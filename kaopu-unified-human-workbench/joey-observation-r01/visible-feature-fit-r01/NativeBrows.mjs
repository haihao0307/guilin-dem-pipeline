import {BrowLashGroom} from './brow-source/Groom.mjs';
/** Only the new source's brow fibers and triangle transport are reused.
 * The model facade leaves the actual person's archive/restore and eye system intact.
 * Source-space landmarks are explicitly rebuilt from the current canonical recipes.
 */
export function attachObservedBrows(api, guides){
 const m=api.motion().controller.model,v=api.motion().viewer,g=m.gnm;
 const map=new Int32Array(g.numVertices).fill(-1);
 for(let k=0;k<m.canonical.gnmRecipes.length;k++){const[a,b,t]=m.canonical.gnmRecipes[k];if(a===b||t===0)map[a]=m.bodyCount+k;else if(t===1)map[b]=m.bodyCount+k;}
 const sample=(ids,weights)=>{const p=m.positions;return[0,1,2].map(k=>ids.reduce((s,i,j)=>s+p[i*3+k]*weights[j],0));};
 const landmark=i=>{
  if(guides[String(i)])return sample(guides[String(i)].ids,guides[String(i)].weights);
  const ids=Array.from(g.landmarkIndices.slice(i*3,i*3+3),x=>map[x]),weights=Array.from(g.landmarkWeights.slice(i*3,i*3+3));if(ids.some(x=>x<0))throw Error('Unmapped native landmark '+i);
  const total=weights.reduce((a,b)=>a+b,0);return sample(ids,weights.map(x=>x/total));
 };
 const skin=new Uint8Array(m.vertexCount),eyeIds=[[],[]];
 for(let i=0;i<m.bodyCount;i++)skin[i]=1;
 for(let k=0;k<m.canonical.gnmRecipes.length;k++){const[a,b,t]=m.canonical.gnmRecipes[k],c=g.componentId[t<.5?a:b],i=m.bodyCount+k;if(c===0)skin[i]=1;else if(c===1||c===2)eyeIds[c-1].push(i);}
 for(const a of Object.values(guides)){if(a.ids.length!==3||a.weights.length!==3||Math.abs(a.weights.reduce((x,y)=>x+y,0)-1)>1e-6||a.ids.some(i=>!skin[i]))throw Error('Invalid current-skin brow guide');}
 const model={get positions(){return m.positions},faces:m.faces,vertexCount:m.vertexCount,canonical:m.canonical,eyeSurface:{landmark,eyes:eyeIds.map(vertices=>({vertices})),skin},archive:()=>m.archive(),restore:a=>m.restore(a)};
 const originalRender=v.render,controller=new EventTarget(),groom=new BrowLashGroom({model,viewer:v,controller});groom.set({lashes:false,browDensity:1.1,browWidth:1.0,browLength:.85,fiberWidth:.92,browArch:0,color:'#3b3028'});
 return{group:groom.group,report(){const r=groom.report();return{...r,sourceCommit:'dffe7e6de138a72064fd7e8d9766040092715153',currentHeadRebound:true,eyeSystemReplaced:false,sourceLashGenerationDisabled:true,guideCount:Object.keys(guides).length};},dispose:()=>{groom.dispose();v.render=originalRender;}};
}
