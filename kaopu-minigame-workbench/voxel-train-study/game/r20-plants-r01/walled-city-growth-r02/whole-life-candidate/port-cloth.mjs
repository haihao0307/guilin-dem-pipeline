/** Narrow syntax/footprint bridge from the locked R6.1 coarse mother. No replacement field. */
import fs from 'node:fs';import crypto from 'node:crypto';
const raw=fs.readFileSync(new URL('../life-resource-audit/cloth-r61/ClothSurfaceR6Dual.frag.glsl',import.meta.url),'utf8'),sha=crypto.createHash('sha256').update(raw).digest('hex');
if(sha!=='ccf973339588bbe6e77d9b9f2cf5b9ff80fa6632f7310b8ffdb6f146287346e3')throw Error('Cloth source changed');
const types={float:'f32',vec2:'vec2<f32>',vec3:'vec3<f32>',M:'KpClothM',P:'KpClothPattern'};
function extract(name){let m=new RegExp('(float|vec3|P) '+name+'\\(([^)]*)\\)\\{').exec(raw);if(!m)throw Error(name);let pos=m.index+m[0].length,n=1,end=pos;while(n){let c=raw[end++];if(c==='{')n++;if(c==='}')n--;}return{type:m[1],args:m[2],body:raw.slice(pos,end-1)};}
function split(s){let out=[],start=0,n=0;for(let i=0;i<s.length;i++){if('([{'.includes(s[i]))n++;if(')]}'.includes(s[i]))n--;if(s[i]===','&&!n){out.push(s.slice(start,i));start=i+1;}}out.push(s.slice(start));return out;}
function convert(name,extra=''){let f=extract(name),body=f.body.replace(/\b(float|vec2|vec3|M|P)\s+([^;]+);/g,(_,t,v)=>split(v).map(q=>{const eq=q.indexOf('=');return eq<0?`var ${q.trim()}:${types[t]};`:`var ${q.slice(0,eq).trim()}:${types[t]}=${q.slice(eq+1)};`;}).join('\n'));
 body=body.replace('if(face<.5)wave=-wave;','if(face<.5){wave=-wave;}').replace('fwidth(qb)','footprintCm*m.den').replace('fract(q)-.5','fract(q)-vec2(.5)');
 let args=f.args.split(',').map(q=>{let [t,n]=q.trim().split(/\s+/);return `${n}:${types[t]}`;}).join(',');return `fn rc_${name}(${args}${extra})->${types[f.type]}{${body}}`;
}
const header=String.raw`
const RC_PI:f32=3.14159265359;
struct KpClothM{col:vec3<f32>,roughW:f32,roughF:f32,sheen:f32,bump:f32,trans:f32,irr:f32,fuzz:f32,slub:f32,open:f32,macroTone:f32,age:f32,farId:f32,meso:f32,den:vec2<f32>}
struct KpClothPattern{h:f32,thread:f32,orient:f32,variation:f32,gap:f32,nearW:f32,midW:f32,farW:f32,slub:f32,roughVar:f32,wear:f32,bundle:f32}
fn rc_h21(value:vec2<f32>)->f32{var p=fract(value*vec2<f32>(123.34,456.21));p+=vec2<f32>(dot(p,p+vec2<f32>(45.32)));return fract(p.x*p.y);}
fn rc_n2(p:vec2<f32>)->f32{let i=floor(p);var f=fract(p);f=f*f*(vec2<f32>(3.)-2.*f);return mix(mix(rc_h21(i),rc_h21(i+vec2<f32>(1,0)),f.x),mix(rc_h21(i+vec2<f32>(0,1)),rc_h21(i+vec2<f32>(1.)),f.x),f.y);}
fn rc_sat(x:f32)->f32{return clamp(x,0.,1.);}
fn kpClothCoarseParams()->KpClothM{return KpClothM(vec3<f32>(.39,.32,.21),.82,.77,.20,.46,.085,.78,.24,.88,.10,.38,.24,.78,1.,vec2<f32>(5.6,5.0));}
`;
let code=header+[convert('patternR3',',footprintCm:vec2<f32>'),convert('ggxD'),convert('smith'),convert('fres'),convert('oneLightCoarse',',C:vec2<f32>')].join('\n');
for(const name of ['patternR3','ggxD','smith','fres','oneLightCoarse','h21','n2','sat'])code=code.replace(new RegExp('(?<!rc_)\\b'+name+'\\(','g'),'rc_'+name+'(');
code=code.replace(/\bvec2\(/g,'vec2<f32>(').replace(/\bvec3\(/g,'vec3<f32>(').replace(/\bPI\b/g,'RC_PI').replace(/\.macro\b/g,'.macroTone').replace(/\.var\b/g,'.variation');
for(const x of ['f.x/ww','f.y/wf','dot(h,b)','dot(h,t)'])code=code.replaceAll('pow('+x+',2.)','(('+x+')*('+x+'))');code=code.replaceAll('f32>=','f32> =');
code=code.replace('f0+(1.-f0)*','f0+(vec3<f32>(1.)-f0)*');
const bridge=String.raw`
// Source material coordinates are centimetres. This explicit footprint bridge
// replaces screen derivatives; physical microheight always uses footprint zero.
fn kpClothCoarsePattern(uvM:vec2<f32>,footprintM:f32)->KpClothPattern{return rc_patternR3(uvM*100.,kpClothCoarseParams(),1.,vec2<f32>(footprintM*100.));}
fn kpClothCoarseBase(uvM:vec2<f32>,p:KpClothPattern)->vec3<f32>{let m=kpClothCoarseParams();return m.col*(1.+p.variation)*(1.-p.wear*.055)*(.965+.035*rc_n2(uvM*100.*.18+vec2<f32>(13.,5.)));}
fn kpClothCoarseSurface(uvM:vec2<f32>,footprintM:f32)->KpSurface{let m=kpClothCoarseParams();let p=kpClothCoarsePattern(uvM,footprintM);return KpSurface(p.h*m.bump*.00038,kpClothCoarseBase(uvM,p),clamp(mix(m.roughW,m.roughF,p.orient)+p.roughVar,.36,.97));}
fn kpClothCoarseLight(uvM:vec2<f32>,footprintM:f32,L:vec3<f32>,lc:vec3<f32>,n:vec3<f32>,v:vec3<f32>,t:vec3<f32>,b:vec3<f32>)->vec3<f32>{let m=kpClothCoarseParams();let p=kpClothCoarsePattern(uvM,footprintM);return rc_oneLightCoarse(L,lc,n,v,t,b,kpClothCoarseBase(uvM,p),m,p,uvM*100.);}
`;
code+='\n'+bridge;
fs.writeFileSync(new URL('cloth-coarse.wgsl',import.meta.url),code);fs.writeFileSync(new URL('cloth-coarse.mjs',import.meta.url),'// Original R6.1 coarse mother, explicit WGSL syntax/footprint bridge.\nexport const KP_CLOTH_COARSE_WGSL='+JSON.stringify(code)+';\n');
fs.writeFileSync(new URL('cloth-source-lock.json',import.meta.url),JSON.stringify({source:'ClothSurfaceR6Dual.frag.glsl',sha256:sha,functions:['patternR3','ggxD','smith','fres','oneLightCoarse'],coordinateUnit:'centimetre',defaults:'pm(mode=2), all UI multipliers=1, neutral=false',ports:['declarations and typed constructors','reserved macro/var field names','explicit footprint replaces fwidth','C passed explicitly','source normal-height 0.038cm coefficient mapped to 0.00038m physical microheight'],geometryBridge:'new host displacement of original normal-height; not original swatch simulation',visualAcceptance:false,GPU:'not-run'},null,2));
console.log(code.length);
