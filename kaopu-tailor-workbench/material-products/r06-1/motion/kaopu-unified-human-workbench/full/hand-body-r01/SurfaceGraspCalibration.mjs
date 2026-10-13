/** Once-per-shape geometric fit of a small prop to the existing full-CSR hand.
 * Vertex clearance is a diagnostic, not triangle collision or force closure.
 * No topology/weights/rest shape are changed; every sampled vertex uses all
 * its original influences. Calibration remains separate from real-time IK.
 */
export function calibrateSphereGrasp(human,rig,{side='L'}={}){
 if(!['L','R'].includes(side))throw Error('Invalid hand side');
 const h=rig.stature,r=rig.evaluate(3,{task:'grasp',side});human.animate(r.skinMatrices);const center=r.object.position.slice(),radius=r.object.radius,points=[],caps={1:[],2:[]};
 for(let v=0;v<human.N;v++){let hand=0,thumb=0,index=0;for(let k=0;k<human.range[v*2+1];k++){const o=(human.range[v*2]+k)*8,name=human.names[human.packed[o+3]],w=human.packed[o+4];if(/(?:finger|metacarpal|wrist)/.test(name)&&name.endsWith('.'+side))hand+=w;if(name==='finger1-3.'+side)thumb+=w;if(name==='finger2-3.'+side)index+=w;}if(hand>.5){const p=human.sampleVertex(v);points.push(p);if(thumb>.4)caps[1].push(p);if(index>.4)caps[2].push(p);}}
 const mean=ps=>ps.reduce((s,p)=>s.map((v,k)=>v+p[k]/ps.length),[0,0,0]),tm=mean(caps[1]),im=mean(caps[2]);let best=tm.map((v,k)=>(v+im[k])/2),score=Infinity,distances=null,count=0;
 const distance=(ps,p)=>{let d=Infinity;for(const q of ps){const v=(q[0]-p[0])**2+(q[1]-p[1])**2+(q[2]-p[2])**2;if(v<d)d=v;}return Math.sqrt(d);};
 for(const [extent,step] of [[.04,.008],[.008,.002],[.002,.0005]]){const origin=best.slice();for(let x=-extent;x<=extent+1e-8;x+=step)for(let y=-extent;y<=extent+1e-8;y+=step)for(let z=-extent;z<=extent+1e-8;z+=step){const p=origin.map((v,k)=>v+[x,y,z][k]*h),d=distance(points,p),a=distance(caps[1],p),b=distance(caps[2],p),cost=(a-radius)**2+(b-radius)**2+Math.max(0,radius+.001-d)**2*10000;count++;if(cost<score){score=cost;best=p;distances={nearestSkinM:d,thumbRegionM:a,indexRegionM:b};}}}
 const offset=[(side==='L'?1:-1)*h*.006,h*.043,h*.025].map((v,k)=>v+center[k]-best[k]);rig.previousGrip=false;
 return{schema:'sphere-grasp-vertex-calibration/1',offset,radius,sampledVertices:points.length,candidates:count,skinMarginM:distances.nearestSkinM-radius,distances,scope:'vertex clearance only; not triangle collision, pad contact or force closure'};
}
export function measurePropVertexClearance(human,object){
 let maxPenetrationM=0,verticesInside=0,sampledVertices=0;
 for(let v=0;v<human.N;v++){let w=0;for(let k=0;k<human.range[v*2+1];k++){const o=(human.range[v*2]+k)*8;if(/finger|metacarpal|wrist/.test(human.names[human.packed[o+3]]))w+=human.packed[o+4];}if(w<=.5)continue;sampledVertices++;const p=human.sampleVertex(v),d=p.map((x,k)=>Math.abs(x-object.position[k])-object.halfExtentsNative[k]);const depth=object.shape==='sphere'?object.radius-Math.hypot(...p.map((x,k)=>x-object.position[k])):d.every(x=>x<0)?-Math.max(...d):0;if(depth>0){verticesInside++;maxPenetrationM=Math.max(maxPenetrationM,depth);}}
 return{maxPenetrationM,verticesInside,sampledVertices,scope:'hand vertices versus declared prop; no triangle or force-closure certification'};
}
