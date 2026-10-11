import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../../vendor/three.module.js';
import {createWordFactory} from '../street/glyphs.mjs';
const glyphURL=new URL('../street/glyphs.mjs',import.meta.url);
const source=readFileSync(glyphURL,'utf8');
const provenance=JSON.parse(readFileSync(new URL('../street/glyphs-provenance.json',import.meta.url)));

function baselineFactory584803a(THREE) {
  const geometryCache = new Map();
  let defaultMaterial = null;

  function optionsOf(options = {}) {
    const {height = 1, depth = .015, style = 'brush'} = options;
    if (!Number.isFinite(height) || height <= 0) throw new RangeError('Glyph height must be finite and positive');
    if (!Number.isFinite(depth) || depth < 0) throw new RangeError('Glyph depth must be finite and nonnegative');
    if (!Object.hasOwn(FAMILIES, style)) throw new RangeError(`Unknown glyph style: ${style}`);
    return {height, depth, style, family: FAMILIES[style]};
  }

  // Runtime sampling cleanup removes only redundant consecutive/straight-edge
  // samples. Native Bézier functions remain unchanged in the shipped source.
  function cleanPoints(points) {
    // Triangulate the positions the renderer will actually store, preventing
    // near-collinear cap triangles from flipping after Float32 conversion.
    points = points.map(p => new THREE.Vector2(Math.fround(p.x), Math.fround(p.y)));
    // Samples that map to the same Float32 vertex have no renderable edge.
    // Native curve control points are not changed or flattened offline.
    const sameVertex = (a,b) => Math.fround(a.x) === Math.fround(b.x) && Math.fround(a.y) === Math.fround(b.y);
    const out = points.filter((p, i) => i === 0 || !sameVertex(p,points[i-1]));
    if (out.length > 1 && sameVertex(out[0],out.at(-1))) out.pop();
    let changed = true;
    while (changed && out.length > 3) {
      changed = false;
      for (let i = 0; i < out.length; i++) {
        const a = out[(i+out.length-1)%out.length], b = out[i], c = out[(i+1)%out.length];
        const ax=b.x-a.x, ay=b.y-a.y, bx=c.x-b.x, by=c.y-b.y;
        const cross=ax*by-ay*bx, dot=ax*bx+ay*by;
        if (dot >= 0 && Math.abs(cross) <= 1e-12*Math.hypot(ax,ay)*Math.hypot(bx,by)) {
          out.splice(i,1); changed = true; break;
        }
      }
    }
    return out;
  }

  function glyphGeometry(character, options) {
    const {style, height, depth, family} = options;
    const curveSegments = ((style === 'serif' && '永雲溪O'.includes(character)) || (style === 'sans' && character === 'O')) ? 12 : (style === 'serif' || style === 'sans') ? 8 : 4;
    if (!Object.hasOwn(family.glyphs, character)) {
      throw new RangeError(`Unsupported Traditional glyph ${JSON.stringify(character)} for style ${style}; fallback is forbidden`);
    }
    const key = `${style}:${character}:${height}:${depth}`;
    if (geometryCache.has(key)) return geometryCache.get(key);
    const glyph = family.glyphs[character], path = new THREE.ShapePath();
    const scale = height / family.units;
    glyph.draw({
      m: (x,y) => path.moveTo(x*scale,y*scale),
      l: (x,y) => path.lineTo(x*scale,y*scale),
      q: (x1,y1,x,y) => path.quadraticCurveTo(x1*scale,y1*scale,x*scale,y*scale),
      c: (x1,y1,x2,y2,x,y) => path.bezierCurveTo(x1*scale,y1*scale,x2*scale,y2*scale,x*scale,y*scale),
      z: () => { if (path.currentPath.curves.length) path.currentPath.closePath(); },
    });
    // A source move+close contour has no area or curves, and is not a counter.
    path.subPaths = path.subPaths.filter(p => p.curves.length > 0);
    const shapes = path.toShapes(family.counterClockwise);
    // THREE's first-point hole reassignment is ambiguous when a large counter
    // contains separate ink islands (e.g. 園). Require the whole sampled counter
    // to fit its owner, then select the smallest enclosing ink contour.
    const allHoles = shapes.flatMap(shape => shape.holes);
    const outlines = shapes.map(shape => shape.getPoints(curveSegments));
    const contains = (point, polygon) => {
      let inside = false;
      for (let i=0, j=polygon.length-1; i<polygon.length; j=i++) {
        const a=polygon[j], b=polygon[i], dx=b.x-a.x, dy=b.y-a.y;
        const cross=dx*(point.y-a.y)-dy*(point.x-a.x);
        if (Math.abs(cross) < 1e-12 && point.x >= Math.min(a.x,b.x)-1e-12 && point.x <= Math.max(a.x,b.x)+1e-12 && point.y >= Math.min(a.y,b.y)-1e-12 && point.y <= Math.max(a.y,b.y)+1e-12) return true;
        if ((a.y>point.y)!==(b.y>point.y) && point.x < dx*(point.y-a.y)/dy+a.x) inside=!inside;
      }
      return inside;
    };
    for (const shape of shapes) shape.holes=[];
    for (const hole of allHoles) {
      const points=hole.getPoints(curveSegments);
      const candidates=outlines.map((polygon,index)=>({polygon,index,area:Math.abs(THREE.ShapeUtils.area(polygon))}))
        .filter(({polygon})=>points.every(point=>contains(point,polygon))).sort((a,b)=>a.area-b.area);
      if (!candidates.length) throw new Error(`Counter has no enclosing native contour for ${style}/${character}`);
      shapes[candidates[0].index].holes.push(hole);
    }
    const counters = shapes.reduce((n, shape) => n + shape.holes.length, 0);
    if (shapes.length !== glyph.solids || counters !== glyph.counters) {
      throw new Error(`Glyph contour classification failed for ${style}/${character}`);
    }
    for (const shape of shapes) {
      shape.extractPoints = function(divisions) {
        return {shape:cleanPoints(this.getPoints(divisions)),
          holes:this.holes.map(hole => cleanPoints(hole.getPoints(divisions)))};
      };
    }
    const geometry = depth === 0
      ? new THREE.ShapeGeometry(shapes, curveSegments)
      : new THREE.ExtrudeGeometry(shapes, {depth, steps:1, bevelEnabled:false, curveSegments});
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.glyph = Object.freeze({character, style, solids:shapes.length,
      counters, nativeCurves:true, curveSegments, height, depth});
    const entry = {geometry, advance:glyph.advance*scale};
    geometryCache.set(key, entry);
    return entry;
  }

  function layoutOf(text, options) {
    if (typeof text !== 'string' || text.length === 0) throw new TypeError('Sign text must be a nonempty string');
    const resolved = optionsOf(options);
    // Validate the entire title before allocating any geometry.
    for (const character of text) {
      if (!Object.hasOwn(resolved.family.glyphs, character)) {
        throw new RangeError(`Unsupported Traditional glyph ${JSON.stringify(character)} for style ${resolved.style}; fallback is forbidden`);
      }
    }
    const parts = [];
    let penX = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const character of text) {
      // Only explicitly exported ASCII spaces advance without allocating a mesh.
      if (character === ' ') { penX += resolved.family.glyphs[character].advance * resolved.height / resolved.family.units; continue; }
      const entry = glyphGeometry(character, resolved), box = entry.geometry.boundingBox;
      parts.push({character, x:penX, geometry:entry.geometry});
      minX = Math.min(minX, penX + box.min.x); maxX = Math.max(maxX, penX + box.max.x);
      minY = Math.min(minY, box.min.y); maxY = Math.max(maxY, box.max.y);
      penX += entry.advance;
    }
    if (!parts.length || !(maxY > minY)) throw new RangeError('Sign text must contain a supported visible glyph');
    const scale = resolved.height / (maxY-minY);
    return {parts, scale, centerX:(minX+maxX)/2, minY, width:(maxX-minX)*scale,
      height:resolved.height, depth:resolved.depth, style:resolved.style};
  }

  function measure(text, options = {}) {
    const {width, height, depth} = layoutOf(text, options);
    return {width, height, depth};
  }

  function makeWord(text, options = {}) {
    const layout = layoutOf(text, options);
    const material = options.material ?? (defaultMaterial ??= new THREE.MeshStandardMaterial({color:0xffe4b7, roughness:.82}));
    const group = new THREE.Group();
    group.name = `traditional-sign:${text}`;
    group.scale.set(layout.scale, layout.scale, 1);
    for (const part of layout.parts) {
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.name = `glyph:${part.character}`;
      mesh.position.set(part.x-layout.centerX, -layout.minY, 0);
      group.add(mesh);
    }
    group.userData.sign = {text, style:layout.style, width:layout.width,
      height:layout.height, depth:layout.depth, glyphSource:'licensed-native-bezier-functions',
      sharedGeometry:true};
    return group;
  }

  function dispose({resources = true} = {}) {
    if (resources) {
      for (const {geometry} of geometryCache.values()) geometry.dispose();
      defaultMaterial?.dispose();
    }
    geometryCache.clear();
    defaultMaterial = null;
  }
  return Object.freeze({makeWord, measure, dispose});
}

