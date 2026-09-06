"""Build only the authorized Xiaoma knowledge archive. Never run archived code.
Run from the repository root inside the one-shot workflow. Standard library only.
"""
from __future__ import annotations
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone

REPO = 'haihao0307/guilin-dem-pipeline'
BRANCH = 'handoff/xiaoma-mentor-v1.1-20260905'
DOC = 'docs/mother_coordination/knowledgebase-v1.2-20260906'
PREFIX = 'docs/mother_coordination/'
TAG = 'xiaoma-knowledge-v1.2-20260906'
NAME = 'Xiaoma_Knowledge_Full_V1.2_2026-09-06'
MEETING = 'XIAOMA-KB-MEETING-20260906-01'
OPEN_COMMENT = 5557214211
SITES = [(REPO,62),(REPO,61),('haihao0307/HOUSE',16),('haihao0307/AIRCRAFT',15),
         ('haihao0307/Humanoid-Rig-Lab-Next',1),('haihao0307/Three.js',2)]
MAX_BYTES = 256 * 1024 * 1024
TOKEN = os.environ['GH_TOKEN']
SHA = os.environ['GITHUB_SHA']

def now():
    return datetime.now(timezone.utc).isoformat()

def digest(b):
    return hashlib.sha256(b).hexdigest()

def enc(obj):
    return (json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False)+'\n').encode()

def request(url, data=None, content_type='application/json', auth=True):
    host=urllib.parse.urlsplit(url).hostname
    headers={'User-Agent':'Xiaoma-Knowledge-Archive/1.2'}
    if auth:
        if host not in {'api.github.com','uploads.github.com'}:
            raise ValueError('Refusing to send GitHub credential to another host')
        headers.update({'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json',
                        'X-GitHub-Api-Version':'2022-11-28'})
    if data is not None: headers['Content-Type']=content_type
    req=urllib.request.Request(url,data=data,headers=headers)
    with urllib.request.urlopen(req,timeout=90) as res:
        body=res.read(MAX_BYTES+1)
        if len(body)>MAX_BYTES: raise ValueError('Response exceeds archive budget')
        return body, res.status

def api(path, obj=None):
    return json.loads(request('https://api.github.com'+path,None if obj is None else enc(obj))[0])

def safe_name(path):
    p=PurePosixPath(path)
    if p.is_absolute() or '..' in p.parts or '\\' in path or not p.parts:
        raise ValueError('Unsafe package path')
    return p.as_posix()

def redact(text):
    # Keep complete discussion text except bearer/share tokens.
    text=re.sub(r'([?&](?:xsec_token|access_token|auth_token)=)[^\s&<>"\\]+',r'\1[REDACTED]',text)
    text=re.sub(r'\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_-]+)\b','[REDACTED_CREDENTIAL]',text)
    return text

VERIFY = '''from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent
manifest=json.loads((root/'MANIFEST.json').read_text(encoding='utf8'))
expected={x['path'] for x in manifest['files']}
actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
allowed=expected|{'MANIFEST.json','SHA256SUMS'}
if actual != allowed: raise SystemExit('File set mismatch: '+str(actual ^ allowed))
for item in manifest['files']:
 p=root/item['path']; b=p.read_bytes()
 if len(b)!=item['bytes'] or hashlib.sha256(b).hexdigest()!=item['sha256']:
  raise SystemExit('Mismatch: '+item['path'])
print('Verified',len(expected),'payload files. Integrity only; no archived program executed.')
'''

