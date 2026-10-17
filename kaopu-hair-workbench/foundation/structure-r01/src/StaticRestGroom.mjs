import {smooth,sub,mix,mul,add,dot,unit} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// Current P01 low-frequency groom controls, in metres. This shapes complete
// guide paths; it is neither a child-strand interpolator nor a gravity solver.
export function staticRestProfile(){return {
 revision:'static-rest-10',source:'volume-flow',protectedRootArc:.015,
 strength:1,midConvergence:.14,lowerInset:.003,tipInset:.0015,
 wispBend:.0015,hemVariation:.004,clearance:.0015,
 ownership:'P01 authored static shape; source native roots, part and regional anatomy unchanged'
};}
export function assertStaticRestField(f){
 if(f?.revision!=='static-rest-10'||f.source!=='volume-flow')throw Error('Invalid current rest source');
 const limits={protectedRootArc:[.015,.015],strength:[0,1],midConvergence:[0,.4],lowerInset:[0,.012],tipInset:[0,.008],wispBend:[0,.006],hemVariation:[0,.006],clearance:[.001,.003]};
 for(const [k,[a,b]] of Object.entries(limits))if(!Number.isFinite(f[k])||f[k]<a||f[k]>b)throw Error('Static rest control outside authored bounds: '+k);
 return true;
}
function seed(id){let h=2166136261;for(const ch of id)h=Math.imul(h^ch.charCodeAt(0),16777619);return(h>>>0)/4294967295;}
function atArc(g,t){const s=t*g.length;let n=0;while(n<g.arcLengths.length-2&&g.arcLengths[n+1]<s)n++;return mix(g.points.slice(n*3,n*3+3),g.points.slice(n*3+3,n*3+6),(s-g.arcLengths[n])/(g.arcLengths[n+1]-g.arcLengths[n]));}
export function shapeStaticRest(source,sourceGraph,f,near){
 assertStaticRestField(f);const byID=new Map(source.map(g=>[g.id,g])),groups=new Map(sourceGraph.filter(g=>g.level==='mid').map(g=>[g.id,g]));let changed=0,projections=0,maxDisplacement=0;
 const guides=source.map(old=>{
  const g=structuredClone(old);if(old.zone<=1||f.strength===0)return g;
  const parent=groups.get(old.mid),center=byID.get(parent.representativeGuide),phase=seed(old.mid)*Math.PI*2,root=old.points.slice(0,3),layer=smooth((root[1]-.285)/.13),cutDelta=f.hemVariation*(layer-.45),N=old.arcLengths.length;
  for(let n=1;n<N;n++){
   const s=old.arcLengths[n],p=old.points.slice(n*3,n*3+3);if(s<=f.protectedRootArc)continue;
   const t=s/old.length,protect=smooth((s-f.protectedRootArc)/.035)*smooth((.285-p[1])/.065),lower=smooth((.29-p[1])/.11),end=smooth((t-.72)/.28),mid=Math.sin(Math.PI*t)**2,c=atArc(center,t),radial=unit([p[0],0,p[2]-.012]);
   // Within a native-root-connected wisp: modest midshaft cohesion, then
   // release toward the cut. No tips all converge to a common point.
   const cohesion=f.midConvergence*mid;
   const inset=f.lowerInset*lower+f.tipInset*end;
   const bend=f.wispBend*Math.sin(phase)*Math.sin(Math.PI*t)*lower;
   const offset=[(c[0]-p[0])*cohesion-radial[0]*inset+radial[2]*bend,cutDelta*smooth((t-.35)/.65),(c[2]-p[2])*cohesion-radial[2]*inset-radial[0]*bend];
   g.points.splice(n*3,3,...add(p,mul(offset,protect*f.strength)));
  }
  // One bounded line search for the whole guide retains a smooth shape. Local
  // per-point acceptance would produce kinks where contact becomes active.
  const desired=g.points.slice();let accepted=false;
  for(let attempt=0;attempt<14;attempt++){
   const amount=2**(-attempt);let safe=true;
   for(let n=1;n<N;n++){
    const p=old.points.slice(n*3,n*3+3),q=mix(p,desired.slice(n*3,n*3+3),amount),clear=Math.min(f.clearance,Math.max(0,near(p).signed));g.points.splice(n*3,3,...q);
    if(near(q).signed<clear-1e-8)safe=false;
   }
   if(safe){accepted=true;break;}projections++;
  }
  if(!accepted)g.points=old.points.slice();
  for(let n=0;n<N;n++)maxDisplacement=Math.max(maxDisplacement,Math.hypot(...sub(g.points.slice(n*3,n*3+3),old.points.slice(n*3,n*3+3))));
  g.cut={...old.cut,hem:g.points.at(-2),endpoint:g.points.slice(-3),operation:'native-connected-wisp-static-rest',sourceStudy:'volume-flow'};rebuildGuide(g);changed++;return g;
 });
 return {guides,report:{revision:f.revision,source:'volume-flow',changedGuides:changed,unchangedFringe:source.filter(g=>g.zone<=1).length,protectedRootArc:f.protectedRootArc,maxDisplacementMM:maxDisplacement*1000,contactLineSearchReductions:projections,method:'complete guide cross-section shaping inside native-root-connected mid wisps; regional cut graduation',physics:false}};
}
export function assertStaticRestIdentity(source,output,f){
 assertStaticRestField(f);if(source.length!==output.length)throw Error('Static rest lost complete guides');
 for(let i=0;i<source.length;i++){
  const a=source[i],b=output[i];for(const k of ['id','rootId','root','zone','macro'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Static rest changed native identity');
  for(let n=0;n<a.arcLengths.length;n++)if(a.zone<=1||a.arcLengths[n]<=f.protectedRootArc)if(a.points.slice(n*3,n*3+3).some((v,k)=>v!==b.points[n*3+k]))throw Error('Static rest changed fringe or native launch');
  if(Math.abs(a.cut.hem-b.cut.hem)>f.hemVariation+1e-8)throw Error('Static rest escaped regional cut graduation');
 }return true;
}

export function assertStaticRestBinding(source,output){
 if(source.length!==output.length)throw Error('Current groom lost guides');
 for(let i=0;i<source.length;i++){const a=source[i],b=output[i];for(const k of ['id','rootId','zone','macro','root'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Current groom changed native identity');if(a.points.slice(0,3).some((v,k)=>v!==b.points[k]))throw Error('Current groom moved root');if(a.zone<=1&&JSON.stringify(a.points)!==JSON.stringify(b.points))throw Error('Current lower-groom task changed fringe');}return true;
}