function auditSurfaceEquivalence(THREE,oldFactory,newFactory,provenance,{heights=[.1,.31,.38,.4464,.4836,.52,.558,.59,.636,.744,1,3],depths=[0,.018]}={}){
 const results={words:0,glyphs:0,contours:0,topologyChangedGlyphOccurrences:0,maxBoundaryDistanceMetres:0,maxBoundsDifferenceMetres:0,maxCapAreaRelativeDifference:0,tolerance:'Per word: 8 * 2^-23 * max(1, requested height, reference word width) metres. Cap area relative difference <= 1e-5. Native contour/counter ownership and winding must match.'};
 const pos=(p,m)=>{const e=m.elements;return{x:e[0]*p.x+e[4]*p.y+e[12],y:e[1]*p.x+e[5]*p.y+e[13]};};
 const shapeWorld=m=>m.geometry.parameters.shapes.map(s=>{const p=s.extractPoints(m.geometry.userData.glyph.curveSegments);return{shape:p.shape.map(p=>pos(p,m.matrixWorld)),holes:p.holes.map(h=>h.map(p=>pos(p,m.matrixWorld)))};});
 const area=p=>{let a=0;for(let i=0,j=p.length-1;i<p.length;j=i++)a+=p[j].x*p[i].y-p[i].x*p[j].y;return a*.5;};
 const areaAll=s=>s.reduce((n,p)=>n+Math.abs(area(p.shape))-p.holes.reduce((n,h)=>n+Math.abs(area(h)),0),0);
 const dist2=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;};
 const directed=(a,b)=>{let max=0;for(const p of a){let min=Infinity;for(let i=0,j=b.length-1;i<b.length;j=i++)min=Math.min(min,dist2(p,b[j],b[i]));max=Math.max(max,min);}return Math.sqrt(max);};
 const compareContour=(a,b,tol,label)=>{assert(Math.sign(area(a))===Math.sign(area(b)),`${label}: contour winding changed`);const max=Math.max(directed(a,b),directed(b,a));results.maxBoundaryDistanceMetres=Math.max(max,results.maxBoundaryDistanceMetres);assert(max<=tol,`${label}: boundary ${max} > ${tol}`);results.contours++;};
 const validateGeometry=(mesh,label)=>{const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),cross=new THREE.Vector3(),norm=new THREE.Vector3();const count=index?index.count:p.count;for(let i=0;i<count;i+=3){const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);a.fromBufferAttribute(p,ids[0]).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,ids[1]).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,ids[2]).applyMatrix4(mesh.matrixWorld);cross.copy(b).sub(a).cross(c.sub(a));assert(cross.lengthSq()>0,`${label}: degenerate triangle`);norm.fromBufferAttribute(n,ids[0]).applyMatrix3(normalMatrix).normalize();assert(cross.dot(norm)>0,`${label}: inside-out triangle/normal`);}};
 const checked=new WeakSet();
 for(const family of provenance.families)for(const text of family.titles)for(const height of heights)for(const depth of depths){const opts={style:family.style,height,depth};const old=oldFactory.makeWord(text,opts),next=newFactory.makeWord(text,opts);old.updateMatrixWorld(true);next.updateMatrixWorld(true);const boxOld=new THREE.Box3().setFromObject(old),boxNext=new THREE.Box3().setFromObject(next);const tol=8*2**-23*Math.max(1,height,boxOld.max.x-boxOld.min.x),label=`${family.style}/${text}/${height}/${depth}`;assert.equal(old.children.length,next.children.length,label);for(const p of ['min','max'])for(const k of ['x','y','z']){const delta=Math.abs(boxOld[p][k]-boxNext[p][k]);results.maxBoundsDifferenceMetres=Math.max(results.maxBoundsDifferenceMetres,delta);assert(delta<=tol,`${label}: bounds ${k} ${delta} > ${tol}`);}assert.equal(next.userData.sign.height,height);assert.equal(next.userData.sign.depth,depth);
  for(let i=0;i<old.children.length;i++){const a=old.children[i],b=next.children[i],ga=a.geometry,gb=b.geometry;const ma=ga.userData.glyph,mb=gb.userData.glyph;for(const k of ['character','style','solids','counters','curveSegments','nativeCurves'])assert.equal(ma[k],mb[k],`${label}: ${k}`);if(!checked.has(gb)){validateGeometry(b,label);checked.add(gb);}const sa=shapeWorld(a),sb=shapeWorld(b);assert.equal(sa.length,sb.length,label);for(let j=0;j<sa.length;j++){assert.equal(sa[j].holes.length,sb[j].holes.length,label);compareContour(sa[j].shape,sb[j].shape,tol,label);for(let h=0;h<sa[j].holes.length;h++)compareContour(sa[j].holes[h],sb[j].holes[h],tol,label);}const aa=areaAll(sa),ab=areaAll(sb),rel=Math.abs(aa-ab)/aa;results.maxCapAreaRelativeDifference=Math.max(results.maxCapAreaRelativeDifference,rel);assert(rel<=1e-5,`${label}: area difference ${rel}`);if(ga.attributes.position.count!==gb.attributes.position.count||(ga.index?.count??0)!==(gb.index?.count??0))results.topologyChangedGlyphOccurrences++;results.glyphs++;}
  results.words++;
 }
 return results;
}


