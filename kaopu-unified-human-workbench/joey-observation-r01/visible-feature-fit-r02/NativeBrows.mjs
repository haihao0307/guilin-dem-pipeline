import {BrowLashGroom} from './brow-source/Groom.mjs';

// BROW-LASH-R01 fibers, rebound to the retained person's CURRENT native mesh.
// The facade never installs a source head/eye or replaces real archive methods.
export const OBSERVED_BROW_LASH_SETTINGS=Object.freeze({
 lashes:true,browDensity:1.3,browWidth:1.03,browLength:.90,
 fiberWidth:1,browArch:0,color:'#302720',roughness:.50,
 lashDensity:1,lashLength:.92,lashCurl:1
});

export function attachObservedBrows(api,guides={}){
 const m=api.motion().controller.model,v=api.motion().viewer,g=m.gnm;
 const map=new Int32Array(g.numVertices).fill(-1);
 for(let k=0;k<m.canonical.gnmRecipes.length;k++){
  const[a,b,t]=m.canonical.gnmRecipes[k];
  if(a===b||t===0)map[a]=m.bodyCount+k;else if(t===1)map[b]=m.bodyCount+k;
 }
 const skin=new Uint8Array(m.vertexCount),eyeIds=[[],[]];
 skin.fill(1,0,m.bodyCount);
 for(let k=0;k<m.canonical.gnmRecipes.length;k++){
  const[a,b,t]=m.canonical.gnmRecipes[k],ca=g.componentId[a],cb=g.componentId[b];
  if(a!==b&&t>0&&t<1&&ca!==cb)throw Error('Mixed native component recipe');
  const c=t===1?cb:ca,i=m.bodyCount+k;
  if(c===0)skin[i]=1;else if(c===1||c===2)eyeIds[c-1].push(i);
 }
 for(const[id,a]of Object.entries(guides)){
  if(!Number.isInteger(Number(id))||Number(id)<17||Number(id)>26)
   throw Error('Only observed brow landmarks may be overridden');
  if(a.ids.length!==3||a.weights.length!==3||
   a.weights.some(w=>!Number.isFinite(w)||w< -1e-7||w>1+1e-7)||
   Math.abs(a.weights.reduce((x,y)=>x+y,0)-1)>1e-6||
   a.ids.some(i=>!Number.isInteger(i)||!skin[i]))
   throw Error('Invalid current-skin brow guide');
 }
 const sample=(ids,weights)=>[0,1,2].map(k=>ids.reduce((s,i,j)=>s+m.positions[i*3+k]*weights[j],0));
 const landmark=i=>{
  if(guides[String(i)])return sample(guides[String(i)].ids,guides[String(i)].weights);
  const ids=Array.from(g.landmarkIndices.slice(i*3,i*3+3),x=>map[x]);
  const weights=Array.from(g.landmarkWeights.slice(i*3,i*3+3));
  if(ids.length!==3||ids.some(x=>x<0)||weights.some(w=>!Number.isFinite(w)))
   throw Error('Unmapped native landmark '+i);
  const total=weights.reduce((a,b)=>a+b,0);
  if(Math.abs(total)<1e-12)throw Error('Invalid native landmark weights '+i);
  return sample(ids,weights.map(x=>x/total));
 };
 // Eyelid hints 36–47 always come from this model's native landmark recipes.
 for(let i=36;i<=47;i++)if(!landmark(i).every(Number.isFinite))throw Error('Invalid native eyelid landmark '+i);
 if(eyeIds.some(ids=>!ids.length))throw Error('Current native eye components are required');
 const model={get positions(){return m.positions},faces:m.faces,vertexCount:m.vertexCount,
  canonical:m.canonical,eyeSurface:{landmark,eyes:eyeIds.map(vertices=>({vertices})),skin},
  archive:()=>m.archive(),restore:a=>m.restore(a)};
 const originalRender=v.render,controller=new EventTarget();
 const groom=new BrowLashGroom({model,viewer:v,controller});
 try{groom.set(OBSERVED_BROW_LASH_SETTINGS);}catch(error){
  groom.dispose();v.render=originalRender;throw error;
 }
 return{
  group:groom.group,
  set:patch=>groom.set(patch),
  rebuild:()=>{groom.build();v.render();return groom.report();},
  report(){return{...groom.report(),sourceCommit:'dffe7e6de138a72064fd7e8d9766040092715153',
   currentHeadRebound:true,eyeSystemReplaced:false,sourceLashGenerationDisabled:false,
   guideCount:Object.keys(guides).length,
   eyelidLandmarks:'Current native GNM landmarks 36–47 through canonical recipes',
   rootSupport:'Current skin/globe visible-rim depth crossing, then current skin triangle barycentrics',
   nativeEyeVertexCounts:eyeIds.map(ids=>ids.length),
   limitations:['Root transport is triangle bound; no hair collision or eyelid-contact physics solver.',
    'Visible-rim detection uses a head-front chart; oblique view and animated blinking still require visual review.']};},
  dispose:()=>{groom.dispose();v.render=originalRender;}
 };
}
