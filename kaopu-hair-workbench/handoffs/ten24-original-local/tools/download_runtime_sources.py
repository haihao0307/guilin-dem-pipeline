"""Retrieve only original Blender and JPG entries using verified HTTP ranges.

No original content is redistributed. Each decoded file must match the existing
72-file original SHA manifest. This does not verify the entire archive SHA.
"""
import io,urllib.request,zipfile,pathlib,json,hashlib,zlib,struct,os
URL='https://samplescan.s3.us-west-2.amazonaws.com/3D_ScanStore_Free+Head.zip'
SIZE=2019571774
class TailArchive(io.RawIOBase):
    def __init__(self,tail):self.tail=tail;self.pos=0;self.start=SIZE-len(tail)
    def seek(self,n,whence=0):
        self.pos=n if whence==0 else self.pos+n if whence==1 else SIZE+n
        return self.pos
    def tell(self):return self.pos
    def read(self,n=-1):
        if self.pos<self.start:raise ValueError('Central directory is outside bounded range')
        n=SIZE-self.pos if n<0 else min(n,SIZE-self.pos)
        out=self.tail[self.pos-self.start:self.pos-self.start+n];self.pos+=len(out);return out
    def seekable(self):return True

def get(a,b):
    req=urllib.request.Request(URL,headers={'Range':f'bytes={a}-{b}'})
    r=urllib.request.urlopen(req,timeout=120)
    if r.status!=206 or r.headers.get('Content-Range')!=f'bytes {a}-{b}/{SIZE}':
        r.close();raise RuntimeError('Server did not honor exact range; stopped without whole ZIP download')
    return r

def download(private_root,manifest_path):
    root=pathlib.Path(private_root);manifest=json.loads(pathlib.Path(manifest_path).read_text(encoding='utf-8'))
    with get(SIZE-131072,SIZE-1) as r:tail=r.read()
    z=zipfile.ZipFile(TailArchive(tail))
    selected=[m for m in manifest['files']if m['path'].startswith(('Blender/','Textures/JPG/'))]
    receipt=[]
    for m in selected:
        name=m['path'];dest=root/'original'/name;dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists():raise FileExistsError('Refusing to overwrite '+str(dest))
        i=z.getinfo(name)
        if i.file_size!=m['bytes'] or i.compress_type not in (0,8):raise ValueError('ZIP entry mismatch '+name)
        with get(i.header_offset,i.header_offset+29)as r:hdr=r.read()
        if hdr[:4]!=b'PK\x03\x04':raise ValueError('Invalid local ZIP header')
        lengths=struct.unpack_from('<HH',hdr,26);start=i.header_offset+30+sum(lengths)
        sha=hashlib.sha256();count=0;d=zlib.decompressobj(-15)if i.compress_type==8 else None
        with get(start,start+i.compress_size-1)as r,open(str(dest)+'.part','xb')as f:
            while True:
                b=r.read(1024*1024)
                if not b:break
                out=d.decompress(b)if d else b;f.write(out);sha.update(out);count+=len(out)
                if count>m['bytes']:raise ValueError('Entry exceeded manifest size')
            if d:
                out=d.flush();f.write(out);sha.update(out);count+=len(out)
        if count!=m['bytes']or sha.hexdigest()!=m['sha256']:raise ValueError('Hash mismatch '+name)
        os.rename(str(dest)+'.part',dest);receipt.append({'path':name,'bytes':count,'sha256':sha.hexdigest()});print('Verified:',name,flush=True)
    (root/'reports'/'source-verification.json').write_text(json.dumps({'scope':'26 original Blender/JPG files, not all 72 archive files','archive_sha_verified':False,'files':receipt},indent=2),encoding='utf-8')
    return receipt
