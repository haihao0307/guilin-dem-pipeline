/* Synthetic DISPLAY seam closure only. No terrain/source/floor modification. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HKTerrainSeamClosure = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STRIDE = 7;
  function createTerrainSeamClosure({ patches, backgroundPositions, backgroundIndices, grid, trace = false }) {
    const v = backgroundPositions, ind = backgroundIndices;
    const { width: w, height: h, step } = grid || {};
    const origin = grid.origin || [834000, 827000];
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2 || !(step > 0)
      || !Number.isFinite(step) || !v || v.length !== w * h * STRIDE || !ind || ind.length % 3) throw new Error('Invalid regular background grid');
    const x0 = v[0], z0 = v[2];
    if (v[(w - 1) * 7] !== x0 + (w - 1) * step || v[(h - 1) * w * 7 + 2] !== z0 + (h - 1) * step) throw new Error('Background positions disagree with grid');
    if (!Array.isArray(patches) || !origin.every(Number.isFinite)) throw new Error('Invalid patches/origin');
    const stats = { synthetic_display_seam_closure: true, sourceModified: false, floorModified: false,
      patchCount: patches.length, sourceTrianglesIndexed: ind.length / 3, unsupportedSourceTriangles: 0,
      elementaryBoundarySegments: 0, internalSegmentsSkipped: 0, externalSegments: 0,
      noOriginalOutsideTriangleSkipped: 0, equalHeightSegmentsSkipped: 0, heightCrossingsSplit: 0,
      closedSegments: 0, outputTriangles: 0, outputVertices: 0, zeroAreaTrianglesSkipped: 0,
      externalBoundaryLengthM: 0, closedBoundaryLengthM: 0, maxGapHeightM: 0 };
    // Presence flags are derived from actual original indices, never from mask guesses.
    const present = new Uint8Array((w - 1) * (h - 1) * 2);
    for (let k = 0; k < ind.length; k += 3) {
      const a = ind[k], b = ind[k + 1], c = ind[k + 2];
      if (![a,b,c].every(i => Number.isInteger(i) && i >= 0 && i < w * h)) throw new Error('Invalid source index');
      const row = Math.min(Math.floor(a / w), Math.floor(b / w), Math.floor(c / w));
      const col = Math.min(a % w, b % w, c % w), j = row * w + col;
      const contains = i => a === i || b === i || c === i;
      let type = -1;
      if (contains(j) && contains(j + 1) && contains(j + w)) type = 0;
      else if (contains(j + 1) && contains(j + w) && contains(j + w + 1)) type = 1;
      if (row >= h - 1 || col >= w - 1 || type < 0) { stats.unsupportedSourceTriangles++; continue; }
      present[((row * (w - 1) + col) * 2) + type] = 1;
    }
    const normalized = patches.map((p, patchIndex) => {
      const l = p.levels && p.levels['2'];
      if (!l || l.step !== 2 || l.width < 2 || l.height < 2 || l.heights.length !== l.width*l.height) throw new Error('Expected 2m hostPatch level');
      const minX = l.x0 - origin[0], minZ = origin[1] - l.y0;
      const maxX = minX + (l.width - 1) * l.step, maxZ = minZ + (l.height - 1) * l.step;
      if (![minX,minZ,maxX,maxZ].every(Number.isFinite)) throw new Error('Nonfinite patch bounds');
      if (p.bounds_epsg2326) {
        const b = p.bounds_epsg2326;
        if (minX !== b[0]-origin[0] || maxX !== b[2]-origin[0] || minZ !== origin[1]-b[3] || maxZ !== origin[1]-b[1]) throw new Error('Patch node bounds mismatch');
      }
      return { l, minX, minZ, maxX, maxZ, patchIndex, id:p.id || String(patchIndex) };
    });
    const points = [], indices = [], segments = trace ? [] : null, seen = new Set();
    function backgroundTriangle(x, z, nx, nz) {
      const u = (x-x0)/step, t = (z-z0)/step;
      let col = Math.floor(u), row = Math.floor(t);
      // On an old grid line choose the genuinely OUTSIDE face, without moving XZ.
      if (Number.isInteger(u) && nx < 0) --col;
      if (Number.isInteger(t) && nz < 0) --row;
      if (col < 0 || row < 0 || col >= w-1 || row >= h-1) return null;
      const type = (u-col)+(t-row) <= 1 ? 0 : 1;
      if (!present[(row*(w-1)+col)*2+type]) return null;
      const j = row*w+col, ids = type === 0 ? [j,j+w,j+1] : [j+1,j+w,j+w+1];
      return { ids, row, col, type };
    }
    function oldHeight(face,x,z) {
      const j = face.row*w+face.col, u=(x-(x0+face.col*step))/step, t=(z-(z0+face.row*step))/step;
      const A=v[j*7+1],B=v[(j+1)*7+1],C=v[(j+w)*7+1],D=v[(j+w+1)*7+1];
      return face.type===0 ? A+(B-A)*u+(C-A)*t : D+(C-D)*(1-u)+(B-D)*(1-t);
    }
    function newHeight(p,edge,along) {
      const l=p.l, isX=edge.axis==='x', start=isX?p.minX:p.minZ;
      const f=(along-start)/l.step, max=(isX?l.width:l.height)-1;
      const i=Math.max(0,Math.min(max-1,Math.floor(f))), t=f-i;
      let a,b;
      if(isX){const row=edge.name==='north'?0:l.height-1;a=row*l.width+i;b=a+1;}
      else{const col=edge.name==='west'?0:l.width-1;a=i*l.width+col;b=a+l.width;}
      if(l.mask && (l.mask[a]!==1||l.mask[b]!==1))throw new Error('Seam patch edge must be original land mask 1');
      const value=l.heights[a]+t*(l.heights[b]-l.heights[a]);
      if(!Number.isFinite(value))throw new Error('Nonfinite patch edge height');
      return value;
    }
    function addTicks(cuts,min,max,base,spacing) {
      for(let k=Math.floor((min-base)/spacing)+1;k<Math.ceil((max-base)/spacing);k++) {
        const value=base+k*spacing;if(value>min&&value<max)cuts.add(value);
      }
    }
    function emitTriangle(ids,nx,nz) {
      const a=ids[0]*7,b=ids[1]*7,c=ids[2]*7;
      const ux=points[b]-points[a],uy=points[b+1]-points[a+1],uz=points[b+2]-points[a+2];
      const vx=points[c]-points[a],vy=points[c+1]-points[a+1],vz=points[c+2]-points[a+2];
      const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
      if(cx===0&&cy===0&&cz===0){stats.zeroAreaTrianglesSkipped++;return;}
      if(cx*nx+cz*nz<0)[ids[1],ids[2]]=[ids[2],ids[1]];
      indices.push(...ids);
    }
    function emitSpan(p,e,a,b,face,ha,hb,na,nb) {
      if(![a,b,ha,hb,na,nb].every(Number.isFinite))throw new Error('Nonfinite seam span');
      if(ha===na&&hb===nb){stats.equalHeightSegmentsSkipped++;return;}
      const xA=e.axis==='x'?a:e.fixed,zA=e.axis==='z'?a:e.fixed,xB=e.axis==='x'?b:e.fixed,zB=e.axis==='z'?b:e.fixed;
      const base=points.length/7, startIndex=indices.length;
      for(const q of [[xA,ha,zA],[xA,na,zA],[xB,hb,zB],[xB,nb,zB]])points.push(Math.fround(q[0]),Math.fround(q[1]),Math.fround(q[2]),e.nx,0,e.nz,1);
      emitTriangle([base,base+1,base+2],e.nx,e.nz);emitTriangle([base+2,base+1,base+3],e.nx,e.nz);
      if(indices.length===startIndex){points.length-=28;stats.equalHeightSegmentsSkipped++;return;}
      stats.closedSegments++;stats.closedBoundaryLengthM+=b-a;
      stats.maxGapHeightM=Math.max(stats.maxGapHeightM,Math.abs(na-ha),Math.abs(nb-hb));
      if(segments)segments.push({patch:p.id,patchIndex:p.patchIndex,edge:e.name,axis:e.axis,fixed:e.fixed,a,b,oldHeights:[ha,hb],newHeights:[na,nb],oldTriangleIndices:face.ids,vertexStart:base,triangleStart:startIndex/3,triangleCount:(indices.length-startIndex)/3});
    }
    for(const p of normalized) for(const e of [
      {name:'north',axis:'x',fixed:p.minZ,min:p.minX,max:p.maxX,nx:0,nz:-1},
      {name:'east',axis:'z',fixed:p.maxX,min:p.minZ,max:p.maxZ,nx:1,nz:0},
      {name:'south',axis:'x',fixed:p.maxZ,min:p.minX,max:p.maxX,nx:0,nz:1},
      {name:'west',axis:'z',fixed:p.minX,min:p.minZ,max:p.maxZ,nx:-1,nz:0}
    ]) {
      const cuts=new Set([e.min,e.max]);
      addTicks(cuts,e.min,e.max,e.min,2);
      addTicks(cuts,e.min,e.max,e.axis==='x'?x0:z0,step);
      // NW-SW-NE / NE-SW-SE diagonal has x+z = x0+z0+k*step.
      addTicks(cuts,e.min,e.max,x0+z0-e.fixed,step);
      for(const other of normalized)for(const value of e.axis==='x'?[other.minX,other.maxX]:[other.minZ,other.maxZ])if(value>e.min&&value<e.max)cuts.add(value);
      const sorted=[...cuts].sort((a,b)=>a-b);
      for(let i=1;i<sorted.length;i++) {
        const a=sorted[i-1],b=sorted[i],mid=(a+b)/2;
        stats.elementaryBoundarySegments++;
        const x=e.axis==='x'?mid:e.fixed,z=e.axis==='z'?mid:e.fixed;
        const internal=normalized.some(q=>q!==p && (e.nx<0 ? q.minX<x&&q.maxX>=x&&z>q.minZ&&z<q.maxZ
          : e.nx>0 ? q.maxX>x&&q.minX<=x&&z>q.minZ&&z<q.maxZ
          : e.nz<0 ? q.minZ<z&&q.maxZ>=z&&x>q.minX&&x<q.maxX
          : q.maxZ>z&&q.minZ<=z&&x>q.minX&&x<q.maxX));
        if(internal){stats.internalSegmentsSkipped++;continue;}
        const key=[e.axis,e.fixed,a,b].join(',');if(seen.has(key))continue;seen.add(key);
        stats.externalSegments++;stats.externalBoundaryLengthM+=b-a;
        const face=backgroundTriangle(x,z,e.nx,e.nz);
        if(!face){stats.noOriginalOutsideTriangleSkipped++;continue;}
        const ha=oldHeight(face,e.axis==='x'?a:e.fixed,e.axis==='z'?a:e.fixed);
        const hb=oldHeight(face,e.axis==='x'?b:e.fixed,e.axis==='z'?b:e.fixed);
        const na=newHeight(p,e,a),nb=newHeight(p,e,b),da=na-ha,db=nb-hb;
        if((da<0&&db>0)||(da>0&&db<0)) {
          const t=da/(da-db),middle=a+(b-a)*t,hm=ha+(hb-ha)*t;
          stats.heightCrossingsSplit++;
          emitSpan(p,e,a,middle,face,ha,hm,na,hm);emitSpan(p,e,middle,b,face,hm,hb,hm,nb);
        } else emitSpan(p,e,a,b,face,ha,hb,na,nb);
      }
    }
    stats.outputTriangles=indices.length/3;stats.outputVertices=points.length/7;
    const result={positions:Float32Array.from(points),indices:Uint32Array.from(indices),stats};
    if(segments)result.segments=segments;
    return result;
  }
  return Object.freeze({STRIDE,createTerrainSeamClosure});
});
