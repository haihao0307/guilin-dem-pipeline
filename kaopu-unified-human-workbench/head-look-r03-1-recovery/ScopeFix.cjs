'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=__dirname;
function once(s,a,b){assert.equal(s.split(a).length,2,'Scope patch anchor drift: '+a.slice(0,100));return s.replace(a,()=>b);}
let s=fs.readFileSync(path.join(dir,'LocalFeatures.mjs'),'utf8');
s=once(s,'float lfEye=0.,lfLip=0.,lfEar=0.,lfCavity=0.;','float lfEye=0.,lfLip=0.,lfLipScope=0.,lfEar=0.,lfCavity=0.;');
s=once(s,'lfLip=lpMask*lfSkinOwner*uLFLips;lfEar=eaM*uLFEars;',`lfLip=lpMask*lfSkinOwner*uLFLips;lfEar=eaM*uLFEars;
  // A border correction can remove the former feather at a corner. Ownership
  // must include BOTH the original support and the edited support; otherwise
  // removed original pigment is falsely classified as an unrelated-skin edit.
  // Recompute the exact retained specialist's original AA/domain equation.
  // This does not broaden the actual colour, normal or optical modifications.
  float lfNativeAA=max(fwidth(vFRest.y)*.8,mix(.00016,.00062,uLSoft));
  float lfNativeLip=smoothstep(lpBotY-lfNativeAA,lpBotY+lfNativeAA,vFRest.y+lpBorderNoise)*(1.-smoothstep(lpTopY-lfNativeAA,lpTopY+lfNativeAA,vFRest.y+lpBorderNoise));
  lfNativeLip*=lpExtent*lpThickness*smoothstep(0.111193347,0.117193347,vFRest.z)*csCover*uLEnabled;
  lfNativeLip=max(lfNativeLip,lpMucosa);
  lfLipScope=max(lpMask,lfNativeLip)*lfSkinOwner*uLFLips;`);
s=once(s,'vec4(lfLip>0.?1.:0.,lfEye>0.?1.:0.,lfEar>0.?1.:0.,1.)','vec4(lfLipScope>0.?1.:0.,lfEye>0.?1.:0.,lfEar>0.?1.:0.,1.)');
s=s.replace("'/bounded-local-features-r03-v1'","'/bounded-local-features-r03-v2-support-union'");
fs.writeFileSync(path.join(dir,'LocalFeatures.mjs'),s);
let t=fs.readFileSync(path.join(dir,'test.mjs'),'utf8');
t=once(t,"console.log('LOCAL_FEATURE_UNIT_CHECKS='+n);",`test('lip scope includes exact old and revised feather, not an arbitrary dilation',()=>{const s=fs.readFileSync(new URL('LocalFeatures.mjs',import.meta.url),'utf8');assert(s.includes('lfLipScope=max(lpMask,lfNativeLip)*lfSkinOwner*uLFLips'));assert(s.includes('max(fwidth(vFRest.y)*.8,mix(.00016,.00062,uLSoft))'));assert(s.includes('lfNativeLip*=lpExtent*lpThickness*smoothstep(0.111193347,0.117193347,vFRest.z)*csCover*uLEnabled'));assert(s.includes('vec4(lfLipScope>0.?1.:0.'));});
test('protected-skin regression remains strict',()=>{const s=fs.readFileSync(new URL('verify.cjs',import.meta.url),'utf8');assert(s.includes('assert.equal(locality.outsideChanged,0'));assert(s.includes('if(change>1)outsideChanged++'));});
console.log('LOCAL_FEATURE_UNIT_CHECKS='+n);`);
fs.writeFileSync(path.join(dir,'test.mjs'),t);
let v=fs.readFileSync(path.join(dir,'verify.cjs'),'utf8');
v=v.replaceAll('{timeout:240000}','{timeout:240000,polling:150}').replace('{timeout:90000});await p.evaluate(()=>{lifelikeIdle.pause(true)','{timeout:90000,polling:150});await p.evaluate(()=>{lifelikeIdle.pause(true)');
v=once(v,'const frame=async name=>p.evaluate(',"const frame=async name=>{console.log('FRAME',name||'unnamed',new Date().toISOString());return p.evaluate(");
v=once(v,'},name||null);','},name||null);};');
fs.writeFileSync(path.join(dir,'verify.cjs'),v);
fs.appendFileSync(path.join(dir,'README.md'),'\n## Lip support correction\n\nRun38393379283 passed all 7 smoke checks and real public controls but stopped at strict lip ownership: 2 old-border pixels differed by 2/255 just outside the new mask. The diagnostic now uses the exact union of original and revised feather support, because removing old lip pigment is itself a lip edit. Colour/roughness/normal behaviour is unchanged by this fix, and the protected-skin test remains zero changed pixels outside that explicit anatomical union (one-byte quantization tolerance only).\n');
console.log('Corrected original/revised lip support; protected-region gate unchanged.');
