'use strict';
// Original compact field on the existing GNM skin, not a replacement head.
function installNativeLocalField({model:m,target}){
 const g=m.gnm,N=g.numVertices,scale=m.headScale;
 if(N!==17821||Math.abs(scale-target.sourceScale)>1e-10)throw Error('Local field source scale mismatch');
 const identity=Array.from(m.state.gnm.identity),original=g.computeVertices,originalTemplate=g.template,adj=Array.from({length:N},()=>new Set()),P=Array.from({length:N},(_,i)=>Array.from(g._bind.slice(3*i,3*i+3),x=>x*scale)),normal=Array.from({length:N},()=>[0,0,0]),skin=Array.from(g.componentId).flatMap((c,i)=>c===0?[i]:[]),blocked=new Set();
 const sub=(a,b)=>a.map((x,i)=>x-b[i]),norm=a=>Math.hypot(...a),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(let f=0;f<g.triangles.length;f+=3){const ids=Array.from(g.triangles.slice(f,f+3));if(ids.some(v=>g.componentId[v]!==0))continue;const n=cross(sub(P[ids[1]],P[ids[0]]),sub(P[ids[2]],P[ids[0]]));for(const i of ids){for(let a=0;a<3;a++)normal[i][a]+=n[a];for(const j of ids)if(i!==j)adj[i].add(j);}}
 for(const i of skin){const n=norm(normal[i]);if(!(n>0))throw Error('Degenerate source normal');normal[i]=normal[i].map(x=>x/n);}
 for(const c of ['nasal_skin','oral_skin','left_ocular_skin','right_ocular_skin'])for(const s of ['_ids','_boundary']){if(!m.headTransfer.d[c+s]?.length)throw Error('Missing source cavity');for(const i of m.headTransfer.d[c+s])blocked.add(i);}
 // All lip and periorbital semantic regions remain outside this diagnostic field.
 for(const i of skin)if([0,1,2,3,4,5,6,7,13,14,17,18,19].includes(g.regionId[i]))blocked.add(i);
 for(const i of [...blocked])for(const j of adj[i])blocked.add(j);
 const seeds=target.targets.filter(t=>!blocked.has(t.vertex));if(seeds.length<8)throw Error('Insufficient local support outside protected organs');
 function distances(seeds,max,block){const d=new Float64Array(N).fill(Infinity),queue=[];for(const i of seeds){d[i]=0;queue.push([0,i]);}while(queue.length){queue.sort((a,b)=>b[0]-a[0]);const[x,i]=queue.pop();if(x!==d[i])continue;for(const j of adj[i]){if(block&&blocked.has(j))continue;const next=x+norm(sub(P[j],P[i]));if(next<=max&&next<d[j]){d[j]=next;queue.push([next,j]);}}}return d;}
 const radius=.012,d=distances(seeds.map(t=>t.vertex),radius,true),organDistance=distances([...blocked],.006,false),support=skin.filter(i=>d[i]<radius&&!blocked.has(i)),index=new Map(support.map((v,i)=>[v,i])),goals=new Map(seeds.map(t=>[t.vertex,t.amountM])),u=new Float64Array(support.length),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},mask=support.map(v=>Math.max(0,1-(d[v]/radius)**2)**2*smooth(organDistance[v]/.005));
 const weights=support.map(v=>{const rows=[];for(const j of adj[v]){const length=norm(sub(P[j],P[v]));if(length>1e-9)rows.push({j:index.get(j),weight:1/length});}return rows;});
 // Screened harmonic interpolation, with zero outside the compact region.
 // Target attraction and smoothness use the same local degree normalization.
 let lastChange=Infinity,iterations=0;for(;iterations<500;iterations++){lastChange=0;for(let i=0;i<support.length;i++){const v=support[i],rows=weights[i],degree=rows.reduce((s,r)=>s+r.weight,0),targetWeight=goals.has(v)?10:0;let sum=0;for(const r of rows)if(r.j!==undefined)sum+=r.weight*u[r.j]/degree;const next=(sum+targetWeight*(goals.get(v)||0))/(1+.02+targetWeight);lastChange=Math.max(lastChange,Math.abs(next-u[i]));u[i]=next;}if(lastChange<1e-10)break;}
 if(lastChange>1e-8)throw Error('Local field interpolation failed to converge');const delta=new Float32Array(N*3),records=[];for(let i=0;i<support.length;i++){const v=support[i],amount=u[i]*mask[i];if(Math.abs(amount)>.00075)throw Error('Local field exceeded fixed trust limit');for(let a=0;a<3;a++)delta[v*3+a]=normal[v][a]*amount/scale;records.push({source:v,amountM:amount,targetM:goals.get(v)??null,mask:mask[i]});}
 let strength=0,disposed=false;const shiftedTemplate=originalTemplate.slice();
 function update(){shiftedTemplate.set(originalTemplate);for(let i=0;i<delta.length;i++)if(delta[i]!==0)shiftedTemplate[i]=originalTemplate[i]+delta[i]*strength;}
 g.computeVertices=function(out){if(disposed)throw Error('Disposed local field');if(this.identity.some((x,i)=>Math.abs(x-Math.fround(identity[i]))>1e-7))throw Error('Local field is bound to the fixed R52 identity');this.template=shiftedTemplate;try{return original.call(this,out);}finally{this.template=originalTemplate;}};
 update();
 return{setStrength(value){if(disposed||!Number.isFinite(value)||value<0||value>1)throw Error('Invalid local field strength');strength=value;update();g.dirty=true;},report(){return{schema:'native-compact-crease-field/1',sameNativeTopology:true,baselineIdentityFrozen:true,strength,sourceSkinVertices:skin.length,sourceSupportCount:support.length,blockedCount:blocked.size,validationGroups:{organ:[...blocked],far:skin.filter(i=>!index.has(i)&&!blocked.has(i)),near:support},targets:seeds,sourceTargetCount:seeds.length,removedProtectedTargets:target.targets.length-seeds.length,radiusM:radius,organFadeM:.005,partialResidualFraction:target.partialResidualFraction,iterations,lastChangeM:lastChange,maximumSourceDisplacementM:Math.max(...records.map(r=>Math.abs(r.amountM))),records,method:'screened harmonic scalar residual, normal displacement, compact smooth taper, original native bind before expression/rig, no template asset mutation'};},dispose(){g.computeVertices=original;g.template=originalTemplate;disposed=true;g.dirty=true;}};
}
module.exports={installNativeLocalField};