def build():
    start=now()
    if not re.fullmatch('[0-9a-f]{40}',SHA): raise ValueError('Invalid source commit')
    payload={}
    source_files=[]
    output_dir=DOC+'/publication/'
    raw=subprocess.check_output(['git','ls-tree','-r','-z',SHA,'--','docs/mother_coordination','AGENTS.md','knowledge/PUBLIC_WEB_DELIVERY_GATE.md'])
    for row in raw.split(b'\0'):
        if not row: continue
        info,pbytes=row.split(b'\t',1)
        mode,kind,blob=info.decode().split()
        path=safe_name(pbytes.decode())
        if path.startswith(output_dir): continue
        if kind!='blob' or mode not in {'100644','100755'}: raise ValueError('Unsupported source entry: '+path)
        b=subprocess.check_output(['git','cat-file','blob',blob])
        if b.startswith(b'version https://git-lfs.github.com/spec/v1'):
            raise ValueError('Unresolved LFS pointer: '+path)
        computed=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
        if computed!=blob: raise ValueError('Git identity mismatch: '+path)
        payload['repo/'+path]=b
        source_files.append({'path':path,'gitBlobSha':blob,'bytes':len(b)})
    required=['DISTILLATION_CORE.md','TERRAIN_CORE.md','WORLD_CONSENSUS.md','FUNCTION_LESSON_01.md','FUNCTION_APPLICATION_MAP.md']
    for n in required:
        if 'repo/'+PREFIX+'learning-r1-20260905/'+n not in payload: raise ValueError('Missing core: '+n)
    original=PREFIX+'mentor-v1.1/full-handoff-v1.1.1/Mother_System_Xiaoma_Full_Handoff_V1.1.1_2026-09-05.zip'
    if 'repo/'+original not in payload: raise ValueError('Original handoff archive missing')
    if sum(map(len,payload.values()))>MAX_BYTES: raise ValueError('Archive budget exceeded')

    invitation=api('/repos/'+REPO+'/issues/comments/'+str(OPEN_COMMENT))
    invited_at=invitation['created_at']
    captures=[]; new_replies=[]; stored={}
    for repo,number in SITES:
        rows=[]; page=1
        while True:
            batch=api(f'/repos/{repo}/issues/{number}/comments?per_page=100&page={page}')
            if not isinstance(batch,list): raise ValueError('Bad discussion payload')
            for c in batch:
                body=redact(c.get('body') or '')
                d={'id':c['id'],'url':c['html_url'],'createdAt':c['created_at'],
                   'updatedAt':c['updated_at'],'authorLogin':(c.get('user') or {}).get('login'),
                   'body':body,'redacted':body!=(c.get('body') or '')}
                rows.append(d)
                if c['created_at']>=invited_at and body.lstrip().startswith('XIAOMA_KB_MEETING_01_REPLY'):
                    new_replies.append({'repo':repo,'issue':number,'id':c['id'],'url':c['html_url'],
                                        'verification':'candidate_reply_not_independently_reviewed'})
            if len(batch)<100: break
            page+=1
            if page>20: raise ValueError('Discussion page budget exceeded; do not silently truncate')
        key=repo.replace('/','__')+'__'+str(number)
        cap={'repository':repo,'issue':number,'capturedAt':now(),'completePagination':True,'comments':rows}
        captures.append({'repository':repo,'issue':number,'comments':len(rows),'pages':page,'capturedAt':cap['capturedAt']})
        jb=enc(cap); stored[key+'.json']=jb; payload['meeting/'+key+'.json']=jb
        md=['# '+repo+' #'+str(number),'','本文件保存实际返回的评论正文；旧评论属于会前资料，不等于本次会议发言。','']
        for c in rows:
            md+=['## '+str(c['id'])+' | '+c['createdAt'],c['url'],'',c['body'],'']
        mb=('\n'.join(md)+'\n').encode(); stored[key+'.md']=mb; payload['meeting/'+key+'.md']=mb
    meeting={'meetingId':MEETING,'invitationUrl':invitation['html_url'],'invitedAt':invited_at,
             'captureStartedAt':start,'captureFinishedAt':now(),'captures':captures,
             'newReplyCandidates':new_replies,'newReplyCandidateCount':len(new_replies),
             'status':'responses_received_pending_review' if new_replies else 'open_waiting',
             'allManagersParticipated':False,'consensusApproved':False,
             'oldReportsCountAsMeetingAttendance':False,
             'notAChatSessionWakeup':True,
             'note':'Issue snapshots are captured sequentially and may reflect different fetch times. Candidates require coordinator review.'}
    payload['meeting/MEETING_STATUS.json']=enc(meeting)
    payload['SOURCE_SNAPSHOT.json']=enc({'repository':REPO,'sourceCommit':SHA,'branch':BRANCH,
      'scope':'All tracked docs/mother_coordination plus AGENTS and existing publication gate; publication outputs excluded',
      'files':source_files,'originalPayloadsBytePreserved':True,'testProgramsExecuted':False})
    payload['CONVERSATION.md']=payload['repo/'+DOC+'/CONVERSATION.md']
    payload['verify_package.py']=VERIFY.encode()
    payload['START_HERE.md']=('''# 小妈知识库 V1.2 全量快照

先运行 `python verify_package.py` 检查全部载荷，再读根目录CONVERSATION.md。
详细接续说明在 repo/docs/mother_coordination/knowledgebase-v1.2-20260906/START_HERE.md。
当前函数应用和技能原文在 repo/docs/mother_coordination/learning-r1-20260905/。
原V1.1.1交接ZIP和展开材料保留在 repo/docs/mother_coordination/mentor-v1.1/。
会议真实状态和原始评论在 meeting/。未回复不代签，历史答卷不当本次发言。

本包完整覆盖选定的小妈知识目录，不是所有生产仓库/DEM/历史聊天的全集。
对话是33组主题的完整整理版，非平台逐字导出。15张当前会话PNG在本地补充包，未进入此远端ZIP；索引见LOCAL_IMAGE_INVENTORY.json。
Make能力测试失败后已关闭，未启用定时自主研究。原有软件测试的历史结果不等于本次重跑。
发布与下载哈希回读结果在仓库同版本目录的publication/PUBLISHED.json，本包内不预写未发生的发布成功。
''').encode()
    manifest={'schemaVersion':1,'name':NAME,'createdAt':now(),'sourceCommit':SHA,
              'meetingStatus':meeting['status'],'scopeComplete':True,'rawConversationExport':False,
              'currentConversationPngOriginalsIncluded':False,
              'files':[{'path':k,'bytes':len(v),'sha256':digest(v)} for k,v in sorted(payload.items())],
              'excludedSelfFiles':['MANIFEST.json','SHA256SUMS']}
    payload['MANIFEST.json']=enc(manifest)
    payload['SHA256SUMS']=(''.join(x['sha256']+'  '+x['path']+'\n' for x in manifest['files'])).encode()
    if len(payload)>10000 or sum(map(len,payload.values()))>MAX_BYTES: raise ValueError('Payload limit')
    tmp=Path(tempfile.mkdtemp(prefix='xiaoma-knowledge-'))
    package=tmp/NAME
    for k,b in payload.items():
        target=package/safe_name(k); target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(b)
    subprocess.run(['python3','-I',str(package/'verify_package.py')],check=True)
    archive=tmp/(NAME+'.zip')
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for k in sorted(payload): z.write(package/k,NAME+'/'+k)
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None: raise ValueError('ZIP CRC failure')
        if len(z.namelist())!=len(payload): raise ValueError('ZIP member count failure')
        for k,b in payload.items():
            if digest(z.read(NAME+'/'+k))!=digest(b): raise ValueError('ZIP byte mismatch: '+k)
    archive_bytes=archive.read_bytes(); sha256=digest(archive_bytes)
    checksum=(sha256+'  '+archive.name+'\n').encode()
    release=api('/repos/'+REPO+'/releases',{'tag_name':TAG,'target_commitish':SHA,
       'name':'小妈知识库 V1.2 | 对话、函数技能与经理交流快照',
       'body':f'用户授权的小妈知识库全量快照。源提交 `{SHA}`。\n\n包含全部选定知识目录、原交接包、33组主题对话整理、技能与测试源码、六个Issue分页交流快照和逐项校验。\n\n会议状态 `{meeting["status"]}`，新候选回复 {len(new_replies)}，不代表全体参会或理解通过。对话为整理版。当前15张PNG原件在本地补充包，未包含在本远端ZIP。Make自动研究尚未启动。\n\nZIP SHA256: `{sha256}`。这是知识归档，不是生产产品发布。',
       'draft':False,'prerelease':True,'make_latest':'false'})
    upload_url=release['upload_url'].split('{',1)[0]
    def upload(name,data,mime):
        return json.loads(request(upload_url+'?'+urllib.parse.urlencode({'name':name}),data,mime)[0])
    asset=upload(archive.name,archive_bytes,'application/zip')
    upload('SHA256SUMS.txt',checksum,'text/plain')
    upload('CONVERSATION.md',payload['CONVERSATION.md'],'text/markdown')
    fetched=None; status=None
    for attempt in range(6):
        try:
            fetched,status=request(asset['browser_download_url'],auth=False)
            if status==200 and digest(fetched)==sha256: break
        except urllib.error.URLError:
            pass
        time.sleep(3)
    if status!=200 or fetched is None or digest(fetched)!=sha256:
        raise ValueError('Release uploaded but public byte readback not verified')
    with zipfile.ZipFile(io.BytesIO(fetched)) as z:
        if z.testzip() is not None: raise ValueError('Remote archive CRC failure')
        for x in manifest['files']:
            if digest(z.read(NAME+'/'+x['path']))!=x['sha256']:
                raise ValueError('Remote payload hash mismatch')
    receipt={'schemaVersion':1,'verifiedAt':now(),'repository':REPO,'branch':BRANCH,
      'sourceCommit':SHA,'releaseId':release['id'],'releaseUrl':release['html_url'],
      'tag':TAG,'archiveName':archive.name,'archiveBytes':len(archive_bytes),'archiveSha256':sha256,
      'assetId':asset['id'],'downloadUrl':asset['browser_download_url'],
      'publicHttpStatus':status,'remoteArchiveByteEquality':True,'remotePayloadHashesVerified':True,
      'selectedSourceFiles':len(source_files),'payloadFiles':len(manifest['files']),'zipMembers':len(payload),
      'meeting':meeting,'dialogueOrganizedGroups':33,'rawConversationExport':False,
      'currentConversationPngOriginalsIncluded':False,'pngSupplementCount':15,
      'autonomousResearchEnabled':False,'productionCodeChanged':False,'mainBranchChanged':False,
      'archiveIntegrityOnly':True,'archivedTestsRerun':False}
    pub=Path(DOC)/'publication'; pub.mkdir(parents=True,exist_ok=True)
    (pub/'PUBLISHED.json').write_bytes(enc(receipt))
    (pub/'MEETING_STATUS.json').write_bytes(enc(meeting))
    for name,b in stored.items():
        target=pub/'meeting'/name; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(b)
    (pub/'MANIFEST.json').write_bytes(enc(manifest))
    subprocess.run(['git','config','user.name','Xiaoma Knowledge Archive'],check=True)
    subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
    subprocess.run(['git','-c','core.hooksPath=/dev/null','add','--',str(pub)],check=True)
    subprocess.run(['git','-c','core.hooksPath=/dev/null','commit','-m','docs(xiaoma): verified full knowledge archive and real meeting snapshot [skip ci]'],check=True)
    subprocess.run(['git','push','origin','HEAD:refs/heads/'+BRANCH],check=True)
    print('PUBLICATION_RECEIPT_BEGIN')
    print(json.dumps({k:v for k,v in receipt.items() if k!='meeting'},ensure_ascii=True))
    print('MEETING_STATUS '+json.dumps(meeting,ensure_ascii=True))
    print('PUBLICATION_RECEIPT_END')

if __name__=='__main__':
    build()
