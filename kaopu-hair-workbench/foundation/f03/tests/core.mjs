import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {rootBank,domain,SETTINGS,enabled,growth,normalArray,signature,point,V} from '../src/approved/BoundaryKernel.mjs';
import {GuideBuilder,DEFAULT,validate,SCALP_LOCK,emergence} from '../src/GuideKernel.mjs';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),h=JSON.parse(fs.readFileSync(process.env.TEST_HEAD||dir+'/head.json')),checks=[],scenarios=[];const test=(name,pass,data=null)=>{checks.push({name,pass,data});console.log(pass?'PASS':'FAIL',name,data??'');};
const roots=rootBank(h),normals=normalArray(h.positions,h.triangles),scalp=domain(h,SETTINGS),b=new GuideBuilder(h,roots,normals),bankJSON=JSON.stringify(roots),d=b.build(DEFAULT),a=b.audit(d,8);
test('native head unchanged',h.positions.length===17821*3&&h.triangles.length===35324*3);
test('approved root bank frozen',roots.length===3300&&signature(roots.flatMap(r=>[r.f,...r.b]))==='a624b76f');
test('approved active samples remain3067',roots.filter(r=>enabled(r,SETTINGS)).length===3067);
test('approved area unchanged',Math.abs(scalp.area*1e4-627.94943956743)<1e-8);
test('all guide roots in approved range',d.curves.every(c=>growth(roots[c.rootId].p,SETTINGS)>=-1e-8));
test('192 distinct persistent guides',new Set(d.curves.map(c=>c.rootId)).size===192);
test('default exact native contact audit',a.centerlineCrossings===0&&a.probeCrossings===0,a);
test('root fixed / arc length exact',a.rootDriftMM<1e-8&&a.maxLengthErrorMM<1e-7);
test('contact positive control',a.positiveControl);
test('regional angles not one global constant',new Set(d.probes.map(e=>e.requestedAngle)).size===5&&d.probes.every(e=>e.requestedAngle===DEFAULT.angles[e.region]));
test('directions unit and tangent perpendicular',d.probes.every(e=>Math.abs(Math.hypot(...e.dir)-1)<1e-8&&Math.abs(e.t.reduce((s,v,k)=>s+v*e.n[k],0))<1e-8));
const lengths=DEFAULT.lengths.slice();lengths[0]=90;const trim=b.build({...DEFAULT,lengths});test('length only uses cached curves',trim.cacheHit&&trim.pathBuilds===1);test('other regions exactly retained',d.curves.every((c,i)=>c.region===0||JSON.stringify(c.points)===JSON.stringify(trim.curves[i].points)));
let maxPrefixError=0;for(let i=0;i<d.curves.length;i++){const c=d.curves[i],q=trim.curves[i];for(let j=0;j<q.points.length-3;j++)maxPrefixError=Math.max(maxPrefixError,Math.abs(q.points[j]-c.points[j]));}test('tip cut preserves prefix not scaled',maxPrefixError<1e-10,maxPrefixError);
const side=b.build({...DEFAULT,partMM:20});test('part changes guides not emergence',JSON.stringify(side.probes)===JSON.stringify(d.probes));test('part has actual curve effect',side.curves.some((c,i)=>JSON.stringify(c.points)!==JSON.stringify(d.curves[i].points)));
for(const patch of[{scalpLock:'wrong'},{rootBank:'wrong'},{lengths:[1]},{angles:[NaN,1,1,1,1,1]},{partMM:99},{earTopMM:1}]){let rejected=false;try{validate({...DEFAULT,...patch});}catch{rejected=true;}test('reject invalid/forbidden recipe '+Object.keys(patch)[0],rejected);}
for(const [name,patch]of[['natural',{family:'natural'}],['swept',{family:'swept'}],['left-part',{family:'parted',partMM:-24}],['whorl-left',{whorlXMM:-18,whorlZMM:-45,whorlTurn:-70}],['whorl-right',{whorlXMM:18,whorlZMM:-5,whorlTurn:70}],['low-root',{rootAngleBias:-6}],['high-root',{rootAngleBias:15}],['all-long',{lengths:[240,240,240,240,240,240]}],['all-short',{lengths:[15,15,15,15,15,15]}]]){const r=b.build({...DEFAULT,...patch}),q=b.audit(r,8);scenarios.push({name,buildMS:r.buildMS,cache:r.cacheHit,...q});test(name+' finite rooted exact static curves',q.centerlineCrossings===0&&q.probeCrossings===0&&q.rootDriftMM<1e-8&&q.maxLengthErrorMM<1e-7&&r.curves.every(c=>c.points.every(Number.isFinite)),{cross:q.centerlineCrossings,probeCross:q.probeCrossings,ms:r.buildMS});}
test('no root mutation after every test',JSON.stringify(roots)===bankJSON);
const report={success:checks.every(c=>c.pass),checks,scenarios,baselineAudit:a,scalpLock:SCALP_LOCK,rootBankSignature:'a624b76f',nativeVertices:h.positions.length/3,scalpAreaCM2:scalp.area*1e4,defaultBuildMS:d.buildMS,lengthEditMS:trim.buildMS,physicsAdvanced:false,limits:['Static native head only, no continuous collision or dynamic solver','No dense followers, not a reference-photo hairstyle','Unseen whorl not a measured follicle field','Extreme long tips may leave displayed open bust']};fs.mkdirSync(dir+'/evidence',{recursive:true});fs.writeFileSync(dir+'/evidence/core.json',JSON.stringify(report,null,2));if(!report.success)process.exitCode=1;
