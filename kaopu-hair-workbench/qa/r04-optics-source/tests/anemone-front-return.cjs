/* CPU transport/energy invariants and opt-in shader contract; no GPU claim. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const O=require('../src/anemone-optics.js'),F=O.frontReturn;
const frozenPath=path.join(__dirname,'../qa/r04-optics-shadow-filter/anemone-optics-after.js');
const old=require(frozenPath),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
const close=(a,b,m,t=1e-10)=>check(Math.abs(a-b)<t,m+': '+a+' / '+b);
check(sha(fs.readFileSync(frozenPath))==='72d84e55078852faae1647d29d8545cb633d1967cde8bc78a466293f957bd1a8','72d84 shadow baseline frozen unchanged');
for(const key of ['fragment','tentacleVertex','bodyVertex','shadowFragment'])check(O[key]===old[key],key+' remains exact prior shader');
for(const key of ['DEFAULTS','PALETTES','DEBUG_MODES'])check(JSON.stringify(O[key])===JSON.stringify(old[key]),key+' fixed for old/new A/B');
for(const key of ['lighting','lightMatrix','applyUniforms','beerLambert','localPath','options','shadowReceiver','shadowVisibilityReference'])check(O[key].toString()===old[key].toString(),key+' unchanged');
check(F.fragment!==O.fragment,'new shader has an explicit independent entry');
check(F.tentacleVertex===O.tentacleVertex&&F.bodyVertex===O.bodyVertex&&F.shadowFragment===O.shadowFragment,'all geometry and depth-pass shader strings identical');
const chunk=(s,start,end)=>s.slice(s.indexOf(start),s.indexOf(end));
check(chunk(F.fragment,'float shadowVisibility(', 'vec3 fresnel(')===chunk(old.fragment,'float shadowVisibility(','vec3 fresnel('),'receiver and source-exit visibility kernel identical');
check(chunk(F.fragment,' if(tentacle&&nl<0.){',' vec3 result=reflected+transmitted;')===chunk(old.fragment,' if(tentacle&&nl<0.){',' vec3 result=reflected+transmitted;'),'back transmission formula and sourceSide check unchanged');
check(F.fragment.includes('reflected=reflected*(1.-uFrontReturn)+frontReturned;'),'front return spends old diffuse energy rather than free addition');
check(F.fragment.includes('if(tentacle&&nl>0.&&uFrontReturn>0.)'),'only visible front/side incident directions enter return budget');
check(F.fragment.includes('frontThickness=tissuePath(-n);'),'finite depth uses existing local normal chord');
check(F.fragment.includes('*(1.-uPhaseG)'),'reduced scattering explicitly uses existing phase asymmetry');
check(F.fragment.includes('tissueReturnLobe(muI,muO))*uKeyRadiance*shadow'),'return requires incident light and ordinary shadow visibility');
check(F.fragment.includes('if(uFrontReturnDebug==0&&uDebugMode=='),'new return diagnostic has explicit priority');
check(F.fragment.includes('reflected+=base*uAmbientRadiance*ambientAccess*(.62+.38*max(n.y,0.));'),'ambient expression is unchanged');
check(F.fragment.includes('reflected+=surfaceF*ggx(n,v,l,roughness)*uKeyRadiance*shadow;'),'specular expression is unchanged');
check(!F.fragment.includes('discard')&&!F.fragment.includes('gl_FragDepth')&&F.fragment.includes('color=vec4(linearToSRGB(result),1.);'),'alpha one and unchanged opaque depth');
// Slab limits and monotonicity, including no scatter / pure scatter / no volume.
check(F.finiteLayerReturn([1,2,3],0,1).every(x=>x===0),'no scatter means no return');
check(F.finiteLayerReturn([1,2,3],1,0).every(x=>x===0),'zero thickness means zero return');
close(F.finiteLayerReturn([0,0,0],2,.5)[0],.5,'pure-scattering finite slab limit SD/(1+SD)');
for(const K of [0,1e-9,.01,.2,1,3,20])for(const S of [.01,.4,1.6,4]){
 let prior=0;
 for(const D of [0,1e-8,1e-5,.001,.01,.1,.5,1,3,20,1000]){
  const R=F.finiteLayerReturn([K,K,K],S,D)[0];
  check(Number.isFinite(R)&&R>=0&&R<=1,'bounded finite layer return');
  check(R>=prior-1e-9,'more depth cannot reduce homogeneous slab return');prior=R;
  if(K>0){const gamma=Math.sqrt(K*(K+2*S));check(R<=S/(K+S+gamma)+1e-9,'finite layer never exceeds infinite-layer reflectance');}
 }
}
for(const D of [.001,.02,.2,1,10])for(const S of [.2,1,3]){
 const r=F.finiteLayerReturn([.1,.5,2],S,D);check(r[0]>r[1]&&r[1]>r[2],'more absorption reduces channel return');
}
// Radiometric lobe checks: reciprocal; nonnegative; conservative hemisphere.
for(const a of [1e-7,1e-4,.01,.1,.4,.8,1])for(const b of [1e-7,1e-4,.01,.1,.4,.8,1]){
 const l=F.tissueReturnLobe(a,b);check(Number.isFinite(l)&&l>=0,'finite positive lobe at grazing');
 close(l,F.tissueReturnLobe(b,a),'return lobe reciprocal');
}
close(F.tissueReturnLobe(0,.5),0,'no incident cosine, no lobe');
close(F.tissueReturnLobe(.5,0),0,'outside viewing hemisphere, no lobe');
const integrations=[];
for(const muI of [1e-7,1e-4,.005,.02,.1,.3,.6,1]){
 const steps=20000;let total=0;
 for(let i=0;i<steps;i++){const x=(i+.5)/steps,muO=x*x;total+=2*Math.PI*F.tissueReturnLobe(muI,muO)*muO*2*x/steps;}
 check(total>=0&&total<=1+1e-7,'hemispherical return lobe energy does not exceed one');integrations.push({muI,total});
}
check(.2*F.tissueReturnLobe(.2,.2)>1*F.tissueReturnLobe(1,1)*.2,'return lobe has broader normalized side response than Lambert');
const p=O.PALETTES[O.DEFAULTS.palette];
const sample={base:p.base,absorption:p.absorption,scattering:p.scattering,thickness:.06,muI:.6,muO:.7,amount:.65,visibility:1,key:[2.8,2.73,2.548]};
const baseline=F.evaluate({...sample,amount:0});
check(baseline.returned.every(x=>x===0)&&baseline.direct.every((x,i)=>x===baseline.old[i]),'front amount zero returns exactly old direct diffuse arithmetic');
for(const muI of [-1,-.5,0])check(F.evaluate({...sample,muI}).returned.every(x=>x===0),'backlight does not create front return');
check(F.evaluate({...sample,key:[0,0,0]}).returned.every(x=>x===0),'no light means no return emission');
check(F.evaluate({...sample,visibility:0}).direct.every(x=>x===0),'shadowed front/side tissue remains unlit by direct return');
const half=F.evaluate({...sample,visibility:.5}),full=F.evaluate(sample);
for(let c=0;c<3;c++)close(half.returned[c],full.returned[c]*.5,'visibility attenuates return linearly');
check(F.evaluate({...sample,scattering:0}).returned.every(x=>x===0),'scattering-zero return term vanishes');
check(F.evaluate({...sample,thickness:0}).returned.every(x=>x===0),'zero-depth return term vanishes');
const thin=F.evaluate({...sample,thickness:.006}),thick=F.evaluate({...sample,thickness:.06});
check(thick.returned.every((x,i)=>x>thin.returned[i]),'thin layer has less front-return scattering, distinct from increased back transmission');
for(const amount of [0,.25,.65,1])for(const muI of [.01,.2,.6,1]){
 const value=F.evaluate({...sample,amount,muI});
 check(value.diffuseBudget.every(x=>x>=0&&x<=.82+1e-12),'finite direct non-specular budget <=0.82 per channel');
 const steps=4000,total=[0,0,0];
 for(let i=0;i<steps;i++){
  const muO=(i+.5)/steps,v=F.evaluate({...sample,amount,muI,muO,key:[1,1,1]});
  for(let c=0;c<3;c++)total[c]+=2*Math.PI*v.direct[c]*muO/(steps*muI);
 }
 check(total.every((x,i)=>x<=value.diffuseBudget[i]+1e-5),'hemisphere-integrated allocated diffuse obeys stated budget');
}
// Shader uploads do not reuse transmission as an implicit front-return switch.
const calls=[],program={},gl={getUniformLocation:(p,n)=>n,uniform1f:(n,v)=>calls.push([n,v]),uniform1i:(n,v)=>calls.push([n,v]),uniform3fv:(n,v)=>calls.push([n,[...v]]),uniformMatrix4fv:(n,t,v)=>calls.push([n,[...v]])};
F.applyUniforms(gl,program,{frontReturn:.65,transmission:0,frontReturnView:'return-only',shadowEnabled:true});
let uniforms=new Map(calls);
check(uniforms.get('uFrontReturn')===.65&&uniforms.get('uTransmission')===0,'front return and back transmission are independent controls');
check(uniforms.get('uFrontReturnDebug')===1,'isolated return-only diagnostic upload');
calls.length=0;F.applyUniforms(gl,program,{frontReturn:0,transmission:1,frontReturnView:'beauty',shadowEnabled:true});uniforms=new Map(calls);
check(uniforms.get('uFrontReturn')===0&&uniforms.get('uTransmission')===1,'front-off preserves existing back transmission switch');
for(const bad of [{frontReturn:-.1},{frontReturn:1.1},{frontReturn:NaN},{frontReturnView:'glow'}]){assert.throws(()=>F.options(bad));checks++;}
for(const key of ['fragment','vertex','tentacleVertex','bodyVertex','shadowFragment','DEFAULTS','PALETTES','DEBUG_MODES','options','applyUniforms','lighting','lightMatrix'])check(F[key]!==undefined,'drop-in set implements '+key);
for(const key of Object.keys(old.DEFAULTS))check(F.DEFAULTS[key]===old.DEFAULTS[key],'original renderer default '+key+' remains fixed');
const serialized=JSON.parse(JSON.stringify(F.options({...F.DEFAULTS,frontReturn:.37,frontReturnView:'return-only',transmission:0})));
const restored=F.options(serialized);
check(restored.frontReturn===.37&&restored.frontReturnView==='return-only'&&restored.transmission===0,'JSON roundtrip retains independent new amount, diagnostic and old transmission');
check(F.options({frontReturn:0}).frontReturn===0,'zero amount not replaced by a truthy default');
check(F.options({}).frontReturn===.65&&F.options({}).frontReturnView==='beauty','set initializes explicit opt-in defaults');
const shaderCount=(s,str)=>s.split(str).length-1;
check(shaderCount(F.fragment,'uniform float uFrontReturn;')===1&&shaderCount(F.fragment,'vec3 frontReturned=')===1,'derived GLSL inserts each mechanism once');
console.log(JSON.stringify({passed:true,checks,moduleSha256:sha(fs.readFileSync(path.join(__dirname,'../src/anemone-optics.js'))),oldFragmentSha256:sha(O.fragment),newFragmentSha256:sha(F.fragment),integrations,defaultLayer:full.layer,scope:'CPU energy/equation/source contract only; new GLSL compilation, actual old/new frame equality at amount=0, appearance and performance are not yet GPU verified'},null,2));