// Only the small factory below is frozen from commit 584803a. Native functions
// remain byte-identical to that commit; no baked geometry is used by this audit.
const prefix=source.slice(0,source.indexOf('/**\n * Create one owner/cache'));
assert.equal(createHash('sha256').update(prefix).digest('hex'),'c4c523be3981d1594c699af1075a1a5fb2ebe8c8e450c17062ae4eca5d08a15f');
const baselineSource=prefix.replace('./street-identities.mjs',new URL('../street/street-identities.mjs',import.meta.url).href)+baselineFactory584803a.toString().replace('function baselineFactory584803a','export function createWordFactory');
const baseline=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
test('Canonical glyph world surfaces match committed 584803a across every title, twelve heights, plane and extrusion',()=>{
 const before=baseline.createWordFactory(THREE),after=createWordFactory(THREE);
 try{const report=auditSurfaceEquivalence(THREE,before,after,provenance);assert.equal(after.stats().geometryBuilds,448);assert.equal(after.stats().cached,448);console.log(JSON.stringify(report));}finally{before.dispose();after.dispose();}
});
test('Generator runtime reproduces canonical factory and production lettering does not consume source UVs',()=>{
 const generator=readFileSync(new URL('../tools/generate-glyph-functions.py',import.meta.url),'utf8');
 const runtime=generator.split("RUNTIME = r'''\n")[1].split("'''")[0];
 assert.equal(runtime,source.slice(source.indexOf('/**\n * Create one owner/cache')));
 const materials=readFileSync(new URL('../street/materials.mjs',import.meta.url),'utf8');assert(!/\b(?:vUv|uv)\b/.test(materials));
 const batches=readFileSync(new URL('../street/render-batches.mjs',import.meta.url),'utf8');assert(!/getAttribute\(['"]uv|attributes\.uv/.test(batches));
 const board=readFileSync(new URL('../station-nameboard.mjs',import.meta.url),'utf8');assert(!/getAttribute\(['"]uv|attributes\.uv/.test(board));
});
