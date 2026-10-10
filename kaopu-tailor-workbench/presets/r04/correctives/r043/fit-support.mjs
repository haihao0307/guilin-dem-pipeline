/** Native material-circuit support. No body deformation or display-only displacement. */
export function exactBodyBounds(body){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of body.positionsMm)for(let k=0;k<3;k++){if(!Number.isFinite(p[k]))throw Error('BODY_BOUNDS_NONFINITE');lo[k]=Math.min(lo[k],p[k]*.001);hi[k]=Math.max(hi[k],p[k]*.001)}return{lo,hi};}
export function attachExteriorField(sdf,body){
 const bounds=exactBodyBounds(body),m=sdf.meta;
 for(let k=0;k<3;k++)if(bounds.lo[k]*1000<m.originMm[k]||bounds.hi[k]*1000>m.originMm[k]+(m.dimensions[k]-1)*m.spacingMm)throw Error('BODY_NOT_ENCLOSED_BY_NATIVE_FIELD');
 const sample=sdf.sample.bind(sdf);sdf.sample=(x,y,z,out)=>{sample(x,y,z,out);if(out[4])return out;const p=[x,y,z],d=p.map((v,k)=>v<bounds.lo[k]?v-bounds.lo[k]:v>bounds.hi[k]?v-bounds.hi[k]:0),len=Math.hypot(...d);if(!(len>0))return out;out[0]=len;out[1]=d[0]/len;out[2]=d[1]/len;out[3]=d[2]/len;out[4]=1;return out;};sdf.exteriorBounds=bounds;return bounds;
}
export function waistCircuit(lab,analytic,{maximumCircumferenceStretch=.03}={}){
 const refs=analytic.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='top').flatMap(i=>i.edges);
 if(!refs.length)return{enabled:false,reason:'no original waistband top interfaces'};
 const ids=[],spans=[],targets=[];let rest=0;const degrees=new Map();
 for(const ref of refs){const p=lab.spec.panels.find(p=>p.id===ref.panelId);if(!p)throw Error('WAIST_SOURCE_PANEL_MISSING');const path=p.edges['e'+ref.edge];if(!path)throw Error('WAIST_SOURCE_EDGE_MISSING');const off=lab.offsets.get(p.id);
  for(let i=0;i<path.length-1;i++){const a=off+path[i],b=off+path[i+1];ids.push(a,b);rest+=Math.hypot(...p.uvMm[path[i]].map((v,k)=>v-p.uvMm[path[i+1]][k]))*.001;for(const id of[a,b]){const root=lab.stitchGroups.find(id);degrees.set(root,(degrees.get(root)||0)+1);}}
 }
 if([...degrees.values()].some(d=>d!==2))return{enabled:false,reason:'native waistband is not yet sewn into a closed material circuit',degrees:[...degrees.values()].filter(d=>d!==2)};
 if(ids.length>lab.positions.length*2)throw Error('WAIST_CIRCUIT_CAPACITY');
 new Int32Array(lab.kernel.memory.buffer,lab.ptr.w43ids,ids.length).set(ids);new Int32Array(lab.kernel.memory.buffer,lab.ptr.w43spans,2).set([0,ids.length/2]);new Float64Array(lab.kernel.memory.buffer,lab.ptr.w43targets,1).set([rest*(1+maximumCircumferenceStretch)]);
 lab.kernel.setWaistLoops43(lab.ptr.w43ids,lab.ptr.w43spans,lab.ptr.w43targets,lab.ptr.w43scratch,1);lab.waistCircuit43=true;
 return{enabled:true,edgeCount:ids.length/2,originalPerimeterMm:rest*1000,maximumCircumferenceStretch,worldPins:false,materialCalibration:false,sourceRefs:refs};
}
