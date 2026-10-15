// Geographic labels retain their same-frame world anchor. Collisions may hide a
// label, but never move it into another neighbourhood to make space.
export function projectLabelAnchor(point, camera, viewport) {
  const v = point.map((x, i) => x - camera.cam[i]);
  const dot = a => v.reduce((s, x, i) => s + x * a[i], 0);
  const depth = dot(camera.fw), tan = Math.tan((camera.fov || 55) * Math.PI / 360);
  const ndc = [dot(camera.right) / (depth * tan * viewport.aspect), dot(camera.up) / (depth * tan)];
  const near = camera.clipNear ?? .15, far = camera.clipFar ?? 150000;
  return {world: [...point], depth, ndc, pixel: [(ndc[0] * .5 + .5) * viewport.width, (.5 - ndc[1] * .5) * viewport.height], inside: depth >= near && depth <= far && ndc.every(Number.isFinite) && Math.abs(ndc[0]) < .95 && Math.abs(ndc[1]) < .87};
}
export function layoutAnchoredLabels(items, {width, height}) {
  const placed = [], output = [];
  for (const item of [...items].sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.order - b.order)) {
    const [x, y] = item.pixel, b = [x - item.width / 2 - 1, y - item.height - 1, x + item.width / 2 + 1, y + 1];
    const outside = b[0] < 0 || b[2] > width || b[1] < (height < 520 ? 125 : 0) || b[3] > height - 35;
    const collision = placed.some(a => b[0] < a[2] && b[2] > a[0] && b[1] < a[3] && b[3] > a[1]);
    const visible = !outside && !collision;
    output.push({...item, visible, reason: outside ? 'outside_viewport' : collision ? 'collision_at_true_anchor' : 'visible', displacementPx: 0});
    if (visible) placed.push(b);
  }
  return output;
}
export function drawGeographicLabels(labels, camera, canvas, mapState, heightAt, qa) {
  const viewport = {width: innerWidth, height: innerHeight, aspect: canvas.width / canvas.height}, candidates = [], reports = [];
  for (let order = 0; order < labels.length; order++) {
    const p = labels[order], h = heightAt(...p.point), world = [p.point[0], (Number.isFinite(h) ? h : 0) + 45, p.point[1]];
    const q = projectLabelAnchor(world, camera, viewport);
    p.el.style.display = 'none';
    if (!(mapState.labels && (!p.detail || mapState.distance < 18000) && q.inside)) { reports.push({text:p.text,...q,visible:false,reason:'outside_or_disabled'}); continue; }
    p.el.style.display = 'block';
    candidates.push({...q, order, label:p, priority:/[启啟]德/.test(p.text)?100:0, width:p.el.offsetWidth, height:p.el.offsetHeight});
  }
  let visible = 0;
  for (const q of layoutAnchoredLabels(candidates, viewport)) {
    const p = q.label, [x,y] = q.pixel;
    p.el.style.display = q.visible ? 'block' : 'none';
    p.el.style.left = x + 'px'; p.el.style.top = y + 'px'; p.el.style.setProperty('--leader','5px');
    p.el.dataset.anchorX = String(x); p.el.dataset.anchorY = String(y);
    p.el.dataset.worldX = String(q.world[0]); p.el.dataset.worldY = String(q.world[1]); p.el.dataset.worldZ = String(q.world[2]);
    const rect=q.visible?p.el.getBoundingClientRect():null;reports.push({text:p.text,sourceLocalXZ:[...p.point],world:q.world,ndc:q.ndc,pixel:q.pixel,rawProjectedPixel:q.pixel,domAnchorPixel:rect?[rect.left+rect.width/2,rect.bottom]:null,depth:q.depth,visible:q.visible,reason:q.reason,displacementPx:0});
    visible += Number(q.visible);
  }
  qa.mapLabelCount = visible;
  qa.geographicLabels = {policy:'fixed_same_frame_anchor_collision_hides_never_relocates',camera:{cam:[...camera.cam],fw:[...camera.fw],right:[...camera.right],up:[...camera.up],clipNear:camera.clipNear,clipFar:camera.clipFar},viewport,labels:reports};
}
export function installGeographicLabels(target=globalThis) { target.HKGeographicLabels = {draw:drawGeographicLabels}; }
export function patchGeographicLabels(html) {
  const start='let visible=0,placed=[];for(const p of hkLabels)', end='qa.mapLabelCount=visible;';
  if (html.split(start).length !== 2 || html.split(end).length !== 2) throw Error('Geographic label host anchor is not unique');
  const a=html.indexOf(start), b=html.indexOf(end,a)+end.length;
  return html.slice(0,a)+'window.HKGeographicLabels.draw(hkLabels,c,canvas,mapState,hkHeight,qa);'+html.slice(b);
}
