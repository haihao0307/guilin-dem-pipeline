/** Independent invariance checks for original-material initialization and curvature. */
import fs from'node:fs/promises';import{gunzipSync}from'node:zlib';import{stageRadialSkirt}from'./correctives/r043b/radial-assembly.mjs';import{configureMaterialBending}from'./correctives/r043b/hinge-bending.mjs';import{materialHash}from'./source-contract.mjs';
const root=new URL('./',import.meta.url),load=async n=>JSON.parse(await fs.readFile(new URL(n,root),'utf8')),raw=async n=>JSON.parse(gunzipSync(await fs.readFile(new URL(n,root)))),rows=[];
function check(name,ok,detail=null){rows.push({name,passed:!!ok,detail});if(!ok)throw Error(name)}
const body=await load('assets/common-body.json');const index=await load('assets/results/index.json');
for(const id of['S01','S02','S06','S08','S09','P01','T06']){
 const saved=index.rows[id]||index.checkpoints[id];const d=await raw('assets/results/'+saved.file),spec=structuredClone(d.spec),source=await raw('assets/papers/'+id+'.json.gz'),before=await materialHash(spec),person=JSON.stringify(body);
 const proof=stageRadialSkirt(spec,source,body);check(id+' original rest material, triangles and seam pairs preserved',await materialHash(spec)===before);check(id+' original common person unmodified',JSON.stringify(body)===person);
 if(['S08','S09'].includes(id)){
  check(id+' authoritative radial top interfaces used',proof.enabled&&proof.moves.length==Number(source.design['flare-skirt']['skirt-many-panels'].n_panels.v));
  for(const move of proof.moves){const b=move.initialPlacement.rigidBasis,axes=[[b[0],b[3],b[6]],[b[1],b[4],b[7]],[b[2],b[5],b[8]]];const dot=(a,b)=>a.reduce((n,v,k)=>n+v*b[k],0);check(id+' rigid material placement '+move.panelId,axes.every(a=>Math.abs(dot(a,a)-1)<1e-10)&&Math.abs(dot(axes[0],axes[1]))<1e-10&&Math.abs(dot(axes[0],axes[2]))<1e-10&&Math.abs(dot(axes[1],axes[2]))<1e-10);}
  check(id+' sewing jig is temporary',proof.temporaryFixtures===4&&proof.fixtureRelease.includes('zero permanent pins'));
 }else check(id+' nonradial styles untouched',proof.enabled===false);
}
const memory=new WebAssembly.Memory({initial:2}),lab={spec:{panels:[{id:'original-square',uvMm:[[0,0],[20,0],[20,20],[0,20]],triangles:[[0,1,2],[0,2,3]]}]},strainTriangles:[{},{}],ptr:{b43ids:0,b43coeff:128,b43weights:256},kernel:{memory,setMaterialBending43b(){}}};
const p=configureMaterialBending(lab),ids=new Int32Array(memory.buffer,0,4),q=new Float64Array(memory.buffer,128,4),w=new Float64Array(memory.buffer,256,1)[0];check('flat material has one internal hinge',p.hinges===1);check('hinge translation invariant',Math.abs(Array.from(q).reduce((a,b)=>a+b,0))<1e-12);
const xyz=[[.1,.3,.7],[.2,.31,.8],[.3,.45,.5],[.2,.4,.6]],energy=ps=>w*[0,1,2].reduce((sum,k)=>sum+Array.from(q).reduce((v,c,a)=>v+c*ps[ids[a]][k],0)**2,0);let max=0;
for(let a=0;a<4;a++)for(let k=0;k<3;k++){const e=1e-6,plus=structuredClone(xyz),minus=structuredClone(xyz);plus[ids[a]][k]+=e;minus[ids[a]][k]-=e;const numeric=(energy(plus)-energy(minus))/(2*e),analytic=2*w*q[a]*Array.from(q).reduce((v,c,j)=>v+c*xyz[ids[j]][k],0);max=Math.max(max,Math.abs(numeric-analytic));}
check('material curvature derivative independently verified',max<1e-8,max);const affine=lab.spec.panels[0].uvMm.map(([u,v])=>[u*.002+v*.0004+1,u*.0003+v*.0011-3,u*.0007-v*.0008+2]);check('affine material plane adds zero bending energy',energy(affine)<1e-24,energy(affine));
const frozen=['T01','T02','T03','T04','T08','T15','T16','T17','T18'];check('previous nine accepted static results remain present',frozen.every(id=>index.rows[id]?.qualityPassed));
await fs.writeFile(new URL('R043B_CONTRACT_TESTS.json',root),JSON.stringify({passed:true,checks:rows,calibratedFabric:false,dynamicWear:false},null,2));console.log('ORIGINAL43B_CONTRACT',rows.length);
