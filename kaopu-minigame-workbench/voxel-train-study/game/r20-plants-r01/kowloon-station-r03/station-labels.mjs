// Native licensed Bézier subset. Uses the existing generator and its unchanged runtime.
// SIL OFL 1.1; see station-labels-LICENSE.txt. No font binary, mesh or bitmap.
const FAMILIES={serif:{units:1000,counterClockwise:true,glyphs:{
"P":{advance:673,solids:1,counters:1,draw({m,l,q,c,z}){m(45,708);l(140,699);c(141,597,141,496,141,394);l(141,346);c(141,243,141,141,140,42);l(45,33);l(45,0);l(395,0);l(395,33);l(285,43);l(284,299);l(329,299);c(557,299,644,398,644,522);c(644,660,555,741,341,741);l(45,741);z();m(284,335);l(284,394);c(284,498,284,602,285,704);l(339,704);c(453,704,510,642,510,523);c(510,412,453,335,326,335);z();}},
"L":{advance:642,solids:1,counters:0,draw({m,l,q,c,z}){m(45,708);l(140,699);c(141,598,141,496,141,394);l(141,326);l(140,42);l(46,33);l(45,0);l(606,0);l(607,214);l(556,214);l(513,37);l(285,37);c(284,140,284,242,284,337);l(284,400);l(285,699);l(386,708);l(386,741);l(45,741);z();}},
"A":{advance:746,solids:1,counters:1,draw({m,l,q,c,z}){m(412,0);l(736,0);l(736,33);l(658,41);l(419,745);l(331,745);l(98,44);l(13,33);l(13,0);l(240,0);l(240,33);l(146,44);l(208,241);l(450,241);l(514,44);l(412,33);z();m(328,622);l(440,275);l(219,275);z();}},
"T":{advance:695,solids:1,counters:0,draw({m,l,q,c,z}){m(23,533);l(76,533);l(119,703);l(275,703);c(277,600,277,497,277,394);l(277,346);c(277,244,277,142,275,42);l(169,33);l(169,0);l(527,0);l(527,33);l(421,42);c(419,143,419,245,419,347);l(419,394);c(419,498,419,601,421,703);l(577,703);l(620,533);l(673,533);l(667,741);l(28,741);z();}},
"F":{advance:648,solids:1,counters:0,draw({m,l,q,c,z}){m(558,548);l(610,548);l(609,741);l(45,741);l(45,708);l(140,699);c(141,597,141,496,141,394);l(141,346);c(141,243,141,141,140,42);l(45,33);l(45,0);l(395,0);l(395,33);l(285,43);c(284,144,284,247,284,359);l(436,359);l(449,252);l(494,252);l(494,500);l(449,500);l(435,395);l(284,395);c(284,502,284,604,285,703);l(518,703);z();}},
"O":{advance:785,solids:1,counters:1,draw({m,l,q,c,z}){m(393,-19);c(578,-19,738,118,738,370);c(738,623,577,759,393,759);c(209,759,48,621,48,370);c(48,117,209,-19,393,-19);z();m(393,18);c(261,18,197,170,197,370);c(197,569,261,722,393,722);c(525,722,588,569,588,370);c(588,170,525,18,393,18);z();}},
"R":{advance:751,solids:1,counters:1,draw({m,l,q,c,z}){m(45,708);l(140,699);c(141,597,141,496,141,394);l(141,346);c(141,243,141,141,140,42);l(45,33);l(45,0);l(380,0);l(380,33);l(284,42);c(281,142,281,244,281,349);l(339,349);c(420,349,445,312,462,230);l(498,81);c(508,11,551,-13,634,-13);c(680,-13,707,-8,742,0);l(742,33);l(650,39);l(611,210);c(592,302,559,352,446,368);c(594,392,651,468,651,553);c(651,672,557,741,387,741);l(45,741);z();m(284,704);l(354,704);c(463,704,517,649,517,550);c(517,459,466,384,354,384);l(281,384);c(281,501,281,603,284,704);z();}},
"M":{advance:1001,solids:1,counters:0,draw({m,l,q,c,z}){m(715,0);l(956,0);l(956,33);l(861,42);c(859,141,859,243,859,346);l(859,394);c(859,496,859,598,861,699);l(954,708);l(954,741);l(715,741);l(501,182);l(286,741);l(41,741);l(41,708);l(139,698);l(136,45);l(30,33);l(30,0);l(292,0);l(292,33);l(181,46);l(181,360);l(176,648);l(430,0);l(475,0);l(721,649);l(718,326);c(717,242,718,143,716,41);l(623,33);l(623,0);z();}},
" ":{advance:250,solids:0,counters:0,draw({m,l,q,c,z}){}},
"N":{advance:815,solids:1,counters:0,draw({m,l,q,c,z}){m(609,-4);l(681,-4);l(681,695);l(780,708);l(780,741);l(509,741);l(509,708);l(640,695);l(640,450);l(643,188);l(264,741);l(42,741);l(42,708);l(125,700);l(135,685);l(135,46);l(38,33);l(38,0);l(308,0);l(308,33);l(183,46);l(183,261);l(175,627);z();}},
"o":{advance:623,solids:1,counters:1,draw({m,l,q,c,z}){m(311,-16);c(469,-16,583,90,583,270);c(583,449,459,552,311,552);c(164,552,40,448,40,270);c(40,92,152,-16,311,-16);z();m(311,17);c(230,17,183,100,183,268);c(183,437,230,518,311,518);c(392,518,439,437,439,268);c(439,100,392,17,311,17);z();}},
".":{advance:335,solids:1,counters:0,draw({m,l,q,c,z}){m(168,-16);c(214,-16,249,20,249,65);c(249,110,214,147,168,147);c(121,147,86,110,86,65);c(86,20,121,-16,168,-16);z();}},
"1":{advance:466,solids:1,counters:0,draw({m,l,q,c,z}){m(57,0);l(432,-2);l(432,27);l(319,47);c(317,110,316,173,316,235);l(316,580);l(320,741);l(305,752);l(54,693);l(54,659);l(181,676);l(181,235);l(179,47);l(57,30);z();}},
"2":{advance:594,solids:1,counters:0,draw({m,l,q,c,z}){m(61,0);l(544,0);l(544,105);l(132,105);c(184,154,235,202,266,229);c(440,379,522,455,522,558);c(522,676,450,757,300,757);c(178,757,69,697,59,584);c(69,561,91,545,116,545);c(144,545,172,560,182,618);l(204,717);c(221,722,238,724,255,724);c(337,724,385,666,385,565);c(385,463,338,396,230,271);c(181,214,122,146,61,78);z();}},
"3":{advance:593,solids:1,counters:0,draw({m,l,q,c,z}){m(274,-16);c(434,-16,537,66,537,189);c(537,294,480,369,332,390);c(461,418,514,491,514,580);c(514,684,439,757,292,757);c(179,757,80,709,72,597);c(81,578,99,568,121,568);c(153,568,179,583,188,628);l(208,719);c(224,722,239,724,254,724);c(334,724,381,672,381,575);c(381,460,318,405,227,405);l(191,405);l(191,367);l(232,367);c(340,367,397,304,397,189);c(397,79,338,17,232,17);c(213,17,197,19,183,24);l(163,115);c(154,172,133,190,99,190);c(75,190,53,177,43,149);c(56,44,135,-16,274,-16);z();}},
"4":{advance:593,solids:1,counters:1,draw({m,l,q,c,z}){m(335,-16);l(455,-16);l(455,177);l(567,177);l(567,265);l(455,265);l(455,753);l(362,753);l(33,248);l(33,177);l(335,177);z();m(84,265);l(219,474);l(335,654);l(335,265);z();}},
}}};

