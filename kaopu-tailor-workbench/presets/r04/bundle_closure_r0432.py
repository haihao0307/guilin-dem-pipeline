"""Reject omitted literal JSON dependencies before publication.
Dynamic JavaScript requests still require actual public-browser verification.
"""
from pathlib import Path
import hashlib,re

def verify_literal_json_closure(root:Path,files:dict)->dict:
    root=Path(root).resolve();rows=[]
    for module in sorted(root.glob('*.mjs')):
        for m in re.finditer(r'''\b(?:fetch|json)\(\s*(['"])([^'"]+\.json)\1''',module.read_text()):
            target=m.group(2)
            if '://' in target or target.startswith('/'):continue
            local=(module.parent/target).resolve()
            if not local.is_relative_to(root):raise AssertionError('JSON_DEPENDENCY_OUTSIDE_BUNDLE: '+target)
            name=str(local.relative_to(root))
            if name not in files:raise AssertionError('JSON_DEPENDENCY_NOT_PUBLISHED: '+name)
            digest=hashlib.sha256(local.read_bytes()).hexdigest()
            if files[name]['sha256']!=digest:raise AssertionError('JSON_DEPENDENCY_HASH_MISMATCH: '+name)
            rows.append({'module':module.name,'path':name,'sha256':digest})
    assert len(rows)>=6 and any(r['path']=='parameter-schema.json'for r in rows)
    return {'schema':'kaopu-literal-json-bundle-closure@1','passed':True,'checked':rows,'scope':'literal JSON requests in top-level module files; dynamic paths still require full public browser testing','doesNotModifyRuntimeFiles':True,'doesNotChangeAnyAcceptanceThreshold':True}

if __name__=='__main__':
    import json,sys
    root=Path(sys.argv[1]).resolve();record=json.loads((root/'R0432_ACCEPTANCE.json').read_text());files=dict(record['files'])
    for name in ['parameter-schema.json','PARAMETER_AUDIT_R043.json']:files[name]={'sha256':hashlib.sha256((root/name).read_bytes()).hexdigest()}
    positive=verify_literal_json_closure(root,files)
    for name in ['parameter-schema.json','PARAMETER_AUDIT_R043.json']:
        omitted=dict(files);omitted.pop(name)
        try:verify_literal_json_closure(root,omitted)
        except AssertionError as e:assert str(e)=='JSON_DEPENDENCY_NOT_PUBLISHED: '+name
        else:raise AssertionError('Missing runtime dependency was not rejected: '+name)
    print('BUNDLE_CLOSURE_PASS',len(positive['checked']),'negative omissions=2',flush=True)
