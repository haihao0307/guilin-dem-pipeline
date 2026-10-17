import {unit,sub,mul,add,mix,dot,smooth} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// P01 authoring of a parted straight fringe. The root support is immutable;
// only its tangent/lift direction and full static trajectory are redesigned.
export function fringeRestProfile(profile){return{revision:'fringe-rest-10',part:structuredClone(profile.PartingCurves[0]),step:.0006,rootLift:.10,escape:.58,partBlend:.004,escapeArc:.035,launchArc:.008,clearance:.0015,hem:.315,edgeDrop:.016,layer:.002,method:'shared parted fringe field, native tangent/lift launch, regional brow-to-temple graduation'};}
export function assertFringeRestField(f){
 if(f?.revision!=='fringe-rest-10'||f.part?.points?.length<2)throw Error('Invalid parted fringe field');
 const bounds={step:[.0004,.001],rootLift:[.04,.2],escape:[.2,.9],partBlend:[.002,.009],escapeArc:[.02,.05],launchArc:[.004,.015],clearance:[.001,.003],hem:[.305,.325],edgeDrop:[0,.025],layer:[0,.006]};
 for(const [k,[a,b]]of Object.entries(bounds))if(!Number.isFinite(f[k])||f[k]<a||f[k]>b)throw Error('Fringe control outside authored bounds: '+k);
 if(f.part.points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Invalid fringe part geometry');return true;
}
export function fringePartX(z,f){const points=f.part.points;let i=0;while(i<points.length-2&&z<points[i+1][2])i++;const a=points[i],b=points[i+1],t=Math.max(0,Math.min(1,(z-a[2])/(b[2]-a[2])));return a[0]+(b[0]-a[0])*t;}
function sideAt(root,f){return Math.tanh((root[0]-fringePartX(root[2],f))/f.partBlend);}
function comb(root,arc,f){return unit([sideAt(root,f)*(f.escape*(1-smooth(arc/f.escapeArc))+.06),-1,.10]);}
export function fringeLaunch(root,n,f){const v=comb(root,0,f),t=unit(sub(v,mul(n,dot(v,n))));return unit(add(t,mul(n,f.rootLift)));}
export function fringeCut(root,f){const distance=Math.abs(root[0]-fringePartX(root[2],f));return Math.min(root[1]-.024,f.hem-f.edgeDrop*smooth((distance-.012)/.055)+f.layer*smooth((root[1]-.35)/.04));}
function sample(points,count){const arcs=[0];for(let i=1;i<points.length;i++)arcs.push(arcs.at(-1)+Math.hypot(...sub(points[i],points[i-1])));let j=0;return Array.from({length:count},(_,n)=>{const s=arcs.at(-1)*n/(count-1);while(j<arcs.length-2&&arcs[j+1]<s)j++;return mix(points[j],points[j+1],(s-arcs[j])/(arcs[j+1]-arcs[j]));});}
export function shapeFringeRest(source,roots,f,near){
 assertFringeRestField(f);const changes=[];
 const guides=source.map(old=>{
  if(old.zone>1)return structuredClone(old);
  const root=old.points.slice(0,3),o=old.rootId*26,n=Array.from(roots.subarray(o+7,o+10)),boundRoot=Array.from(roots.subarray(o+4,o+7)),initial=fringeLaunch(boundRoot,n,f),target=fringeCut(root,f),first=add(root,mul(initial,f.step)),path=[root,first];let p=first.slice(),arc=f.step,stopped=false,projections=0;
  function vector(q,s){const hit=near(q),proximity=1-smooth((hit.signed-.003)/.014);let v=comb(root,s,f);v=sub(v,mul(hit.n,Math.min(0,dot(v,hit.n))*proximity));v=unit(add(v,mul(hit.n,.06*proximity)));return unit(mix(initial,v,smooth((s-f.step)/f.launchArc)));}
  for(let i=0;i<600;i++){
   const a=vector(p,arc),v=vector(add(p,mul(a,f.step*.5)),arc+f.step*.5);let q=add(p,mul(v,f.step));
   for(let k=0;k<5;k++){const hit=near(q),clear=f.clearance*smooth((arc-f.step)/.010);if(hit.signed>=clear)break;q=add(q,mul(hit.n,Math.min(.002,clear-hit.signed)));projections++;}
   if(q[1]<=target){q=mix(p,q,(p[1]-target)/(p[1]-q[1]));q[1]=target;path.push(q);stopped=true;break;}
   arc+=Math.hypot(...sub(q,p));path.push(q);p=q;
  }
  if(!stopped)throw Error('Fringe field did not reach regional cut: '+old.id);
  const g=structuredClone(old);g.points=[...root,...sample(path.slice(1),96).flat()];g.cut={...old.cut,hem:target,endpoint:g.points.slice(-3),operation:'part-aware-fringe-rest',sourceStudy:'volume-flow'};g.fringeSide=sideAt(root,f);rebuildGuide(g);changes.push({id:g.id,rootId:g.rootId,side:g.fringeSide,bodyProjections:projections});return g;
 });return{guides,report:{revision:f.revision,changedGuides:changes.length,changes,method:f.method,physics:false}};
}
export function updateFringeRoots(roots,f){let changed=0;for(let i=0;i<roots.length/26;i++){const o=i*26;if(!roots[o+25]||roots[o+23]>1)continue;const root=Array.from(roots.subarray(o+4,o+7)),normal=Array.from(roots.subarray(o+7,o+10)),d=fringeLaunch(root,normal,f),component=dot(d,normal),t=sub(d,mul(normal,component)),length=Math.hypot(...t);for(let k=0;k<3;k++){roots[o+10+k]=t[k]/length;roots[o+13+k]=d[k];}roots[o+18]=component/length;changed++;}return changed;}
export function assertFringeIdentity(source,output){if(source.length!==output.length)throw Error('Fringe task lost guides');for(let i=0;i<source.length;i++){const a=source[i],b=output[i];for(const k of ['id','rootId','root','zone','macro'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Fringe task changed native support');if(a.points.slice(0,3).some((v,k)=>v!==b.points[k]))throw Error('Fringe task moved bound root');if(a.zone>1)for(const k of ['points','frames','arcLengths','length','cut'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Fringe task changed reviewed body groom');}return true;}