/**
 * Create one owner/cache for sign lettering. Glyph outlines remain Bézier curves
 * until THREE builds Shapes and triangulates/extrudes them here, at runtime.
 * Supported glyphs are deliberately finite. No font fallback or network fetch.
 * Each style/character keeps one unit-font plane and one unit-depth extrusion.
 * Word transforms supply requested metre height/depth; native contours and the
 * counter-classification algorithm are unchanged. Source UVs are canonical too;
 * production lettering uses world-position materials and never samples them.
 * Geometry returned in groups is SHARED and must not be mutated or disposed by
 * individual signs. Use the owner's dispose(), or dispose({resources:false})
 * after a scene-level resource collector has already released each resource.
 */
export function createWordFactory(THREE) {
  const geometryCache = new Map(), geometryKeys = new WeakMap();
  const cacheStats={geometryBuilds:0,cacheHits:0,evictions:0};
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
    // Tessellate once per native glyph and topology, independent of sign size.
    const {style, family} = options, height = 1, depth = options.depth === 0 ? 0 : 1;
    const curveSegments = ((style === 'serif' && '永雲溪O'.includes(character)) || (style === 'sans' && character === 'O')) ? 12 : (style === 'serif' || style === 'sans') ? 8 : 4;
    if (!Object.hasOwn(family.glyphs, character)) {
      throw new RangeError(`Unsupported Traditional glyph ${JSON.stringify(character)} for style ${style}; fallback is forbidden`);
    }
    const key = `${style}:${character}:${depth}`;
    if (geometryCache.has(key)) {cacheStats.cacheHits++;return geometryCache.get(key);}
    cacheStats.geometryBuilds++;
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
      counters, nativeCurves:true, curveSegments, height, depth, canonical:true});
    const entry = {geometry, advance:glyph.advance*scale};
    geometryCache.set(key, entry);geometryKeys.set(geometry,key);
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
      if (character === ' ') { penX += resolved.family.glyphs[character].advance / resolved.family.units; continue; }
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
    // Positive XY/Z scales preserve cap winding and transformed side normals.
    group.scale.set(layout.scale, layout.scale, layout.depth === 0 ? 1 : layout.depth);
    for (const part of layout.parts) {
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.name = `glyph:${part.character}`;
      mesh.position.set(part.x-layout.centerX, -layout.minY, 0);
      group.add(mesh);
    }
    group.userData.sign = {text, style:layout.style, width:layout.width,
      height:layout.height, depth:layout.depth, glyphSource:'licensed-native-bezier-functions',
      sharedGeometry:true, geometrySpace:'unit-font'};
    return group;
  }

  // Caller must establish zero live users before evicting a geometry.
  function forget(geometry){const key=geometryKeys.get(geometry);if(key==null||geometryCache.get(key)?.geometry!==geometry)return false;geometryCache.delete(key);geometryKeys.delete(geometry);cacheStats.evictions++;return true;}

  function dispose({resources = true} = {}) {
    if (resources) {
      for (const {geometry} of geometryCache.values()) geometry.dispose();
      defaultMaterial?.dispose();
    }
    geometryCache.clear();
    defaultMaterial = null;
  }
  return Object.freeze({makeWord, measure, forget, stats:()=>({...cacheStats,cached:geometryCache.size}), dispose});
}
