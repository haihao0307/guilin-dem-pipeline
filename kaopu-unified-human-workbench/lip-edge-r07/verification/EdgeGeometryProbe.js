/* R07 read-only native/actual-draw triangle sections. No mutation, render,
 * update, stage hooks, invented surface correspondence or thickness claim. */
(function () {
  'use strict';
  const VERSION = 'native-draw-edge-sections@1';
  const STATIONS = [-.45, 0, .45], LIMIT = 2400;
  let c = null, samples = 0, last = null;
  const sub = (a, b) => a.map((v, k) => v - b[k]);
  const dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit = a => { const n = Math.hypot(...a); if (!(n > 1e-12)) throw Error('Degenerate mouth frame'); return a.map(v => v/n); };
  const at = (a, i) => [a[i*3],a[i*3+1],a[i*3+2]];
  function fingerprint(a) {
    if (!a?.buffer) return null;
    const b = new Uint8Array(a.buffer,a.byteOffset,a.byteLength); let h=2166136261;
    for (let i=0;i<b.length;i++) h=Math.imul(h^b[i],16777619);
    return (h>>>0).toString(16).padStart(8,'0')+':'+b.length;
  }
  function frame() {
    const lm=i=>c.model.faceSurface.fields.landmark(c.model.positions,i);
    const left=lm(48), right=lm(54), x=unit(sub(right,left)), v=sub(lm(27),lm(8));
    const up=unit(v.map((q,k)=>q-x[k]*dot(v,x))), center=lm(62).map((q,k)=>(q+lm(66)[k])*.5);
    let front=unit(cross(x,up)); if(dot(front,sub(lm(30),center))<0)front=front.map(q=>-q);
    const convert=a=>[a[0],a[2],-a[1]];
    return {source:'Native ao landmark frame; canonical [x,y,z] converted to display [x,z,-y]',
      center:convert(center),x:convert(x),up:convert(up),front:convert(front),width:Math.hypot(...sub(right,left)),
      units:'native display metres; section coordinates and lengths below in mm'};
  }
  function check() {
    if(!c||c.restored)throw Error('Install R07 geometry probe first');
    if(c.viewer.currentLip!==c.lip||c.solver.topology!==c.top||c.top.geometry!==c.lip.geometry||
      c.model.lipStructure.mother.surfaces.get(c.lip.geometry)!==c.solver)throw Error('Native observation domain changed');
    if(c.solver.apply!==c.apply||c.viewer.update!==c.update||c.viewer.render!==c.render)throw Error('Solver/update/render identity changed');
  }
  function arrays(g) {
    const p=g?.attributes?.position, ix=g?.index;
    if(!p||p.itemSize!==3||p.isInterleavedBufferAttribute||!ix||ix.itemSize!==1||ix.isInterleavedBufferAttribute||ix.array.length%3)
      throw Error('Actual indexed noninterleaved triangle geometry unavailable');
    if(p.array.length!==p.count*3)throw Error('Invalid position domain');
    return {p:p.array,index:ix.array,count:p.count};
  }
  function signature(g) {
    const out={index:fingerprint(g.index?.array)};
    for(const [name,a]of Object.entries(g.attributes||{}))out[name]=fingerprint(a.array);
    return out;
  }
  function semantic(g,id,native) {
    const out={};
    for(const name of ['csType','l19Oral','l19State','l19Detail']) {
      const a=g.attributes[name];
      if(!a||a.isInterleavedBufferAttribute||id>=a.count){out[name]=null;continue;}
      out[name]=Array.from(a.array.subarray(id*a.itemSize,(id+1)*a.itemSize));
    }
    if(native){const s=c.top.samples[id];out.sample=s?Object.fromEntries(['u','v','upper','weight','inner','red','rim','skin','front','depth','type'].map(k=>[k,s[k]??null])):null;}
    return out;
  }
  function interpolate(g, a, b, t, f) {
    const pa=at(g.attributes.position.array,a),pb=at(g.attributes.position.array,b),p=pa.map((v,k)=>v+(pb[k]-v)*t),q=sub(p,f.center);
    const result={edge:[a,b],t,position:p,mouthMM:[dot(q,f.x)*1000,dot(q,f.up)*1000,dot(q,f.front)*1000],attributes:{}};
    for(const name of ['normal','l19Oral','l19State','l19Detail']){
      const x=g.attributes[name]; if(!x||x.isInterleavedBufferAttribute||Math.max(a,b)>=x.count){result.attributes[name]=null;continue;}
      result.attributes[name]=Array.from({length:x.itemSize},(_,k)=>x.array[a*x.itemSize+k]*(1-t)+x.array[b*x.itemSize+k]*t);
    }
    return result;
  }
  function cut(g,f,native) {
    const {p,index,count}=arrays(g), xyz=new Float64Array(count*3), relevant=new Uint8Array(count);
    for(let id=0;id<count;id++){
      const q=sub(at(p,id),f.center),o=id*3;
      xyz[o]=dot(q,f.x);xyz[o+1]=dot(q,f.up);xyz[o+2]=dot(q,f.front);
      if(!Number.isFinite(xyz[o]+xyz[o+1]+xyz[o+2]))throw Error('Nonfinite actual geometry position');
      relevant[id]=xyz[o+1]>=-.035&&xyz[o+1]<=.022&&xyz[o+2]>=-.025&&xyz[o+2]<=.020?1:0;
    }
    const sections=STATIONS.map(u=>({u,planeXMM:u*f.width*.5*1000,totalSegments:0,coplanarTriangles:0,degenerateIntersections:0,segments:[]}));
    const vertices=new Map();
    const groupAt=offset=>{const a=(g.groups||[]).filter(x=>offset>=x.start&&offset<x.start+x.count).map(x=>x.materialIndex);return a.length?a:[0];};
    for(let i=0;i<index.length;i+=3){
      const ids=[index[i],index[i+1],index[i+2]];
      if(ids.some(id=>!Number.isInteger(id)||id<0||id>=count))throw Error('Invalid original triangle index');
      // Bounding boxes reject only triangles wholly outside this explicit mouth ROI.
      const ys=ids.map(id=>xyz[id*3+1]),zs=ids.map(id=>xyz[id*3+2]);
      if(Math.max(...ys)<-.035||Math.min(...ys)>.022||Math.max(...zs)<-.025||Math.min(...zs)>.020)continue;
      for(const s of sections){
        const plane=s.planeXMM/1000,d=ids.map(id=>xyz[id*3]-plane);
        if(Math.min(...d)>0||Math.max(...d)<0)continue;
        if(d.every(v=>Math.abs(v)<1e-12)){s.coplanarTriangles++;continue;}
        const hits=[];
        for(let e=0;e<3;e++){
          const j=(e+1)%3,da=d[e],db=d[j]; if((da<0&&db<0)||(da>0&&db>0)||Math.abs(da-db)<1e-15)continue;
          const t=da/(da-db);if(t<0||t>1)continue;
          const hit=interpolate(g,ids[e],ids[j],t,f);
          if(!hits.some(h=>Math.hypot(...sub(h.position,hit.position))<1e-10))hits.push(hit);
        }
        if(hits.length!==2){s.degenerateIntersections++;continue;}
        // Intersections are retained when their segment bbox overlaps the ROI;
        // endpoints remain exact triangle-plane intersections, not clipped guesses.
        if(Math.max(...hits.map(h=>h.mouthMM[1]))<-35||Math.min(...hits.map(h=>h.mouthMM[1]))>22||
          Math.max(...hits.map(h=>h.mouthMM[2]))<-25||Math.min(...hits.map(h=>h.mouthMM[2]))>20)continue;
        s.totalSegments++;if(s.segments.length>=LIMIT)continue;
        const pn=ids.map(id=>at(p,id)),normal=cross(sub(pn[1],pn[0]),sub(pn[2],pn[0])),norm=Math.hypot(...normal);
        const n=norm>1e-16?normal.map(v=>v/norm):null;
        s.segments.push({triangle:i/3,indexOffset:i,vertexIDs:ids,materialSlots:groupAt(i),endpoints:hits,
          lengthMM:Math.hypot(...sub(hits[1].position,hits[0].position))*1000,triangleNormal:n,
          triangleNormalMouth:n?[dot(n,f.x),dot(n,f.up),dot(n,f.front)]:null,triangleAreaMM2:norm*.5e6});
        for(const id of ids)if(!vertices.has(id))vertices.set(id,{id,position:at(p,id),mouthMM:[xyz[id*3]*1000,xyz[id*3+1]*1000,xyz[id*3+2]*1000],...semantic(g,id,native)});
      }
    }
    for(const s of sections){s.returnedSegments=s.segments.length;s.truncated=s.totalSegments>s.segments.length;}
    return {source:native?'Native solver.topology.geometry original index/position':'Actual viewer.mesh.geometry original draw index/position',
      vertices:count,indexCount:index.length,trianglesScanned:index.length/3,indexed:true,
      attributes:Object.fromEntries(['position','normal','csType','l19Oral','l19State','l19Detail'].map(k=>[k,g.attributes[k]?{count:g.attributes[k].count,itemSize:g.attributes[k].itemSize}:null])),
      geometryGroups:(g.groups||[]).map(x=>({...x})),
      roi:{upMM:[-35,22],frontMM:[-25,20],typeFilter:'None. Skin, oral and teeth retained with actual csType; no assumed semantic-to-anatomy equivalence.',endpointClipping:false},
      sections,vertexSemantics:[...vertices.values()],nonempty:sections.some(s=>s.totalSegments>0),
      bounds:{maxSegmentsPerStation:LIMIT,selection:'Original index order; all triangles scanned and all intersection totals counted.'}};
  }
  function install(viewer,model){
    if(c&&!c.restored)throw Error('Geometry probe already installed');
    const lip=viewer?.currentLip,solver=model?.lipStructure?.mother?.surfaces?.get(lip?.geometry),top=solver?.topology;
    if(!top||top.geometry!==lip.geometry)throw Error('Frozen native lip evaluator unavailable');
    c={viewer,model,lip,solver,top,apply:solver.apply,update:viewer.update,render:viewer.render,restored:false};
    arrays(top.geometry);arrays(viewer.mesh.geometry);samples=0;last=null;return report();
  }
  function sample(){
    check();const ng=c.top.geometry,dg=c.viewer.mesh.geometry,nb=signature(ng),db=signature(dg),base=fingerprint(c.solver.base),canonical=fingerprint(c.model.positions),f=frame();
    const native=cut(ng,f,true),draw=cut(dg,f,false);
    check();const unchanged=JSON.stringify(nb)===JSON.stringify(signature(ng))&&JSON.stringify(db)===JSON.stringify(signature(dg))&&base===fingerprint(c.solver.base)&&canonical===fingerprint(c.model.positions);
    if(!unchanged)throw Error('Read-only probe observed changed native/draw/canonical buffers');
    if(!native.nonempty||!draw.nonempty)throw Error('No actual native/draw mouth cross-section intersections');
    const sameGeometry=ng===dg,samePositionArray=ng.attributes.position.array===dg.attributes.position.array,sameIndexArray=ng.index.array===dg.index.array;
    samples++;last={nonempty:true,nativeSegments:native.sections.map(s=>s.totalSegments),drawSegments:draw.sections.map(s=>s.totalSegments),readOnlyExact:unchanged};
    return {version:VERSION,sample:samples,pose:window.lipWorkbench?.pose?.()||null,coordinateFrame:f,native,draw,
      correspondence:{sameGeometry,samePositionArray,sameIndexArray,proven:samePositionArray&&sameIndexArray,
        method:samePositionArray&&sameIndexArray?'Identical actual arrays':'No native-to-draw correspondence inferred. Independent actual domains; no prefix assumption.'},
      drawObject:{type:c.viewer.mesh.type,matrixWorld:c.viewer.mesh.matrixWorld?.toArray?.()||null,skinned:!!c.viewer.mesh.isSkinnedMesh,morphInfluences:c.viewer.mesh.morphTargetInfluences||null,
        limitation:'Sections use actual draw position attributes before any GPU-only skinning/morph/displacement. Vertex shader or material displacement is not reconstructed; no visible-pixel attribution is claimed.'},
      stages:{nativeFinal:'After existing complete R05/R06/native update, sampled without update',beforeLocalFingerprint:base,
        limitation:'This helper does not measure pre/post closure or envelope separately; the independent stage observer supplies those boundaries.'},
      readOnly:{unchanged,method:'Byte FNV fingerprints over every native/draw attribute and index plus solver.base/canonical positions; runner independently verifies SHA/full state and solver calls',native:nb,draw:db,canonical,
        updates:0,renders:0,installedHooks:0},
      interpretation:'Exact indexed triangle-plane intersections in the declared mouth ROI, with raw semantic fields and geometric face normals. Neither segment width, l19Detail.w, paired gap, semantic v nor interpolated normals alone is physical tissue thickness. Connection/turn/contact/visibility require interpreting indexed adjacency and the actual images.'};
  }
  function report(){return{version:VERSION,installed:!!c&&!c.restored,samples,readOnly:true,hooksInstalled:0,errors:[],last};}
  function restore(){if(c)c.restored=true;return{...report(),restored:true,originalDescriptorsRestored:true,note:'No descriptors or native data were changed; no update/render called.'};}
  if(window.__R07_EDGE_GEOMETRY__)throw Error('R07 geometry probe global already exists');
  window.__R07_EDGE_GEOMETRY__=Object.freeze({version:VERSION,install,sample,report,restore});
})();
