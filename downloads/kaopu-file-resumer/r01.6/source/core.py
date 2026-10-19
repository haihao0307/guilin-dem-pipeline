"""Safe queued range downloader. Standard library; URLs protected by Windows DPAPI."""
import copy, base64, ctypes, hashlib, http.client, json, os, queue, re, shutil, socket, ssl
import threading, time, urllib.error, urllib.request, uuid, zipfile
from pathlib import Path
from urllib.parse import urlsplit, unquote

CHUNK = 1024 * 1024
class SafetyPause(Exception):
    def __init__(self, message, kind='safety_check'):
        super().__init__(message)
        self.kind = kind
class UserPause(Exception): pass
class Transient(Exception):
    def __init__(self, kind='network'):
        super().__init__(kind)
        self.kind = kind

def transport_failure(exc):
    # Only a verification failure is a certificate error; EOF/protocol failures
    # still use the normal validating HTTPS opener on every subsequent attempt.
    if isinstance(exc, ssl.SSLCertVerificationError):
        return Transient('tls_certificate')
    if isinstance(exc, ssl.SSLError):
        return Transient('tls_handshake')
    return Transient('network')

def retry_delay(kind, failures, watchdog=600):
    if kind == 'tls_certificate':
        return min(600, 60 * 2 ** min(max(0, failures - 1), 4))
    return min(300, 2 ** min(failures, 8)) if failures <= 8 else max(60, watchdog)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafetyPause('下载地址发生重定向：请在浏览器确认后更新最终下载链接。')

def parse_url(value, allow_local=False):
    value=value.strip()
    try:
        p=urlsplit(value)
        if p.username or p.password or p.fragment or not p.hostname or any(c.isspace() for c in value): raise ValueError()
        if p.scheme!='https' and not (allow_local and p.scheme=='http' and p.hostname in ('127.0.0.1','localhost')): raise ValueError()
        _=p.port
    except ValueError: raise SafetyPause('仅接受完整 HTTPS 下载链接，不接受内嵌账号密码。') from None
    return value

def resource_key(url):
    p=urlsplit(url)
    return hashlib.sha256((p.scheme+"://"+p.netloc+p.path).encode()).hexdigest()

def filename(url):
    s=unquote(urlsplit(url).path.rsplit('/',1)[-1])
    s=re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_',s).strip(' .')[:160] or 'download.bin'
    if s.split('.')[0].upper() in {'CON','PRN','AUX','NUL',*(f'COM{i}' for i in range(10)),*(f'LPT{i}' for i in range(10))}: s='_'+s
    return s

def atomic_json(path,data):
    tmp=path.with_suffix(path.suffix+'.tmp')
    with tmp.open('w',encoding='utf-8') as f:
        json.dump(data,f,ensure_ascii=False); f.flush(); os.fsync(f.fileno())
    os.replace(tmp,path)

def protect(value, decrypt=False):
    if os.name!='nt': return '' # Never persist signed URLs unencrypted on unsupported systems.
    from ctypes import wintypes
    class Blob(ctypes.Structure): _fields_=[('cbData',wintypes.DWORD),('pbData',ctypes.POINTER(ctypes.c_ubyte))]
    raw=base64.b64decode(value) if decrypt else value.encode('utf-8')
    buf=ctypes.create_string_buffer(raw); src=Blob(len(raw),ctypes.cast(buf,ctypes.POINTER(ctypes.c_ubyte))); dst=Blob()
    fn=ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    fn.argtypes=[ctypes.POINTER(Blob),ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,wintypes.DWORD,ctypes.POINTER(Blob)]
    fn.restype=wintypes.BOOL
    if not fn(ctypes.byref(src),None,None,None,None,1,ctypes.byref(dst)): raise SafetyPause('Windows 无法保护/读取下载链接；请重新粘贴。')
    try:
        out=ctypes.string_at(dst.pbData,dst.cbData)
        return out.decode('utf-8') if decrypt else base64.b64encode(out).decode('ascii')
    finally:
        ctypes.windll.kernel32.LocalFree.argtypes=[ctypes.c_void_p]
        ctypes.windll.kernel32.LocalFree(ctypes.cast(dst.pbData,ctypes.c_void_p))

def digest(path,start,length,stop=lambda:False):
    h=hashlib.sha256()
    with path.open('rb') as f:
        f.seek(start)
        while length:
            if stop(): raise UserPause()
            b=f.read(min(CHUNK,length))
            if not b: raise SafetyPause('工作文件短于检查点，保留现场。')
            h.update(b); length-=len(b)
    return h.hexdigest()

