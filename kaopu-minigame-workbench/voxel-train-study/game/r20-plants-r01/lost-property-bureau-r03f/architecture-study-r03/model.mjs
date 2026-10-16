import {vaultSpec,groinHeight,archProfile,rectangleIntersection} from './kaopu-architecture-core.mjs';
import * as T from './vendor/three.module.js';
import {AssemblyBuilder, archOutline, rectangle, wallMap, wall, archDress, sash, hipRoof, PALETTE} from './construction.mjs';
export const REVISION='architecture-study-r03';
export const DESIGN={units:'metres',front:{x:[-42,42],z:[-46,-30]},hall:{x:[-13,13],z:[-30,12],bays:[-21,-9,3],span:12,spring:7.7,rise:4.4},warehouse:{x:[-45,45],z:[20,70],allocationArea:4500,bay:18,framePitch:5},gallery:{west:-38.5,east:38.5,width:5},clearances:{entry:4.8,public:8.4,staff:2.35,warehouseMain:5.4},sourcePrinciples:['Soane Bank Stock Office: hierarchy of public room, continuous counter and staff strip, indirect top light; no dimensional replication','BlockResearchGroup/compas-RV: explicit support grid, span/rise and boundary conditions; no claim of structural analysis'],unknowns:['artistic acceptance','structural sizing and thrust','fire/accessibility engineering','net storage capacity and operational address migration']};
Object.assign(PALETTE,{stone:0xb8aa8e,trim:0xd7cbb0,brick:0x795447,plaster:0xe1d8be,roof:0x3c4b50,iron:0x34524d,darkIron:0x233936,wood:0x614331,woodLight:0x98714b,glass:0xa6c6c3,floor:0xc9bd9f,paving:0xb8b09d,ground:0x82927d,road:0x6c756c,soil:0x81705d,black:0x253633,paper:0xeadfc3,brass:0xb49656,blue:0x558893,red:0xb76e4f,green:0x536e5d,copper:0x668879,cream:0xf2e6c7,terrazzo:0x515b50});
export function buildBureau(){
 const B=new AssemblyBuilder(),openings=[],relations=[],supports=[],zones=[];
 const box=(c,s,m='stone')=>B.box(c,s,m),beam=(a,b,w=.1,d=.1,m='iron')=>B.beam(a,b,w,d,m),rod=(a,b,r=.05,m='iron')=>B.rod(a,b,r,m);
 function strip(axis,fixed,a,b,y,w,h,mat='trim'){box(axis==='x'?[fixed,y,(a+b)/2]:[(a+b)/2,y,fixed],axis==='x'?[w,h,b-a]:[b-a,h,w],mat);}
 function cornice(axis,fixed,a,b,y,scale=1){for(const[dy,w,h]of[[-.38,.67,.16],[-.19,.79,.16],[0,.95,.16],[.14,1.10,.1]])strip(axis,fixed,a,b,y+dy*scale,w*scale,h*scale);}
 function dressedWall(id,axis,fixed,a,b,y0,y1,depth,os=[],mat='brick'){
  B.set('walls',id);wall(B,axis,fixed,a,b,y0,y1,depth,os,mat);
  for(const o of os){const w=o.kind==='arch'?o.radius*2:o.width,top=o.kind==='arch'?o.bottom+o.spring+o.radius:o.top;openings.push({id:id+':'+o.u,axis,fixed,u:o.u,width:w,bottom:o.bottom,top});
   if(o.kind==='arch'){archDress(B,axis,fixed,o.u,o.bottom,o.radius,o.spring,.2,depth+.16);if(o.glazed!==false)sash(B,axis,fixed,o.u,o.bottom,w,top-o.bottom,true);}
   else {for(const s of[-1,1])strip(axis,fixed,o.u+s*w/2-.08,o.u+s*w/2+.08,(o.bottom+top)/2,depth+.14,top-o.bottom,'trim');strip(axis,fixed,o.u-w/2-.12,o.u+w/2+.12,top+.12,depth+.2,.24);if(o.glazed!==false)sash(B,axis,fixed,o.u,o.bottom,w,top-o.bottom,false);}
  }
 }
 function col(x,z,y0,top,r=.28,mat='trim'){
  box([x,y0+.12,z],[r*3,.24,r*3],'stone');B.lathe([x,y0+.24,z],[[r*1.35,0],[r*1.4,.12],[r,.26],[r,.45],[r*.87,top-y0-.92],[r*1.2,top-y0-.75],[r*1.4,top-y0-.59]],mat,16);box([x,top-.2,z],[r*3.1,.25,r*3.1],mat);box([x,top-.035,z],[r*3.35,.1,r*3.35],mat);supports.push({x,z,y0,top,baseWidth:r*3,group:B.group});
 }
 function archRib(axis,fixed,u,span,spring,rise,width=.17,depth=.23,mat='trim'){
  const map=wallMap(axis,fixed),outer=[],inner=[];
  for(let i=0;i<=48;i++){const a=Math.PI-i*Math.PI/48;outer.push([u+(span/2+width)*Math.cos(a),spring+(rise+width)*Math.sin(a)]);inner.unshift([u+span/2*Math.cos(a),spring+rise*Math.sin(a)]);}B.extrude([...outer,...inner],depth,map,mat);
 }
 function barrel(x0,x1,z0,z1,spring,rise,mat='plaster',layer='vaults'){
  B.set(layer,'barrel-'+x0+'-'+z0);for(let i=0;i<48;i++){const a=i*Math.PI/48,c=(i+1)*Math.PI/48,x=(x0+x1)/2,r=(x1-x0)/2;B.prism([[x+r*Math.cos(a),spring+rise*Math.sin(a),z0],[x+r*Math.cos(c),spring+rise*Math.sin(c),z0],[x+r*Math.cos(c),spring+rise*Math.sin(c),z1],[x+r*Math.cos(a),spring+rise*Math.sin(a),z1]],.18,mat);}
 }
 function groin(cx,cz,span,spring,rise){
  B.set('vaults','hall-groin-'+cz);const h=span/2,N=24,pts=[],spec=vaultSpec({spanX:span,spring,rise,supports:[[-h,-h],[h,-h],[-h,h],[h,h]]}),height=(x,z)=>groinHeight(x,z,spec);
  // A groin is the union of two barrel voids. max barrel height leaves four open arches, not a closed cloister vault.
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){const x=-h+i*span/N,z=-h+j*span/N,xx=x+span/N,zz=z+span/N;if(cz===-9&&Math.abs(x+span/N/2)<2&&Math.abs(z+span/N/2)<2)continue;const p=[[cx+x,height(x,z),cz+z],[cx+xx,height(xx,z),cz+z],[cx+xx,height(xx,zz),cz+zz],[cx+x,height(x,zz),cz+zz]];B.quad(p,'plaster');}
  for(const s of[-1,1]){const p=[];for(let i=0;i<=48;i++){const t=-h+span*i/48;p.push([cx+t,height(t,s*t)-.025,cz+s*t]);}for(let i=1;i<p.length;i++){if(cz===-9&&Math.abs((p[i-1][0]+p[i][0])/2)<2)continue;beam(p[i-1],p[i],.11,.09,'trim');}}
  for(const z of[cz-h,cz+h])archRib('z',z,cx,span,spring,rise,.16,.22);
  relations.push({id:'vault-'+cz,supports:[[-6,cz-h],[6,cz-h],[-6,cz+h],[6,cz+h]],span,rise,spring,crown:spring+rise,rule:'equal plan spans; four corner supports; open side arches; authored geometric union, not thrust solved'});
 }
 function floorRect(id,x0,x1,z0,z1,y=0,mat='floor'){B.set(y?'upper-floors':'floors',id);box([(x0+x1)/2,y-.13,(z0+z1)/2],[x1-x0,.26,z1-z0],mat);}
 function panelledCounter(x,z,length,axis='z'){
  const face=x<0?-1:1;const p=(u,y,v)=>axis==='z'?[x+u*face,y,z+v]:[x+v,y,z+u],s=(w,h,l)=>axis==='z'?[w,h,l]:[l,h,w];
  box(p(0,.61,0),s(1.0,1.18,length),'wood');box(p(0,1.235,0),s(1.25,.11,length+.1),'wood');box(p(0,.1,0),s(1.13,.2,length+.06),'darkIron');
  const n=Math.round(length/2.4);for(let i=0;i<n;i++){const u=-length/2+(i+.5)*length/n;box(p(-.51,.65,u),s(.035,.76,length/n-.3),'woodLight');for(const k of[-1,1])box(p(-.54,.65,u+k*(length/n-.2)/2),s(.07,.9,.09),'wood');box(p(-.74,.825,u),s(.52,.05,1.35),'wood');box(p(-.75,.86,u),s(.28,.016,.40),'paper');box(p(.15,1.31,u+.5),s(.24,.06,.32),'paper');rod(p(-.1,1.31,u-.52),p(-.1,1.48,u-.52),.018,'brass');
   if(i%2===0){box(p(.55,1.48,u),s(.04,.43,1.36),'glass');box(p(.56,1.72,u),s(.07,.06,1.50),'brass');for(const k of[-.7,.7])rod(p(.56,1.26,u+k),p(.56,1.74,u+k),.025,'brass');}}
 }
 function desk(x,z,w=2.1,d=1.0,y=0){box([x,y+.79,z],[w,.10,d],'wood');for(const s of[-1,1]){box([x+s*(w/2-.31),y+.38,z],[.47,.76,d-.12],'wood');for(let q=0;q<3;q++){box([x+s*(w/2-.31),y+.21+q*.2,z-d/2+.025],[.39,.15,.025],'woodLight');rod([x+s*(w/2-.31)-.07,y+.25+q*.2,z-d/2-.02],[x+s*(w/2-.31)+.07,y+.25+q*.2,z-d/2-.02],.018,'brass');}}box([x-.25,y+.855,z],[.4,.02,.28],'paper');box([x+.55,y+.87,z+.1],[.15,.07,.16],'darkIron');}
 function chair(x,z,y=0,rot=0){box([x,y+.48,z],[.55,.12,.55],'wood');box([x,y+.95,z+.25],[.55,.76,.07],'wood');for(const dx of[-.22,.22])for(const dz of[-.22,.22])box([x+dx,y+.23,z+dz],[.055,.46,.055],'wood');}
 function cabinet(x,z,w=3,h=2.8,axis='z',y=0){const p=(u,yy,v)=>axis==='z'?[x+u,y+yy,z+(z<-30?-v:v)]:[x+(x<0?-v:v),y+yy,z+u],s=(a,b,c)=>axis==='z'?[a,b,c]:[c,b,a];box(p(0,h/2,0),s(w,h,.52),'wood');box(p(0,h+.04,0),s(w+.16,.12,.66),'wood');const n=Math.round(w/.38);for(let i=0;i<n;i++)for(let j=0;j<7;j++){const xx=-w/2+(i+.5)*w/n,yy=.22+j*(h-.4)/7;box(p(xx,yy,-.28),s(w/n-.035,(h-.4)/7-.025,.045),'woodLight');box(p(xx,yy,-.309),s(.11,.055,.014),'brass');}}
 function lantern(x,z,top=7){rod([x,top,z],[x,top-1.5,z],.025,'brass');box([x,top-1.8,z],[.44,.5,.44],'cream');for(const dx of[-.23,.23])for(const dz of[-.23,.23])rod([x+dx,top-2.1,z+dz],[x+dx,top-1.5,z+dz],.022,'brass');box([x,top-1.52,z],[.56,.08,.56],'darkIron');box([x,top-2.1,z],[.5,.07,.5],'darkIron');}
 function clockFace(x,y,z,axis='z'){
  const map=(u,v,d)=>axis==='z'?[x+u,y+v,z+d]:[x+(x>0?-d:d),y+v,z+u];const g=new T.CylinderGeometry(1.68,1.68,.14,64);g.rotateX(Math.PI/2);if(axis==='x')g.rotateY(Math.PI/2);g.translate(x,y,z);B.add(g,'cream');for(let i=0;i<60;i++){const a=i*Math.PI/30,r=i%5?1.48:1.39;beam(map(Math.sin(a)*r,Math.cos(a)*r,-.09),map(Math.sin(a)*1.56,Math.cos(a)*1.56,-.09),i%5?.023:.06,.025,'darkIron');}beam(map(0,0,-.13),map(.61,.79,-.13),.08,.06,'darkIron');beam(map(0,0,-.15),map(-1.14,.46,-.15),.055,.05,'darkIron');const ring=[];for(let i=0;i<=64;i++)ring.push(map(1.74*Math.cos(i*Math.PI/32),1.74*Math.sin(i*Math.PI/32),-.04));for(let i=1;i<ring.length;i++)rod(ring[i-1],ring[i],.07,'brass');}
 // SITE: forecourt, two courtyards, and a separate service apron. Datum y=0 is continuous at all public doors.
 B.set('site','ground');box([0,-.48,13],[170,.6,170],'ground');box([0,-.145,-59],[150,.11,18],'road');box([0,-.06,-50],[102,.1,7.7],'paving');box([0,-.16,17],[99,.2,111],'paving');box([52,-.1,44],[15,.12,64],'paving');
 for(const x of[-48.5,48.5])box([x,.02,10],[.2,.15,118],'trim');
 for(let x=-48;x<=48;x+=3)box([x,-.001,-50],[.018,.02,7.5],'stone');
 for(const s of[-1,1]){box([s*24,-.025,-8.5],[19,.16,35],'paving');box([s*24,.09,-8],[12.8,.22,25.8],'stone');box([s*24,.21,-8],[12.4,.12,25.4],'ground');for(const z of[-19,2]){B.cyl([s*24,.35,z],1.55,.45,'stone',1.65,32);B.cyl([s*24,.61,z],1.45,.08,'soil',1.45,32);B.lathe([s*24,.62,z],[[1.3,0],[1.35,.5],[1.1,1.0],[.6,1.3],[0,1.35]],'green',16);}for(const x of[s*17,s*31]){box([x,.48,-8],[.72,.14,3.3],'wood');for(const z of[-9.3,-6.7])box([x,.21,z],[.55,.42,.18],'iron');}}
 // CIVIC FRONT: a coherent 6 m bay system. Central tower is the entrance volume, never a detached ornament.
 floorRect('front-ground',-42,42,-46,-30);
 for(const side of[-1,1]){const a=side<0?-42:6,b=side<0?-6:42;const os=[];for(let x=a+3;x<b;x+=6){os.push({kind:'arch',u:x,bottom:1.0,radius:1.05,spring:1.95});os.push({kind:'rect',u:x,bottom:5.8,width:2.1,top:8.9});}dressedWall('civic-front-'+side,'z',-45.75,a,b,0,10.8,.6,os);cornice('z',-45.75,a,b,10.65);strip('z',-45.75,a,b,4.9,.67,.16);strip('z',-45.75,a,b,.42,.78,.38,'stone');
  dressedWall('civic-rear-'+side,'z',-30.25,a,b,0,10.8,.5,[...Array.from({length:6},(_,i)=>(Math.abs(a+3+i*6)===39?{kind:'rect',u:a+3+i*6,bottom:0,width:3.6,top:4.5,glazed:false}:{kind:'rect',u:a+3+i*6,bottom:1.05,width:2.1,top:3.8})),...Array.from({length:6},(_,i)=>({kind:'rect',u:a+3+i*6,bottom:5.8,width:2.1,top:8.9}))]);
  B.set('walls','civic-quoin-'+side);for(let x=a;x<=b;x+=12){box([x,5.15,-45.96],[.32,10.3,.20],'stone');for(let y=.7;y<10;y+=.55)box([x,y,-46.12],[.35,.025,.07],'trim');}
  B.set('roofs','civic-hip-'+side);hipRoof(B,a-.35,b+.35,-46.15,-29.85,10.95,14.6,'x');
  B.set('upper-floors','civic-upper-'+side);B.extrude(rectangle(a+.3,-45.45,b-.3,-30.55),.26,(x,z,d)=>[x,4.67+d,z],'floor',[rectangle(side*28-1.8,-40.6,side*28+1.8,-34.35)]);
  for(const x of side<0?[-36,-18]:[18,36]){B.set('walls','civic-chimney-'+x);box([x,13.4,-34.2],[1.5,4.5,1.35],'brick');box([x,15.7,-34.2],[1.8,.22,1.6],'trim');for(const dx of[-.42,.42])B.cyl([x+dx,16.17,-34.2],.2,.7,'brick',.23,12);}
 }
 for(const x of[-41.75,41.75]){dressedWall('civic-end-'+x,'x',x,-45.5,-30.3,0,10.8,.5,[{kind:'arch',u:-38,bottom:1,radius:1.15,spring:1.9},{kind:'rect',u:-38,bottom:5.8,width:2.3,top:8.9}]);cornice('x',x,-45.8,-30.1,10.65);}
 // Clock entrance: four actual open portals at ground level; upper stages align with corner piers.
 const towerOs=[{kind:'arch',u:0,bottom:0,radius:2.4,spring:2.7,glazed:false}];dressedWall('tower-front','z',-46.2,-6,6,0,15.5,.8,[...towerOs,{kind:'rect',u:0,bottom:7.4,width:2.7,top:11.1}],'stone');dressedWall('tower-back','z',-30,-6,6,0,15.5,.8,towerOs,'stone');
 for(const x of[-5.6,5.6])dressedWall('tower-side-'+x,'x',x,-46.2,-30,0,15.5,.8,[{kind:'arch',u:-36,bottom:0,radius:1.5,spring:2.5,glazed:false},{kind:'rect',u:-31.7,bottom:0,width:2.4,top:3.1,glazed:false},{kind:'rect',u:-38,bottom:7.4,width:2.2,top:10.8}],'stone');
 for(const z of[-46.2,-30]){cornice('z',z,-6.25,6.25,6.2);cornice('z',z,-6.25,6.25,14.6);}for(const x of[-5.6,5.6]){cornice('x',x,-46.2,-30,6.2);cornice('x',x,-46.2,-30,14.6);}
 B.set('walls','tower-rusticated-corners');for(const x of[-5.72,5.72])for(const z of[-46.05,-30.15]){box([x,7.7,z],[.9,15.4,.9],'stone');for(let yy=.5;yy<14.4;yy+=.55)box([x,yy,z],[.96,.035,.96],'trim');}for(const z of[-46.2,-30])strip('z',z,-5.8,5.8,12.4,.85,.22);
 B.set('walls','clock-stage');for(const z of[-43.65,-32.55]){dressedWall('clock-face-'+z,'z',z,-4.8,4.8,14.6,21.8,.45,[-3.45,3.45].map(u=>({kind:'rect',u,bottom:16.3,width:.62,top:20.6,glazed:false})),'stone');for(const x of[-3.45,3.45])for(let yy=16.4;yy<20.6;yy+=.22)box([x,yy,z],[.62,.07,.29],'darkIron');}for(const x of[-4.8,4.8]){dressedWall('clock-return-'+x,'x',x,-43.65,-32.55,14.6,21.8,.45,[-42.1,-34.1].map(u=>({kind:'rect',u,bottom:16.3,width:.62,top:20.6,glazed:false})),'stone');for(const z of[-42.1,-34.1])for(let yy=16.4;yy<20.6;yy+=.22)box([x,yy,z],[.29,.07,.62],'darkIron');}for(const x of[-4.7,4.7])for(const z of[-43.65,-32.55])box([x,18.6,z],[.7,7.8,.7],'trim');clockFace(0,20,-43.84);clockFace(-5.12,20,-38.1,'x');clockFace(5.12,20,-38.1,'x');
 for(const z of[-43.85,-32.35])cornice('z',z,-5.1,5.1,22.35);for(const x of[-4.9,4.9])cornice('x',x,-43.9,-32.3,22.35);
 B.set('roofs','clock-roof');hipRoof(B,-5.25,5.25,-44.25,-31.95,22.5,25.3,'z','roof');B.lathe([0,25.25,-38.1],[[.6,0],[.65,.15],[.28,.35],[.22,1.3],[.1,1.65],[.03,2.1]],'brass',16);
 // Public vestibule has articulated vault and lantern, not a solid hidden cube.
 floorRect('vestibule',-5.1,5.1,-45.8,-30.4);barrel(-5.1,5.1,-45.7,-30.4,5.4,3.2);B.set('interior','vestibule-lamp');lantern(0,-38,7.4);
 // HALL: three equal square groin bays on six aligned piers; side staff aisles have lower barrel vaults.
 floorRect('hall-floor',-13,13,-30,12);B.set('floors','hall-floor-inlay');for(const x of[-6.5,6.5])box([x,.014,-9],[.24,.026,42],'terrazzo');for(const z of[-27,-15,-3,9])box([0,.018,z],[13,.025,.18],'terrazzo');for(let z=-28;z<11;z+=1.5)for(let x=-4.5;x<=4.5;x+=1.5)if((Math.round((x+4.5)/1.5)+Math.round((z+28)/1.5))%2===0)box([x,.012,z],[1.44,.016,1.44],'paving');
 for(const x of[-12.75,12.75]){const windows=[];for(const z of[-21,-9,3]){windows.push({kind:'arch',u:z,bottom:1.8,radius:1.65,spring:2.2});}dressedWall('hall-outer-'+x,'x',x,-30,12,0,7.3,.5,windows,'plaster');cornice('x',x,-30,12,7.1,.65);}
 for(const x of[-6.05,6.05]){const os=DESIGN.hall.bays.map(z=>({kind:'arch',u:z,bottom:7.4,radius:2.55,spring:1.75}));dressedWall('hall-clerestory-'+x,'x',x,-27,9,7.4,12.8,.3,os,'stone');cornice('x',x,-27,9,12.7,.65);}
 B.set('structure','hall-piers');for(const x of[-6,6])for(const z of[-27,-15,-3,9]){col(x,z,0,7.7,.38);box([x,.7,z],[1.4,1.4,1.4],'stone');for(const k of[-1,1])box([x+k*.49,4.2,z],[.14,5.5,.5],'trim');}
 // Side arcade spandrels explicitly close the gap to the lower aisle vaults.
 for(const sx of[-6.3,6.3]){B.set('walls','nave-arcade-'+sx);for(const cz of DESIGN.hall.bays){const a=cz-6,b=cz+6,r=5.25,spring=4.4,rise=2.7,pts=[[a,0],[cz-r,0],[cz-r,spring]];for(let i=1;i<=48;i++){const t=Math.PI-i*Math.PI/48;pts.push([cz+r*Math.cos(t),spring+rise*Math.sin(t)]);}pts.push([cz+r,0],[b,0],[b,7.7],[a,7.7]);B.extrude(pts,.32,wallMap('x',sx),'plaster');archRib('x',sx,cz,2*r,spring,rise,.16,.45,'trim');}cornice('x',sx,-27,9,7.65,.6);}
 for(const z of DESIGN.hall.bays)groin(0,z,12,7.7,4.4);
 for(const s of[-1,1]){barrel(s<0?-12.5:6.6,s<0?-6.6:12.5,-27,9,4.9,2.1);B.set('structure','aisle-ribs-'+s);for(const z of[-27,-15,-3,9])archRib('z',z,s*9.55,5.9,4.9,2.1,.12,.2);}
 for(const z of[-29.7,11.7])dressedWall('hall-end-'+z,'z',z,-12.5,12.5,0,12.8,.45,[{kind:'arch',u:0,bottom:0,radius:2.5,spring:3,glazed:false},{kind:'arch',u:-9.5,bottom:0,radius:1.25,spring:2.5,glazed:false},{kind:'arch',u:9.5,bottom:0,radius:1.25,spring:2.5,glazed:false},{kind:'arch',u:0,bottom:8.1,radius:2.1,spring:1.3}],'plaster');
 B.set('roofs','hall-roofs');// Two continuous roof slopes and hip ends, with one measured central opening.
 const ry=x=>15.9-Math.abs(x)*2.95/6.6;for(const side of[-1,1]){const xa=side<0?-6.6:0,xb=side<0?0:6.6;for(const[za,zb]of[[-21.5,-11],[-7,3.5]])B.prism([[xa,ry(xa),za],[xb,ry(xb),za],[xb,ry(xb),zb],[xa,ry(xa),zb]],.16,'roof');const outer=side*6.6,inner=side*2;B.prism([[outer,ry(outer),-11],[inner,ry(inner),-11],[inner,ry(inner),-7],[outer,ry(outer),-7]],.16,'roof');B.prism([[side*6.6,12.95,-28.1],[0,15.9,-21.5],[side*6.6,12.95,-21.5]],.16,'roof');B.prism([[side*6.6,12.95,3.5],[0,15.9,3.5],[side*6.6,12.95,10.1]],.16,'roof');}B.prism([[-6.6,12.95,-28.1],[6.6,12.95,-28.1],[0,15.9,-21.5]],.16,'roof');B.prism([[-6.6,12.95,10.1],[0,15.9,3.5],[6.6,12.95,10.1]],.16,'roof');
 B.set('vaults','central-daylight-shaft');for(const x of[-2.1,2.1])box([x,13.55,-9],[.18,3.4,4.2],'plaster');for(const z of[-11.1,-6.9])box([0,13.55,z],[4.2,3.4,.18],'plaster');B.set('roofs','central-lantern');for(const x of[-2.1,2.1]){box([x,16.5,-9],[.08,2.4,4.2],'glass');for(const z of[-11.1,-10.05,-9,-7.95,-6.9])box([x,16.5,z],[.11,2.6,.11],'iron');}for(const z of[-11.1,-6.9]){box([0,16.5,z],[4.2,2.4,.08],'glass');for(const x of[-2.1,-1.05,0,1.05,2.1])box([x,16.5,z],[.11,2.6,.11],'iron');}for(const y of[15.25,17.8]){box([0,y,-11.1],[4.4,.15,.18],'iron');box([0,y,-6.9],[4.4,.15,.18],'iron');box([-2.1,y,-9],[.18,.15,4.4],'iron');box([2.1,y,-9],[.18,.15,4.4],'iron');}hipRoof(B,-2.4,2.4,-11.4,-6.6,17.9,19.1,'z','copper');
 B.set('roofs','hall-side-roofs');for(const s of[-1,1]){const x0=s<0?-13.3:6.6,x1=s<0?-6.6:13.3;B.prism([[x0,s<0?7.5:9,-30],[x1,s<0?9:7.5,-30],[x1,s<0?9:7.5,12],[x0,s<0?7.5:9,12]],.15,'roof');}
 // Hall roof lanterns cut through neither vault nor support: two daylight strips sit above clerestory aisles.
 B.set('interior','hall-joinery');for(const s of[-1,1]){panelledCounter(s*8.5,-8.7,32.0);for(const z of[-21,-9,3]){cabinet(s*12.35,z,4.5,2.8,'x');}for(let z=-25;z<=7;z+=3)box([s*12.44,.72,z],[.055,1.44,2.92],'wood');}
 B.set('interior','hall-lamps');for(const z of[-21,-9,3]){rod([0,z===-9?17.8:12.0,z],[0,10.7,z],.025,'brass');lantern(0,z,10.7);}
 B.set('interior','hall-benches');for(const s of[-1,1])for(const z of[-24,6]){box([s*3.3,.49,z],[.72,.13,3.1],'wood');box([s*3.65,.92,z],[.075,.8,3.1],'wood');for(const zz of[z-1.2,z+1.2]){box([s*3.3,.23,zz],[.55,.46,.12],'iron');}}
 // Two cloisters: same bay rhythm and actual connected openings. They stop below the hall clerestory.
 for(const s of[-1,1]){
  const xc=s*38.5;floorRect('cloister-'+s,xc-3.0,xc+3.0,-30,16);const inner=s*35.5,outer=s*41.5;const os=Array.from({length:7},(_,i)=>({kind:'arch',u:-26.5+i*6,bottom:0,radius:2.15,spring:2.9,glazed:false}));dressedWall('cloister-arcade-'+s,'x',inner,-30,12,0,6.6,.55,os,'stone');cornice('x',inner,-30,12,6.5,.8);
  dressedWall('cloister-outer-'+s,'x',outer,-30,12,0,6.6,.5,os,'stone');cornice('x',outer,-30,12,6.5,.8);
  barrel(xc-2.7,xc+2.7,-29.7,11.7,4.6,1.55);B.set('structure','cloister-ribs-'+s);for(let z=-29.5;z<12;z+=6)archRib('z',z,xc,5.4,4.6,1.55,.10,.18);
  B.set('roofs','cloister-roof-'+s);hipRoof(B,xc-3.3,xc+3.3,-30.3,12.0,6.85,8.45,'z');
  B.set('interior','cloister-lamps');for(const z of[-23.5,-11.5,.5,12.5])lantern(xc,z,5.8);
 }
 // End connections close the courts and connect the central hall to both side galleries.
 floorRect('transfer-floor',-45,45,12,20);
 const rearFront=[];for(const x of[-38.5,-24,-9.5,0,9.5,24,38.5])rearFront.push({kind:'arch',u:x,bottom:0,radius:2.0,spring:2.7,glazed:false});dressedWall('transfer-court-face','z',12.25,-45,45,0,7.3,.5,rearFront,'stone');cornice('z',12.25,-45,45,7.2,.7);
 B.set('roofs','transfer-gallery-roof');box([0,7.5,16],[90,.28,8.2],'roof');
 for(const x of[-44.75,44.75])dressedWall('transfer-end-'+x,'x',x,12.25,19.75,0,7.3,.5,[{kind:'arch',u:16,bottom:0,radius:1.8,spring:2.6,glazed:false}]);
 // Offices are enclosed working rooms plus rear corridor, with paired desks, archive walls and meeting tables.
 for(const [id,x0,x1]of[['records',-41,-24],['correspondence',-23,-7],['registrar',7,23],['superintendent',24,41]]){
  zones.push({id,rect:[x0,x1,-45,-31],use:'office',levels:[0,4.8]});for(const y of[0,4.8]){B.set('interior','office-'+id+'-'+y);const xc=(x0+x1)/2;for(const x of[xc-3.6,xc+3.6]){if(Math.abs(Math.abs(x)-28.9)<.1)continue;desk(x,-39,2.4,1.15,y);chair(x,-37.9,y);}cabinet(xc,-44.9,x1-x0-1.5,3.2,'z',y);box([xc,y+.79,-35.0],[5.4,.15,1.65],'wood');for(const x of[xc-1.7,xc+1.7])chair(x,-33.8,y);for(const x of[x0,x1]){B.set('walls','office-partition-'+id);wall(B,'x',x,-45.4,-33, y,y+4.5,.16,[],'plaster');}
   B.set('walls','office-corridor-'+id);wall(B,'z',-33,x0,x1,y,y+4.5,.16,[{kind:'rect',u:xc,bottom:y,width:1.5,top:y+2.9}],'plaster');}
 }
 // Two visible dog-leg stairs connect front office floors; landings share the corridor datum.
 for(const s of[-1,1]){B.set('stairs','office-stair-'+s);const x=s*28;for(let flight=0;flight<2;flight++){const start=flight?-35.9:-40.4,sign=flight?-1:1,yy=flight*2.4;const pts=[[start,yy-.18],[start,yy+.16]];for(let i=0;i<15;i++){pts.push([start+sign*(i+1)*.3,yy+(i+1)*.16]);if(i<14)pts.push([start+sign*(i+1)*.3,yy+(i+2)*.16]);}pts.push([start+sign*4.5,yy+2.15],[start,yy-.18]);B.extrude(pts,1.6,(z,y,d)=>[x+(flight?.9:-.9)+d,y,z],'stone');for(const side of[-1,1])rod([x+(flight?.9:-.9)+side*.72,yy+1,start],[x+(flight?.9:-.9)+side*.72,yy+3.4,start+sign*4.5],.035,'iron');}box([x,2.27,-35.15],[3.5,.26,1.5],'stone');box([x,4.67,-41.15],[3.5,.26,1.5],'stone');}
 // WAREHOUSE: five transverse 18 m spans, clear 90×50 m allocation; columns deducted explicitly below.
 floorRect('warehouse-floor',-45,45,20,70,0,'paving');
 for(const z of[19.75,70.25]){const os=[];for(const x of[-36,-18,0,18,36])os.push({kind:'arch',u:x,bottom:0,radius:2.3,spring:3,glazed:false});for(const x of[-27,-9,9,27])os.push({kind:'arch',u:x,bottom:2.3,radius:1.5,spring:2.4});dressedWall('warehouse-end-'+z,'z',z,-45.3,45.3,0,9,.5,os);cornice('z',z,-45.5,45.5,8.9,.75);}
 for(const x of[-45.25,45.25]){const os=[];for(let z=25;z<70;z+=10)if(!(x>0&&z===65))os.push({kind:'arch',u:z,bottom:2.3,radius:1.6,spring:2.4});if(x>0)os.push({kind:'arch',u:65,bottom:0,radius:2.0,spring:2.5,glazed:false});dressedWall('warehouse-side-'+x,'x',x,20,70,0,9,.5,os);cornice('x',x,20,70,8.9,.75);}
 let columnArea=0;
 for(let x=-45;x<=45;x+=18)for(let z=20;z<=70;z+=5){B.set('structure','warehouse-column');col(x,z,0,8.6,.19,'iron');const halfBase=.19*3/2;columnArea+=rectangleIntersection([-45,45,20,70],[x-halfBase,x+halfBase,z-halfBase,z+halfBase]);}
 for(let k=0;k<5;k++){const x0=-45+k*18,x1=x0+18,c=x0+9;
  B.set('roofs','warehouse-barrel-'+k);
  for(let i=0;i<36;i++){const a=i*Math.PI/36,b=(i+1)*Math.PI/36;const xA=c+9.12*Math.cos(a),xB=c+9.12*Math.cos(b),yA=9.05+4.25*Math.sin(a),yB=9.05+4.25*Math.sin(b);const mat=i>=15&&i<21?'glass':'roof';B.prism([[xA,yA,19.5],[xB,yB,19.5],[xB,yB,70.5],[xA,yA,70.5]],.11,mat);}
  for(const z of[19.72,70.28]){B.set('walls','warehouse-lunette-'+k);const p=[[x0,9],[x1,9]];for(let i=0;i<=36;i++){const a=i*Math.PI/36;p.push([c+9*Math.cos(a),9+4.25*Math.sin(a)]);}B.extrude(p,.36,wallMap('z',z),'brick');archRib('z',z,c,18,9,4.25,.17,.54,'stone');}
  B.set('structure','warehouse-arched-truss-'+k);
  for(let z=20;z<=70;z+=5){archRib('z',z,c,18,8.85,4.15,.11,.15,'iron');archRib('z',z,c,17.8,8.55,3.7,.09,.14,'iron');beam([x0,8.55,z],[x1,8.55,z],.1,.16,'iron');for(let i=1;i<12;i++){const a=i*Math.PI/12,x=c+8.9*Math.cos(a),y=8.55+3.7*Math.sin(a);rod([x,8.55,z],[x,y,z],.027,'iron');if(i<11){const aa=(i+1)*Math.PI/12;rod([x,y,z],[c+8.9*Math.cos(aa),8.55,z],.025,'iron');}}}
  for(const xx of[-6,-3,0,3,6]){const y=9.05+4.25*Math.sqrt(1-xx*xx/(9.12*9.12));beam([c+xx,y,19.5],[c+xx,y,70.5],.085,.09,'iron');}
 }
 function rack(x,z,length=11){B.set('interior','warehouse-rack');const bays=Math.ceil(length/2);for(let j=0;j<=bays;j++)for(const dz of[-.8,.8])box([x-length/2+j*length/bays,2.8,z+dz],[.075,5.6,.075],'iron');for(let l=0;l<5;l++){const y=.35+l*1.1;box([x,y,z],[length,.07,1.65],'woodLight');for(const dz of[-.85,.85])box([x,y-.09,z+dz],[length,.12,.055],'iron');const bins=Math.floor(length/1.8);for(let j=0;j<bins;j++){if((j+l+Math.round(x+z))%4===0)continue;const xx=x-length/2+(j+.5)*length/bins;const h=.38+((j+l)%3)*.14;box([xx,y+h/2+.04,z],[1.05,h,.8],(j+l)%3?'wood':'paper');box([xx,y+h*.5,z-.408],[.28,.14,.016],'cream');}}for(const dx of[-length/2,length/2]){rod([x+dx,.4,z-.75],[x+dx,5,z+.75],.025);rod([x+dx,.4,z+.75],[x+dx,5,z-.75],.025);}}
 for(const x of[-36,-18,18,36])for(const z of[27,32,42,47,57,62])rack(x,z,12);for(const x of[-6.8,6.8])for(const z of[27,32,42,47,57,62])rack(x,z,7.2);
 // A clear axial aisle and three cross aisles are maintained. Goods conveyor occupies an overhead service lane, not public floor.
 B.set('interior','warehouse-sorting');for(const x of[-8,8]){desk(x,35,4.5,1.35);desk(x,53,4.5,1.35);}B.set('interior','warehouse-lamps');for(const x of[-36,-18,0,18,36])for(const z of[30,50,65])lantern(x,z,8.3);
 // VISIBLE STEAM TRANSFER: a glazed east service gallery contains receiver, line-shaft and elevated track.
 floorRect('steam-floor',45.5,52,20,70,0,'floor');dressedWall('steam-outer','x',52,20,70,0,7.7,.35,Array.from({length:8},(_,i)=>({kind:'arch',u:23+i*6,bottom:1,radius:2.1,spring:3.2})),'brick');B.set('roofs','steam-roof');B.prism([[45.4,8.9,19.8],[52.4,7.9,19.8],[52.4,7.9,70.2],[45.4,8.9,70.2]],.12,'glass');
 B.set('machinery','steam-system');for(const z of[24,36,48,60]){box([48.2,.25,z],[2.4,.5,2.8],'stone');B.cyl([48.2,2.7,z],.65,4.3,'copper',.65,24);for(const y of[.8,4.5])B.cyl([48.2,y,z],.76,.15,'brass',.76,24);rod([48.2,4.9,z],[48.2,6.8,z],.12,'copper');rod([48.2,6.8,z],[50,6.8,z],.12,'copper');}
 rod([50,6.8,21],[50,6.8,69],.16,'copper');rod([47.4,5.9,21],[47.4,5.9,69],.07,'iron');for(let z=22;z<70;z+=6){rod([47.4,5.9,z],[47.4,7.3,z],.055,'iron');const g=new T.TorusGeometry(.48,.045,8,28);g.rotateY(Math.PI/2);g.translate(47.4,5.9,z);B.add(g,'brass');for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([47.4,5.9,z],[47.4,5.9+.45*Math.sin(a),z+.45*Math.cos(a)],.022,'iron');}}
 for(const x of[46.4,47.5])beam([x,4.9,21],[x,4.9,69],.16,.18,'iron');for(const z of[29,44,59]){rod([46.95,4.9,z],[46.95,3.9,z],.04,'iron');box([46.95,3.65,z],[.85,.5,1.1],'wood');}
 // Service chimney is tied to the machinery court, subordinate to the civic tower.
 B.set('walls','steam-chimney');box([49,.35,74],[4.2,.7,4.2],'stone');B.lathe([49,.7,74],[[1.7,0],[1.7,2],[1.3,2.3],[.88,21],[1.05,21.2],[1.05,21.65],[.9,21.8],[.9,22.5],[1.05,22.6],[1.05,23],[.7,23],[.7,22.7]],'brick',32);B.cyl([49,23.55,74],.69,.03,'black',.69,24);
 B.set('site','receiving-apron');box([0,-.06,77],[94,.12,13],'paving');for(const x of[-36,-18,0,18,36]){box([x,.02,75],[5.2,.04,6],'stone');}for(const z of[83,88]){for(const dz of[-.72,.72])box([0,.09,z+dz],[112,.12,.075],'darkIron');for(let x=-56;x<56;x+=1)box([x,.01,z],[.15,.1,2],'wood');}
 // 3D route guides are off by default and cannot be mistaken for dynamic transport.
 for(const [id,mat,points]of[['public','blue',[[0,.14,-53],[0,.14,-38],[0,.14,-27],[0,.14,8]]],['staff','green',[[-38.5,.15,-31.5],[-38.5,.15,16],[-9.5,.15,16],[-9.5,.15,10]]],['goods','red',[[0,.16,80],[0,.16,66],[0,.16,37],[0,.16,16],[44,.16,16],[49,.16,24]]]]){B.set('routes',id);for(let i=1;i<points.length;i++)rod(points[i-1],points[i],.08,mat);}
 const result=B.finish();for(const m of Object.values(result.materials)){m.roughness=.83;if(m===result.materials.wood||m===result.materials.woodLight)m.roughness=.42;if(m===result.materials.brass){m.metalness=.7;m.roughness=.3;}if(m===result.materials.cream){m.emissive=new T.Color(0xe6c880);m.emissiveIntensity=.20;}}for(const o of result.root.children)if(o.userData.layer==='routes')o.visible=false;
 return{...result,proof:{revision:REVISION,design:DESIGN,triangles:result.triangles,meshes:result.root.children.length,elements:result.elements.length,openings,supports,relations,zones,warehouse:{allocation:4500,columnFootprint:columnArea,remainingArea:4500-columnArea,definition:'90×50 m internal allocation, minus intersected actual 0.57 m square column bases; shelving and access aisles included',capacityCertified:false},artisticAcceptance:false,engineeringCertification:false,oldModelUntouched:true}};
}
