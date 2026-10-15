// Original metre-based inspection geometry. No THREE, DOM, texture, or source mutation.
// Compare heights relative to the same authored station base, not absolute DEM altitude.
export const KOWLOON_HEIGHT_REFERENCE = Object.freeze({
  anchorWorld: Object.freeze([1477.171, 3.90, 9824.015]),
  officialBodyM: 44, officialRodM: 7, officialTipM: 51,
  baselineBodyM: 41.43017366612912, baselineTipM: 44.049999193763426,
  source: 'https://www.amo.gov.hk/en/historic-buildings/monuments/kowloon/monuments_43/index.html',
  status: 'Official total heights; station base and internal section proportions remain authored.'
});

/** Returns raw world-metre segments plus interleaved [x,y,z,r,g,b] triangle vertices.
 * Append vertices to an existing raw-WebGL colour buffer; draw with TRIANGLES.
 * labels[].position is also world metres. Labels are optional parent UI work.
 */
export function makeKowloonScaleGuides({
  anchor = KOWLOON_HEIGHT_REFERENCE.anchorWorld,
  offset = [-12, 0], showOriginal = true, thicknessM = 0.10
} = {}) {
  if (anchor.length !== 3 || offset.length !== 2 || ![...anchor,...offset,thicknessM].every(Number.isFinite) || thicknessM <= 0) throw Error('Invalid metre scale-guide placement');
  const origin = [anchor[0]+offset[0], anchor[1], anchor[2]+offset[1]],
    body = [.24,.83,.88], rod = [.98,.78,.26], original = [.98,.45,.25],
    segments = [], labels = [], vertices = [];
  function point(x, h, z=0) { return [origin[0]+x, origin[1]+h, origin[2]+z]; }
  function line(id, a, b, color, width=thicknessM) {
    // The guides are axis-aligned; caps match exact measurement endpoints.
    const axis = [0,1,2].filter(i=>a[i]!==b[i]);
    if (axis.length !== 1) throw Error('Scale-guide segment must be axis-aligned');
    const lo=a.map((v,i)=>i===axis[0]?Math.min(v,b[i]):v-width/2),
      hi=a.map((v,i)=>i===axis[0]?Math.max(v,b[i]):v+width/2);
    const [x,y,z]=lo,[X,Y,Z]=hi,
      p=[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z],[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]];
    for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
      for(const i of [f[0],f[1],f[2],f[0],f[2],f[3]]) vertices.push(...p[i],...color);
    segments.push({id,a:[...a],b:[...b],color:[...color],widthM:width,lengthM:Math.hypot(...a.map((v,i)=>b[i]-v))});
  }
  line('official-body-44m',point(0,0),point(0,44),body);
  line('official-rod-7m',point(0,44),point(0,51),rod);
  for (const h of [0,5,10,15,20,25,30,35,40,44,45,50,51]) {
    const key=[0,44,51].includes(h), w=key?2.4:.65;
    line('height-tick-'+h,point(-w/2,h),point(w/2,h),h>44?rod:body,key?thicknessM:thicknessM*.65);
  }
  labels.push(
    {id:'datum',position:point(-1.4,0),text:'0 m · 站体显示基底 +3.90 m',heightAboveBaseM:0,color:body},
    {id:'official-body',position:point(-1.4,44),text:'44 m 本体 · AMO',heightAboveBaseM:44,color:body},
    {id:'official-tip',position:point(-1.4,51),text:'51 m 针顶 · 44 + 7 m',heightAboveBaseM:51,color:rod}
  );
  if (showOriginal) {
    const x=3.6, old=KOWLOON_HEIGHT_REFERENCE;
    line('baseline-total',point(x,0),point(x,old.baselineTipM),original,thicknessM*.55);
    for(const [id,h,text] of [['baseline-body',old.baselineBodyM,'旧塔本体 41.430 m'],['baseline-tip',old.baselineTipM,'旧塔针顶 44.050 m']]) {
      line(id+'-tick',point(x-.5,h),point(x+.5,h),original,thicknessM*.55);
      labels.push({id,position:point(x+.65,h),text,heightAboveBaseM:h,color:original});
    }
  }
  return {vertices:new Float32Array(vertices),triangleCount:vertices.length/18,segments,labels,
    anchorWorld:[...anchor],originWorld:origin,reference:KOWLOON_HEIGHT_REFERENCE,
    units:'metres',interpretation:'Ruler endpoints are heights above the authored common station base; not surveyed ground elevation.'};
}
