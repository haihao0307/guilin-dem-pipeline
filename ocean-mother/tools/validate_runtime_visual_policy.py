#!/usr/bin/env python3
from __future__ import annotations
import json,pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[2]
OCEAN=ROOT/'ocean-mother'
POLICY=OCEAN/'contracts'/'OCEAN_RUNTIME_VISUAL_POLICY.json'
IMAGE_SUFFIXES={'.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff','.avif','.dds','.ktx','.ktx2','.exr','.hdr'}
RUNTIME=re.compile(r'^(?:coast-v\d+|v\d+|nearshore.*|runtime.*|workbench.*)$')
def fail(msg): raise AssertionError(msg)
def main():
    p=json.loads(POLICY.read_text('utf-8'))
    if p.get('status')!='USER_LOCKED': fail('policy status changed')
    r=p['runtimeOutput']
    for k in ('imageGenerationMode','imageDetailEnhancementMode','imageBasedDeliverable','screenshotAsProduct'):
        if r.get(k) is not False: fail(f'{k} must remain false')
    if p['visualDirection'].get('primary')!='photorealistic': fail('photoreal direction changed')
    if p['visualDirection'].get('cartoonStyle')!='deferred_until_explicit_future_user_approval': fail('cartoon style unlocked without user record')
    roots=[x for x in OCEAN.iterdir() if x.is_dir() and RUNTIME.match(x.name)]
    images=[];violations=[];scanned=0
    for root in roots:
        for f in root.rglob('*'):
            if not f.is_file(): continue
            scanned+=1
            if f.suffix.lower() in IMAGE_SUFFIXES: images.append(str(f.relative_to(ROOT)));continue
            if f.suffix.lower() not in {'.html','.css','.js','.mjs','.cjs','.json','.glsl','.vert','.frag','.wgsl','.md'}: continue
            try:s=f.read_text('utf-8')
            except UnicodeDecodeError: continue
            for label,pat in {'embedded raster':r'data\s*:\s*image/','raster request':r'(?:src\s*=|url\s*\(|fetch\s*\()[^\n]{0,180}\.(?:png|jpe?g|webp|gif|bmp|tiff?|avif|dds|ktx2?|exr|hdr)\b','image generation':r'\b(?:image_gen|text2im|generateImage)\b'}.items():
                if re.search(pat,s,re.I): violations.append({'file':str(f.relative_to(ROOT)),'rule':label})
    if images: fail('persistent images: '+','.join(images))
    if violations: fail(json.dumps(violations,ensure_ascii=False))
    print(json.dumps({'status':'OCEAN_RUNTIME_VISUAL_POLICY_PASS','policyVersion':p['version'],'runtimeRoots':[str(x.relative_to(ROOT)) for x in roots],'scannedFiles':scanned,'persistentImageFiles':0,'violations':0,'primaryVisualDirection':'photorealistic','imageGenerationMode':False},ensure_ascii=False,indent=2))
if __name__=='__main__':
    try:main()
    except Exception as e:
        print(json.dumps({'status':'OCEAN_RUNTIME_VISUAL_POLICY_FAIL','error':str(e)},ensure_ascii=False),file=sys.stderr);raise
