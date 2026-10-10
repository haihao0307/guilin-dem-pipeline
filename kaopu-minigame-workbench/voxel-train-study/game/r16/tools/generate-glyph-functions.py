#!/usr/bin/env python3
"""Regenerate the finite R16 sign repertoire as native Bézier drawing functions.

Usage: python tools/generate-glyph-functions.py --font-dir /path/to/fonts
Requires FontTools. Never flattens outlines, triangulates or copies font binaries.
The source fonts and notices must be supplied by the maintainer, not the browser.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.boundsPen import BoundsPen

SOURCES = [
    dict(style='brush', filename='Bakudai-Bold.ttf', text='麗華戲院金禾冰室',
         title=['麗華戲院', '金禾冰室'], license='Bakudai-OFL.txt',
         source='https://github.com/max32002/bakudaifont',
         font_url='https://raw.githubusercontent.com/max32002/bakudaifont/master/tw/Bakudai-Bold.ttf',
         source_license='https://github.com/max32002/bakudaifont/blob/master/SIL_Open_Font_License_1.1.txt'),
    dict(style='serif', filename='NotoSerifCJKhk-Bold.otf', text='同豐藥房海峰鐘錶',
         title=['同豐藥房', '海峰鐘錶'], license='NotoSerifCJK-OFL.txt',
         source='https://github.com/notofonts/noto-cjk',
         font_url='https://github.com/notofonts/noto-cjk/tree/main/Serif/OTF/TraditionalChineseHK',
         source_license='https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE'),
]


def number(value):
    # Source units and implied TrueType on-curve points are integral or halves.
    value = float(value)
    return str(int(value)) if value.is_integer() else repr(value)


class FunctionPen(BasePen):
    """Decompose components and implied TT points without flattening any curve."""
    def __init__(self, glyphs):
        super().__init__(glyphs)
        self.contours = []
        self.current = []
        self.area_pen = None
        self.op_counts = dict(move=0, line=0, quadratic=0, cubic=0, close=0)

    def emit(self, op, points):
        self.current.append(f"{op}({','.join(number(v) for p in points for v in p)});")

    def _moveTo(self, p):
        self.current = []
        self.area_pen = AreaPen(None)
        self.area_pen.moveTo(p)
        self.emit('m', [p]); self.op_counts['move'] += 1

    def _lineTo(self, p):
        self.area_pen.lineTo(p)
        self.emit('l', [p]); self.op_counts['line'] += 1

    def _qCurveToOne(self, p1, p2):
        self.area_pen.qCurveTo(p1, p2)
        self.emit('q', [p1, p2]); self.op_counts['quadratic'] += 1

    def _curveToOne(self, p1, p2, p3):
        self.area_pen.curveTo(p1, p2, p3)
        self.emit('c', [p1, p2, p3]); self.op_counts['cubic'] += 1

    def _closePath(self):
        self.area_pen.closePath()
        self.current.append('z();'); self.op_counts['close'] += 1
        self.contours.append((self.current, self.area_pen.value))
        self.current = []

    def _endPath(self):
        self._closePath()


RUNTIME = r'''
/**
 * Create one owner/cache for sign lettering. Glyph outlines remain Bézier curves
 * until THREE builds Shapes and triangulates/extrudes them here, at runtime.
 * Supported glyphs are deliberately finite. No font fallback or network fetch.
 * Geometry returned in groups is SHARED and must not be mutated or disposed by
 * individual signs. Use the owner's dispose(), or dispose({resources:false})
 * after a scene-level resource collector has already released each resource.
 */
export function createWordFactory(THREE) {
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
    const out = points.filter((p, i) => i === 0 || !p.equals(points[i-1]));
    if (out.length > 1 && out[0].equals(out.at(-1))) out.pop();
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
    const curveSegments = style === 'serif' ? 8 : 4;
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
      const entry = glyphGeometry(character, resolved), box = entry.geometry.boundingBox;
      parts.push({character, x:penX, geometry:entry.geometry});
      minX = Math.min(minX, penX + box.min.x); maxX = Math.max(maxX, penX + box.max.x);
      minY = Math.min(minY, box.min.y); maxY = Math.max(maxY, box.max.y);
      penX += entry.advance;
    }
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
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'street')
    args = parser.parse_args()
    chunks = [
        '// R16 Traditional Sign Curves: finite licensed glyph-function subset.\n',
        '// Derivative font software under SIL OFL 1.1; see glyphs-LICENSE.txt.\n',
        '// Generated from native outlines; no raster, vertex/index, or flattened contour data.\n',
        '// Regenerate using ../tools/generate-glyph-functions.py.\n\nconst FAMILIES = {\n',
    ]
    provenance = dict(name='R16 Traditional Sign Curves', format='native move/line/quadratic/cubic drawing functions',
        derivative_name_note='Original family names are source attribution only; this finite derivative is named R16 Traditional Sign Curves.',
        license='SIL Open Font License 1.1', generated='2026-10-10',
        source_font_binaries_distributed=False, raster_data=False, baked_vertex_or_index_buffers=False,
        flattening='None offline; THREE samples native curves and triangulates Shapes/ExtrudeGeometry at runtime.',
        historical_note='Modern openly licensed font proxies for fictional signs; not claimed to reproduce any historical shop lettering.',
        families=[])
    notices = ['R16 Traditional Sign Curves — font-outline derivative software\nSIL Open Font License, Version 1.1\n\nOriginal family names below identify sources only. The modified finite subset\nis called R16 Traditional Sign Curves; no author endorsement is implied.\nNo full font binary accompanies this subset.\n']
    for source in SOURCES:
        path = args.font_dir / source['filename']
        font = TTFont(path, lazy=False)
        glyphs = font.getGlyphSet(); cmap = font.getBestCmap()
        units = font['head'].unitsPerEm
        is_ccw = source['style'] == 'serif'
        chunks.append(f"  {source['style']}: {{units:{units},counterClockwise:{str(is_ccw).lower()},glyphs:{{\n")
        info = dict(style=source['style'], titles=source['title'], repertoire=source['text'],
            source_file=source['filename'], sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            units_per_em=units, family=font['name'].getDebugName(1), version=font['name'].getDebugName(5),
            copyright=font['name'].getDebugName(0), license_metadata=font['name'].getDebugName(13),
            source_url=source['source'], font_source_url=source['font_url'], license_url=source['source_license'], glyphs={})
        if source['style'] == 'serif':
            info['local_source_note'] = 'Standalone HK face previously extracted unchanged from installed NotoSerifCJK-Bold.ttc, face index 4; source bundle provenance retained.'
        notices.append('\n' + '='*72 + '\nSOURCE: ' + info['family'] + ' / ' + source['filename'] + '\n' + info['copyright'] + '\n' + source['source'] + '\n\n')
        if source['style'] == 'brush':
            notices.append('Additional copyright and Reserved Font Name notice from embedded name table:\n' + info['license_metadata'].split('This Font Software')[0].replace('\\n','\n') + '\n')
        notices.append((args.font_dir / source['license']).read_text() + '\n')
        for character in source['text']:
            name = cmap.get(ord(character))
            if not name or name == '.notdef':
                raise ValueError(f'No glyph {character!r} in {path.name}; fallback is forbidden')
            pen = FunctionPen(glyphs); glyphs[name].draw(pen)
            bounds = BoundsPen(glyphs); glyphs[name].draw(bounds)
            advance = font['hmtx'].metrics[name][0]
            areas = [area for commands, area in pen.contours if len(commands)>2]
            solids = sum(area>0 if is_ccw else area<0 for area in areas)
            counters = sum(area<0 if is_ccw else area>0 for area in areas)
            if len(areas) != solids+counters:
                raise ValueError(f'Unexpected nontrivial zero-area contour in {character}')
            chunks.append(f"    '{character}': {{advance:{advance},solids:{solids},counters:{counters},draw({{m,l,q,c,z}}){{\n")
            for commands, _ in pen.contours:
                chunks.append('      ' + ''.join(commands) + '\n')
            chunks.append('    }},\n')
            info['glyphs'][character] = dict(codepoint=f'U+{ord(character):04X}',source_glyph_name=name,
                advance=advance, bounds=bounds.bounds, contour_count=len(pen.contours),
                nondegenerate_contour_count=len(areas), solids=solids, counters=counters,
                point_only_contours_ignored_at_runtime=len(pen.contours)-len(areas),
                native_contour_areas=areas, command_counts=pen.op_counts)
        chunks.append('  }},\n')
        provenance['families'].append(info)
    chunks.append('};\n'); chunks.append(RUNTIME)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = ''.join(chunks)
    (args.output_dir / 'glyphs.mjs').write_text(output)
    provenance['module_bytes'] = len(output.encode())
    provenance['module_sha256'] = hashlib.sha256(output.encode()).hexdigest()
    (args.output_dir / 'glyphs-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
    (args.output_dir / 'glyphs-LICENSE.txt').write_text(''.join(notices))
    print(f'Generated {len(output.encode())} bytes, {sum(len(s["text"]) for s in SOURCES)} licensed glyph functions')


if __name__ == '__main__':
    main()
