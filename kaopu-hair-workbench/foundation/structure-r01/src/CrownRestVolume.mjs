import {smooth,add,mul,sub} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// Low-frequency static volume of complete guides, not a scalp shell. Only
// the inherited native surface supplies offset normals. Metres throughout.
export function crownVolumeProfile(){return{revision:'crown-volume-11',strength:1,lift:.0035,startArc:.006,reach:.080,minPointY:.335,heightFade:.030,rootMinY:.345,rootFade:.045};}
export function assertCrownVolumeField(f){if(f?.revision!=='crown-volume-11')throw Error('Invalid crown volume field');const limits={strength:[0,1],lift:[0,.006],startArc:[.006,.006],reach:[.080,.080],minPointY:[.335,.335],heightFade:[.030,.030],rootMinY:[.345,.345],rootFade:[.045,.045]};for(const[k,[a,b]]of Object.entries(limits))if(!Number.isFinite(f[k])||f[k]<a||f[k]>b)throw Error('Crown volume control outside scope: '+k);return true;}
export function shapeCrownVolume(reference,launchGuides,f,normalAt){
 assertCrownVolumeField(f);if(reference.length!==launchGuides.length)throw Error('Crown input identity mismatch');let changedGuides=0,maxDisplacementMM=0;const affected=[];
 const guides=launchGuides.map((old,i)=>{
  const source=reference[i],g=structuredClone(old);if(source.id!==old.id)throw Error('Crown input identity mismatch');if(source.zone<=1||!f.strength||!f.lift)return g;
  const rootWeight=smooth((source.points[1]-f.rootMinY)/f.rootFade);if(!rootWeight)return g;let local=0;
  for(let n=1;n<97;n++){
   const s=source.arcLengths[n],p=source.points.slice(n*3,n*3+3);if(s<=f.startArc||s>=f.reach||p[1]<=f.minPointY)continue;
   const envelope=Math.sin(Math.PI*smooth((s-f.startArc)/(f.reach-f.startArc)))**2*smooth((p[1]-f.minPointY)/f.heightFade),normal=normalAt(p);if(normal.length!==3||normal.some(v=>!Number.isFinite(v))||Math.abs(Math.hypot(...normal)-1)>1e-5)throw Error('Crown requires actual unit native surface normals');const amount=f.strength*f.lift*rootWeight*envelope,q=add(old.points.slice(n*3,n*3+3),mul(normal,amount));g.points.splice(n*3,3,...q);local=Math.max(local,Math.hypot(...sub(q,old.points.slice(n*3,n*3+3)))*1000);
  }
  if(local>1e-7){rebuildGuide(g);changedGuides++;affected.push(g.id);maxDisplacementMM=Math.max(maxDisplacementMM,local);}return g;
 });return{guides,report:{revision:f.revision,changedGuides,affected,maxDisplacementMM,method:'compact low-frequency native-normal crown loft on complete paths, fixed launches and downstream points',physics:false}};
}
export function assertCrownLaunches(reference,launchGuides,output,f){
 assertCrownVolumeField(f);if(reference.length!==output.length||reference.length!==launchGuides.length)throw Error('Crown volume lost guides');for(let i=0;i<reference.length;i++){const source=reference[i],a=launchGuides[i],b=output[i];for(let n=0;n<97;n++)if(source.zone<=1||source.arcLengths[n]<=f.startArc||source.arcLengths[n]>=f.reach||source.points[n*3+1]<=f.minPointY)if(a.points.slice(n*3,n*3+3).some((v,k)=>v!==b.points[n*3+k]))throw Error('Crown changed protected launch/fringe/downstream point');if(JSON.stringify(a.cut)!==JSON.stringify(b.cut))throw Error('Crown changed cut');}return true;
}