class Engine:
    def __init__(self,root_dir,event_callback=lambda e:None,allow_local=False):
        self.root=Path(root_dir); self.root.mkdir(parents=True,exist_ok=True)
        self.callback=event_callback; self.allow_local=allow_local; self.lock=threading.RLock()
        self.tasks={}; self.urls={}; self.threads={}; self.importing=set(); self.closed=False; self.concurrency=3; self.watchdog_seconds=600
        self.state=self.root/'queue.json'; self.instance=(self.root/'instance.lock').open('a+b')
        # OS-held lock releases after crash. Never start a second writer for this queue.
        try:
            if os.name=='nt':
                import msvcrt
                self.instance.seek(0); self.instance.write(b'0'); self.instance.flush(); self.instance.seek(0)
                msvcrt.locking(self.instance.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(self.instance.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError: raise SafetyPause('靠谱文件续传器已在运行，请使用现有窗口。') from None
        if self.state.exists():
            data=json.loads(self.state.read_text(encoding='utf-8'))
            if data.get('version') not in (1,2): raise SafetyPause('队列版本不匹配；未修改原队列。')
            if data.get('version') == 1:
                # Preserve the exact old queue before any migration or worker starts.
                backup = self.root / ('queue.r01.3-backup-' + uuid.uuid4().hex + '.json')
                with backup.open('xb') as f:
                    f.write(self.state.read_bytes()); f.flush(); os.fsync(f.fileno())
            self.concurrency=max(1,min(6,int(data.get('concurrency',3))))
            self.watchdog_seconds=data.get('watchdog_seconds',600)
            used_colors = set()
            for t in data['tasks']:
                color = t.get('color_index')
                if type(color) is not int or color < 0 or color in used_colors:
                    color = max(used_colors, default=-1) + 1
                t['color_index'] = color
                used_colors.add(color)
                self.tasks[t['id']]=t
                try:
                    u=protect(t.get('url_sealed',''),True) if t.get('url_sealed') else ''
                    if u:self.urls[t['id']]=parse_url(u,allow_local)
                except Exception: pass
                t.setdefault('pause_reason', {'paused':'manual', 'attention':'safety_check', 'archived':'archived'}.get(t['status'], ''))
                t.setdefault('error_kind', '')
                # Only exact known old certificate messages are eligible. Never
                # reinterpret arbitrary attention/auth/integrity states as network.
                legacy_tls = t['status'] == 'attention' and t.get('message') in (
                    'TLS证书验证失败；没有绕过安全警告。', 'TLS证书验证失败。')
                if legacy_tls:
                    t['error_kind'] = 'tls_certificate'
                    t['pause_reason'] = 'tls_certificate'
                    t['retry_at'] = time.time() + 60
                    t['status'] = 'retry'
                    t['message'] = '证书验证未通过；60秒后严格TLS重检，不绕过验证。'
                if t['status'] not in ('complete', 'paused', 'attention', 'archived'):
                    if t['id'] not in self.urls:
                        t['status'] = 'attention'; t['pause_reason'] = 'missing_url'
                        t['message'] = '请更新下载链接；原进度保留。'
                    elif t['status'] != 'retry':
                        t['status'] = 'queued'; t['retry_at'] = 0
                        t['message'] = '重启后将校验检查点并继续。'
                t['speed'] = 0
        self.scheduler=threading.Thread(target=self._schedule,daemon=True); self.scheduler.start()
    def emit(self,t=None,message=None):
        try:self.callback({'kind':'update','task':dict(t)} if t else {'kind':'log','message':message})
        except Exception: pass
    def save(self):
        with self.lock: atomic_json(self.state,{'version':2,'concurrency':self.concurrency,'watchdog_seconds':self.watchdog_seconds,'tasks':list(self.tasks.values())})
    def set_concurrency(self,n):
        with self.lock:self.concurrency=max(1,min(6,int(n)));self.save()
    def _new(self,url,output_dir):
        tid=uuid.uuid4().hex; folder=Path(output_dir).resolve()/('靠谱下载-'+tid[:8]); folder.mkdir(parents=True)
        color_index=max((t.get('color_index', -1) for t in self.tasks.values()), default=-1)+1
        t=dict(id=tid,color_index=color_index,name=filename(url),status='queued',offset=0,total=None,speed=0,message='等待下载',folder=str(folder),etag=None,chunks=[],failures=0,retry_at=0,pause_reason='',error_kind='',url_sealed=protect(url),source_hash=hashlib.sha256(url.encode()).hexdigest(),resource_key=resource_key(url),origin=urlsplit(url).scheme+'://'+urlsplit(url).netloc)
        self.tasks[tid]=t;self.urls[tid]=url; return t
    def add_urls(self,text,output_dir):
        values=text.split(); accepted=[]
        # Validate batch before creating anything.
        for u in values: parse_url(u,self.allow_local)
        with self.lock:
            for u in values:
                h=hashlib.sha256(u.encode()).hexdigest()
                if any(t['source_hash']==h for t in self.tasks.values()):continue
                t=self._new(u,output_dir);accepted.append(t['id']);self.emit(t)
            self.save()
        return accepted
    def pause(self,tid):
        with self.lock:
            t=self.tasks[tid]
            if t['status'] in ('complete','archived'):return
            t['status']='paused';t['pause_reason']='manual';t['retry_at']=0;t['speed']=0;t['message']='手动暂停；不会自动重启。';self.save();self.emit(t)
    def resume(self,tid):
        with self.lock:
            t=self.tasks[tid]
            if t['status'] in ('complete','archived'):return
            if tid not in self.urls:raise SafetyPause('请先更新下载链接。')
            t['status']='queued';t['pause_reason']='';t['error_kind']='';t['message']='等待校验后继续';t['retry_at']=0;t['failures']=0;self.save();self.emit(t)
    def update_url(self,tid,url):
        url=parse_url(url,self.allow_local)
        with self.lock:
            t=self.tasks[tid]
            if t['status']=='archived':raise SafetyPause('请先从已移出列表恢复任务。')
            if tid in self.threads or tid in self.importing:raise SafetyPause('请先暂停并等待当前连接结束，再更新链接。')
            if t['status']=='complete':raise SafetyPause('此任务已完成。新文件请添加新任务。')
            if t.get('resource_key')!=resource_key(url):raise SafetyPause('更新链接必须是同一站点同一路径（可更新查询密钥）；其他文件请另建任务。')
            self.urls[tid]=url;t['url_sealed']=protect(url);t['source_hash']=hashlib.sha256(url.encode()).hexdigest();t['origin']=urlsplit(url).scheme+'://'+urlsplit(url).netloc
            t['status']='queued';t['pause_reason']='';t['error_kind']='';t['retry_at']=0;self.save();self.emit(t)
    def archive_tasks(self, tids):
        """Hide stopped tasks only. Never touch payloads or cancel active writers."""
        archived, busy = [], []
        with self.lock:
            before = {}
            for tid in dict.fromkeys(tids):
                t = self.tasks.get(tid)
                if not t or t['status'] == 'archived':
                    continue
                # Even a paused/complete task can still have a live worker unwinding.
                if tid in self.threads or tid in self.importing:
                    busy.append(tid)
                    continue
                before[tid] = copy.deepcopy(t)
                t['archive_previous_status'] = t['status']
                t['archived_at'] = time.time()
                t['archive_previous_pause_reason'] = t.get('pause_reason', '')
                t['pause_reason'] = 'archived'
                t['status'] = 'archived'
                t['speed'] = 0
                t['message'] = '已移出列表；文件和检查点保留，可恢复。'
                archived.append(tid)
            try:
                self.save()
            except Exception:
                for tid, snapshot in before.items():
                    self.tasks[tid].clear(); self.tasks[tid].update(snapshot)
                raise
            for tid in archived:
                self.emit(self.tasks[tid])
        return archived, busy

    def restore_tasks(self, tids):
        """Restore identity/progress; incomplete tasks require an explicit resume."""
        restored = []
        with self.lock:
            before = {}
            for tid in dict.fromkeys(tids):
                t = self.tasks.get(tid)
                if not t or t['status'] != 'archived':
                    continue
                if tid in self.threads or tid in self.importing:
                    continue
                before[tid] = copy.deepcopy(t)
                previous = t.pop('archive_previous_status', 'paused')
                t.pop('archived_at', None)
                t.pop('archive_previous_pause_reason', None)
                t['pause_reason'] = '' if previous == 'complete' else 'restored'
                t['status'] = 'complete' if previous == 'complete' else 'paused'
                t['speed'] = 0
                t['retry_at'] = 0
                t['message'] = '已恢复；文件和检查点保留。' if previous == 'complete' else '已恢复并保持暂停；请手动继续，必要时更新链接。'
                restored.append(tid)
            try:
                self.save()
            except Exception:
                for tid, snapshot in before.items():
                    self.tasks[tid].clear(); self.tasks[tid].update(snapshot)
                raise
            for tid in restored:
                self.emit(self.tasks[tid])
        return restored

    def close(self):
        self.closed=True
        self.scheduler.join(timeout=2)
        for th in list(self.threads.values()):th.join(timeout=25)
        self.save()
        if not any(th.is_alive() for th in self.threads.values()):self.instance.close()
    def _stopped(self,t):return self.closed or t['status'] in ('paused','attention','archived')
    def _schedule(self):
        while not self.closed:
            with self.lock:
                for tid,th in list(self.threads.items()):
                    if not th.is_alive():del self.threads[tid]
                for tid,t in list(self.tasks.items()):
                    if len(self.threads)>=self.concurrency:break
                    if tid not in self.threads and t['status'] in ('queued','retry') and t.get('retry_at',0)<=time.time():
                        th=threading.Thread(target=self._run,args=(t,),daemon=True);self.threads[tid]=th;th.start()
            time.sleep(.15)
    def _paths(self,t):
        d=Path(t['folder'])
        if d.is_symlink():raise SafetyPause('工作目录不能是符号链接。')
        part=d/'payload.part';final=d/t['name']
        if part.is_symlink() or final.is_symlink():raise SafetyPause('工作文件不能是符号链接。')
        return part,final
    def _verify_local(self,t):
        part,final=self._paths(t)
        if not part.exists():
            if t['offset']==t['total'] and final.exists():
                # Crash after final rename: verify final rather than replace it.
                part=final
            elif t['offset']:raise SafetyPause('工作文件缺失；未从头重下。')
            else:part.touch(exist_ok=False)
        offset=0
        for c in t['chunks']:
            if c['start']!=offset or c['length']<=0:raise SafetyPause('检查点区间错误。')
            if digest(part,offset,c['length'],lambda:self._stopped(t))!=c['sha256']:raise SafetyPause('工作文件校验失败；保留现场，不追加。', 'integrity')
            offset+=c['length']
        if offset!=t['offset'] or part.stat().st_size<offset:raise SafetyPause('检查点长度不一致。', 'integrity')
        if part.stat().st_size>offset:
            if part==final:raise SafetyPause('最终文件长度异常。')
            with part.open('r+b') as f:f.truncate(offset)
        return part,final
    def _fetch(self,t,start,end):
        if self._stopped(t):raise UserPause()
        headers={'Range':f'bytes={start}-{end}','Accept-Encoding':'identity','User-Agent':'KaopuFileResumer/1.0'}
        if t['etag']:headers['If-Range']=t['etag']
        req=urllib.request.Request(self.urls[t['id']],headers=headers)
        try:
            with urllib.request.build_opener(NoRedirect()).open(req,timeout=20) as r:
                if r.status!=206:raise SafetyPause('服务器未返回206分段数据；没有追加200整包响应。')
                etag=r.headers.get('ETag','')
                if not etag.startswith('"') or not etag.endswith('"') or etag.startswith('W/'):raise SafetyPause('源站缺少强ETag，不能安全自动续传。')
                if t['etag'] and etag!=t['etag']:raise SafetyPause('文件身份ETag已改变：旧进度隔离保留，请另建任务。', 'source_identity')
                cr=re.fullmatch(r'bytes (\d+)-(\d+)/(\d+)',r.headers.get('Content-Range',''))
                if not cr:raise SafetyPause('Content-Range缺失或格式错误。')
                a,b,total=map(int,cr.groups())
                if a!=start or b!=min(end,total-1) or b<a or total<=0 or (t['total'] is not None and t['total']!=total):raise SafetyPause('服务器区间/总大小改变，停止追加。', 'source_identity')
                size=b-a+1
                if r.headers.get('Content-Length')!=str(size) or r.headers.get('Content-Encoding','identity').lower()!='identity':raise SafetyPause('服务器长度或编码不一致。')
                if any(x in r.headers.get('Content-Type','').lower() for x in ('text/html','application/xhtml')):raise SafetyPause('源站返回登录/验证网页，请在浏览器完成后更新下载地址。', 'authentication')
                if t['etag'] is None:
                    with self.lock:t['etag']=etag;t['total']=total;self.save()
                data=bytearray();started=time.monotonic();last=started;last_emit=started
                while len(data)<size:
                    if self._stopped(t):raise UserPause()
                    if time.monotonic()-last>self.watchdog_seconds:raise Transient()
                    block=r.read1(min(64*1024,size-len(data)))
                    if not block:raise Transient()
                    if self._stopped(t):raise UserPause()
                    data.extend(block);last=time.monotonic();t['speed']=len(data)/max(.001,last-started)
                    t['message']=f'接收中（本块 {len(data):,} 字节尚未提交）'
                    if last-last_emit>=.25 or len(data)==size:
                        self.emit(t);last_emit=last
                return bytes(data)
        except urllib.error.HTTPError as e:
            if e.code in (408,429,500,502,503,504):raise Transient() from None
            raise SafetyPause(f'HTTP {e.code}：需检查链接/登录/权限；不会自动点击验证。', 'authentication' if e.code in (401,403,407) else 'http_attention') from None
        except urllib.error.URLError as e:
            raise transport_failure(e.reason) from None
        except (TimeoutError,ConnectionError,http.client.IncompleteRead,socket.timeout):raise Transient() from None
        except ssl.SSLError as e:raise transport_failure(e) from None
    def _finish(self,t,part,final):
        with self.lock:
            if self._stopped(t):raise UserPause()
            t['status']='verifying';t['speed']=0;t['message']='完整性校验中';self.emit(t)
        if part.stat().st_size!=t['total']:raise SafetyPause('最终长度不一致。', 'integrity')
        # A ZIP name must parse as ZIP; ZIP signatures without extension are checked too.
        if t['name'].lower().endswith('.zip') or zipfile.is_zipfile(part):
            try:
                with zipfile.ZipFile(part) as z:
                    for info in z.infolist():
                        if self._stopped(t):raise UserPause()
                        with z.open(info) as f:
                            while f.read(CHUNK):
                                if self._stopped(t):raise UserPause()
            except (zipfile.BadZipFile,RuntimeError,NotImplementedError,EOFError):raise SafetyPause('ZIP完整CRC校验失败；保留文件，不自动重下。', 'integrity') from None
            verified='ZIP全部条目CRC通过'
        else:verified='长度与本地块SHA256核验完成（非源站签名验证）'
        # Recheck all chunks including imported prefix before publishing final file.
        for c in t['chunks']:
            if digest(part,c['start'],c['length'],lambda:self._stopped(t))!=c['sha256']:raise SafetyPause('最终数据块校验失败。', 'integrity')
        with self.lock:
            if self._stopped(t):raise UserPause()
            if part!=final:
                if final.exists():raise SafetyPause('已有同名最终文件，不覆盖。')
                # Hard link is atomic and refuses overwrite on Windows/Unix; same directory.
                try:os.link(part,final)
                except OSError:
                    if os.name=='nt':part.rename(final)
                    else:raise SafetyPause('无法安全发布最终文件，保留完整工作文件。') from None
                else:part.unlink()
            t['status']='complete';t['pause_reason']='';t['error_kind']='';t['retry_at']=0;t['message']=verified;t['speed']=0;self.save();self.emit(t)
    def _run(self,t):
        try:
            with self.lock:
                if self._stopped(t):return
                t['status']='checking';t['message']='核验已有检查点';self.emit(t)
            part,final=self._verify_local(t)
            while t['total'] is None or t['offset']<t['total']:
                with self.lock:
                    if self._stopped(t):raise UserPause()
                    t['status']='downloading';start=t['offset'];end=start+CHUNK-1
                payload=self._fetch(t,start,end)
                with self.lock:
                    if self._stopped(t):raise UserPause()
                    with part.open('r+b') as f:
                        if f.seek(0,2)!=start:raise SafetyPause('文件被外部改动，停止。', 'integrity')
                        f.write(payload);f.flush();os.fsync(f.fileno())
                    t['chunks'].append(dict(start=start,length=len(payload),sha256=hashlib.sha256(payload).hexdigest()))
                    t['offset']+=len(payload);t['failures']=0;t['pause_reason']='';t['error_kind']='';t['message']='数据块已提交';self.save();self.emit(t)
            self._finish(t,part,final)
        except UserPause:pass
        except Transient as e:
            with self.lock:
                if not self._stopped(t):
                    t['failures']+=1
                    delay=retry_delay(e.kind,t['failures'],self.watchdog_seconds)
                    t['error_kind']=e.kind;t['pause_reason']=e.kind
                    label={'tls_certificate':'证书验证未通过；严格TLS重检（不绕过验证）',
                           'tls_handshake':'TLS连接/握手中断；重新严格验证',
                           'network':'网络连接中断'}.get(e.kind,'连接中断')
                    t['retry_at']=time.time()+delay;t['status']='retry';t['speed']=0
                    t['message']=f'{label}；{delay}秒后自动重试（保留检查点）'
                    self.save();self.emit(t)
        except Exception as e:
            with self.lock:
                if not self._stopped(t):
                    t['status']='attention';t['error_kind']=e.kind if isinstance(e,SafetyPause) else 'local_io';t['pause_reason']=t['error_kind'];t['retry_at']=0;t['speed']=0;t['message']=str(e) if isinstance(e,SafetyPause) else '本地读写或校验异常（'+type(e).__name__+'）；保留现场。';self.save();self.emit(t)

    def import_legacy(self,directory,urls_text):
        """Copy only explicitly selected old tool checkpoints; never scan browser/private files."""
        source=Path(directory)
        if (source/'恢复工作副本').is_dir():source=source/'恢复工作副本'
        urls={filename(parse_url(u,self.allow_local)):u for u in urls_text.split()}
        expected={'11-NW-25C.zip':(1385396161,'"529377c1-64866a1e8ab99"'),'11-SW-5A.zip':(1873155052,'"6fa613ec-656198d661dbc"')}
        imported=[]
        for name,u in urls.items():
            if name not in expected:raise SafetyPause('旧进度导入仅支持已知两份香港ZIP；其它链接请直接入队。')
            p=urlsplit(u)
            if p.scheme!='https' or p.hostname!='download.map.gov.hk' or p.port not in (None,443) or p.path!='/api/3d-zip/GLTF/'+name:raise SafetyPause('旧检查点只能关联原香港官方对应文件地址。')
            cp=source/(name+'.checkpoint.json')
            if not cp.is_file() or cp.is_symlink():raise SafetyPause('所选目录没有对应旧检查点。')
            data=json.loads(cp.read_text(encoding='utf-8'));size,etag=expected[name]
            if data.get('version')!=1 or data.get('target')!=name or data.get('total')!=size or data.get('etag')!=etag:raise SafetyPause('旧检查点身份不符合原工具记录。')
            old=source/(name+'.recovery.part')
            if not old.exists():old=source/name
            if not old.is_file() or old.is_symlink():raise SafetyPause('旧工作副本缺失或类型错误。')
            chunks=[dict(start=0,length=data['backup_size'],sha256=data['backup_sha256'])]+data['chunks']
            off=0
            for c in chunks:
                if c['start']!=off or c['length']<=0 or digest(old,off,c['length'],lambda:self.closed)!=c['sha256']:raise SafetyPause('旧工作副本哈希不匹配；没有导入。')
                off+=c['length']
            if off!=data['offset'] or off>size:raise SafetyPause('旧检查点长度异常。')
            if shutil.disk_usage(source).free<off+64*1024*1024:raise SafetyPause('空间不足以复制旧工作文件，原文件未动。')
            with self.lock:
                if any(t.get('legacy_source')==str(cp.resolve()) for t in self.tasks.values()):continue
                t=self._new(u,source/'靠谱续传导入');t['status']='paused';self.importing.add(t['id'])
                t.update(total=size,etag=etag,chunks=chunks,offset=off,legacy_source=str(cp.resolve()),message='正在复制已验证旧进度')
                part=Path(t['folder'])/'payload.part'
            try:
                with old.open('rb') as src,part.open('xb') as dst:
                    left=off
                    while left:
                        if self.closed:raise UserPause()
                        b=src.read(min(CHUNK,left))
                        if not b:raise SafetyPause('复制期间旧文件变化。')
                        dst.write(b);left-=len(b)
                    dst.flush();os.fsync(dst.fileno())
                # Worker re-verifies copied bytes before any request; original remains untouched.
                with self.lock:self.importing.discard(t['id']);t['status']='queued';self.save();self.emit(t);imported.append(t['id'])
            except Exception:
                with self.lock:self.importing.discard(t['id']);t['status']='attention';t['message']='导入未完成；原文件未改动';self.save();self.emit(t)
                raise
        return imported
