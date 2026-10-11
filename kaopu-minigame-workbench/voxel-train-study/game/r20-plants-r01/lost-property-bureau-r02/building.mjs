import * as T from '../../../vendor/three.module.js';
import {stationSurfaceCatalog} from '../kowloon-station-r02/surface-bindings.mjs';
import {geometryForPart} from '../kowloon-station-r02/station-geometry.mjs';
import {createTimberMember} from '../kowloon-station-r02/timber/three-adapter.mjs';
import {createForgedRod,placeForgedRod,createCrosshead} from '../native-a4/running-gear/forged-rods.mjs';
import {batchStaticDisplay} from '../native-a4/display-batching.mjs';
import {createWordFactory} from './labels.mjs';
import {SOURCE_X,SOURCE_Z,LEVELS,routeFor,sampleRoute,CYCLE,APPROACH} from './simulation.mjs';
export function buildBureau(){
const root=new T.Group(),fixed=new T.Group(),facade=new T.Group(),roof=new T.Group(),wood=new T.Group(),moving=new T.Group(),clockMoving=new T.Group();root.add(fixed,facade,roof,wood,moving,clockMoving);
const surface=stationSurfaceCatalog(),words=createWordFactory(T),timbers=[],rotors=[],labels=[],carriers=[],pickers=[],branchRotors=[],catalog=surface.get;
const proof={units:'metre',wholeBuilding:true,buildingMetres:[44,38,21],sourceRevision:'f31df978916876205355664593b0299f027188ad',originalMaterials:surface.proof,timberCalls:0,originalForgedRods:0,geometryCompilerCalls:0,importedMeshCount:0,imageTextures:0,steamModel:'abstract shaft power / no pressure-vessel engineering',referenceStatus:'original composition from user spatial brief; seoul_station284 identity located; structural source not recovered or incorporated'};
const mats={stone:catalog('platform-stone'),brick:catalog('hall-brick'),trim:catalog('masonry-trim'),iron:catalog('cast-iron'),steel:catalog('structural-iron'),copper:catalog('roof-copper'),brass:catalog('brass'),glass:catalog('window-glass'),dark:catalog('boat-black'),cream:catalog('paint-cream'),light:catalog('lamp-glass'),floor:catalog('quay-stone'),enamel:catalog('sign-enamel')};
const mesh=(g,m,p,parent=fixed)=>{const o=new T.Mesh(g,m);o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
const box=(p,s,m=mats.iron,parent=fixed)=>mesh(new T.BoxGeometry(...s),m,p,parent);
const cyl=(p,r,h,m=mats.iron,parent=fixed,axis='y',r2=r)=>{const o=mesh(new T.CylinderGeometry(r2,r,h,24),m,p,parent);if(axis==='x')o.rotation.z=Math.PI/2;if(axis==='z')o.rotation.x=Math.PI/2;return o;};
const ball=(p,r,m=mats.brass,parent=fixed,scale=[1,1,1])=>{const o=mesh(new T.SphereGeometry(r,24,12),m,p,parent);o.scale.set(...scale);return o;};
const beam=(a,b,w,d,m=mats.iron,parent=fixed)=>{const g=geometryForPart(T,{id:'bureau-member',shape:{type:'beam',a,b,width:w,depth:d},surface:{role:'structure',feature:'load-bearing'}});proof.geometryCompilerCalls++;const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
const pipe=(points,r=.12,m=mats.copper,parent=fixed)=>{for(let i=1;i<points.length;i++){const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),o=cyl(a.clone().add(b).multiplyScalar(.5).toArray(),r,a.distanceTo(b),m,parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());}for(const p of points)ball(p,r*1.05,m,parent);};
function arc(p,r,width,depth,m,parent=fixed){const s=new T.Shape();s.absarc(0,0,r+width/2,0,Math.PI,false);s.lineTo(-r+width/2,0);s.absarc(0,0,r-width/2,Math.PI,0,true);s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:28});g.translate(0,0,-depth/2);return mesh(g,m,p,parent);}
function text(label,p,height=.35,parent=fixed,m=mats.cream){const g=words.makeWord(label,{style:'serif',height,depth:.02,material:m});g.position.set(...p);parent.add(g);return g;}
function timber(id,p,s,parent=wood){const h=createTimberMember(T,{id,sourceId:'bureau-oak-stock',seed:1978,length:s[0],height:s[1],depth:s[2],position:p,presetId:'yunnan_dark_aged_v2',tessellation:{lengthSegments:12,crossSegments:2,endSegments:2}});h.mesh.castShadow=false;h.mesh.receiveShadow=false;parent.add(h.mesh);timbers.push(h);proof.timberCalls++;return h.mesh;}
function column(x,z,h=12,bottom=0,parent=fixed){box([x,bottom+.18,z],[.9,.36,.9],mats.trim,parent);cyl([x,bottom+.53,z],.35,.36,mats.iron,parent);const part={id:'cast-column',shape:{type:'fluted-column',center:[x,bottom+h/2,z],radius:.22,height:h-1,flutes:12,depth:.018,segments:48},surface:{role:'cast-iron'}};mesh(geometryForPart(T,part),mats.iron,[0,0,0],parent);proof.geometryCompilerCalls++;for(const y of [bottom+1,bottom+h-.6])cyl([x,y,z],.3,.2,mats.brass,parent);box([x,bottom+h-.2,z],[.72,.22,.72],mats.iron,parent);}
function guard(a,b,y,parent=fixed){beam([a[0],y+1.1,a[1]],[b[0],y+1.1,b[1]],.065,.065,mats.iron,parent);beam([a[0],y+.45,a[1]],[b[0],y+.45,b[1]],.035,.035,mats.iron,parent);const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/1.4);for(let i=0;i<=n;i++){const u=i/n;beam([a[0]+(b[0]-a[0])*u,y,a[1]+(b[1]-a[1])*u],[a[0]+(b[0]-a[0])*u,y+1.12,a[1]+(b[1]-a[1])*u],.045,.045,mats.iron,parent);}}
function belt(a,b,{width=1.35,parent=fixed,legs=false}={}){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av),L=d.length();if(Math.abs(d.y)>.01)return;const side=new T.Vector3(d.z,0,-d.x).normalize();const deck=box(av.clone().add(bv).multiplyScalar(.5).toArray(),[width,.13,L],mats.dark,parent);deck.rotation.y=Math.atan2(d.x,d.z);for(const sign of [-1,1]){const off=side.clone().multiplyScalar(sign*(width/2+.05));beam(av.clone().add(off).add(new T.Vector3(0,-.18,0)).toArray(),bv.clone().add(off).add(new T.Vector3(0,-.18,0)).toArray(),.16,.055,mats.steel,parent);}const n=Math.ceil(L/.55);for(let i=0;i<=n;i++){const p=av.clone().lerp(bv,i/n);const roller=cyl(p.toArray(),.10,width,mats.steel,parent);roller.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),side);if(legs&&i%5===0)for(const sign of[-1,1]){const q=p.clone().addScaledVector(side,sign*(width/2-.1));beam([q.x,.25,q.z],[q.x,p.y-.2,q.z],.085,.085,mats.iron,parent);}}
}
function windowBay(x,z,y,parent=facade){box([x,y+1.5,z],[2.9,3,.11],mats.glass,parent);for(const dx of[-1.5,0,1.5])box([x+dx,y+1.5,z+.10],[.12,3.3,.17],mats.trim,parent);for(const dy of [0,1.7,3])box([x,y+dy,z+.1],[3.2,.11,.2],mats.trim,parent);arc([x,y+3,z+.05],1.5,.17,.23,mats.trim,parent);for(let q=-2;q<=2;q++){const xx=q*.46,yy=Math.sqrt(1.4**2-xx**2);beam([x,y+3,z+.07],[x+xx,y+3+yy,z+.07],.045,.07,mats.iron,parent);}box([x,y-.15,z],[3.6,.28,.55],mats.trim,parent);}
function lamp(p,parent=fixed){cyl([p[0],p[1]-.2,p[2]],.12,.18,mats.brass,parent);ball(p,.18,mats.light,parent,[1,1.5,1]);}
// Ground and tiled public hall, surrounded by a real structural base.
box([0,-.6,0],[50,.8,47],mats.floor);box([0,-.1,0],[44,.3,38],mats.stone);box([0,.03,12.5],[40,.08,12],mats.trim);
for(let x=-20;x<20;x+=2)for(let z=8;z<18;z+=2)if((x+z)%4===0)box([x+1,.083,z+1],[1.94,.025,1.94],mats.floor);
for(const x of[-21,21]){const group=x<0?fixed:facade;
for(const [za,zb]of[[-18,-14.7],[-11.3,-6.7],[-3.3,1.3],[4.7,9.3],[12.7,18]])box([x,7.3,(za+zb)/2],[1,14.6,zb-za],mats.brick,group);
for(const [ya,yb]of[[0,2],[6.5,8],[12.5,14.6]])for(const z of[-13,-5,3,11])box([x,(ya+yb)/2,z],[1,yb-ya,3.4],mats.brick,group);
for(const y of[1,6.5,12.5,14.6])box([x,y,0],[1.35,.28,37],mats.trim,group);
for(const z of[-13,-5,3,11]){const bay=new T.Group();bay.position.set(x+(x<0?-.56:.56),0,z);bay.rotation.y=x<0?-Math.PI/2:Math.PI/2;group.add(bay);windowBay(0,0,2,bay);windowBay(0,0,8,bay);}}

