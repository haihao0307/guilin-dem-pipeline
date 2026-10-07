"""Read existing original files/ZIP without changing them; copy verified subset privately."""
import pathlib,json,hashlib,zipfile,shutil

def import_existing(root,manifest_path,source_root=None,source_zip=None):
    root=pathlib.Path(root);manifest=json.loads(pathlib.Path(manifest_path).read_text(encoding='utf-8'))
    selected=[m for m in manifest['files']if m['path'].startswith(('Blender/','Textures/JPG/'))]
    if bool(source_root)==bool(source_zip):raise ValueError('Select exactly one original source folder or ZIP')
    archive=None
    if source_zip:
        archive=zipfile.ZipFile(pathlib.Path(source_zip).expanduser().resolve())
        names=set(archive.namelist())
        prefixes=['']+[n.rsplit('Blender/Blender Scene.blend',1)[0] for n in names if n.endswith('/Blender/Blender Scene.blend')]
        matches=[p for p in prefixes if all(p+m['path']in names for m in selected)]
        if len(matches)!=1:raise ValueError('ZIP must contain exactly one complete original Blender/JPG set')
        prefix=matches[0]
    else:
        source_root=pathlib.Path(source_root).expanduser().resolve()
        if not (source_root/'Blender/Blender Scene.blend').is_file():
            candidates=[p for p in source_root.iterdir()if p.is_dir()and(p/'Blender/Blender Scene.blend').is_file()]if source_root.is_dir()else[]
            if len(candidates)!=1:raise ValueError('Choose the folder directly containing Blender and Textures')
            source_root=candidates[0]
    receipt=[]
    try:
        for item in selected:
            name=item['path'];dest=root/'original'/name;dest.parent.mkdir(parents=True,exist_ok=True)
            if dest.exists():raise FileExistsError('Refusing to overwrite private output')
            src=archive.open(prefix+name)if archive else (source_root/name).open('rb')
            digest=hashlib.sha256();size=0
            with src,open(str(dest)+'.part','xb')as out:
                while True:
                    b=src.read(1024*1024)
                    if not b:break
                    size+=len(b)
                    if size>item['bytes']:raise ValueError('Original size differs: '+name)
                    digest.update(b);out.write(b)
            if size!=item['bytes']or digest.hexdigest()!=item['sha256']:raise ValueError('Original hash differs: '+name+'; source untouched, no substitute used')
            pathlib.Path(str(dest)+'.part').rename(dest);receipt.append({'path':name,'bytes':size,'sha256':digest.hexdigest()});print('Verified existing original:',name,flush=True)
    finally:
        if archive:archive.close()
    (root/'reports'/'source-verification.json').write_text(json.dumps({'scope':'26 original Blender/JPG files, not all 72 archive files','source_mode':'existing ZIP'if source_zip else'existing folder','original_source_modified':False,'archive_sha_verified':False,'files':receipt},indent=2),encoding='utf-8')
    return receipt
