"""Guarded local source cleanup. No network writes, branch deletion, or broad rm.

Run on a clean Git checkout in the handoff/guilin-canonical-clean-v1 branch.
All baseline hashes are checked before any file is changed.
"""
from __future__ import annotations
import argparse,hashlib,json,shutil,subprocess
from pathlib import Path

def git(root:Path,*args:str)->str:
    return subprocess.check_output(['git','-C',str(root),*args],text=True).strip()

def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()

def inside(root:Path,name:str)->Path:
    rel=Path(name)
    if rel.is_absolute() or '..' in rel.parts:raise ValueError('Unsafe path')
    p=root/rel
    if p.is_symlink() or root.resolve() not in p.resolve().parents:raise ValueError('Unsafe target')
    return p

def main()->int:
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--package',type=Path,required=True)
    ap.add_argument('--checkout',type=Path,required=True);ap.add_argument('--apply',action='store_true');a=ap.parse_args()
    package=a.package.resolve();root=a.checkout.resolve();repo=package/'repo'
    plan=json.loads((package/'handoff/DELETE_PLAN.json').read_text(encoding='utf-8'))
    baseline=json.loads((package/'handoff/SOURCE_BASELINE.json').read_text(encoding='utf-8'))
    if git(root,'rev-parse','--show-toplevel')!=str(root):raise ValueError('Checkout path must be repository root')
    if git(root,'status','--porcelain'):raise ValueError('Checkout must be clean')
    branch=git(root,'branch','--show-current')
    if branch!='handoff/guilin-canonical-clean-v1':raise ValueError('Use the dedicated clean handoff branch')
    origin=git(root,'remote','get-url','origin')
    if 'haihao0307/guilin-dem-pipeline' not in origin:raise ValueError('Unexpected repository origin')
    package_files={str(p.relative_to(repo)).replace('\\','/'):p for p in repo.rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc'}
    known={x['path']:x for x in baseline['files']}
    conflicts=[]
    for name,record in known.items():
        p=inside(root,name);replacement=package_files.get(name)
        if p.exists():
            actual=sha(p)
            if actual!=record['sha256'] and not (replacement and actual==sha(replacement)):conflicts.append(name)
        elif replacement:conflicts.append(name+' missing since baseline')
    for name,p in package_files.items():
        q=inside(root,name)
        if name not in known and q.exists() and sha(q)!=sha(p):conflicts.append(name+' new-file collision')
    if conflicts:raise RuntimeError('Concurrent source changes require review before cleanup:\n'+'\n'.join(conflicts))
    deletions=[x for x in plan['source_delete_files'] if inside(root,x['path']).exists()]
    report={'apply':a.apply,'branch':branch,'source_files_to_copy':len(package_files),
        'source_files_to_delete':[x['path'] for x in deletions],
        'remote_writes':False,'other_projects_and_branches_untouched':True}
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if not a.apply:return 0
    for item in deletions:inside(root,item['path']).unlink()
    for name,p in package_files.items():
        q=inside(root,name);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
    print('Source cleanup applied locally. Inspect git diff before committing. No push was performed.')
    return 0
if __name__=='__main__':raise SystemExit(main())
