/** Native BT10-family static mechanism study. Independent authored rules only.
 * x transverse, y up from rail reference, z rearward; body midpoint z=0.
 * Explicit historical anchors do not calibrate every local shape or a particular car.
 */
const FRA = 'https://railroads.dot.gov/sites/fra.dot.gov/files/fra_net/15976/1979_ENGINEERING%20DATA%20ON%20SELECTED%20HIGH%20SPEED%20PASSENGER.PDF';
const MT288 = 'https://www.bluebell-railway.co.uk/bluebell/cw/hra_tech/MT288-wheelset-tread-standards-and-gauging-wg4j.pdf';
export const COACH_MECHANICS_EVIDENCE = Object.freeze({
  checkedOn: '2026-10-17',
  wheelDiameter: { value: 0.914, unit: 'm', status: 'historical-primary-document-nominal-new-wheel', source: FRA, location: 'FRA/ORD-78/29, April 1979 reprint, printed p82 Table13, PDF p91', corroboration: { source: MT288, location: 'British Rail MT288 Issue2 RevA September1996, printed p54 Table3, PDF p56, BT5/BT10 row NEW 914mm' }, caveat: 'New/nominal tread diameter, not flange-tip diameter or a measurement of current worn wheels' },
  bogieWheelbase: { value: 2.600, unit: 'm', status: 'historical-primary-document-design', source: FRA, location: 'printed p82 Table13, PDF p91, English BT10 wheelbase' },
  bogieCentres: { value: 16.000, unit: 'm', status: 'historical-primary-document-design', source: FRA, location: 'printed p88 Table17 continued, PDF p97, English HST MarkIII/BT10 truck spacing' },
  trackGauge: { value: 1.435, unit: 'm', status: 'historical-primary-document-design', source: FRA, location: 'printed p82 Table13, PDF p91' },
  architecture: { source: FRA, location: 'printed pp55–57, PDF pp64–66, Figures23–24', scope: 'Historical BT10 HST passenger-trailer suspension and equipment arrangement; local shapes and installed coordinates remain an authored study.' },
  rejectedLegacyValues: { bogieWheelbase: [2.26, 1.8], bogieCentres: [15.3], reason: 'Old study values conflict with the historical primary BT10 design tables; never accepted as measured dimensions.' },
  provisional: 'All other dimensions, contour controls, wheel profile, mounting coordinates, equipment layout, brake disc/caliper details, fasteners, coupling type and service routing.',
  sourceCorrespondence: 'Named source assemblies are inventory evidence only. Anonymous wheel/brake/suspension submeshes have not been established one-for-one. No claim of 89/89 reconstructed mesh equivalence.',
  completeness: 'Static functional study, not a complete or working train mechanism. No dynamic suspension, braking, load or safety validation.'
});
export const COACH_MECHANICS_DEFAULTS = Object.freeze({
  bodyLength: 22.57, nominalCoupledLength: 23.0, floorUndersideY: 1.175,
  bogieCentres: 16.0, bogieWheelbase: 2.6, wheelDiameter: 0.914, trackGauge: 1.435,
  wheelTreadCentres: 1.505, wheelWidth: 0.135, flangeHeight: 0.028,
  frameHalfWidth: 1.016, frameLength: 3.66, frameY: 0.925,
  frameBeamWidth: 0.18, frameBeamHeight: 0.16,
  primarySpringRadius: 0.105, primaryWireRadius: 0.021, primarySpringHeight: 0.29, primaryCoils: 5.75,
  secondarySpringRadius: 0.245, secondarySpringHeight: 0.27,
  brakeDiscRadius: 0.335, brakeDiscThickness: 0.032,
  equipmentBottomY: 0.45, equipmentHeight: 0.50, equipmentWidth: 1.94,
  couplingHeight: 0.82, radialSegments: 48, tubeSegments: 10, springSamplesPerTurn: 20,
  includeUnderframe: true, includeEquipment: true, includeEndServices: true,
  includeSteps: true, includeFasteners: true, includeServicePipes: true
});
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]), mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);if(n<1e-12)return[0,1,0];return mul(a,1/n);};
const lerp=(a,b,t)=>a+(b-a)*t;
const mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const signs=[-1,1];
function params(input){
  const p={...COACH_MECHANICS_DEFAULTS,...input};
  for(const [k,v]of Object.entries(p)){
    if(!(k in COACH_MECHANICS_DEFAULTS))throw new RangeError(`Unknown coach mechanics parameter: ${k}`);
    if(typeof COACH_MECHANICS_DEFAULTS[k]==='boolean'){if(typeof v!=='boolean')throw new TypeError(`${k} must be boolean`);}
    else if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new RangeError(`${k} must be finite and positive`);
  }
  if(p.bodyLength>p.nominalCoupledLength)throw new RangeError('Bare body length exceeds coupled reference');
  if(p.wheelDiameter<.75||p.wheelDiameter>1.04)throw new RangeError('wheelDiameter outside supported static study range');
  if(p.bogieWheelbase<2.3||p.bogieWheelbase>3.1)throw new RangeError('Bogie wheelbase outside this BT10 study; legacy 1.8/2.26 values rejected');
  if(p.bogieCentres<14||p.bogieCentres+p.frameLength>p.bodyLength)throw new RangeError('Bogie centre layout leaves body');
  if(p.frameLength<p.bogieWheelbase+.75)throw new RangeError('Frame too short for wheelbase and primary suspension');
  if(p.wheelTreadCentres<p.trackGauge||p.wheelTreadCentres>p.trackGauge+.18)throw new RangeError('Wheel tread centres must be distinct from rail inner-face gauge');
  if(p.floorUndersideY<=1.15)throw new RangeError('Floor interface intersects the current bolster/centre-pin study');
  if(p.frameY<.88||p.frameY>.97)throw new RangeError('frameY outside this static attachment study');
  if(p.frameY+p.frameBeamHeight/2>=p.floorUndersideY-.025)throw new RangeError('Bogie frame collides with floor interface');
  if(p.equipmentBottomY+p.equipmentHeight>=p.floorUndersideY-.1)throw new RangeError('Equipment collides with floor interface');
  if(p.brakeDiscRadius>=p.wheelDiameter/2-.06)throw new RangeError('Brake disc does not fit wheel');
  if(p.primarySpringHeight<.18||p.primarySpringHeight>.36||p.primaryCoils<3||p.primaryCoils>9)throw new RangeError('Primary spring outside supported range');
  if(p.primaryWireRadius*2*p.primaryCoils>=p.primarySpringHeight)throw new RangeError('Primary coil turns self-intersect');
  if(p.secondarySpringHeight<.16||p.secondarySpringHeight>.32)throw new RangeError('Air spring outside supported range');
  for(const k of ['radialSegments','tubeSegments','springSamplesPerTurn'])if(!Number.isInteger(p[k])||p[k]<6||p[k]>96)throw new RangeError(`Invalid ${k}`);
  return p;
}
class Mesh{
  constructor(name,material,role,assembly,metadata={}){Object.assign(this,{name,material,category:'mechanics',metadata:{role,assembly,localDimensions:'provisional',...metadata},positions:[],normals:[],uvs:[],indices:[]});}
  vertex(p,n,uv){const id=this.positions.length/3;this.positions.push(...p);this.normals.push(...unit(n));this.uvs.push(...uv);return id;}
  tri(points,normals,uvs){const n=unit(normals.reduce(add,[0,0,0])),g=cross(sub(points[1],points[0]),sub(points[2],points[0]));if(Math.hypot(...g)<1e-12)return;let ids=points.map((v,i)=>this.vertex(v,normals[i],uvs[i]));if(dot(g,n)<0)ids=[ids[0],ids[2],ids[1]];this.indices.push(...ids);}
  quad(points,normals=null,uvs=[[0,0],[1,0],[1,1],[0,1]]){const n=unit(cross(sub(points[1],points[0]),sub(points[3],points[0])));normals??=[n,n,n,n];this.tri([points[0],points[1],points[2]],[normals[0],normals[1],normals[2]],[uvs[0],uvs[1],uvs[2]]);this.tri([points[0],points[2],points[3]],[normals[0],normals[2],normals[3]],[uvs[0],uvs[2],uvs[3]]);}
  finish(){return{...this,positions:new Float32Array(this.positions),normals:new Float32Array(this.normals),uvs:new Float32Array(this.uvs),indices:new Uint32Array(this.indices),materialGroups:[{start:0,count:this.indices.length,materialIndex:0}],uvUnits:'design-metres'};}
}
function basis(axis){const w=unit(axis),a=Math.abs(w[1])<.85?[0,1,0]:[1,0,0],u=unit(cross(a,w)),v=cross(w,u);return{u,v,w};}
function orient(point,origin,b){return add(origin,add(mul(b.u,point[0]),add(mul(b.v,point[1]),mul(b.w,point[2]))));}
function lathe(mesh,origin,axis,profile,segments=48){
  const b=basis(axis),count=profile.length;
  for(let k=0;k<count;k++){
    const j=(k+1)%count,[a0,r0]=profile[k],[a1,r1]=profile[j];
    const da=a1-a0,dr=r1-r0;
    for(let i=0;i<segments;i++){
      const t0=i/segments*Math.PI*2,t1=(i+1)/segments*Math.PI*2;
      const rad=t=>add(mul(b.u,Math.cos(t)),mul(b.v,Math.sin(t)));
      const point=(a,r,t)=>add(origin,add(mul(b.w,a),mul(rad(t),r)));
      const normal=t=>unit(add(mul(b.w,-dr),mul(rad(t),da)));
      mesh.quad([point(a0,r0,t0),point(a0,r0,t1),point(a1,r1,t1),point(a1,r1,t0)],[normal(t0),normal(t1),normal(t1),normal(t0)],[[t0*Math.max(r0,r1),a0],[t1*Math.max(r0,r1),a0],[t1*Math.max(r0,r1),a1],[t0*Math.max(r0,r1),a1]]);
    }
  }
}
function cylinder(mesh,a,b,r,segments=24,bevel=0){const d=Math.hypot(...sub(b,a));lathe(mesh,mix(a,b,.5),sub(b,a),[[-d/2,0],[-d/2,r-bevel],[-d/2+bevel,r],[d/2-bevel,r],[d/2,r-bevel],[d/2,0]],segments);}
function polygonArea(p){return p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2;}
function triangulate(poly){
  const ids=Array.from({length:poly.length},(_,i)=>i);if(polygonArea(poly)<0)ids.reverse();const tris=[];
  const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inside=(p,a,b,c)=>cross2(a,b,p)>=-1e-10&&cross2(b,c,p)>=-1e-10&&cross2(c,a,p)>=-1e-10;
  while(ids.length>3){let clipped=false;for(let i=0;i<ids.length;i++){const a=ids[(i+ids.length-1)%ids.length],b=ids[i],c=ids[(i+1)%ids.length];if(cross2(poly[a],poly[b],poly[c])<=1e-10)continue;if(ids.some(j=>j!==a&&j!==b&&j!==c&&inside(poly[j],poly[a],poly[b],poly[c])))continue;tris.push([a,b,c]);ids.splice(i,1);clipped=true;break;}if(!clipped)throw new Error('Authored prism profile cannot be triangulated');}
  tris.push(ids);return tris;
}
function prism(mesh,outline,rings,origin=[0,0,0],axis=[0,0,1]){
  const b=basis(axis),poly=polygonArea(outline)>0?outline:[...outline].reverse();
  const point=(ring,p)=>orient([p[0]*ring.scale,p[1]*ring.scale+(ring.y??0),ring.z],origin,b);
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;mesh.quad([point(rings[k],poly[i]),point(rings[k],poly[j]),point(rings[k+1],poly[j]),point(rings[k+1],poly[i])]);}
  const triangles=triangulate(poly);
  for(const [ring,sign]of [[rings[0],-1],[rings.at(-1),1]])for(const tri of triangles){const n=mul(b.w,sign);mesh.tri(tri.map(i=>point(ring,poly[i])),[n,n,n],tri.map(i=>poly[i]));}
}
function roundedRect(w,h,r,segments=4){const pts=[];for(let k=0;k<4;k++){const c=[[w/2-r,h/2-r],[-w/2+r,h/2-r],[-w/2+r,-h/2+r],[w/2-r,-h/2+r]][k];for(let i=0;i<=segments;i++){const t=(k+i/segments)*Math.PI/2;pts.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)]);}}return pts;}
function housing(mesh,center,size,bevel=.025,axis=[0,0,1]){const [w,h,l]=size,r=Math.min(bevel,w/4,h/4),s=1-Math.min(.08,bevel/Math.min(w,h));prism(mesh,roundedRect(w,h,r),[{z:-l/2,scale:s},{z:-l/2+r,scale:1},{z:l/2-r,scale:1},{z:l/2,scale:s}],center,axis);}
function beam(mesh,a,b,w,h){housing(mesh,mix(a,b,.5),[w,h,Math.hypot(...sub(b,a))],Math.min(.015,w/8,h/8),sub(b,a));}
function tube(mesh,path,r,sides=10){
  const rings=[];let previous=null,length=0;
  for(let i=0;i<path.length;i++){
    const t=unit(sub(path[Math.min(i+1,path.length-1)],path[Math.max(0,i-1)]));
    let u=previous?unit(sub(previous,mul(t,dot(previous,t)))):basis(t).u;previous=u;const v=cross(t,u);
    if(i)length+=Math.hypot(...sub(path[i],path[i-1]));
    rings.push({length,points:Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2,n=add(mul(u,Math.cos(a)),mul(v,Math.sin(a)));return{point:add(path[i],mul(n,r)),normal:n};})});
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides,a=rings[i],b=rings[i+1],s=[a.points[j],b.points[j],b.points[k],a.points[k]];mesh.quad(s.map(x=>x.point),s.map(x=>x.normal),[[j/sides*Math.PI*2*r,a.length],[j/sides*Math.PI*2*r,b.length],[k/sides*Math.PI*2*r,b.length],[k/sides*Math.PI*2*r,a.length]]);}
  for(const [index,sign]of [[0,-1],[rings.length-1,1]]){const ring=rings[index],n=mul(unit(sub(path[Math.min(index+1,path.length-1)],path[Math.max(0,index-1)])),sign);for(let j=0;j<sides;j++)mesh.tri([path[index],ring.points[j].point,ring.points[(j+1)%sides].point],[n,n,n],[[0,0],[1,0],[1,1]]);}
}
function bezier(a,b,c,d,n=24){return Array.from({length:n+1},(_,i)=>{const t=i/n,s=1-t;return a.map((v,k)=>s*s*s*v+3*s*s*t*b[k]+3*s*t*t*c[k]+t*t*t*d[k]);});}
function boltRing(mesh,origin,axis,radius,count,boltRadius=.018){const b=basis(axis);for(let i=0;i<count;i++){const t=i/count*Math.PI*2,q=add(origin,add(mul(b.u,Math.cos(t)*radius),mul(b.v,Math.sin(t)*radius)));cylinder(mesh,q,add(q,mul(b.w,.018)),boltRadius,6);}}
function ringPlate(mesh,origin,axis,inner,outer,thickness,segments=48){lathe(mesh,origin,axis,[[-thickness/2,inner],[-thickness/2,outer],[thickness/2,outer],[thickness/2,inner]],segments);}
function iSection(w,h){const f=.026,t=.034;return[[-w/2,-h/2],[w/2,-h/2],[w/2,-h/2+f],[t/2,-h/2+f],[t/2,h/2-f],[w/2,h/2-f],[w/2,h/2],[-w/2,h/2],[-w/2,h/2-f],[-t/2,h/2-f],[-t/2,-h/2+f],[-w/2,-h/2+f]];}
function part(parts,name,material,role,assembly,fn,metadata={}){const m=new Mesh(name,material,role,assembly,metadata);fn(m);const out=m.finish();if(out.indices.length)parts.push(out);return out;}
function wheelProfile(p){const r=p.wheelDiameter/2,w=p.wheelWidth,f=p.flangeHeight;return[[-w*.50,.080],[-w*.50,.145],[-w*.34,.24],[-w*.27,r-.065],[-w*.48,r+.008],[-w*.40,r+f],[-w*.26,r+f*.9],[-w*.16,r+.006],[-w*.07,r],[w*.39,r-.004],[w*.50,r-.016],[w*.50,r-.060],[w*.23,.25],[w*.18,.15],[w*.50,.080]];}
function addDamper(parts,name,a,b,assembly,role,p){const mid=mix(a,b,.62);part(parts,`${name}-body`,'blackPaint',role,assembly,m=>cylinder(m,a,mid,.046,24,.008),{damperAssembly:name,subcomponent:'body'});part(parts,`${name}-rod`,'brushedMetal',role,assembly,m=>cylinder(m,mid,b,.019,16),{damperAssembly:name,subcomponent:'polished-piston-rod'});part(parts,`${name}-eyes`,'dark-iron',role,assembly,m=>{for(const q of [a,b])ringPlate(m,q,[1,0,0],.015,.038,.042,24);},{damperAssembly:name,subcomponent:'mounting-eyes'});}
function buildBogie(parts,centerZ,index,p){
  const assembly=`bogie-${index}`,R=p.wheelDiameter/2,frameX=p.frameHalfWidth,frameY=p.frameY;
  const loc=(x,y,z)=>[x,y,centerZ+z];
  for(const side of signs){
    part(parts,`${assembly}-sideframe-${side}`,'blackPaint','bogie-frame',assembly,m=>prism(m,iSection(p.frameBeamWidth,p.frameBeamHeight),Array.from({length:13},(_,i)=>({z:-p.frameLength/2+p.frameLength*i/12,scale:1,y:.022*Math.sin(Math.PI*i/12)})),loc(side*frameX,frameY,0)),{generator:'authored-I-section-sweep'});
    part(parts,`${assembly}-airspring-${side}`,'rubber','secondary-air-spring',assembly,m=>{
      const h=p.secondarySpringHeight,r=p.secondarySpringRadius,profile=[];for(let i=0;i<=20;i++){const t=i/20;profile.push([-h/2+t*h,r*(.80+.20*Math.sin(Math.PI*t))]);}profile.push([h/2,0],[-h/2,0]);lathe(m,loc(side*.99,.585+h/2,0),[0,1,0],profile,p.radialSegments);
    },{countPerBogie:2,architectureSource:'FRA p55',envelopeOnly:true});
    part(parts,`${assembly}-air-spring-plates-${side}`,'blackPaint','secondary-air-spring-mount',assembly,m=>{for(const y of [.57,.585+p.secondarySpringHeight+.015])cylinder(m,loc(side*.99,y-.012,0),loc(side*.99,y+.012,0),p.secondarySpringRadius*.86,32,.006);housing(m,loc(side*.99,.925,0),[.36,.11,.36],.022);});
    part(parts,`${assembly}-side-bearing-${side}`,'dark-iron','slide-pad',assembly,m=>housing(m,loc(side*.86,p.floorUndersideY-.049,0),[.31,.075,.31],.025));
    for(const end of signs){
      const z=end*p.bogieWheelbase/2;
      const wheelCenter=loc(side*p.wheelTreadCentres/2,R,z);
      part(parts,`${assembly}-wheel-${side}-${end}`,'dark-iron','wheel',assembly,m=>lathe(m,wheelCenter,[side,0,0],wheelProfile(p),p.radialSegments),{treadDiameter:p.wheelDiameter,flangeTipDiameter:p.wheelDiameter+2*p.flangeHeight,dimensionStatus:'historical-nominal-tread-anchor;profile-provisional'});
      part(parts,`${assembly}-wheel-tread-${side}-${end}`,'brushedMetal','wheel-tread',assembly,m=>lathe(m,wheelCenter,[side,0,0],[[-p.wheelWidth*.07,R+.0002],[p.wheelWidth*.39,R-.0038],[p.wheelWidth*.39,R-.0042],[-p.wheelWidth*.07,R-.0002]],p.radialSegments));
      part(parts,`${assembly}-axlebox-${side}-${end}`,'blackPaint','axlebox',assembly,m=>{cylinder(m,loc(side*.91,R,z),loc(side*1.11,R,z),.154,32,.012);housing(m,loc(side*1.005,R-.018,z),[.20,.24,.30],.038);});
      part(parts,`${assembly}-axlebox-cap-${side}-${end}`,'dark-iron','axlebox-cover',assembly,m=>{cylinder(m,loc(side*1.10,R,z),loc(side*1.135,R,z),.124,32,.008);if(p.includeFasteners)boltRing(m,loc(side*1.136,R,z),[side,0,0],.089,6,.013);});
      const springZ=z+end*.265,springBottom=R-.015;
      part(parts,`${assembly}-primary-coil-${side}-${end}`,'dark-iron','primary-coil-spring',assembly,m=>{
        const n=Math.ceil(p.primaryCoils*p.springSamplesPerTurn),path=Array.from({length:n+1},(_,i)=>{const t=i/n,a=t*p.primaryCoils*Math.PI*2;return loc(side*frameX+Math.cos(a)*p.primarySpringRadius,springBottom+t*p.primarySpringHeight,springZ+Math.sin(a)*p.primarySpringRadius);});tube(m,path,p.primaryWireRadius,p.tubeSegments);
      },{turns:p.primaryCoils,countPerBogie:4,architectureSource:'FRA p55'});
      part(parts,`${assembly}-spring-seats-${side}-${end}`,'blackPaint','primary-spring-seat',assembly,m=>{for(const y of [springBottom-.012,springBottom+p.primarySpringHeight+.012])cylinder(m,loc(side*frameX,y-.012,springZ),loc(side*frameX,y+.012,springZ),p.primarySpringRadius+.024,24,.007);cylinder(m,loc(side*frameX,springBottom+p.primarySpringHeight+.024,springZ),loc(side*frameX,frameY-p.frameBeamHeight/2+.02,springZ),.065,20);});
      part(parts,`${assembly}-radius-arm-${side}-${end}`,'blackPaint','axlebox-radius-arm',assembly,m=>{const a=loc(side*frameX,R-.035,z-end*.50),b=loc(side*frameX,R-.035,z+end*.34);beam(m,a,b,.12,.075);beam(m,a,loc(side*frameX,frameY-.065,z-end*.50),.10,.10);cylinder(m,loc(side*(frameX-.07),R-.035,z-end*.50),loc(side*(frameX+.07),R-.035,z-end*.50),.065,24);});
      part(parts,`${assembly}-radius-arm-bush-${side}-${end}`,'rubber','radius-arm-rubber-bush',assembly,m=>ringPlate(m,loc(side*frameX,R-.035,z-end*.50),[1,0,0],.022,.052,.15,24));
      addDamper(parts,`${assembly}-primary-damper-${side}-${end}`,loc(side*(frameX+.105),R+.025,z+end*.38),loc(side*(frameX+.105),frameY-.025,z+end*.38),assembly,'primary-hydraulic-damper',p);
      const discX=side*(p.wheelTreadCentres/2-p.wheelWidth/2-.020);
      part(parts,`${assembly}-brake-disc-${side}-${end}`,'brushedMetal','wheel-cheek-brake-disc',assembly,m=>{ringPlate(m,loc(discX,R,z),[1,0,0],.15,p.brakeDiscRadius,p.brakeDiscThickness,p.radialSegments);if(p.includeFasteners)boltRing(m,loc(discX-side*p.brakeDiscThickness*.55,R,z),[-side,0,0],.235,10,.014);},{mounting:'inboard-wheel-cheek study; exact disc arrangement pending variant drawing'});
      part(parts,`${assembly}-brake-caliper-${side}-${end}`,'blackPaint','disc-brake-caliper',assembly,m=>{
        const cx=discX;const outline=[[-.10,-.08],[-.04,-.08],[-.04,.07],[.04,.07],[.04,-.08],[.10,-.08],[.10,.13],[-.10,.13]];
        prism(m,outline,[{z:-.085,scale:1},{z:.085,scale:1}],loc(cx,R+.24,z-end*.15));
        beam(m,loc(cx,R+.35,z-end*.15),loc(cx,frameY-.04,z-end*.30),.07,.07);
      },{detailedEngineering:'provisional-static-caliper-with-open-throat'});
      part(parts,`${assembly}-brake-pads-${side}-${end}`,'dark-iron','disc-brake-pad',assembly,m=>{for(const s of signs)housing(m,loc(discX+s*.029,R+.24,z-end*.15),[.018,.12,.12],.006);});
      part(parts,`${assembly}-wsp-detector-${side}-${end}`,'blackPaint','wheel-slide-protection-detector',assembly,m=>cylinder(m,loc(side*1.135,R,z),loc(side*1.18,R,z),.046,24,.006),{routingAndSensorShape:'provisional',architectureSource:'FRA Figure24'});
      if(p.includeServicePipes)part(parts,`${assembly}-wsp-lead-${side}-${end}`,'rubber','wheel-slide-protection-lead',assembly,m=>tube(m,bezier(loc(side*1.18,R+.03,z),loc(side*1.22,R+.14,z),loc(side*1.20,frameY-.10,z-end*.23),loc(side*1.10,frameY-.02,z-end*.30)),.009,8));
    }
    for(const end of signs){
      part(parts,`${assembly}-swing-link-${side}-${end}`,'blackPaint','secondary-swing-link',assembly,m=>{beam(m,loc(side*1.18,.60,end*.30),loc(side*1.18,frameY+.005,end*.30),.065,.06);for(const y of [.60,frameY+.005])ringPlate(m,loc(side*1.18,y,end*.30),[1,0,0],.018,.048,.08,24);},{countPerBogie:4,architectureSource:'FRA p55'});
    }
    part(parts,`${assembly}-anchor-rod-${side}`,'dark-iron','secondary-anchor-rod',assembly,m=>{const a=loc(side*1.12,.82,-.38),b=loc(side*1.12,.82,.53);cylinder(m,a,b,.026,20);for(const z of [-.38,.53])ringPlate(m,loc(side*1.12,.82,z),[1,0,0],.023,.055,.075,24);},{countPerBogie:2});
    addDamper(parts,`${assembly}-secondary-damper-${side}`,loc(side*1.19,.63,.285),loc(side*1.19,frameY+.01,.285),assembly,'secondary-vertical-damper',p);
    part(parts,`${assembly}-levelling-valve-${side}`,'dark-iron','air-levelling-valve',assembly,m=>{housing(m,loc(side*1.20,.76,-.30),[.10,.10,.12],.015);beam(m,loc(side*1.22,.75,-.30),loc(side*1.22,.62,-.06),.013,.013);},{position:'provisional',architectureSource:'FRA Figure24'});
  }
  for(const end of signs){
    const z=end*p.bogieWheelbase/2;
    part(parts,`${assembly}-axle-${end}`,'dark-iron','axle',assembly,m=>{cylinder(m,loc(-1.11,R,z),loc(1.11,R,z),.075,32,.012);for(const s of signs)cylinder(m,loc(s*.60,R,z),loc(s*.83,R,z),.103,32,.008);},{axleStationZ:centerZ+z});
    part(parts,`${assembly}-crossmember-${end}`,'blackPaint','frame-crossmember',assembly,m=>prism(m,iSection(.18,.15),[{z:-frameX,scale:1},{z:frameX,scale:1}],loc(0,frameY-.015,end*.58),[1,0,0]),{countPerBogie:2,architectureSource:'FRA p55 text specifies two crossmembers omitted in Figure23 sketch'});
  }
  part(parts,`${assembly}-bolster`,'blackPaint','bolster',assembly,m=>housing(m,loc(0,1.025,0),[2.25,.14,.40],.045));
  part(parts,`${assembly}-spring-plank`,'blackPaint','spring-plank',assembly,m=>housing(m,loc(0,.565,0),[2.39,.065,.70],.025));
  part(parts,`${assembly}-centre-pivot`,'dark-iron','centre-pivot-and-pin',assembly,m=>{cylinder(m,loc(0,.72,0),loc(0,1.13,0),.105,32,.012);ringPlate(m,loc(0,1.11,0),[0,1,0],.106,.22,.04,32);});
  addDamper(parts,`${assembly}-lateral-damper`,loc(-.60,.73,.45),loc(.60,.73,.45),assembly,'lateral-secondary-damper',p);
  part(parts,`${assembly}-air-reservoir`,'blackPaint','air-reservoir',assembly,m=>cylinder(m,loc(-.40,.79,-.45),loc(.40,.79,-.45),.12,32,.04));
  if(p.includeServicePipes)part(parts,`${assembly}-air-pipe-network`,'dark-iron','air-service-pipe',assembly,m=>{
    for(const side of signs)tube(m,bezier(loc(side*.35,.79,-.45),loc(side*.7,.79,-.45),loc(side*.9,.85,-.20),loc(side*.99,.85,0)),.012,8);
    tube(m,bezier(loc(0,.79,-.45),loc(.1,.90,-.8),loc(.15,.96,-.9),loc(.2,1.09,-1.0)),.012,8);
  });
  if(p.includeFasteners)part(parts,`${assembly}-frame-fasteners`,'dark-iron','frame-fasteners',assembly,m=>{for(const side of signs)for(const z of [-p.frameLength/2+.08,-.58,.58,p.frameLength/2-.08])cylinder(m,loc(side*frameX,frameY+.082,z),loc(side*frameX,frameY+.105,z),.023,6);});
}
function addUnderframe(parts,p){
  const a='underframe',L=p.bodyLength-.34;
  for(const side of signs)part(parts,`underframe-solebar-${side}`,'blackPaint','body-solebar',a,m=>prism(m,iSection(.12,.10),[{z:-L/2,scale:1},{z:L/2,scale:1}],[side*1.08,p.floorUndersideY-.061,0]));
  part(parts,'underframe-crossbearers','blackPaint','body-crossbearer',a,m=>{for(let z=-L/2+.2;z<L/2;z+=1.65)prism(m,iSection(.09,.085),[{z:-1.08,scale:1},{z:1.08,scale:1}],[0,p.floorUndersideY-.065,z],[1,0,0]);},{repeatRule:'uniform study spacing 1.65m; not source-derived'});
  for(const sign of signs)part(parts,`underframe-headstock-${sign}`,'blackPaint','headstock',a,m=>housing(m,[0,p.floorUndersideY-.105,sign*(p.bodyLength/2-.15)],[2.27,.17,.15],.018));
}
function addEquipment(parts,p){
  const assembly='underfloor-equipment',free=p.bogieCentres-p.frameLength-.40;
  const bays=[{id:'electrical',ratio:.22},{id:'conditioning',ratio:.28},{id:'auxiliary',ratio:.18},{id:'battery',ratio:.25}];
  let z=-free/2;
  for(const bay of bays){
    const length=free*bay.ratio,center=z+length/2,y=p.equipmentBottomY+p.equipmentHeight/2;
    part(parts,`equipment-${bay.id}-housing`,'blackPaint','underfloor-equipment-enclosure',assembly,m=>housing(m,[0,y,center],[p.equipmentWidth,p.equipmentHeight,length],.045),{equipmentFunction:'provisional interpretation, source identifies only Bottom Boxes',bay:bay.id});
    part(parts,`equipment-${bay.id}-mounts`,'dark-iron','equipment-mounting-bracket',assembly,m=>{for(const side of signs)for(const end of signs)beam(m,[side*.78,y+.08,center+end*length*.34],[side*.78,p.floorUndersideY-.02,center+end*length*.34],.075,.08);});
    part(parts,`equipment-${bay.id}-access-panels`,'blackPaint','equipment-access-panel',assembly,m=>{for(const side of signs)housing(m,[side*(p.equipmentWidth/2+.006),y,center],[.020,p.equipmentHeight*.78,length*.91],.006);});
    part(parts,`equipment-${bay.id}-vent-louvres`,'dark-iron','equipment-vent-louvre',assembly,m=>{
      const slats=12;for(const side of signs)for(let i=0;i<slats;i++){const zz=center-length*.32+i/(slats-1)*length*.64;beam(m,[side*(p.equipmentWidth/2+.020),y-.14,zz],[side*(p.equipmentWidth/2+.036),y+.14,zz],.026,.012);}
    },{sourceRole:'Bottom Box Vents_27; layout provisional'});
    z+=length+free*.023;
  }
  if(p.includeServicePipes)part(parts,'underframe-service-trunk','dark-iron','underfloor-service-trunk',assembly,m=>{for(const side of signs)tube(m,[[side*.46,1.02,-p.bodyLength/2+.65],[side*.46,1.02,p.bodyLength/2-.65]],.018,10);});
}
function addEndServices(parts,p){
  for(const sign of signs){
    const assembly=`end-services-${sign}`,z=sign*(p.bodyLength/2),Y=p.couplingHeight;
    const P=(x,y,offset)=>[x,y,z+sign*offset];
    part(parts,`${assembly}-drawgear`,'blackPaint','coupling-drawgear-mount',assembly,m=>{housing(m,P(0,Y,-.21),[.36,.26,.34],.045);for(const side of signs)beam(m,P(side*.22,Y-.04,-.38),P(side*.16,Y+.05,-.03),.07,.08);},{couplingType:'unresolved; generic native mechanical envelope, not validated HST coupler'});
    part(parts,`${assembly}-shank`,'dark-iron','coupling-shank',assembly,m=>cylinder(m,P(0,Y,-.13),P(0,Y,.13),.067,24,.008));
    part(parts,`${assembly}-coupling-head`,'dark-iron','coupling-head',assembly,m=>{
      const profile=[[-.12,-.11],[.11,-.11],[.16,-.045],[.16,.085],[.07,.125],[-.06,.125],[-.06,.05],[.045,.025],[.045,-.025],[-.12,-.025]];
      prism(m,profile.map(([u,v])=>[u*.5,v]),[{z:-.055,scale:1},{z:.055,scale:1}],P(0,Y,.145),[sign,0,0]);
    },{status:'authored-static-study; exact coupler head geometry unresolved'});
    part(parts,`${assembly}-mount-brackets`,'blackPaint','end-mount-bracket',assembly,m=>{for(const side of signs)housing(m,P(side*.86,.94,-.01),[.23,.22,.18],.023);},{sourceRole:'Rear Buffer Mount names; HST non-buffer variant: do not invent buffer heads'});
    part(parts,`${assembly}-service-sockets`,'dark-iron','end-service-socket',assembly,m=>{for(const x of [-.46,-.30,.30,.46]){cylinder(m,P(x,.93,.015),P(x,.93,.07),.045,24,.008);ringPlate(m,P(x,.93,.074),[0,0,sign],.023,.038,.012,24);}});
    part(parts,`${assembly}-hanging-hoses`,'rubber','end-service-hose',assembly,m=>{for(const side of signs)tube(m,bezier(P(side*.38,.92,.07),P(side*.58,.41,.18),P(side*.18,.40,.19),P(side*.22,.85,.09),32),.022,10);},{routing:'authored loose loop; connection identity and routing unresolved'});
    part(parts,`${assembly}-hose-holders`,'blackPaint','end-hose-holder',assembly,m=>{for(const side of signs)ringPlate(m,P(side*.38,.91,.035),[0,0,sign],.027,.047,.022,24);});
  }
}
function addSteps(parts,p){for(const end of signs)for(const side of signs){const z=end*(p.bodyLength/2-1),a=`steps-${side}-${end}`;part(parts,a,'blackPaint','vestibule-access-step','vestibule-steps',m=>{
  for(const y of [.67,.92])housing(m,[side*1.23,y,z],[.25,.035,.60],.008);
  for(const dz of [-.25,.25])beam(m,[side*1.20,.65,z+dz],[side*1.20,1.09,z+dz],.035,.045);
  for(let i=0;i<6;i++)beam(m,[side*1.12,.941,z-.23+i*.092],[side*1.34,.941,z-.23+i*.092],.009,.009);
});}}
function bounds(parts){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of parts)for(let i=0;i<p.positions.length;i+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p.positions[i+j]);max[j]=Math.max(max[j],p.positions[i+j]);}return{min,max,size:max.map((x,i)=>x-min[i])};}
const EXPECTED_ROLES={wheel:8,axle:4,'primary-hydraulic-damper':8,'secondary-vertical-damper':4,'lateral-secondary-damper':2,'primary-coil-spring':8,'secondary-air-spring':4,'secondary-swing-link':8,'secondary-anchor-rod':4,'bogie-frame':4,'frame-crossmember':4,bolster:2,'spring-plank':2,'centre-pivot-and-pin':2,'axlebox':8,'wheel-cheek-brake-disc':8,'disc-brake-caliper':8,'wheel-slide-protection-detector':8};
export function buildMark3Mechanics(input={}){
  const p=params(input),parts=[];buildBogie(parts,-p.bogieCentres/2,'front',p);buildBogie(parts,p.bogieCentres/2,'rear',p);
  if(p.includeUnderframe)addUnderframe(parts,p);if(p.includeEquipment)addEquipment(parts,p);if(p.includeEndServices)addEndServices(parts,p);if(p.includeSteps)addSteps(parts,p);
  const roleCounts={};for(const part of parts)roleCounts[part.metadata.role]=(roleCounts[part.metadata.role]??0)+1;
  const functionalCounts={...roleCounts};for(const role of ['primary-hydraulic-damper','secondary-vertical-damper','lateral-secondary-damper'])functionalCounts[role]=new Set(parts.filter(part=>part.metadata.role===role).map(part=>part.metadata.damperAssembly)).size;
  const checklist=Object.entries(EXPECTED_ROLES).map(([role,expected])=>({role,expected,generated:functionalCounts[role]??0,status:functionalCounts[role]===expected?'generated-native-static-study':'missing',dimensionStatus:['wheel','axle'].includes(role)?'named historical anchors only; all local geometry provisional':'local geometry and installation provisional'}));
  checklist.push({role:'all-source-mesh-subcomponent-correspondence',status:'unresolved',reason:'89 source meshes include anonymous composite bogie geometry; no one-to-one mechanical decomposition has been proven.'},{role:'working-brake-and-suspension-behaviour',status:'not-implemented',reason:'Static structure only; no dynamic validation.'},{role:'exact-variant-coupling-and-equipment-routing',status:'unresolved',reason:'Source assembly names do not establish engineering identity or installed route.'});
  const bogieParts=parts.filter(part=>part.metadata.assembly.startsWith('bogie-'));const mountRoles=['slide-pad','centre-pivot-and-pin'];const movingEnvelope=bounds(bogieParts.filter(part=>!mountRoles.includes(part.metadata.role)));const mountingEnvelope=bounds(bogieParts.filter(part=>mountRoles.includes(part.metadata.role)));
  const edited=Object.entries(input).filter(([k,v])=>v!==COACH_MECHANICS_DEFAULTS[k]).map(([k])=>k);
  return{schema:'kaopu.student-native-mark3-mechanics/1.0',parts,parameters:p,evidence:{...COACH_MECHANICS_EVIDENCE,editedPublishedAnchors:edited.filter(k=>['wheelDiameter','bogieWheelbase','bogieCentres','trackGauge'].includes(k))},checklist,roleCounts,functionalCounts,bounds:bounds(parts),interfaces:{railY:0,wheelTreadContactY:0,flangeBelowRail:p.flangeHeight,floorUndersideY:p.floorUndersideY,bogieCentresZ:[-p.bogieCentres/2,p.bogieCentres/2],axleStationsZ:[-p.bogieCentres/2-p.bogieWheelbase/2,-p.bogieCentres/2+p.bogieWheelbase/2,p.bogieCentres/2-p.bogieWheelbase/2,p.bogieCentres/2+p.bogieWheelbase/2],bogieMovingEnvelope:movingEnvelope,bogieMountingEnvelope:mountingEnvelope,mountingZoneY:[1.10,p.floorUndersideY],floorGap:p.floorUndersideY-mountingEnvelope.max[1],staticOnly:true},completion:{staticNativeAssemblies:'present-study',fullVehicle:false,sourceEquivalent:false,mechanicalFunctionValidated:false,visualApproval:'pending'}};
}
export const generateCoachMechanics=buildMark3Mechanics;
