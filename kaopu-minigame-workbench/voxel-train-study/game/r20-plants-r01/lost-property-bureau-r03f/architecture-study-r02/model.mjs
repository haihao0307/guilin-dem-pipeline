import * as T from '../geometry-orbit-r01/vendor/three.module.js';
import {AssemblyBuilder,archOutline,rectangle,wallMap,wall,archDress,sash,hipRoof,PALETTE} from './construction.mjs';
export const REVISION='architecture-study-r02';
export const DESIGN={units:'metres',envelope:{x:[-42,50],z:[-40,40]},hall:{x:[-37.9,-26.5],z:[-10,23],clearHeight:8.4},store:{x:[-26,46],z:[-28,35],allocationArea:4536},grid:{x:[-26,-2,22,46],z:Array.from({length:11},(_,i)=>-28+i*6.3)},tower:{floors:[0,5.4,10.8,16.2],stairHole:{x:[-37.3,-33.7],z:[-23,-17]},top:28},handover:{x:-32.4,y:1.3,zStart:-6,zPitch:3.2,count:8},sources:['Waterhouse: CCA DR1993:0035 ground-floor plan (1868)','Manchester City Council / Historic England 1207469','Crossness official 1893 site plan / Historic England 1064241','7 user supplied architectural reference photographs (not distributed)'],unknowns:['original boiler-house reference','measured historic sections','structural/fire/accessibility engineering','new rack capacity and custody migration','user artistic acceptance']};
const sum=a=>a.reduce((x,y)=>x+y,0);
export function buildBureau(){
 const B=new AssemblyBuilder(),junctions=[],openings=[],metrics={warehousePermanentArea:0};
 const box=(c,s,m)=>B.box(c,s,m),rod=(a,b,r,m)=>B.rod(a,b,r,m),beam=(a,b,w,d,m)=>B.beam(a,b,w,d,m);
 function strip(axis,fixed,a,b,y,width,height,mat='trim'){box(axis==='x'?[fixed,y,(a+b)/2]:[(a+b)/2,y,fixed],axis==='x'?[width,height,b-a]:[b-a,height,width],mat);}
 function recordOpening(id,axis,fixed,u,width,height){openings.push({id,axis,fixed,u,width,height,innerBoundaryOwner:id+':reveal'});}
 function column(x,z,y0,top,scale=1){
  box([x,y0+.1,z],[.92*scale,.2,.92*scale],'stone');
  B.lathe([x,y0+.2,z],[[.39*scale,0],[.43*scale,.08],[.43*scale,.16],[.35*scale,.24],[.345*scale,.38],[.34*scale,(top-y0)*.55],[.30*scale,top-y0-.58],[.36*scale,top-y0-.55],[.39*scale,top-y0-.46]],'trim',16);
  box([x,top-.18,z],[.92*scale,.22,.92*scale],'trim');box([x,top-.02,z],[1.02*scale,.10,1.02*scale],'stone');
 }
 function balustrade(axis,fixed,a,b,y){strip(axis,fixed,a,b,y+.10,.32,.18);strip(axis,fixed,a,b,y+1.02,.40,.14);const n=Math.max(1,Math.floor((b-a-.7)/.48));for(let i=0;i<n;i++){const u=a+.5+(b-a-1)*(i+.5)/n,c=axis==='x'?[fixed,y+.19,u]:[u,y+.19,fixed];B.lathe(c,[[.10,0],[.11,.10],[.07,.16],[.10,.27],[.13,.38],[.10,.49],[.065,.62],[.10,.7],[.10,.75]],'trim',8);}}
 function arcade(axis,fixed,a,b,n,top=10.8){
  const pitch=(b-a)/n,os=[];
  for(let i=0;i<n;i++){const u=a+(i+.5)*pitch;os.push({kind:'arch',u,bottom:0,radius:2.3,spring:2.4});}
  wall(B,axis,fixed,a,b,0,5.08,.66,os,'stone');
  for(const o of os){archDress(B,axis,fixed,o.u,0,1.9,2.4,.4,.82);recordOpening(`arcade-${axis}-${o.u.toFixed(2)}`,axis,fixed,o.u,3.8,4.3);}
  for(let i=0;i<=n;i++){const u=a+i*pitch,c=wallMap(axis,fixed)(u,0,0);box([c[0],.17,c[2]],axis==='x'?[.92,.34,pitch-3.65]:[pitch-3.65,.34,.92],'trim');for(const y of[.72,1.44,2.16])strip(axis,fixed,u-(pitch-4.62)/2,u+(pitch-4.62)/2,y,.69,.026,'trim');column(c[0],c[2],5.4,top-.75,.94);if(i<n)balustrade(axis,fixed,u+.5,u+pitch-.5,5.4);}
  for(const[y,w,h]of[[4.98,.85,.16],[5.15,1.04,.18],[5.34,.94,.18],[top-.6,.85,.23],[top-.37,1.0,.18],[top-.12,1.18,.23]])strip(axis,fixed,a,b,y,w,h);
 }
 function windowBand(axis,fixed,a,b,n,y0,h,w=1.7){const os=[];for(let i=0;i<n;i++){const u=a+(i+.5)*(b-a)/n;os.push({kind:'arch',u,bottom:y0,radius:w/2+.22,spring:h-w/2});}return os;}
 function windowDressList(axis,fixed,os,depth=.72){for(const o of os){archDress(B,axis,fixed,o.u,o.bottom,o.radius-.22,o.spring,.22,depth);sash(B,axis,fixed,o.u,o.bottom,(o.radius-.22)*2,o.spring+o.radius-.22,true);}}
 function roofCornice(axis,fixed,a,b,y){for(const[dy,w,h]of[[-.2,.78,.18],[0,1.0,.18],[.16,1.15,.12]])strip(axis,fixed,a,b,y+dy,w,h);}
 // Ground and the two civic street edges are continuous; no foundation above the door datum.
 B.set('site','site');box([6,-.42,4],[240,.45,210],'ground');box([-59,-.16,-1],[24,.10,115],'road');box([4,-.16,-54],[126,.10,22],'road');box([4,-.055,0],[100,.11,88],'paving');box([5,-.075,53],[100,.08,22],'soil');
 for(let z=-44;z<43;z+=2.2)box([-45.3,-.005,z],[.2,.10,2.15],'trim');for(let x=-44;x<55;x+=2.2)box([x,-.005,-43.3],[2.15,.10,.2],'trim');
 B.set('ground-floors','building-floor');box([4,-.15,0],[92,.3,80],'floor');
 // Lower arches carry an upper colonnade. The two levels have different construction.
 B.set('envelope','street-arcades');arcade('x',-41.65,-10,23,6,10.8);arcade('x',-41.65,23,40,3,10.8);arcade('x',-41.65,-40,-28,2,9.8);arcade('z',-39.65,-42,50,16,9.8);
 B.set('upper-floors','street-gallery');box([-40.0,5.25,15],[4,.3,50],'stone');box([4,5.25,-38.0],[92,.3,4],'stone');box([-40,5.25,-34],[4,.3,12],'stone');
 // Tall public hall wall: high real openings at both levels, not window-colored slabs.
 B.set('envelope','hall-west-wall');const lower=windowBand('x',-38.15,-10,23,6,1.4,2.9,2.15),upper=windowBand('x',-38.15,-10,23,6,6.0,3.4,2.15);
 wall(B,'x',-38.15,-10,23,0,10.8,.5,[...lower,...upper],'plaster');windowDressList('x',-38.15,[...lower,...upper],.67);
 for(let i=0;i<=6;i++){const z=-10+5.5*i;box([-37.78,4.3,z],[.22,8.6,.46],'trim');box([-37.65,.82,z],[.15,1.64,.65],'wood');}
 B.set('envelope','hall-end-walls');wall(B,'z',-10.22,-38.4,-26.25,0,10.8,.44,[{kind:'rect',u:-35,bottom:0,width:4,top:4.2},{kind:'rect',u:-29.9,bottom:0,width:2.4,top:3.5}], 'plaster');
 wall(B,'z',23.25,-38.4,-26.25,0,10.8,.5,[{kind:'rect',u:-29.9,bottom:0,width:2.4,top:3.5}], 'plaster');
 B.set('envelope','hall-store-boundary');const transfer=[6.65,12.95].map(z=>({kind:'rect',u:z,bottom:0,width:2.2,top:3.4}));wall(B,'x',-26.25,-28,35,0,10.8,.5,[...transfer,{kind:'rect',u:31.85,bottom:0,width:2.8,top:3.5}], 'plaster');for(const o of transfer){recordOpening('controlled-transfer-'+o.u,'x',-26.25,o.u,2.2,3.4);for(const s of[-1,1])box([-26.28,1.7,o.u+s*1.18],[.65,3.4,.16],'wood');box([-26.28,3.5,o.u],[.65,.2,2.5],'wood');}
 // Public hall has no upper slab. A full-span roof structure and tall windows define it.
 B.set('structure','hall-roof-structure');for(let i=0;i<6;i++){const z=-7.25+i*5.5,apex=Math.min(12.5,10.9+2.8*Math.min((z+10)/8.025,(40.3-z)/8.025,5.95/8.025)-.35);beam([-37.9,9.15,z],[-26.5,9.15,z],.18,.22,'wood');beam([-37.9,9.15,z],[-32.2,apex,z],.2,.24,'wood');beam([-32.2,apex,z],[-26.5,9.15,z],.2,.24,'wood');rod([-32.2,9.15,z],[-32.2,apex,z],.07,'iron');for(const s of[-1,1])beam([-32.2+s*5.6,8.1,z],[-32.2+s*3.6,9.15,z],.14,.18,'wood');}
 B.set('roofs','west-wing-hip-roof');hipRoof(B,-42.3,-26.25,-10,40.3,10.9,13.7,'z');
 B.set('envelope','northwest-workrooms');const nw=windowBand('x',-38.15,23,40,3,1.4,2.9,1.9);wall(B,'x',-38.15,23,40,0,10.8,.5,[...nw,...windowBand('x',-38.15,23,40,3,6,3.3,1.9)],'plaster');windowDressList('x',-38.15,[...nw,...windowBand('x',-38.15,23,40,3,6,3.3,1.9)],.66);
 wall(B,'z',35.25,-38.4,-26.5,0,9.7,.5,[{kind:'rect',u:-32.2,bottom:0,width:3.2,top:4}], 'plaster');
 B.set('upper-floors','northwest-office-slab');box([-32.2,5.25,31.6],[11.4,.3,16.2],'stone');
 // South offices have shallower bays and a lower, independent roof.
 B.set('envelope','south-offices');const s0=windowBand('z',-36.15,-42,50,16,1.2,3.0,1.9),s1=windowBand('z',-36.15,-42,50,16,6.0,2.8,1.9);wall(B,'z',-36.15,-42,50,0,9.8,.5,[...s0,...s1],'plaster');windowDressList('z',-36.15,[...s0,...s1],.66);
 wall(B,'z',-28.25,-26,46,0,9.6,.5,[{kind:'rect',u:-24,bottom:0,width:2,top:3.4},{kind:'rect',u:47,bottom:0,width:2,top:3.4}].filter(o=>o.u<45),'plaster');
 wall(B,'x',49.75,-40,40,0,9.7,.5,[...windowBand('x',49.75,-35,30,10,1.5,3.3,2.0),{kind:'rect',u:36.8,bottom:0,width:3.5,top:4}], 'brick');windowDressList('x',49.75,windowBand('x',49.75,-35,30,10,1.5,3.3,2.0),.66);
 B.set('upper-floors','south-office-slab');B.extrude(rectangle(-42,-35.9,49.5,-28.5),.30,(x,z,d)=>[x,5.25+d,z],'stone');
 B.set('roofs','south-wing-hip-roof');hipRoof(B,-42.3,50.3,-40.3,-28,9.9,12.0,'x');
 B.set('envelope','south-cornice');roofCornice('z',-39.65,-42,50,9.6);roofCornice('x',49.75,-40,35,9.5);
 // Tower: independently straight storey bands. Continuous stair shaft cuts every floor.
 const tiers=[[14,16],[13.2,15.2],[11.4,12.8],[9.8,10.8]],tc=[-35,-20];
 B.set('envelope','entrance-tower');for(let k=0;k<4;k++){
  const[w,d]=tiers[k],x0=tc[0]-w/2,x1=tc[0]+w/2,z0=tc[1]-d/2,z1=tc[1]+d/2,y0=k*5.4,y1=y0+5.4;
  for(const[axis,fixed,a,b]of[['x',x0,z0,z1],['x',x1,z0,z1],['z',z0,x0,x1],['z',z1,x0,x1]]){
   const os=[];
   if(k===0&&axis==='x'&&fixed===x0)os.push({kind:'arch',u:-17.5,bottom:0,radius:2.6,spring:2.1});
   else if(k===0&&axis==='z'&&fixed===z1)os.push({kind:'rect',u:-35,bottom:0,width:4,top:4.2},{kind:'rect',u:-29.9,bottom:0,width:2.4,top:3.5});
   else if(k===0&&axis==='z'&&fixed===z0)os.push({kind:'rect',u:-29.9,bottom:0,width:2.4,top:3.5});
   else if(k>0){for(const u of[(a+b)/2-1.65,(a+b)/2+1.65])os.push({kind:'arch',u,bottom:y0+1.0,radius:.9,spring:2.0});}
   wall(B,axis,fixed,a,b,y0,y1-.35,.5,os,'stone');
   if(k===0&&axis==='x'&&fixed===x0){archDress(B,axis,fixed,-17.5,0,2.2,2.1,.4,.85);recordOpening('tower-public-entry',axis,fixed,-17.5,4.4,4.3);}
   if(k>0)windowDressList(axis,fixed,os,.66);
   roofCornice(axis,fixed,a,b,y1-.28);
  }
  for(const x of[x0+.12,x1-.12])for(const z of[z0+.12,z1-.12]){box([x,(y0+y1)/2-.15,z],[.68,y1-y0-.3,.68],'trim');for(let yy=y0+.7;yy<y1-.5;yy+=.8)box([x,yy,z],[.71,.045,.71],'stone');}
  if(k>0){B.set('upper-floors','tower-slabs');B.extrude(rectangle(x0+.25,z0+.25,x1-.25,z1-.25),.3,(x,z,d)=>[x,y0-.15+d,z],'stone',[rectangle(-37.3,-23,-33.7,-17)]);B.set('envelope','entrance-tower');}
 }
 // Flat, low neck is a deliberate interval; the high hall roof cannot intersect the tower.
 B.set('roofs','tower-hall-low-connection');box([-35,4.85,-11],[14,.3,2],'roof');junctions.push({id:'tower-hall',kind:'low-link',towerEdgeZ:-12,hallEdgeZ:-10,roofTop:5.0,upperFloor:5.4});
 B.set('envelope','neck-side-wall');wall(B,'x',-28.25,-12,-10,0,4.8,.5,[],'stone');
 B.set('roofs','tower-hip-roof');hipRoof(B,-40.05,-29.95,-25.55,-14.45,21.7,26.6,'z');B.lathe([-35,26.65,-20],[[.3,0],[.33,.1],[.15,.24],[.1,.9],[.025,1.35]],'brass',12);
 // Stair flights are stepped profile solids with one sloping soffit; no stacked box pile.
 B.set('stairs','tower-stair');for(let level=0;level<3;level++){
  const base=level*5.4;
  for(let flight=0;flight<2;flight++){
   const x=flight===0?-36.35:-34.65,start=flight===0?-23:-18.8,sign=flight===0?1:-1,y=base+flight*2.7,pts=[[start,y-.2],[start,y+.18]];
   for(let i=0;i<15;i++){const z=start+sign*(i+1)*.28;pts.push([z,y+(i+1)*.18]);if(i<14)pts.push([z,y+(i+2)*.18]);}
   pts.push([start+sign*4.2,y+2.7-.25],[start,y-.25]);B.extrude(pts,1.5,(z,yy,d)=>[x+d,yy,z],'stone');
   for(const s of[-1,1]){const xx=x+s*.68;rod([xx,y+1.05,start],[xx,y+3.75,start+sign*4.2],.045,'wood');for(let i=0;i<15;i+=3){const z=start+sign*(i+.5)*.28,yy=y+(i+1)*.18;rod([xx,yy,z],[xx,yy+1.0,z],.025,'iron');}}
  }
  box([-35.5,base+2.55,-18.05],[3.4,.3,1.5],'stone');for(const xx of[-37.13,-33.87])rod([xx,base+2.7,-17.38],[xx,base+3.7,-17.38],.04,'iron');rod([-37.13,base+3.7,-17.38],[-33.87,base+3.7,-17.38],.045,'wood');
 }
 // Warehouse envelope: three 24m spans, 6.3m longitudinal structure.
 B.set('envelope','warehouse');wall(B,'x',46.25,-28,35,0,9.6,.5,[{kind:'rect',u:-22,bottom:0,width:2.4,top:3.4},{kind:'rect',u:30,bottom:0,width:2.8,top:3.8}], 'brick');
 for(const z of[-28.25,35.25]){const os=z>0?[{kind:'rect',u:10,bottom:0,width:5.6,top:4.8}]:[];if(z>0)wall(B,'z',z,-26,46,0,9.6,.5,os,'brick'); // South office back wall is the shared boundary, emitted once.
 for(let b=0;b<3;b++){const x0=-26+24*b,x1=x0+24,c=x0+12;B.extrude([[x0,9.6],[x1,9.6],[c,12.6]],.5,wallMap('z',z),'brick');for(const x of[x0+.15,x1-.15])box([x,5,z],[.58,10,.75],'stone');}}
 B.set('envelope','rear-loading-wall');wall(B,'z',39.75,-42,50,0,9.6,.5,[{kind:'rect',u:10,bottom:0,width:5.6,top:4.8},{kind:'rect',u:-32.2,bottom:0,width:3.2,top:4.0},...windowBand('z',39.75,-23,0,4,2,3.6,2.2),...windowBand('z',39.75,18,45,4,2,3.6,2.2)],'brick');
 windowDressList('z',39.75,[...windowBand('z',39.75,-23,0,4,2,3.6,2.2),...windowBand('z',39.75,18,45,4,2,3.6,2.2)],.7);
 B.set('structure','warehouse-columns');for(const x of DESIGN.grid.x)for(const z of DESIGN.grid.z){
  box([x,.18,z],[.7,.36,.7],'stone');B.lathe([x,.36,z],[[.29,0],[.29,.18],[.23,.3],[.19,7.2],[.3,7.6],[.38,7.8],[.38,7.9]],'iron',12);box([x,8.32,z],[.85,.24,.85],'iron');
  const xmin=Math.max(x-.35,-26),xmax=Math.min(x+.35,46),zmin=Math.max(z-.35,-28),zmax=Math.min(z+.35,35);metrics.warehousePermanentArea+=(xmax-xmin)*(zmax-zmin);
 }
 B.set('structure','warehouse-roof-trusses');for(const z of DESIGN.grid.z)for(let k=0;k<3;k++){
  const x0=-26+24*k,x1=x0+24,c=x0+12;
  beam([x0,8.45,z],[x1,8.45,z],.18,.22,'iron');beam([x0,9.4,z],[c,12.4,z],.19,.25,'iron');beam([c,12.4,z],[x1,9.4,z],.19,.25,'iron');
  for(let j=0;j<=4;j++){const x=x0+6*j,yy=12.4-Math.abs(x-c)*.25;rod([x,8.45,z],[x,yy,z],.065,'iron');if(j<4){const nx=x+6,ny=12.4-Math.abs(nx-c)*.25;rod([x,8.45,z],[nx,ny,z],.055,'iron');}}
  for(const[x,s]of[[x0,1],[x1,-1]])B.tube([[x,7.0,z],[x+s*.5,7.8,z],[x+s*1.4,8.35,z],[x+s*2.3,8.45,z]],.075,'iron');
 }
 // Roof skins stop at the actual glazed monitor opening. No opaque sheet underneath.
 B.set('roofs','warehouse-roofs');for(let k=0;k<3;k++){
  const x0=-26+24*k,x1=x0+24,c=x0+12,lo=-28.4,hi=35.4,yt=12.375;
  B.prism([[x0,9.6,lo],[c-.9,yt,lo],[c-.9,yt,hi],[x0,9.6,hi]],.16,'roof');B.prism([[c+.9,yt,lo],[x1,9.6,lo],[x1,9.6,hi],[c+.9,yt,hi]],.16,'roof');
  for(const s of[-1,1]){B.quad([[c+s*.9,yt,lo],[c+s*.9,13.15,lo],[c+s*.9,13.15,hi],[c+s*.9,yt,hi]],'glass');beam([c+s*.9,yt,lo],[c+s*.9,yt,hi],.1,.12,'iron');beam([c+s*.9,13.15,lo],[c+s*.9,13.15,hi],.1,.12,'iron');B.prism([[c+s*1.05,13.15,lo],[c,13.65,lo],[c,13.65,hi],[c+s*1.05,13.15,hi]],.1,'roof');}
  for(const z of DESIGN.grid.z)for(const s of[-1,1])beam([c+s*.9,yt,z],[c+s*.9,13.15,z],.075,.075,'iron');
  for(const x of[x0,x1]){beam([x,9.56,lo],[x,9.56,hi],.32,.22,'iron');}
 }
 B.set('roofs','service-roofs');box([47.75,9.45,3.5],[3,.3,64],'roof');box([7.5,9.45,37.5],[78.5,.3,4.5],'roof');
 // Storage modules follow space and aisles. They are empty furniture, not a certified address count.
 B.set('interior','warehouse-storage');function rack(x0,x1,z,levels=5){const length=x1-x0,n=Math.ceil(length/1.8),height=6.1;
  for(let i=0;i<=n;i++){const x=x0+length*i/n;for(const dz of[-.85,.85]){box([x,height/2,z+dz],[.075,height,.075],'iron');box([x,.06,z+dz],[.2,.12,.2],'darkIron');}}
  for(let l=0;l<levels;l++){const y=.35+l*1.15;box([(x0+x1)/2,y,z],[length,.085,1.78],'woodLight');for(const dz of[-.89,.89])box([(x0+x1)/2,y-.08,z+dz],[length,.12,.06],'iron');}
  for(const xx of[x0,x1]){rod([xx,.35,z-.8],[xx,5.0,z+.8],.026,'iron');rod([xx,.35,z+.8],[xx,5.0,z-.8],.026,'iron');}
 }
 for(const[x0,x1,skip]of[[-21.5,-3.3,true],[-.7,5.7,true],[14.3,20.7,false],[25.3,43.0,false]])for(const z of[-18.55,-12.25,-5.95,.35,6.65,12.95,19.25,25.55])if(!(skip&&[6.65,12.95].includes(z)))rack(x0,x1,z,5);
 // Two distinct sorting benches occupy the broad west transfer work zone, away from cross-aisles.
 function desk(x,z,length=2.3,depth=1.1,y=0){box([x,y+.78,z],[length,.12,depth],'wood');for(const dx of[-length/2+.15,length/2-.15])for(const dz of[-depth/2+.15,depth/2-.15])box([x+dx,y+.36,z+dz],[.09,.72,.09],'wood');box([x,y+.16,z],[length-.16,.08,depth-.18],'wood');}
 B.set('interior','sorting-work');desk(-15,9.8,5.6,1.25);desk(-6,9.8,4.2,1.25);
 // Continuous public cabinet retains all eight anchors; patterned joinery belongs to that whole.
 B.set('interior','public-counter');box([-32.5,.64,5.2],[1.1,1.18,25.1],'wood');box([-32.5,1.245,5.2],[1.36,.11,25.1],'wood');box([-32.5,.12,5.2],[1.22,.24,25.1],'darkIron');
 for(let i=0;i<8;i++){const z=-6+3.2*i;box([-33.07,.73,z],[.09,.72,2.76],'woodLight');for(const dz of[-1.43,1.43])box([-33.13,.72,z+dz],[.14,1.0,.09],'wood');box([-33.44,.815,z+.8],[.56,.05,1.28],'wood');for(const dz of[.25,1.35])beam([-33.08,.48,z+dz],[-33.65,.79,z+dz],.045,.045,'iron');box([-31.68,1.34,z+.9],[.4,.12,.3],'paper');}
 function bench(x,z,along='z'){const l=2.2;box([x,.45,z],along==='z'?[.68,.12,l]:[l,.12,.68],'wood');box([x-.3,.88,z],along==='z'?[.07,.74,l]:[l,.74,.07],'wood');for(const dx of[-.24,.24])for(const dz of[-.9,.9])box([x+dx,.2,z+dz],[.06,.4,.08],'iron');}
 B.set('interior','public-waiting');bench(-36.2,20.5);bench(-36.2,-8.2);
 B.set('interior','office-furniture');for(const y of[0,5.4])for(const x of[-20,-8,4,16,28,40]){desk(x,-32,2.6,1.3,y);box([x+2.5,y+1.0,-29.2],[1.8,2,.58],'wood');}
 B.set('interior','hall-dado');box([-37.86,.63,6.5],[.08,1.26,33],'wood');for(let z=-9.7;z<23;z+=1.1)box([-37.8,.64,z],[.06,1.06,.035],'woodLight');
 B.set('interior','hall-lights');for(const z of[-7.25,3.75,14.75]){rod([-34.3,8.0,z],[-34.3,6.45,z],.025,'brass');B.lathe([-34.3,6.0,z],[[.22,0],[.34,.12],[.42,.35],[.32,.5],[.08,.55]],'trim',16);}
 // Boiler/service annex is an authored spatial proposal, not the missing user's boiler reference.
 B.set('envelope','service-annex');const bw=windowBand('x',56.25,42,60,3,2.2,4.5,2.3);wall(B,'x',56.25,42,60,0,8.8,.5,[...bw.filter(o=>o.u!==51),{kind:'arch',u:51,bottom:0,radius:2.35,spring:2.5}],'brick');windowDressList('x',56.25,bw.filter(o=>o.u!==51),.72);archDress(B,'x',56.25,51,0,2,2.5,.35,.76);
 const be=windowBand('x',67.75,42,60,3,2.2,4.5,2.3);wall(B,'x',67.75,42,60,0,8.8,.5,be,'brick');windowDressList('x',67.75,be,.7);
 for(const z of[42.25,59.75]){wall(B,'z',z,56,68,0,8.8,.5,[{kind:'arch',u:62,bottom:1.8,radius:1.5,spring:3.8}], 'brick');archDress(B,'z',z,62,1.8,1.25,3.8,.25,.7);sash(B,'z',z,62,1.8,2.5,5.05,true);B.extrude([[56,8.8],[68,8.8],[62,11.4]],.5,wallMap('z',z),'brick');}
 for(const x of[56.15,67.85])for(const z of[42.2,48,54,59.8])box([x,4.35,z],[.75,8.7,.6],'stone');for(const z of[42.2,59.8])roofCornice('z',z,56,68,8.5);
 B.set('roofs','service-annex-roof');B.prism([[55.7,8.9,41.7],[62,11.55,41.7],[62,11.55,60.3],[55.7,8.9,60.3]],.16);B.prism([[62,11.55,41.7],[68.3,8.9,41.7],[68.3,8.9,60.3],[62,11.55,60.3]],.16);
 B.set('structure','service-annex-structure');for(const z of[42.6,48.3,54,59.7]){beam([56.5,8.2,z],[67.5,8.2,z],.16,.18,'iron');beam([56.5,8.4,z],[62,11.2,z],.16,.2,'iron');beam([62,11.2,z],[67.5,8.4,z],.16,.2,'iron');rod([62,8.2,z],[62,11.2,z],.055,'iron');}
 B.set('envelope','service-support-wing');wall(B,'x',73.75,42,60,0,5.0,.5,[{kind:'rect',u:46,bottom:0,width:2.2,top:3.0},...windowBand('x',73.75,50,59,2,1.4,2.5,1.4)],'brick');for(const z of[42.25,59.75])wall(B,'z',z,68,74,0,5.0,.5,[],'brick');B.set('roofs','service-support-roof');B.prism([[68,6.4,41.8],[74.3,5.1,41.8],[74.3,5.1,60.2],[68,6.4,60.2]],.16);
 B.set('ground-floors','service-court');box([65,-.13,54],[22,.2,28],'paving');box([62,.02,51],[11,.04,17],'floor');
 B.set('envelope','chimney');box([71,.4,63],[5.2,.8,5.2],'stone');B.lathe([71,.8,63],[[2.25,0],[2.25,1.5],[1.85,2.0],[1.25,27.6],[1.44,27.8],[1.44,28.2],[1.28,28.35],[1.28,29.3],[1.5,29.4],[1.5,30.0],[1.1,30.0],[1.1,29.7]],'brick',28);B.cyl([71,30.52,63],1.10,.03,'black',1.10,28);
 // Historical rail alignment remains context; the old moving machinery is not silently transplanted.
 B.set('site','rail-yard');for(const z of[46,51]){for(const dz of[-.72,.72])box([-20,.09,z+dz],[120,.12,.075],'darkIron');for(let x=-80;x<40;x+=1.0)box([x,.005,z],[.15,.1,2.0],'wood');}
 // Toggleable route overlays are 3D guides, not autonomous people or inventory transfers.
 B.set('routes','public-route');const publicRoute=[[-48,.12,-17.5],[-39,.12,-17.5],[-39,.12,-14],[-35,.12,-14],[-35,.12,-8],[-36.7,.12,-4],[-36.7,.12,16]];for(let i=1;i<publicRoute.length;i++)rod(publicRoute[i-1],publicRoute[i],.1,'blue');
 B.set('routes','goods-route');const goodsRoute=[[10,.14,44],[10,.14,37.5],[-32.2,.14,37.5],[-32.2,.14,31.85],[-23,.14,31.85],[10,.14,31.85],[10,.14,6.65],[-27,.14,6.65]];for(let i=1;i<goodsRoute.length;i++)rod(goodsRoute[i-1],goodsRoute[i],.1,'red');
 B.set('routes','staff-route');const staffRoute=[[-24,.16,-32],[-29.9,.16,-32],[-29.9,.16,-11],[-29.9,.16,18]];for(let i=1;i<staffRoute.length;i++)rod(staffRoute[i-1],staffRoute[i],.08,'green');
 const result=B.finish();for(const o of result.root.children)if(o.userData.layer==='routes')o.visible=false;
 const bounds=new T.Box3().setFromObject(result.root);return{...result,proof:{revision:REVISION,units:'metres',design:DESIGN,triangles:result.triangles,meshes:result.root.children.length,primitiveCount:result.elements.length,openings,junctions,warehouse:{allocation:4536,measuredColumnFootprint:metrics.warehousePermanentArea,remainingArea:4536-metrics.warehousePermanentArea,method:'intersection of all 0.7m square column plinth footprints with internal warehouse rectangle; no receiving/hall/office area counted',rackCapacityCertified:false},bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},artisticAcceptance:false,engineeringCertification:false,boilerReferenceRecovered:false,oldModelUntouched:true}};
}
