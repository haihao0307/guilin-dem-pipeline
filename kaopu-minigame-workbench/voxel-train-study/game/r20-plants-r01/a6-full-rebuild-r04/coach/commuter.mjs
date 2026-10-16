import {kit,roundedShape} from './retained/design/geometry.mjs';
export const DOOR_CENTRES=Object.freeze([-9.65,0,9.65]);
/** Lower boundary explicitly walks around each portal; no hole touching an outer ring. */
export function sideShellShape(T){
 const s=new T.Shape();s.moveTo(-11.2,-.82);s.quadraticCurveTo(-11.2,-1,-11.02,-1);
 for(const x of DOOR_CENTRES){s.lineTo(x-.66,-1);s.lineTo(x-.66,.79);s.quadraticCurveTo(x-.66,.88,x-.57,.88);s.lineTo(x+.57,.88);s.quadraticCurveTo(x+.66,.88,x+.66,.79);s.lineTo(x+.66,-1);}
 s.lineTo(11.02,-1);s.quadraticCurveTo(11.2,-1,11.2,-.82);s.lineTo(11.2,.82);s.quadraticCurveTo(11.2,1,11.02,1);s.lineTo(-11.02,1);s.quadraticCurveTo(-11.2,1,-11.2,.82);s.closePath();return s;
}
export function createCommuterInterior(T,M,parent){
 const root=new T.Group();root.name='Detailed standing commuter interior';parent.add(root);const K=kit(T,M,root),seats=[],poles=[],loops=[];
 function mesh(g,m,name,at,rotation){const o=K.add(g,m,name,at);if(rotation)o.rotation.set(...rotation);return o;}
 for(const side of[-1,1])for(const x of[-7.8,-6.6,-5.4,-4.2,-3,-1.8,1.8,3,4.2,5.4,6.6,7.8]){
  const seat=new T.Group();seat.name='Compact original-material commuter twin seat '+x+'/'+side;seat.position.x=x;root.add(seat);const Q=kit(T,M,seat);
  function wood(at,size,name){return Q.add(M.woodGeometry(...size),M.wood,name,at);}
  const cushion=Q.add(M.leatherGeometry(1.12,.135,.50,{radius:.055}),M.leather,'Original chart leather seat cushion',[0,side*1.025,1.63]);cushion.rotation.x=Math.PI/2;
  const back=Q.add(M.leatherGeometry(1.12,.105,.56,{radius:.050}),M.leather,'Original chart leather padded back',[0,side*1.235,1.98]);back.rotation.x=side*.06;
  wood([0,side*1.29,1.98],[1.17,.045,.66],'Rounded walnut seat back shell');wood([0,side*1.03,1.52],[1.17,.53,.08],'Walnut seat support apron');
  for(const dx of[-.43,.43]){Q.rod([dx,side*1.06,1.24],[dx,side*1.06,1.51],.025,'steel','Seat stanchion',16);Q.box([dx,side*1.06,1.235],[.13,.13,.025],'steel','Seat floor fixing plate');for(const dd of[-.043,.043])Q.rod([dx+dd,side*(1.06+.043),1.24],[dx+dd,side*(1.06+.043),1.255],.009,'brass','Seat fixing bolt',8);}
  // Original chart/relief is carried by each sewn leather edging, not generic paint.
  for(const z of[1.76,2.23]){const welt=Q.add(M.leatherGeometry(1.08,.012,.012,{radius:.005}),M.leather,'Leather sewn backrest welt',[0,side*1.174,z]);welt.userData.chartRetained=true;}
  Q.rod([0,side*.77,1.62],[0,side*.77,1.77],.014,'brass','Twin-seat divider grip',12);
  seats.push(seat);
 }
 // Pillars intentionally stop outside boarding clear zones. Continuous paths remain at Y=+/-.38.
 for(const x of[-7.2,-4.8,-2.4,2.4,4.8,7.2]){
  const pole=K.rod([x,0,1.22],[x,0,3.12],.023,'steel','Standing passenger central pole',24);poles.push(pole);
  for(const z of[1.235,3.115]){K.rod([x,0,z-.012],[x,0,z+.012],.075,'steel','Pole load-spreading flange',24);for(const a of[0,Math.PI/2,Math.PI,Math.PI*1.5])K.rod([x+.052*Math.cos(a),.052*Math.sin(a),z],[x+.052*Math.cos(a),.052*Math.sin(a),z+.016],.008,'brass','Pole mounting screw',8);}
  for(const side of[-1,1])K.pipe([[x,0,3.10],[x,side*.30,3.10],[x,side*.55,3.02]],.022,'steel','Overhead rail pole bracket');
 }
 for(const side of[-1,1])for(const [a,b]of[[-8.75,-.85],[.85,8.75]]){
  K.rod([a,side*.55,3.02],[b,side*.55,3.02],.023,'steel','Longitudinal overhead handrail',24);
  for(let x=a+.25;x<b-.1;x+=.60){K.torus([x,side*.55,3.01],.031,.007,'steel','Hand strap suspension clamp',[1,0,0]);K.box([x,side*.55,2.88],[.035,.026,.25],'black','Flexible hand strap');const loop=K.torus([x,side*.55,2.70],.088,.014,'black','Standing passenger hand loop',[0,1,0]);loops.push(loop);}
 }
 for(const side of[-1,1])for(const x of[-8.5,-.95,.95,8.5]){K.pipe([[x,side*.78,1.24],[x,side*.78,2.27],[x,side*.82,2.34],[x,side*1.27,2.34]],.021,'steel','Seat-end standing grab rail');K.box([x,side*1.02,1.83],[.026,.43,.48],'glass','Finite seat-end draught partition');}
 root.userData={layout:'longitudinal compact commuter seats; standing central aisle',motherMaterials:'original walnut and oxblood leather geometry/charts',continuousPathCentrelinesY:[-.38,.38],doorClearZones:DOOR_CENTRES.map(x=>({x,halfLength:.66})),occupancyCertification:false};return{root,seats,poles,loops};
}
export function addSlidingSideDoors(T,M,{near,far,chassis}){
 const leaves=[],portals=[];
 for(const side of[-1,1])for(const x of DOOR_CENTRES){const parent=side===1?near:far,K=kit(T,M,parent),portal=new T.Group();portal.name='Real side boarding portal '+x+'/'+side;parent.add(portal);portals.push(portal);
  for(const dx of[-.66,.66])K.box([x+dx,side*1.405,2.17],[.04,.09,1.86],'steel','Side portal structural jamb');K.box([x,side*1.405,3.12],[1.36,.09,.045],'steel','Door portal top lintel');K.box([x,side*1.405,1.245],[1.36,.13,.035],'steel','Door sill and drainage channel');
  K.box([x,side*1.37,3.17],[2.65,.11,.08],'iron','Sliding door overhead carriage track');
  for(const sign of[-1,1]){const leaf=new T.Group();leaf.position.set(x+sign*.325,side*1.46,2.17);leaf.name='Finite sliding boarding door leaf';portal.add(leaf);const shape=roundedShape(T,.64,1.81,.045),hole=roundedShape(T,.42,.72,.055);shape.holes.push(new T.Path(hole.getPoints(16).map(p=>new T.Vector2(p.x,p.y+.34))));const g=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false,curveSegments:16});g.rotateX(Math.PI/2);const mesh=new T.Mesh(g,M.paint);mesh.name='Sliding leaf solid panel with true glazed aperture';leaf.add(mesh);const L=kit(T,M,leaf);L.box([0,-.025,.34],[.42,.014,.72],'glass','Finite sliding-door window');for(const dx of[-.224,.224])L.box([dx,-side*.030,.34],[.018,.025,.77],'brass','Door glazed aperture vertical trim');for(const z of[-.032,.712])L.box([0,-side*.030,z],[.46,.025,.018],'brass','Door glazed aperture horizontal trim');L.rod([-sign*.24,-side*.045,-.35],[-sign*.24,-side*.045,-.09],.014,'steel','Door recessed handgrip');L.box([-sign*.316,0,0],[.015,.057,1.74],'black','Door meeting-edge compression seal');for(const dx of[-.20,.20])L.rod([dx,-.025,.91],[dx,.025,.91],.035,'steel','Sliding leaf overhead trolley roller',20);leaves.push({leaf,x:x+sign*.325,side,sign});}
  // Platform boarding tread at floor level: no stairs through an uncut side wall.
  const C=kit(T,M,chassis);C.box([x,side*1.48,1.185],[1.25,.27,.055],'iron','Side boarding threshold tread');for(let dx=-.55;dx<=.56;dx+=.11)C.box([x+dx,side*1.48,1.217],[.018,.24,.008],'steel','Threshold anti-slip rib');
 }
 function setOpen(v){for(const {leaf,x,side,sign}of leaves){leaf.position.x=x+sign*.70*v;leaf.position.y=side*(1.46+.065*Math.min(1,v*8));}}
 return{leaves,portals,setOpen,sourcePrinciple:'original coach-model sideIntervals and true boarding opening; rebuilt at detailed R03 scale',clearOpeningWidthM:1.32,openingHeightM:1.88};
}
