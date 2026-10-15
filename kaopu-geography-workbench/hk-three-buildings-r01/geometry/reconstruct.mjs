/**
 * HK measured-boundary research adapter 0.1.0.
 * Source glTF, source preview, triangle arrays and extraction audit are NEVER
 * read by this module. A shared Three.js ShapeUtils (Earcut) triangulates the
 * measured polygon boundaries, including interior loops. Three.js is MIT.
 */
export const GENERATOR = Object.freeze({id:'hk-measured-boundary',version:'0.1.0'});

function finite(value,name){if(!Number.isFinite(value))throw new Error(`Non-finite ${name}`);return value;}
function signedArea(loop){let s=0;for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function normalise(v){const n=Math.hypot(...v);if(n<1e-14)throw new Error('Degenerate normal');return v.map(x=>x/n);}

export function validateScore(score){
  if(score?.adapter!=='kaopu.hk.measured-plane-boundary/0.1-research')throw new Error('Unsupported research adapter');
  if(score.units!=='metre')throw new Error('Metre units required');
  if(score.reconstruction?.generator!==GENERATOR.id||score.reconstruction.version!==GENERATOR.version)throw new Error('Generator version mismatch');
  if(!Array.isArray(score.reconstruction.operations)||score.reconstruction.operations.length>20000)throw new Error('Recipe operation budget');
  const ids=new Set();
  for(const op of score.reconstruction.operations){
    if(ids.has(op.id))throw new Error('Duplicate recipe id');ids.add(op.id);
    if(!['wallStrip','wallProfile','roofPlane','undersidePlane'].includes(op.kind))throw new Error('Unsupported operation');
    if(op.kind==='wallStrip'){
      if(!Array.isArray(op.edge)||op.edge.length!==2||op.edge.some(p=>p.length!==2||p.some(x=>!Number.isFinite(x))))throw new Error('Invalid wall edge');
      finite(op.bottom,'bottom');finite(op.top,'top');if(op.top<=op.bottom)throw new Error('Wall top must exceed bottom');
    }else{
      if(!Array.isArray(op.loops)||!op.loops.length||op.loops.some(l=>l.length<3||l.some(p=>p.length!==2||p.some(x=>!Number.isFinite(x)))))throw new Error('Invalid boundary loops');
      if(op.kind==='wallProfile'){
        for(const key of ['origin','tangent','horizontalDriftPerHeight'])if(op[key]?.length!==2||op[key].some(x=>!Number.isFinite(x)))throw new Error('Invalid wall frame');
      }else if(op.heightPlane?.length!==3||op.heightPlane.some(x=>!Number.isFinite(x)))throw new Error('Invalid roof plane');
    }
  }
  for(const key of ['scaleEast','scaleNorth','scaleHeight']){const v=score.edits?.[key]??1;if(!Number.isFinite(v)||v<0.25||v>3)throw new Error('Edit scale must be 0.25–3');}
  return true;
}

function decodeOperation(op){
  if(op.kind==='wallStrip'){
    const [a,b]=op.edge,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<1e-9)throw new Error('Zero wall length');
    return{loops:[[[0,op.bottom],[len,op.bottom],[len,op.top],[0,op.top]]],map:([s,h])=>[a[0]+dx*s/len,a[1]+dy*s/len,h],normal:normalise([dy,-dx,0]),material:0};
  }
  if(op.kind==='wallProfile'){
    const a=op.origin,t=op.tangent,d=op.horizontalDriftPerHeight;
    return{loops:op.loops,map:([s,h])=>[a[0]+t[0]*s+d[0]*h,a[1]+t[1]*s+d[1]*h,h],normal:normalise(cross([t[0],t[1],0],[d[0],d[1],1])),material:0};
  }
  const [a,b,c]=op.heightPlane,sign=op.kind==='undersidePlane'?-1:1;
  return{loops:op.loops,map:([e,n])=>[e,n,a*e+b*n+c],normal:normalise([-a*sign,-b*sign,sign]),material:sign>0?1:2};
}

/** Return non-indexed triangle buffers, deterministic recipe groups and normals.
 * Optional edit scales are applied coherently to every measured boundary; this
 * is an explicitly authored deformation, not a new historical observation.
 */
export function reconstructBuffers(score,THREE){
  validateScore(score);
  if(!THREE?.ShapeUtils?.triangulateShape)throw new Error('Three.js ShapeUtils is required');
  const scales=[score.edits?.scaleEast??1,score.edits?.scaleNorth??1,score.edits?.scaleHeight??1];
  const positions=[],normals=[],groups=[],patches=[];
  for(const op of score.reconstruction.operations){
    const p=decodeOperation(op),loops=p.loops.map(l=>l.map(q=>q.slice()));
    // Outer and holes have explicit roles, not guessed from a raw mesh.
    if(signedArea(loops[0])<0)loops[0].reverse();
    for(let i=1;i<loops.length;i++)if(signedArea(loops[i])>0)loops[i].reverse();
    const flat=loops.flat(),outer=loops[0].map(q=>new THREE.Vector2(...q)),holes=loops.slice(1).map(l=>l.map(q=>new THREE.Vector2(...q)));
    const faces=THREE.ShapeUtils.triangulateShape(outer,holes);if(!faces.length)throw new Error('Triangulation failed for '+op.id);
    const n=normalise(p.normal.map((v,i)=>v/scales[i])),displayN=[n[0],n[2],-n[1]],start=positions.length/3;
    for(const face of faces){
      let xyz=face.map(i=>p.map(flat[i]).map((v,j)=>v*scales[j]));
      const u=xyz[1].map((v,i)=>v-xyz[0][i]),v=xyz[2].map((v,i)=>v-xyz[0][i]),c=cross(u,v);
      if(c.reduce((s,v,i)=>s+v*n[i],0)<0)[xyz[1],xyz[2]]=[xyz[2],xyz[1]];
      for(const q of xyz){positions.push(q[0],q[2],-q[1]);normals.push(...displayN);}
    }
    const count=positions.length/3-start;groups.push({start,count,materialIndex:p.material});patches.push({id:op.id,kind:op.kind,start,count,holes:loops.length-1});
  }
  return{positions:new Float32Array(positions),normals:new Float32Array(normals),indices:null,groups,patches,edited:scales.some(v=>v!==1)};
}

export function buildGeometry(score,THREE){
  const data=reconstructBuffers(score,THREE),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  for(const g of data.groups)geometry.addGroup(g.start,g.count,g.materialIndex);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometry.userData={objectId:score.objectId,generator:GENERATOR,patches:data.patches,edited:data.edited,sourceMeshReadAtRuntime:false};
  return geometry;
}
