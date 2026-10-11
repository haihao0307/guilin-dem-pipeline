import * as T from '../../../vendor/three.module.js';
import {stationSurfaceCatalog} from '../kowloon-station-r02/surface-bindings.mjs';
import {geometryForPart} from '../kowloon-station-r02/station-geometry.mjs';
import {createTimberMember} from '../kowloon-station-r02/timber/three-adapter.mjs';
import {createRailGeometry,wheelRailDatums} from '../wheel-rail-profile.mjs';
import {batchStaticDisplay} from '../native-a4/display-batching.mjs';
import {createWordFactory} from './labels.mjs';
import {CYCLE,sampleRoute} from './simulation.mjs';
// Local street/track interfaces, not geographic north or a surveyed urban plan.
export const SITE={units:'metre',railX:34.75,platforms:[{x:28.5,z:-4,width:5,length:46},{x:41,z:-4,width:5,length:46}],streetZ:29.5,boilerBounds:{min:[-38,0,-37],max:[-24,10,-22]},buildingBounds:{min:[-22,0,-19],max:[22,21,19]},publicPaths:[[[28,1,14],[28,1,18],[28,.12,24],[28,.12,25.2],[5,.12,25.2],[0,.12,21],[0,.15,18.5]]],servicePaths:{firemen:[[-43,.12,-16.5],[-43,.12,-19],[-39,.12,-19],[-36,.12,-20],[-31,.12,-19.2],[-26,.12,-21],[-26,.12,-24],[-28.5,.12,-24]],maintenance:[[-23,.12,-21.5],[-18.9,.12,-21.5],[-18.9,.12,-15],[-19.4,.12,-2]],coal:[[-47,.12,-31.5],[-42,.12,-31.5],[-40.5,.12,-31.5],[-40.5,.12,-28],[-36.9,.12,-28],[-36.9,.12,-24.5],[-34.5,.12,-24.5]],ash:[[-35,.12,-23],[-38.5,.12,-23],[-40,.12,-21.5],[-42,.12,-21.5],[-47,.12,-21.5]]},limits:'Fictional authoring dimensions. No urban-plan, fire-code or boiler-engineering certification.'};
export function buildSite(){
const root=new T.Group(),fixed=new T.Group(),enclosure=new T.Group(),moving=new T.Group(),wood=new T.Group();root.add(fixed,enclosure,moving,wood);
const surf=stationSurfaceCatalog(),c=surf.get,words=createWordFactory(T),m={stone:c('platform-stone'),brick:c('hall-brick'),trim:c('masonry-trim'),iron:c('cast-iron'),steel:c('structural-iron'),copper:c('roof-copper'),brass:c('brass'),glass:c('window-glass'),dark:c('boat-black'),cream:c('paint-cream'),enamel:c('sign-enamel'),floor:c('quay-stone')};
const proof={units:'metre',originalRailCalls:0,originalTimberCalls:0,boilersOutsideBuilding:true,publicRailCrossings:0,coalAshSeparate:true,source:'existing wheel-rail-profile.mjs / wood-v3 / A4 metal / KST1',powerModel:'shared phase ratios, abstract steam loop; no pressure or thermal engineering'};
const mesh=(g,mat,p,parent=fixed)=>{const o=new T.Mesh(g,mat);o.position.fromArray(p);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
const box=(p,s,mat=m.iron,parent=fixed)=>mesh(new T.BoxGeometry(...s),mat,p,parent);
const cyl=(p,r,h,mat=m.iron,parent=fixed,axis='y')=>{const o=mesh(new T.CylinderGeometry(r,r,h,20),mat,p,parent);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;};
const ball=(p,r,mat=m.brass,parent=fixed)=>mesh(new T.SphereGeometry(r,16,10),mat,p,parent);
const beam=(a,b,w,d,mat=m.iron,parent=fixed)=>mesh(geometryForPart(T,{id:'site-member',shape:{type:'beam',a,b,width:w,depth:d},surface:{role:'structure'}}),mat,[0,0,0],parent);
function pipe(points,r,mat){for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),o=cyl(a.clone().add(b).multiplyScalar(.5).toArray(),r,a.distanceTo(b),mat);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());}for(const p of points)ball(p,r*1.1,mat);}
function text(s,p,h=.32,parent=fixed){const g=words.makeWord(s,{style:'serif',height:h,depth:.012,material:m.cream});g.position.fromArray(p);parent.add(g);return g;}
function timber(id,p,s){const h=createTimberMember(T,{id,sourceId:'bureau-site-oak',seed:1911,length:s[0],height:s[1],depth:s[2],position:p,presetId:'yunnan_dark_aged_v2',tessellation:{lengthSegments:8,crossSegments:2,endSegments:2}});wood.add(h.mesh);h.mesh.castShadow=false;proof.originalTimberCalls++;}
function fence(a,b,{y=0,h=1.4,mat=m.iron}={}){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/1.7);for(let i=0;i<=n;i++){const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;box([x,y+h/2,z],[.09,h,.09],mat);}for(const dy of[.45,h])beam([a[0],y+dy,a[1]],[b[0],y+dy,b[1]],.07,.07,mat);}
function path(points,width,mat=m.trim,y=.1){for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),d=b.clone().sub(a);const o=box(a.clone().add(b).multiplyScalar(.5).toArray(),[width,.08,d.length()],mat);o.position.y=y;o.rotation.y=Math.atan2(d.x,d.z);}}
function arrow(p,angle,mat=m.brass){const g=new T.Group();g.position.fromArray(p);g.rotation.y=angle;fixed.add(g);box([0,0,0],[.13,.002,.8],mat,g);for(const s of[-1,1]){const q=box([s*.12,0,-.29],[.055,.002,.40],mat,g);q.rotation.y=s*.65;}}
function gateSign(label,x,z,width=5){for(const dx of[-width/2,width/2])box([x+dx,1.8,z],[.16,3.6,.16]);box([x,3.2,z],[width,.7,.15],m.enamel);text(label,[x,3.08,z+.09],.22);}
// A compact site slab. Streets stop before rail land; no implicit rail crossing.
box([-1,-.53,-5],[99,.6,80],m.floor);
box([-7,.01,29.5],[73,.12,5],m.dark);box([-7,.12,24.5],[73,.16,3],m.trim);
for(let x=-41;x<28;x+=4)box([x,.08,29.5],[1.7,.018,.10],m.cream);
for(const x of[-22,-12,12,23]){cyl([x,2.5,23],.07,5,m.iron);box([x,4.95,23],[.60,.13,.6],m.enamel);ball([x,4.72,23],.20,m.cream);}
// Paving creates an unmistakable street-side public entrance route.
path([[0,0,19],[0,0,25.2],[28,0,25.2],[28,0,24]],2.0,m.trim,.19);for(const x of[6,13,20,27])arrow([x,.25,25.2],-Math.PI/2);
for(const x of[-5,5])cyl([x,.65,20.8],.13,1.3,m.iron);
// Original exact rail section, rotated as geometry only. Original gauge reference retained.
const datum=wheelRailDatums();for(const s of[-1,1]){const geo=createRailGeometry(T,{lengthM:74,centerXM:0,centerZM:s*datum.railCentreAbsM,railTopM:datum.railTopM});geo.rotateY(-Math.PI/2);mesh(geo,m.steel,[SITE.railX,0,-6]);proof.originalRailCalls++;}
box([SITE.railX,-.12,-6],[4,.28,74],m.floor);for(let z=-42;z<31;z+=.64)box([SITE.railX,.075,z],[2.33,.14,.23],m.stone);
// Two side platforms, iron canopies and retained oak benches. Not a complete station reconstruction.
for(const [idx,p]of SITE.platforms.entries()){
box([p.x,.42,p.z],[p.width,.9,p.length],m.stone);for(const x of[p.x-p.width/2,p.x+p.width/2]){const opened=idx===0&&x<p.x;box([x,.9,opened?-2.5:p.z],[.3,.12,opened?43:p.length],m.trim);}
const edge=idx===0?p.x+1.7:p.x-1.7;box([edge,.975,p.z],[.15,.018,p.length-.6],m.brass);
for(const z of[-19,-9,1,11]){cyl([p.x,2.6,z],.10,3.3,m.iron);for(const d of[-1,1])beam([p.x,3.1,z],[p.x+d*2.1,4.1,z],.08,.09,m.iron);beam([p.x,4.1,z-5],[p.x,4.1,z+5],.11,.15,m.iron);
for(const side of[-1,1]){const corners=[[p.x,4.4,z-5],[p.x+side*2.55,4.05,z-5],[p.x+side*2.55,4.05,z+5],[p.x,4.4,z+5]];if(side<0)corners.reverse();mesh(geometryForPart(T,{id:'platform-roof',shape:{type:'roof-panel',corners,thickness:.08},surface:{role:'roof-copper'}}),m.copper,[0,0,0],enclosure);}
if(z!==11){timber('platform-bench-'+idx+z,[p.x,1.55,z],[2.1,.13,.52]);timber('platform-back-'+idx+z,[p.x,1.87,z-.3],[2.1,.55,.10]);for(const dx of[-.8,.8])box([p.x+dx,1.2,z],[.1,.65,.48]);}}
for(const z of[-13,7]){box([p.x,3.4,z],[3.8,.55,.12],m.enamel);text(idx===0?'BUREAU SIDE':'YAU MA TI',[p.x,3.32,z+.08],.20);}
}
// Street exit ramp on the bureau side, no track crossing. Porters use the OTHER platform end.
const ramp=box([28,.50,21],[2.3,.16,6.2],m.stone);ramp.rotation.x=Math.atan2(.88,6);for(const x of[26.8,29.2]){beam([x,2,18],[x,1.15,24],.06,.06,m.iron);for(const z of[18,20,22,24])box([x,1.2-(z-18)*.07,z],[.055,1.2,.055]);}
fence([24.5,-23],[24.5,17]);fence([31,-26],[31,18],{y:1,h:.8});
// Cargo docks: platform-end route turns clear of the running line and enters rear door.
path([[28,0,-22],[28,0,-26],[-12,0,-26],[-12,0,-22]],2.7,m.stone,.89);
for(const x of[-5,2])path([[x,0,-32],[x,0,-22]],2.4,m.stone,.89);
for(const x of[-12,-5,2])box([x,.42,-22],[2.7,.84,3.3],m.stone);
for(const x of[-12,0,12,25])arrow([x,.933,-26],Math.PI/2);gateSign('RAIL TRANSFER',25,-27.8,6);
box([3,.04,-35],[32,.15,5.3],m.dark);for(const x of[-5,2]){box([x,.13,-33.0],[2.5,.16,.6],m.trim);gateSign(x===-5?'AIR TRANSFER':'SEA TRANSFER',x,-32,5.2);}
// The rear service court is physically detached from the bureau and freight dock.
box([-31,.02,-29.5],[17,.14,20],m.stone);box([-43,.02,-29],[8,.13,24],m.dark);
// Boiler-house masonry walls with an open fireman's front, and removable roof for inspection.
box([-38,3.1,-33.75],[.6,6.2,6.5],m.brick);box([-38,3.1,-24.25],[.6,6.2,2.5],m.brick);box([-38,4.8,-28],[.6,2.8,5],m.brick);box([-24,3.1,-30],[.6,6.2,14],m.brick);box([-31,3.1,-37],[14,6.2,.6],m.brick);
for(const x of[-37.6,-24.4])box([x,3.4,-23],[.5,6.8,.5],m.iron);beam([-38,6.6,-23],[-24,6.6,-23],.23,.23,m.iron);
for(const side of[-1,1]){const corners=[[-31,8.2,-37.5],[-31+side*7.6,6.8,-37.5],[-31+side*7.6,6.8,-22],[-31,8.2,-22]];if(side<0)corners.reverse();mesh(geometryForPart(T,{id:'boiler-house-roof',shape:{type:'roof-panel',corners,thickness:.12},surface:{role:'roof-copper'}}),m.copper,[0,0,0],enclosure);}
const boilerOut=[];for(const x of[-34.5,-28.5]){cyl([x,2.4,-30],1.45,8,m.iron,fixed,'z');for(const z of[-34,-32,-28,-26]){const ring=mesh(new T.TorusGeometry(1.48,.065,8,36),m.brass,[x,2.4,z]);}for(const z of[-32.7,-27.3])box([x,.6,z],[2.2,1.2,.85],m.stone);cyl([x,2.4,-25.94],1.28,.13,m.dark,fixed,'z');box([x,1.6,-25.82],[1.2,.9,.14],m.brass);box([x,1.6,-25.72],[.82,.56,.08],m.dark);cyl([x,4.7,-31],.4,2,m.copper);boilerOut.push([x,5.8,-31]);pipe([[x,5.6,-31],[x,5.8,-31],[-25.5,5.8,-31]],.18,m.copper);}
// Chimney and flues remain out of occupied main-building floors.
box([-26,5.9,-35],[1.85,11.8,1.85],m.brick);for(const y of[1,5,9,11.8])box([-26,y,-35],[2.1,.22,2.1],m.trim);pipe([[-34.5,3.8,-34],[-34.5,4.6,-35],[-26,4.6,-35]],.38,m.dark);pipe([[-28.5,3.8,-34],[-28.5,4.6,-35],[-26,4.6,-35]],.38,m.dark);
// Coal bay, ash bay and personnel entrance are distinct physical destinations.
for(const [name,x,z]of[['COAL',-42,-35],['ASH',-42,-24]]){box([x,.2,z],[5,.4,4],m.stone);for(const dx of[-2.5,2.5])box([x+dx,1.3,z],[.25,2.6,4.2],m.brick);box([x,1.3,z-2],[5.2,2.6,.25],m.brick);for(let i=0;i<18;i++){const xx=x-1.9+(i%6)*.72,zz=z-1.3+Math.floor(i/6)*.8;const o=mesh(new T.IcosahedronGeometry(name==='COAL'?.53:.36,0),name==='COAL'?m.dark:m.stone,[xx,.7+Math.sin(i*2.3)*.2,zz]);o.rotation.y=i*.7;}gateSign(name,x,z+2.1,5);}
path(SITE.servicePaths.firemen,1.4,m.trim,.12);path(SITE.servicePaths.maintenance,1.4,m.trim,.12);path(SITE.servicePaths.coal,1.5,m.dark,.10);path(SITE.servicePaths.ash,1.5,m.floor,.12);
fence([-23,-37],[-23,-24]);gateSign('STAFF',-43,-18,4);gateSign('MAINTENANCE',-19,-20,4);
// Coal and ash handling carts are parked, not misleading moving NPCs.
for(const [x,z]of[[-45.5,-34],[-45.5,-24]]){box([x,.75,z],[1.35,.8,1.6],m.enamel);for(const dx of[-.7,.7])for(const dz of[-.5,.5])cyl([x+dx,.3,z+dz],.24,.14,m.iron,fixed,'x');}
// Traceable three-part power loop. Colored moving markers share the one simulation time.
const circuits=[{id:'steam',label:'STEAM',color:m.copper,points:[[-25.5,5.8,-31],[-25.5,5.8,-20.3],[-18,5.8,-20.3],[-18,5,-18],[-16.9,5,-17.3],[-16.9,5,-.5],[-17,3,-.5]]},
{id:'return',label:'CONDENSATE',color:m.iron,points:[[-18,.45,-18],[-18,.45,-19.2],[-18,3.9,-19.2],[-30,3.9,-19.2],[-30,2,-21.4]]},
{id:'feed',label:'FEED WATER',color:m.brass,points:[[-30,1.3,-22],[-34,1.3,-22],[-34,3.8,-22],[-34.5,3.8,-22],[-34.5,3.8,-26]]}];
circuits.push({id:'feed-02',label:'FEED WATER 02',color:m.brass,points:[[-34,3.8,-22],[-28.5,3.8,-22],[-28.5,3.8,-26]]});for(const q of circuits)pipe(q.points,.13,q.color);
for(const x of[-25.5,-21.5]){beam([x,.1,-20.3],[x,6.0,-20.3],.14,.14,m.iron);beam([x-.6,5.55,-20.3],[x+.6,5.55,-20.3],.12,.13,m.iron);}
// Return receiver, pump and accessible isolation valves; no numerical pressure claims.
cyl([-30,1.65,-21.4],.70,2.3,m.copper,fixed,'x');box([-33.2,.6,-22],[2.2,.9,1.1],m.iron);cyl([-34,1.3,-22],.4,1.1,m.brass,fixed,'x');
for(const p of[[-25.5,5.8,-23],[-30,3.9,-19.2],[-34.5,3.8,-24]]){cyl([p[0],p[1]+.35,p[2]],.045,.7,m.brass);const v=mesh(new T.TorusGeometry(.24,.035,6,20),m.enamel,[p[0],p[1]+.70,p[2]]);v.rotation.x=Math.PI/2;}
for(const q of circuits){q.curve=new T.CurvePath();for(let i=1;i<q.points.length;i++)q.curve.add(new T.LineCurve3(new T.Vector3(...q.points[i-1]),new T.Vector3(...q.points[i])));q.dots=[];for(let i=0;i<4;i++)q.dots.push(ball(q.points[0],.18,m.cream,moving));}
// Pump drive is explicitly linked to the main engine via the return-service gallery.
pipe([[-18,3,-.7],[-18.9,3,-.7],[-18.9,3,-20],[-33.2,3,-20],[-33.2,1.3,-22]],.08,m.steel);
const pumpRotor=new T.Group();pumpRotor.position.set(-33.2,1.3,-22);moving.add(pumpRotor);const pr=mesh(new T.TorusGeometry(.56,.06,8,28),m.brass,[0,0,0],pumpRotor);for(let i=0;i<8;i++){const a=i*Math.PI/4;beam([0,0,0],[Math.sin(a)*.55,Math.cos(a)*.55,0],.045,.055,m.iron,pumpRotor);}
text('BOILER & POWER COURT',[-31,6.1,-22.6],.30);text('RETURN / FEED',[-30,2.8,-20.8],.22);
const labels=[{text:'07 街側正門',detail:'出站沿街入局 · 不穿軌',p:[0,1,24]},{text:'08 對面站台',detail:'另一端轉入受控貨運通道',p:[28,3,-3]},{text:'09 後院收貨',detail:'鐵路 / 航空 / 船運交接',p:[7,3,-27]},{text:'10 獨立鍋爐院',detail:'煤 / 灰 / 炉工入口分開',p:[-31,8,-30]},{text:'11 供汽',detail:'鍋爐總管 → 主機',p:[-21,5.8,-20.3]},{text:'12 凝結水回收',detail:'主機 → 回水罐',p:[-25,3.9,-19.2]},{text:'13 給水 / 傳動',detail:'泵 → 兩台鍋爐 · 主機同相齒比',p:[-33,3.8,-22]}];
for(const g of[fixed,enclosure])batchStaticDisplay(g,{domain:true});
return{root,fixed,wood,enclosure,labels,proof,circuits,setCutaway(v){enclosure.visible=!v;},update(state){surf.update({elapsed:state.time,distance:0});for(const q of circuits)for(let i=0;i<q.dots.length;i++)q.dots[i].position.copy(q.curve.getPoint((state.time*.07+i/4)%1));pumpRotor.rotation.z=state.drives.feedPump.phase;},state(){return{...proof,circuitPaths:circuits.map(q=>({id:q.id,points:q.points})),site:SITE};},auditCargo(){root.updateMatrixWorld(true);const solids=[];fixed.traverse(o=>{if(o.isMesh&&!o.userData.nativeDisplayBatch&&o.geometry?.attributes.position){o.geometry.computeBoundingBox();solids.push({o,b:o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)});}});const hits=[],cargo=new T.Box3(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],tri=new T.Triangle();for(let source=0;source<3;source++)for(let age=0;age<CYCLE;age+=.5){const p=sampleRoute(source,age).position;const external=age<54;cargo.min.set(p[0]-(external?.77:.43),p[1]+(external?-.65:.025),p[2]-(external?.85:.28));cargo.max.set(p[0]+(external?.77:.43),p[1]+.8,p[2]+(external?.68:.28));for(const{o,b}of solids){if(!cargo.intersectsBox(b))continue;const g=o.geometry,a=g.attributes.position,n=g.index?.count??a.count;let hit=false;for(let i=0;i<n;i+=3){for(let j=0;j<3;j++)v[j].fromBufferAttribute(a,g.index?g.index.getX(i+j):i+j).applyMatrix4(o.matrixWorld);tri.set(...v);if(cargo.intersectsTriangle(tri)){hit=true;break;}}if(hit){hits.push({source,age,p,bounds:[b.min.toArray(),b.max.toArray()]});if(hits.length>=20)return{hits,complete:false};}}}return{samples:CYCLE*6,solids:solids.length,hits,complete:true};}};
}