// Rear elevation has three actual transfer doorways, never a solid wall across cargo.
for(const x of[-20,-16,-8.5,-1.5,6,11,16,21])box([x,5.5,-18],[1,11,1],mats.brick);
box([0,12.5,-18],[44,3.2,1],mats.brick);for(const y of[6,11,14.2])box([0,y,-18],[44,.3,1.25],mats.trim);
for(const x of[-12,-5,2]){arc([x,5,-18],2.2,.35,.7,mats.trim);box([x,6.1,-18.55],[4.8,.65,.2],mats.enamel);}
text('RAIL',[-12,6,-18.68],.4).rotation.y=Math.PI;text('AIR',[-5,6,-18.68],.4).rotation.y=Math.PI;text('SEA',[2,6,-18.68],.4).rotation.y=Math.PI;
// Victorian civic front: true tall entrance, divided masonry bays and an elevated central dome.
for(const x of[-20,-15,-10,10,15,20]){box([x,5.2,18],[1.1,10.4,1.2],mats.brick,facade);for(const y of[1,6.4,10])box([x,y,18],[1.4,.28,1.5],mats.trim,facade);}
for(const x of[-17.5,-12.5,12.5,17.5]){box([x,1.25,18],[4,2.5,1],mats.brick,facade);windowBay(x,18.2,2.5);box([x,9.5,18],[4,1.5,1],mats.brick,facade);}
for(const x of[-7,7])column(x,18,9.2,0,facade);
arc([0,5.5,18],6.2,.70,1,mats.trim,facade);for(const x of[-6.2,6.2])box([x,2.75,18],[.72,5.5,1],mats.trim,facade);
box([0,10.9,18],[15,1.05,1.4],mats.trim,facade);box([0,11,18.78],[12,1.2,.15],mats.enamel,facade);text('HONG KONG GENERAL LOST & FOUND OFFICE A.D. 1911',[0,10.95,18.9],.25,facade);text('失物招領局',[0,10.48,18.9],.38,facade);
for(const y of [10.35,11.8])box([0,y,18],[44,.24,1.6],mats.trim,facade);
for(const x of[-18,18]){box([x,13.25,15.5],[7.6,2.9,6.5],mats.brick,roof);
for(const sign of[-1,1]){const corners=[[x,16,11.5],[x+sign*4.25,14.85,11.5],[x+sign*4.25,14.85,19.5],[x,16,19.5]];if(sign<0)corners.reverse();mesh(geometryForPart(T,{id:'pavilion-roof',shape:{type:'roof-panel',corners,thickness:.14},surface:{role:'roof-copper'}}),mats.copper,[0,0,0],roof);}
for(const z of[11.6,19.35]){const shape=new T.Shape();shape.moveTo(-4,0);shape.lineTo(4,0);shape.lineTo(0,1.08);shape.closePath();mesh(new T.ExtrudeGeometry(shape,{depth:.16,bevelEnabled:false}),mats.brick,[x,14.8,z],roof);}
}
cyl([0,13.4,13.8],5.8,3.3,mats.trim,roof,'y',5.8);for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.sin(a)*5.8,z=13.8+Math.cos(a)*5.8;column(x,z,2.6,12,roof);}ball([0,15,13.8],5.7,mats.copper,roof,[1,.76,1]);cyl([0,19.6,13.8],.65,2.1,mats.copper,roof);ball([0,20.8,13.8],.35,mats.brass,roof);
// Within the monumental arch, a real double entrance and fixed side glazing.
for(const sign of[-1,1]){box([sign*3.85,2.7,18.08],[4.15,5.4,.08],mats.glass,facade);for(const x of[sign*1.75,sign*5.95])box([x,2.7,18.19],[.16,5.4,.18],mats.iron,facade);for(const y of[.14,2.7,5.4])box([sign*3.85,y,18.19],[4.2,.14,.18],mats.iron,facade);
const door=new T.Group();door.position.set(sign*1.7,0,18.12);door.rotation.y=-sign*.20;facade.add(door);const cx=-sign*.83;box([cx,2.15,0],[1.6,4.2,.08],mats.glass,door);for(const xx of[cx-.80,cx+.80])box([xx,2.15,0],[.12,4.3,.18],mats.enamel,door);for(const yy of[.12,1.0,4.23])box([cx,yy,0],[1.72,.12,.18],mats.enamel,door);cyl([cx-sign*.52,1.7,.15],.035,.7,mats.brass,door);}
box([0,4.82,18.12],[3.4,1.1,.08],mats.glass,facade);box([0,4.3,18.2],[3.5,.16,.18],mats.iron,facade);box([0,5.45,18.2],[12,.18,.20],mats.iron,facade);
const fan=new T.Shape();fan.moveTo(-5.95,0);fan.absarc(0,0,5.95,Math.PI,0,true);fan.lineTo(-5.95,0);fan.closePath();mesh(new T.ShapeGeometry(fan,48),mats.glass,[0,5.5,18.07],facade);
for(let i=0;i<=12;i++){const a=i*Math.PI/12;beam([0,5.5,18.18],[5.95*Math.cos(a),5.5+5.95*Math.sin(a),18.18],.045,.065,mats.iron,facade);}
arc([0,5.5,18.2],3.1,.07,.09,mats.iron,facade);
// Shared-time civic clock mounted on the entrance drum.
const clockFace=cyl([0,13.5,19.73],1.15,.10,mats.cream,roof,'z');
const clockRim=mesh(new T.TorusGeometry(1.18,.06,8,56),mats.brass,[0,13.5,19.81],roof);
for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=box([Math.sin(a)*.96,13.5+Math.cos(a)*.96,19.84],[.04,.15,.025],mats.dark,roof);tick.rotation.z=-a;}
const clockHands=[];for(const [length,width]of [[.65,.07],[.92,.045]]){const hand=new T.Group();hand.position.set(0,13.5,19.89);box([0,length*.38,0],[width,length,.025],mats.dark,hand);clockMoving.add(hand);clockHands.push(hand);}ball([0,13.5,19.92],.08,mats.brass,roof);
// Great hall contains people-space only. The machine service hatch terminates behind it.
for(const x of[-14,-7,0,7,14])column(x,7,11.4);
for(const z of[-14,-7,0,7]){for(const x of[-18,18])column(x,z,14.5);for(let i=0;i<20;i++){const x=-18+i*1.8,y=14.3+4.1*Math.sin((x+18)/36*Math.PI),x2=x+1.8,y2=14.3+4.1*Math.sin((x2+18)/36*Math.PI);beam([x,y,z],[x2,y2,z],.15,.2,mats.iron);beam([x,y-.75,z],[x2,y2-.75,z],.12,.16,mats.iron);beam([x,y,z],[x2,y2-.75,z],.065,.065,mats.brass);}
for(const x of [-12,-6,0,6,12]){const y=14.3+4.1*Math.sin((x+18)/36*Math.PI);beam([x,y,z-3.5],[x,y,z+3.5],.11,.14,mats.iron,roof);}}
// Closed barrel envelope. Continuous metric panel corners eliminate floating strips.
const roofY=x=>14.6+3.9*Math.sin((x+22)/44*Math.PI);
for(let i=0;i<28;i++){const x0=-22+i*44/28,x1=-22+(i+1)*44/28;
const corners=[[x0,roofY(x0),-19],[x1,roofY(x1),-19],[x1,roofY(x1),8],[x0,roofY(x0),8]];
const g=geometryForPart(T,{id:'continuous-roof-'+i,shape:{type:'roof-panel',corners,thickness:.13},surface:{role:'roof-copper'}});mesh(g,(i===9||i===10||i===17||i===18)?mats.glass:mats.copper,[0,0,0],roof);
beam([x0,roofY(x0)+.05,-19],[x0,roofY(x0)+.05,8],.075,.075,mats.iron,roof);
for(const z of[-19,-14,-7,0,7,8])beam([x0,roofY(x0)-.13,z],[x1,roofY(x1)-.13,z],.13,.13,mats.iron,roof);
// The step down to the public hall is an actual glazed clerestory enclosure.
box([(x0+x1)/2,(12.3+roofY((x0+x1)/2))/2,8],[(x1-x0)+.015,roofY((x0+x1)/2)-12.3,.10],mats.glass,roof);
beam([x0,12.3,8],[x0,roofY(x0),8],.11,.11,mats.iron,roof);
const rh=roofY((x0+x1)/2)-14.2;box([(x0+x1)/2,14.2+rh/2,-18.65],[x1-x0+.01,rh,.10],mats.glass,roof);beam([x0,14.2,-18.65],[x0,roofY(x0),-18.65],.09,.09,mats.iron,roof);
}
for(const x of[-22,22]){box([x,14.5,-5.5],[.30,.35,27.5],mats.trim,roof);pipe([[x,14.75,-19],[x,14.75,8],[x,12.5,8],[x,12.5,19]],.10,mats.copper,roof);}
// Continuous lower hall roof beneath the civic dome and corner pavilions.
box([0,12.18,13.5],[44.5,.24,11.4],mats.copper,roof);for(const x of[-22,22])box([x,12,13.5],[.42,.35,11.6],mats.trim,roof);
for(let x=-21;x<=21;x+=1.5)beam([x,12.35,8],[x,12.35,19.2],.06,.06,mats.iron,roof);
box([0,12.08,19],[44.5,.45,.6],mats.trim,roof);
// Administrative wings and unobstructed service galleries.
for(const x of[-18,18])for(const y of[6,12]){if(x<0){for(const xx of[-19.7,-16.3])box([xx,y,-3],[2.2,.23,27],mats.stone);box([x,y,-9],[1.2,.23,15],mats.stone);box([x,y,5.3],[1.2,.23,10.4],mats.stone);}else{box([x,y,-8.25],[5.6,.23,16.5],mats.stone);box([x,y,7.5],[5.6,.23,6],mats.stone);}guard([x-2.8,-16],[x-2.8,10],y);guard([x+2.8,-16],[x+2.8,10],y);for(const z of[-12,-6,0,6]){timber('desk-'+x+y+z,[x,y+.85,z],[2.8,.14,1.05]);box([x,y+.4,z],[.12,.8,.7]);box([x+1.1,y+.4,z],[.12,.8,.7]);box([x,y+1.1,z],[.65,.32,.4],mats.cream);lamp([x+1,y+1.35,z]);}}
for(const x of[-18,18])for(let i=0;i<24;i++){const z=7+i*.3;box([x,.125+i*.25,z],[2,.25,.34],mats.stone);}
// Tall public clerks' counter, grille booths and original v3 oak benches.
for(const x of[-13,-7,-1,5,11]){timber('counter-'+x,[x,1.05,8.9],[4.5,.18,1.3]);box([x,.5,8.9],[4.3,1,.95],mats.enamel);for(let j=-4;j<=4;j++)cyl([x+j*.43,2.1,8.58],.018,1.7,mats.brass);box([x,3,8.58],[4.4,.13,.13],mats.brass);text('0'+Math.round((x+19)/6),[x,2.9,8.7],.34);}
for(const x of [-14,-7,7,14])for(const z of[12,15]){timber('bench-'+x+z,[x,.70,z],[3.5,.16,.56]);timber('bench-back-'+x+z,[x,1.14,z-.36],[3.5,.65,.12]);for(const dx of[-1.3,1.3]){box([x+dx,.34,z],[.10,.68,.54]);}}
for(const x of[-11,-5,1,7,13])for(const z of[10.8,12.1]){cyl([x,.55,z],.035,1.1,mats.brass);ball([x,1.14,z],.08);if(z===10.8)beam([x,1,z],[x,1,12.1],.035,.035,mats.dark);}
// Function-built clerks stand on their side of the counter. They do not enter cargo corridors.
for(const x of[-13,-7,-1,5,11]){const z=7.65;box([x,1.04,z],[.42,.58,.24],mats.enamel);ball([x,1.52,z],.15,mats.trim);for(const dx of[-.13,.13])box([x+dx,.48,z],[.13,.65,.17],mats.dark);for(const side of[-1,1])beam([x+side*.24,1.23,z],[x+side*.42,1.07,z+.5],.11,.12,mats.enamel);}
// Three incoming lines with scan portals and level-specific lift towers.
for(let s=0;s<3;s++){const x=SOURCE_X[s],z=SOURCE_Z[s],y=LEVELS[s];belt([x,1.50,-23],[x,1.50,z-.8]);for(const dx of[-.95,.95])beam([x+dx,0,-10],[x+dx,3.1,-10],.2,.2,mats.iron);box([x,3.1,-10],[2.25,.3,.45],mats.enamel);lamp([x,3.34,-10]);
for(const dx of[-1,1])for(const dz of[-.85,.85])beam([x+dx,0,z+dz],[x+dx,13.6,z+dz],.16,.16,mats.iron);
for(let y0=1;y0<13;y0+=2)for(const dz of[.85]){beam([x-1,y0,z+dz],[x+1,y0+1.7,z+dz],.055,.055,mats.brass);}
for(const dx of[-.72,.72])pipe([[x+dx,0,z+.85],[x+dx,13,z+.85]],.055,mats.dark);
belt([x+.8,y-.1,z],[6,y-.1,z]);belt([6,y-.1,z],[6,y-.1,-7]);belt([6,y-.1,-7],[17.5,y-.1,-7]);belt([6,y-.1,2],[18.2,y-.1,2]);belt([6,y-.1,-7],[6,y-.1,2]);
}
// Portal supports stand outside the swept cargo corridors, with clear transfer junctions.
for(const x of[4.7,7.3])for(const z of[-8.4,3.4])beam([x,0,z],[x,12.2,z],.18,.18,mats.iron);
for(const y of LEVELS)for(const x of[4.7,7.3])beam([x,y-.42,-8.4],[x,y-.42,3.4],.2,.2,mats.iron);
for(let source=0;source<3;source++){const z=SOURCE_Z[source],y=LEVELS[source];for(let x=SOURCE_X[source]+2;x<5;x+=3.5)for(const side of[-1,1]){beam([x,0,z+side*1.1],[x,y-.4,z+side*1.1],.13,.13,mats.iron);beam([x,y-.4,z+side*1.1],[x,y-.4,z],.14,.14,mats.iron);}}
// Four-tier archive cabinet structure, ladder service edges, addresses and stored luggage.
for(const x of[8.5,12,15.5,19])for(const z of[-12,-8.6])beam([x,0,z],[x,15.25,z],.16,.16,mats.iron);
for(const y of[2.5,6.5,10.5,14.0]){box([13.8,y,-9.5],[12,.15,5.2],mats.steel);for(const x of[10.25,13.75,17.25]){box([x,y+(y>13?.45:1.45),-12.05],[3.3,y>13?.9:2.8,.12],mats.enamel);text(String(Math.floor(y/4)+1)+' / '+String(Math.round(x)),[x,y+(y>13?.6:2.3),-8.42],.22);for(let n=0;n<3;n++){const p=[x+(n-1)*.83,y+.43,-10.7];box(p,[.65,.7,.55],n%2?mats.copper:mats.dark);box([p[0],p[1]+.38,p[2]],[.25,.09,.12],mats.brass);}}}
// Three rail-guided archive shuttles. Forks support the actual transfer bag.
for(let source=0;source<3;source++){const picker=new T.Group();moving.add(picker);box([0,-.2,-1.18],[1.15,.38,.50],mats.enamel,picker);box([0,.55,-1.30],[.25,1.5,.18],mats.steel,picker);for(const dx of[-.31,.31])box([dx,-.055,-.12],[.10,.09,1.7],mats.brass,picker);cyl([.58,.12,-1.18],.16,.14,mats.brass,picker,'x');pickers.push({source,g:picker});beam([6,LEVELS[source]-.35,-8.3],[18,LEVELS[source]-.35,-8.3],.15,.15,mats.iron);}
// Continuous return paternoster and screened hatch, terminating before people-space.
for(const dx of[-1,1])for(const dz of[-.85,.85])beam([19+dx,0,2+dz],[19+dx,13.5,2+dz],.16,.16,mats.iron);belt([19,1.5,2.8],[19,1.5,8.5]);box([19,1,9.5],[2.7,2,1],mats.enamel);arc([19,2,8.9],1.1,.16,.16,mats.brass);
// The boilers now live in the separate rear service court (site.mjs).
// A real supply connection reaches the engine through the open rear service bay.
// Supply is authored by site.mjs, offset around the original cast columns.
pipe([[-12,1,-.5],[-12,.45,-.5],[-14,.45,-.5],[-14,.45,-15],[-18,.45,-15],[-18,.45,-18]],.10,mats.iron);
// Protected ground-level maintenance route remains under the office gallery.
for(const z of[-15,-10,-5,0])box([-19.45,.10,z],[1.6,.08,4.7],mats.trim);
const engine=new T.Group();engine.position.set(-18,3,0);engine.rotation.x=Math.PI/2;moving.add(engine);
const wheel=new T.Group();engine.add(wheel);const rim=mesh(new T.TorusGeometry(1.7,.16,10,64),mats.iron,[0,0,0],wheel);rim.rotation.x=Math.PI/2;cyl([0,0,0],.24,.65,mats.brass,wheel);for(let i=0;i<12;i++){const a=i*Math.PI/6;beam([.22*Math.cos(a),0,.22*Math.sin(a)],[1.58*Math.cos(a),0,1.58*Math.sin(a)],.13,.1,mats.iron,wheel);}cyl([.65,-.25,0],.1,.3,mats.brass,wheel);
const rod=createForgedRod(T,{lengthM:3,steel:mats.steel,bush:mats.brass,name:'retained A4 forged rod / bureau prime mover'});engine.add(rod);proof.originalForgedRods++;const crosshead=createCrosshead(T,{steel:mats.steel,bush:mats.brass,axisYM:-.25,slideZM:0,guideCentreXM:3,strokeM:1.3,name:'retained A4 crosshead'});engine.add(crosshead.root);cyl([5,-.25,0],.55,2,mats.iron,engine,'x');
const shaft=cyl([0,14.5,4.7],.13,38,mats.steel,fixed,'x');for(const x of[-18,-12,-5,2,10,18]){const g=new T.Group();g.position.set(x,14.5,4.7);moving.add(g);const rim=mesh(new T.TorusGeometry(.75,.08,8,36),mats.brass,[0,0,0],g);rim.rotation.y=Math.PI/2;for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([0,0,0],[0,.70*Math.sin(a),.70*Math.cos(a)],.07,.07,mats.iron,g);}rotors.push(g);beam([x,13.5,4.7],[x,15.5,4.7],.16,.16,mats.iron);}
// Branch pulley phase is mechanically derived from the same prime mover, with fixed ratios.
for(let k=0;k<3;k++){const g=new T.Group();g.position.set(SOURCE_X[k],13.4,SOURCE_Z[k]);moving.add(g);mesh(new T.TorusGeometry(.42,.055,8,32),mats.brass,[0,0,0],g);for(let j=0;j<6;j++){const a=j*Math.PI/3;beam([0,0,0],[Math.sin(a)*.4,Math.cos(a)*.4,0],.045,.055,mats.iron,g);}branchRotors.push({g,id:['railLift','airLift','seaLift'][k]});}
// Explicit shaft transmission: prime mover -> right-angle boxes -> overhead line shaft -> lift drives.
pipe([[-18,3,-.7],[-18,14.5,-.7],[-18,14.5,4.7]],.13,mats.steel);
for(const p of[[-18,3,-.7],[-18,14.5,-.7],[-18,14.5,4.7]]){box(p,[.65,.65,.65],mats.enamel);for(const dx of[-.22,.22])for(const dy of[-.22,.22])cyl([p[0]+dx,p[1]+dy,p[2]+.34],.035,.04,mats.brass,fixed,'z');}
for(let s=0;s<3;s++){const x=SOURCE_X[s],z=SOURCE_Z[s];pipe([[x,14.5,4.7],[x,14.5,z],[x,13.3,z]],.10,mats.steel);for(const p of[[x,14.5,4.7],[x,14.5,z],[x,13.3,z]])box(p,[.48,.48,.48],mats.enamel);}
pipe([[18,14.5,4.7],[19,14.5,4.7],[19,14.5,2],[19,13.2,2]],.10,mats.steel);
// Building signage remains native geometry, labels outside are UI only.
text('ARCHIVE  /  01—04',[13,15.2,-8.4],.32);text('STEAM & TRANSMISSION',[-17,6,1],.24);text('CLAIMS  /  ENQUIRIES',[0,4.2,8.8],.32);
labels.push({text:'01  公眾大廳',detail:'等候 / 登記 / 文員櫃台',p:[-8,2.5,15]},{text:'02  三源接收',detail:'鐵路 / 航空 / 船運',p:[-5,3,-22]},{text:'03  提升與分揀',detail:'獨立提升通道 → 分層傳輸',p:[-7,12,-2]},{text:'04  立體失物檔案',detail:'可見上架、暫存、提取',p:[13,13,-9]},{text:'05  主機 / 檢修道',detail:'後院供汽 → 主機 → 公共傳動軸',p:[-18,5,-6]},{text:'06  局長 / 業務辦公',detail:'雙翼辦公、獨立檢修通路',p:[-19,13,6]});
// Keep original shader uniforms / no clone-based pseudo-reuse.
for(const group of[fixed,facade,roof]){const b=batchStaticDisplay(group,{domain:true});proof.staticSourceMeshes=(proof.staticSourceMeshes||0)+b.sources.length;proof.staticBatches=(proof.staticBatches||0)+b.displays.length;}
const luggageMaterials=[catalog('brass'),catalog('water'),catalog('hall-brick')];const luggage=new Map();
function makeBag(id,source){const g=new T.Group();g.name=id;box([0,.41,0],[.88,.82,.58],luggageMaterials[source],g);for(const x of[-.29,.29])box([x,.41,0],[.045,.84,.61],mats.dark,g);box([0,.87,0],[.29,.10,.10],mats.brass,g);box([.2,.57,.3],[.15,.21,.018],mats.cream,g);const tray=box([0,-.13,0],[1.35,.18,1.12],mats.steel,g);tray.name='synchronised elevator carrier';g.userData.tray=tray;const cart=new T.Group();g.add(cart);box([0,-.23,0],[1.5,.16,1.3],mats.enamel,cart);for(const dx of[-.60,.60])for(const dz of[-.48,.48])cyl([dx,-.43,dz],.23,.12,mats.iron,cart,'x');beam([-.6,-.15,-.6],[-.6,.8,-.8],.05,.05,mats.iron,cart);beam([.6,-.15,-.6],[.6,.8,-.8],.05,.05,mats.iron,cart);beam([-.6,.8,-.8],[.6,.8,-.8],.05,.05,mats.iron,cart);g.userData.cart=cart;moving.add(g);luggage.set(id,g);return g;}
return {root,proof,labels,materials:surface,groups:{fixed,facade,roof,wood,moving},setCutaway(value){facade.visible=roof.visible=clockMoving.visible=!value;},update(state){surface.update({elapsed:state.time,distance:0});const minutes=380+state.time/60;clockHands[0].rotation.z=-(minutes%720)*Math.PI/360;clockHands[1].rotation.z=-(minutes%60)*Math.PI/30;const a=state.shaftAngle;wheel.rotation.y=a;const A=[.65*Math.cos(a),-.25,-.65*Math.sin(a)],B=[.65*Math.cos(a)+Math.sqrt(9-.65*.65*Math.sin(a)**2),-.25,0];placeForgedRod(T,rod,A,B);crosshead.moving.position.set(...B);for(const r of rotors)r.rotation.x=state.drives.lineShaft.phase;for(const q of branchRotors)q.g.rotation.z=state.drives[q.id].phase;for(const c of carriers){const f=(state.time/32+c.phase)%1;c.g.position.set(c.x+1.6,(1-f)*12.2+.35,c.z);}
for(const q of pickers){const bag=state.packages.find(p=>p.source===q.source&&((p.age>=61+APPROACH&&p.age<70+APPROACH)||(p.age>=86+APPROACH&&p.age<94+APPROACH)));q.g.position.set(bag?bag.position[0]:6,LEVELS[q.source],-7);}const visible=new Set();for(const p of state.packages){const g=luggage.get(p.id)||makeBag(p.id,p.source);g.visible=true;const age=p.age-APPROACH;g.userData.tray.visible=(age>=29&&age<40)||(age>=112&&age<122)||(age>=19&&age<29&&p.position[2]>SOURCE_Z[p.source]-.8)||(age>=40&&age<55&&p.position[0]<SOURCE_X[p.source]+.8)||(age>=102&&age<112&&p.position[0]>18.2)||(age>=122&&p.position[2]<2.8);g.userData.cart.visible=p.age<APPROACH;g.position.fromArray(p.position);visible.add(p.id);}for(const[id,g]of luggage)if(!visible.has(id)){g.removeFromParent();g.traverse(o=>{if(o.geometry)o.geometry.dispose();});luggage.delete(id);}},auditClearance(){root.updateMatrixWorld(true);const solids=[];for(const group of [fixed,wood])group.traverse(o=>{if(o.isMesh&&!o.userData.nativeDisplayBatch&&o.geometry?.attributes.position){o.geometry.computeBoundingBox();solids.push({o,b:o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)});}});const hits=[],cargo=new T.Box3(),tri=new T.Triangle(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];for(let source=0;source<3;source++)for(let age=0;age<CYCLE;age+=.5){const q=sampleRoute(source,age),p=q.position;cargo.min.set(p[0]-.43,p[1]+.025,p[2]-.28);cargo.max.set(p[0]+.43,p[1]+.80,p[2]+.28);for(const {o,b}of solids){if(!cargo.intersectsBox(b))continue;const g=o.geometry,a=g.attributes.position,n=g.index?.count??a.count;let hit=false;for(let i=0;i<n;i+=3){for(let j=0;j<3;j++)v[j].fromBufferAttribute(a,g.index?g.index.getX(i+j):i+j).applyMatrix4(o.matrixWorld);tri.set(...v);if(cargo.intersectsTriangle(tri)){hit=true;break;}}if(hit){hits.push({source,age,p,mesh:o.name,material:o.material?.name,bounds:[b.min.toArray(),b.max.toArray()]});if(hits.length>=40)return{testedUntil:{source,age},hits,complete:false};}}}return{samples:CYCLE*6,solidCount:solids.length,hits,complete:true};},state(){return{...proof,activeBags:luggage.size,enclosure:{facade:facade.visible,roof:roof.visible},clockHands:clockHands.map(h=>h.rotation.z)}}};
}
