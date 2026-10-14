import {D} from './dimensions.mjs';
import {kit,roundedShape,sweptSurface} from './design/geometry.mjs';
import {createLettering} from './design/lettering.mjs';
import {createCorrectedNativeWheel} from './retained/native-a4/running-gear/cast-wheels.mjs';
import {createForgedRod,placeForgedRod,createCrosshead} from './retained/native-a4/running-gear/forged-rods.mjs';
import {createRailGeometry,wheelRailDatums,sectionContactReport} from './retained/wheel-rail-profile.mjs';
import {contourShapes} from './retained/branding/contours-injected.mjs';
import wordmark from './retained/branding/wordmark.mjs';
import angelL from './retained/branding/angel_left.mjs';
import angelR from './retained/branding/angel_right.mjs';
export function buildTrain(T){
 const root=new T.Group();root.name='A6 88 · R08 native dimensioned train';
 const mat=(color,metalness=.1,roughness=.35)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const M={paint:new T.MeshPhysicalMaterial({color:'#064630',metalness:.58,roughness:.25,clearcoat:1,clearcoatRoughness:.18,side:T.DoubleSide}),gold:mat('#e9bc63',.8,.24),brass:mat('#e9bc63',.8,.24),steel:mat('#acb5bb',.85,.25),iron:mat('#283239',.65,.4),black:mat('#11191c',.1,.6),rubber:mat('#1b2426',.05,.8),red:mat('#e22a32',.4,.3),cream:mat('#d9c6a3',.05,.6),wood:mat('#76533b',.08,.44),seat:mat('#233f38',.05,.67),skin:mat('#b68b68',.02,.68),uniform:mat('#233444',.05,.65),glass:new T.MeshPhysicalMaterial({color:'#153b40',metalness:.26,roughness:.12,clearcoat:1,clearcoatRoughness:.08,transparent:true,opacity:.70,side:T.DoubleSide,depthWrite:false}),lamp:new T.MeshStandardMaterial({color:'#fff5d8',emissive:'#fff2ce',emissiveIntensity:1.5})};
 const group=(name,p=root)=>{const g=new T.Group();g.name=name;p.add(g);return g;};
 const shell=group('01 continuous R08 exterior'),interior=group('02 cab boiler oil water interior'),running=group('03 inherited wheels rods and connected suspension'),coach=group('04 integral commuter coach'),coachShell=group('04a coach removable shell',coach),coachInside=group('04b coach commuter interior',coach),connections=group('05 continuous couplings brake and service pipes');
 const K=kit(T,M,root),E=kit(T,M,shell),I=kit(T,M,interior),G=kit(T,M,running),C=kit(T,M,coachShell),P=kit(T,M,coachInside),J=kit(T,M,connections),L=createLettering(T,M);
 // A single rounded-superellipse section field owns every exterior surface.
 const stations=[[0,.16,.48,.78],[.8,.67,.31,1.43],[2.1,1.16,.29,2.43],[3.4,1.39,.29,2.94],[4.25,1.45,.29,3.25],[5.5,1.475,.29,4.02],[6.4,1.475,.29,4.15],[8.2,1.475,.29,4.15],[10.15,1.475,.29,4.06],[11.2,1.475,.29,3.98],[20.1,1.475,.29,3.98],[20.32,1.475,.29,3.98],[27.60,1.475,.29,3.98],[28.30,1.45,.31,3.96],[29.10,1.45,1.07,3.96],[29.80,1.475,1.07,3.98],[51.40,1.475,1.07,3.98],[52.10,1.45,1.07,3.96]];
 function smoothAt(x){let i=0;while(i<stations.length-2&&x>stations[i+1][0])i++;let a=stations[i],b=stations[i+1],t=Math.min(1,Math.max(0,(x-a[0])/(b[0]-a[0])));return a.slice(1).map((v,k)=>{const prev=stations[Math.max(0,i-1)],next=stations[Math.min(stations.length-1,i+2)],m1=(b[k+1]-prev[k+1])/(b[0]-prev[0])*(b[0]-a[0]),m2=(next[k+1]-a[k+1])/(next[0]-a[0])*(b[0]-a[0]);const q=(2*t**3-3*t*t+1)*v+(t**3-2*t*t+t)*m1+(-2*t**3+3*t*t)*b[k+1]+(t**3-t*t)*m2;return Math.max(Math.min(v,b[k+1]),Math.min(Math.max(v,b[k+1]),q));});}
 const halfAt=(x,z)=>{const[w,lo,hi]=smoothAt(x),u=Math.max(-1,Math.min(1,(z-(lo+hi)/2)/((hi-lo)/2)));const n=x>=29.10&&u<0?18:4.8;return w*Math.pow(Math.max(0,1-Math.pow(Math.abs(u),n)),1/n);};
 const roofAtY=(x,y)=>{const[w,lo,hi]=smoothAt(x);return(lo+hi)/2+(hi-lo)/2*Math.pow(Math.max(0,1-Math.pow(Math.abs(y)/w,4.8)),1/4.8);};
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 const cutAt=x=>{const lo=smoothAt(x)[1];if(x<8.02||x>18.12)return lo;if(x<8.57)return lo+(2.17-lo)*ease((x-8.02)/.55);if(x<17.43)return 2.17;return lo+(2.17-lo)*(1-ease((x-17.43)/.69));};
 const skin=(Q,x0,x1,z0,z1,material,name,nu=120,nv=42,inset=0)=>{const parts=[];for(const sign of[-1,1]){const o=surface(Q,x0,x1,(x,v)=>{const low=typeof z0==='function'?z0(x):z0,high=typeof z1==='function'?z1(x):z1,z=low+(high-low)*v;return[x,sign*Math.max(0,halfAt(x,z)+inset),z]},material,name+' '+sign,nu,nv);parts.push(o);}return parts;};
 const sectionLoop=(x,z0,z1,inset=0)=>{const pts=[];for(let i=0;i<=40;i++){const z=z0+(z1-z0)*i/40;pts.push([x,Math.max(0,halfAt(x,z)-inset),z]);}for(let i=39;i>=0;i--){const z=z0+(z1-z0)*i/40;pts.push([x,-Math.max(0,halfAt(x,z)-inset),z]);}return pts;};
 function cap(Q,x,lo,hi,inset,mat,name){const pts=sectionLoop(x,lo,hi,inset),shape=new T.Shape(pts.map(p=>new T.Vector2(p[1],p[2]))),g=new T.ExtrudeGeometry(shape,{depth:.045,bevelEnabled:false});g.applyMatrix4(new T.Matrix4().set(0,0,1,x,1,0,0,0,0,1,0,0,0,0,0,1));return Q.add(g,mat,name);}
 function surface(owner,x0,x1,point,material,name,n=100,m=32){return owner.add(sweptSurface(T,(u,v)=>point(x0+(x1-x0)*u,v),n,m),material,name);}
 // Material boundaries share the very same loft, so windshield and nose meet without a ledge.
 skin(E,0,4.25,x=>smoothAt(x)[1],x=>smoothAt(x)[2],'paint','one-field double-curved nose',150,56);
 skin(E,4.25,10.15,cutAt,D.cabGlassSill,'paint','continuous cab lower shell with swept wheel opening',130,28);
 skin(E,10.15,20.10,cutAt,x=>smoothAt(x)[2],'paint','continuous boiler body loft and wheel opening',180,56);
 const glass=skin(E,4.25,10.15,D.cabGlassSill,x=>smoothAt(x)[2],'glass','closed thick tinted panoramic canopy',130,52,0);for(const o of glass)o.renderOrder=8;
 const innerGlass=M.glass.clone();innerGlass.opacity=.14;const innerCanopy=skin(E,4.25,10.15,D.cabGlassSill+.014,x=>smoothAt(x)[2],innerGlass,'canopy inner glass wall 18 mm',90,32,-.010);for(const o of innerCanopy)o.position.z=-.018;
 surface(E,4.30,10.15,(x,v)=>{const y=-.36+.72*v;return[x,y,roofAtY(x,y)+.013]},'paint','continuous dark green canopy roof spine',100,20);
 for(const side of[-1,1]){
  E.pipe(Array.from({length:80},(_,i)=>{const x=4.25+5.9*i/79;return[x,side*(halfAt(x,D.cabGlassSill)+.022),D.cabGlassSill]}),.025,'steel','low panoramic window surround');
  E.pipe(Array.from({length:140},(_,i)=>{const x=.15+19.95*i/139,z=Math.min(D.goldStripe,smoothAt(x)[2]-.23);return[x,side*(halfAt(x,z)+.016),z]}),.023,'gold','gold belt follows actual skin');
  for(const x of[4.25,5.50,7.10,8.65,10.15]){const hi=smoothAt(x)[2];E.pipe(Array.from({length:48},(_,i)=>{const z=D.cabGlassSill+(hi-D.cabGlassSill)*i/47;return[x,side*(halfAt(x,z)+.022),z]}),x===4.25||x===10.15?.032:.015,'steel','flush canopy arch follows shared loft');}
  for(const [a,b]of[[.35,8.56],[17.44,20.1]])E.pipe(Array.from({length:65},(_,i)=>{const x=a+(b-a)*i/64,z=cutAt(x)+.04;return[x,side*(halfAt(x,z)+.006),z]}),.016,'steel','swept curved skirt edge');
  for(let q=0;q<3;q++){const x=10.70+q*.34;skin(E,x-.07,x+.07,2.93,3.44,'black','rearward recessed cooling gill '+q,8,18,.016);}
  addBrand(wordmark,6.62,[15.12,side*(halfAt(15.12,3.03)+.020),3.03],side,M.gold,shell,'existing Flying Hongkonger identity');
  const numberY=side*(halfAt(2.8,1.70)+.020),number=L.relief(shell,'88',.58,.010,[2.8,numberY,1.70],side,M.gold);number.updateMatrix();number.geometry=number.geometry.clone();number.geometry.applyMatrix4(number.matrix);number.position.set(0,0,0);number.rotation.set(0,0,0);number.scale.set(1,1,1);const np=number.geometry.attributes.position;for(let j=0;j<np.count;j++){const depth=side*(np.getY(j)-numberY);np.setY(j,side*(halfAt(np.getX(j),np.getZ(j))+.018+depth));}number.geometry.computeVertexNormals();number.userData.surfaceConformed=true;
 }
 function addBrand(recipe,width,at,side,material,parent,name){const scale=width/recipe.size_px[0],g=new T.ExtrudeGeometry(contourShapes(T,recipe),{depth:.009/scale,bevelEnabled:false,curveSegments:1});g.scale(scale,scale,scale);g.translate(-width/2,width*recipe.size_px[1]/recipe.size_px[0]/2,0);const o=new T.Mesh(g,material);o.name=name;o.applyMatrix4(L.sideMatrix(side,at));o.userData={source:recipe.source_sha256||recipe.asset,originalContours:true,widthM:width};parent.add(o);return o;}
 // Single high-forward driver position, full-size seat, generous work zone behind.
 I.box([7.15,0,D.cabFloor-.05],[6.02,2.72,.10],'iron','cab raised structural deck');
 I.box([7.22,0,D.cabFloor+.025],[5.78,2.62,.025],'wood','cab walnut floor');
 function seat(Q,x,y,z,front=-1){const g=group('full scale 480 mm seat',Q===I?interior:coachInside),S=kit(T,M,g);S.box([x,y,z+.34],[.45,.48,.10],'seat','upholstered cushion');const b=S.box([x-front*.20,y,z+.70],[.10,.48,.66],'seat','sculpted high back');b.rotation.y=front*.09;S.rod([x,y,z-.0],[x,y,z+.30],.055,'steel','seat pedestal');if(Q===I)for(const s of[-1,1])S.pipe([[x-front*.17,y+s*.26,z+.40],[x+front*.16,y+s*.26,z+.45]],.021,'gold','seat arm');return g;}
 seat(I,5.7,0,D.cabFloor,-1);seat(I,8.0,.99,D.cabFloor,-1);I.box([8.0,.99,2.43],[.14,.45,.48],'seat','foldable rear seat back');
 const desk=I.box([5.04,0,2.86],[.78,1.35,.15],'black','single central pilot instrument deck');desk.rotation.y=-.15;
 for(let i=0;i<5;i++){const y=-.48+i*.24;I.rod([5.01,y,2.94],[4.99,y,2.99],.088,'gold','inset analogue instrument bezel',32);I.rod([5.01,y,2.985],[4.99,y,3.0],.071,'cream','instrument face',32);}
 I.torus([5.32,0,3.02],.18,.018,'black','pilot control wheel',[1,0,0]);I.rod([5.1,0,2.78],[5.30,0,3.02],.027,'steel','control column');
 cap(I,9.82,D.cabFloor,3.98,.09,'iron','sealed bulkhead follows continuous outer shell');
 for(const s of[-1,1]){I.pipe([[9.75,s*.82,2.10],[9.75,s*.82,3.68],[9.75,s*.34,3.68]],.033,'gold','full height steam service pipe');I.torus([9.68,s*.73,3.00],.24,.026,'red','large startup valve 480 mm',[1,0,0]);for(let j=0;j<5;j++){const a=j*Math.PI*2/5;I.rod([9.66,s*.73,3.0],[9.66,s*.73+.22*Math.cos(a),3+.22*Math.sin(a)],.012,'red','valve spoke');}}
 for(let i=0;i<3;i++)I.rod([9.72,-.36+i*.36,3.49],[9.65,-.36+i*.36,3.49],.12,'cream','backhead instrument',48);
 I.box([8.70,0,D.cabFloor+.04],[2.05,1.05,.008],new T.MeshStandardMaterial({color:'#b18c46',transparent:true,opacity:.15}),'clear startup valve standing work zone 2.05 x 1.05 m');
 // The sealed combustion/boiler volume is aft of cab; oil/water is in the tender.
 I.rod([10.50,0,3.04],[18.95,0,3.04],.88,'iron','diesel-fired steam generator envelope',64);
 for(const x of[11.2,13,14.8,16.6,18.3])I.torus([x,0,3.04],.895,.022,'steel','boiler support band',[1,0,0]);
 for(const x of D.steamOutlets){E.rod([x,0,3.94],[x+.10,0,4.32],.25,'iron','twin rear steam outlet',64,.31);E.torus([x+.10,0,4.32],.295,.025,'gold','outlet lip');E.rod([x+.10,0,4.324],[x+.10,0,4.326],.258,'black','open dark outlet throat',48);}
 // Reuse the actual wheel tread/flange and forged-rod components; 4 axle layout is newly declared.
 const dat=wheelRailDatums({gaugeM:D.gauge,railTopM:0}),wheels=[],rodLinks=[],crankPins=[],mains=[];
 function hub(r){const g=new T.Group();g.add(new T.Group(),new T.Group());for(const [rr,h]of[[r*.145,.23],[r*.085,.036]]){const m=new T.Mesh(new T.CylinderGeometry(rr,rr,h,32));m.rotation.z=Math.PI/2;g.add(m);}return g;}
 function axle(x,r,driver=false,name='axle'){G.rod([x,-dat.wheelReferenceAbsM,r],[x,dat.wheelReferenceAbsM,r],.085,'steel',name+' solid axle');for(const s of[-1,1]){const w=createCorrectedNativeWheel(T,{sourceWheel:hub(r),sourceRadius:r,radiusM:r,side:s,driver,closedDisc:!driver,spokes:20,steel:M.steel,cast:M.iron});w.position.set(x,s*dat.wheelReferenceAbsM,r);w.name=name+' '+s;running.add(w);wheels.push({object:w,x,r,driver,side:s});G.box([x,s*.57,r],[.24,.21,.26],'iron',name+' bearing box');G.rod([x,s*.57,r+.13],[x,s*.57,r+.41],.08,'steel',name+' suspension connection');
 if(driver){G.box([x,s*.57,r+.46],[1.15,.12,.11],'iron','laminated suspension pack');G.rod([x-.50,s*.57,r+.40],[x-.50,s*.57,1.77],.025,'steel','suspension hanger');G.rod([x+.50,s*.57,r+.40],[x+.50,s*.57,1.77],.025,'steel','suspension hanger');const b=G.box([x+.96,s*dat.wheelReferenceAbsM,r-.14],[.075,.13,.36],'black','tread brake shoe');b.rotation.y=.10;G.rod([x+.94,s*dat.wheelReferenceAbsM,1.72],[x+.96,s*dat.wheelReferenceAbsM,r-.12],.026,'steel','brake shoe hanger');}
 }}
 for(const x of D.driverAxles)axle(x,D.driverRadius,true,'driving axle');for(const x of D.guideAxles)axle(x,D.guideRadius,false,'covered guide axle');axle(D.trailingAxle,D.trailingRadius,false,'trailing support axle');
 for(const s of[-1,1]){G.box([12.4,s*.56,1.68],[14.0,.10,.34],'iron','continuous locomotive plate frame');G.rod([8.7,s*.64,.59],[17.3,s*.64,.59],.025,'steel','continuous brake pull rod');G.rod([15.8,s*.4,1.4],[16.3,s*.4,1.4],.16,'iron','air brake cylinder');G.rod([16.3,s*.4,1.4],[16.6,s*.64,.59],.03,'steel','brake cylinder operating lever');
 const yy=s*1.02;for(let i=0;i<4;i++){const o=G.rod([D.driverAxles[i],yy-.06,1.016],[D.driverAxles[i],yy+.06,1.016],.065,'gold','coupling crank journal');crankPins.push({o,i,s});}
 for(let i=0;i<3;i++){const rod=createForgedRod(T,{lengthM:D.driverSpacing,steel:M.steel,bush:M.gold,bigRadiusM:.12,smallRadiusM:.12,bigBoreM:.065,smallBoreM:.065,shankBigM:.12,shankSmallM:.12,thicknessM:.065,webM:.024,name:'articulated four-axle coupling rod '+i});running.add(rod);rodLinks.push({rod,i,s});}
 const main=createForgedRod(T,{lengthM:3.30,steel:M.steel,bush:M.gold,name:'front cylinder connecting rod'});running.add(main);const cross=createCrosshead(T,{steel:M.steel,bush:M.gold,axisYM:s*1.15,slideZM:D.driverRadius,guideCentreXM:6.3,strokeM:.66,name:'parallel guide crosshead'});running.add(cross.root);G.rod([4.9,s*1.15,D.driverRadius],[5.95,s*1.15,D.driverRadius],.24,'iron','forward steam cylinder');mains.push({rod:main,cross,s});}
 const crank=(i,s,a)=>[D.driverAxles[i]+.33*Math.cos(a+(s<0?Math.PI/2:0)),s*1.02,D.driverRadius+.33*Math.sin(a+(s<0?Math.PI/2:0))];
 function setPhase(a){for(const w of wheels)w.object.rotation.y=(w.driver?a+(w.side<0?Math.PI/2:0):a*D.driverRadius/w.r);for(const p of crankPins)p.o.position.set(...crank(p.i,p.s,a));for(const q of rodLinks)placeForgedRod(T,q.rod,crank(q.i,q.s,a),crank(q.i+1,q.s,a));for(const q of mains){const A=crank(0,q.s,a);A[1]=q.s*1.15;const B=[A[0]-Math.sqrt(3.30**2-(A[2]-D.driverRadius)**2),A[1],D.driverRadius];placeForgedRod(T,q.rod,B,A);q.cross.moving.position.set(...B);}root.userData.phase=a;}
 // Connected bogie assemblies, with pivot bolster, side beams and brake pipes.
 function bogie(cx,r,label){for(const dx of[-.90,.90])axle(cx+dx,r,false,label);G.rod([cx,0,r+.20],[cx,0,1.14],.15,'steel',label+' kingpin to underframe');G.box([cx,0,r+.31],[.42,1.45,.16],'iron',label+' bolster');for(const s of[-1,1]){G.box([cx,s*.98,r+.20],[2.45,.14,.24],'iron',label+' bogie side frame');for(const dx of[-.90,.90]){G.box([cx+dx,s*.98,r+.12],[.25,.27,.23],'iron',label+' axle journal');G.rod([cx+dx,s*.98,r+.23],[cx+dx,s*.98,r+.52],.075,'steel',label+' suspension');G.rod([cx+dx+.38,s*.85,r+.34],[cx+dx+.38,s*.85,.25],.022,'steel',label+' brake hanger');G.box([cx+dx+.39,s*.80,r],[.06,.14,.19],'black',label+' brake shoe');}G.rod([cx-1.1,s*.9,.3],[cx+1.1,s*.9,.3],.02,'steel',label+' brake pull rod');}}
 for(const cx of D.tenderBogieCentres)bogie(cx,D.tenderWheelRadius,'oil water tender');for(const cx of D.coachBogieCentres)bogie(cx,D.coachWheelRadius,'commuter coach');
 // Tender is another interval of exactly the same longitudinal section field.
 skin(E,D.tenderStart,D.tenderEnd,x=>smoothAt(x)[1],x=>smoothAt(x)[2],'paint','continuous oil water tender loft',150,56);
 for(const side of[-1,1]){E.pipe(Array.from({length:70},(_,i)=>{const x=D.tenderStart+(D.tenderEnd-D.tenderStart)*i/69;return[x,side*(halfAt(x,D.goldStripe)+.016),D.goldStripe]}),.023,'gold','matched tender belt on shared surface');addBrand(side>0?angelR:angelL,3.65,[24.4,side*(halfAt(24.4,2.99)+.020),2.99],side,M.red,shell,'existing red flying figure');}
 I.box([24.30,0,1.07],[7.9,2.40,.16],'iron','tender chassis');I.box([23.0,0,2.25],[4.1,2.10,1.85],'steel','water envelope contained inside skin');I.box([26.60,0,2.3],[2.5,2.10,1.85],'iron','diesel oil envelope contained inside skin');
 for(const x of[23.1,26.6]){E.rod([x,0,3.97],[x,0,4.06],.21,'gold','sealed filling collar');E.rod([x,0,4.06],[x,0,4.09],.23,'paint','flush oil water filling cover');}
 // Flat joining ends, not a pointed decorative dead end. Both share coach body section.
 cap(E,28.28,.43,3.95,.015,'paint','tender matched rounded rear bulkhead');cap(C,D.coachStart,1.13,3.95,.015,'paint','coach matched rounded front bulkhead');cap(C,D.coachEnd,1.13,3.95,.015,'paint','coach matched rounded rear bulkhead');
 P.box([40.60,0,D.coachFloor-.08],[23,2.77,.16],'iron','coach structural floor');P.box([40.60,0,D.coachFloor+.015],[22.85,2.73,.03],'wood','coach quiet walnut floor');
 skin(C,29.10,52.10,x=>smoothAt(x)[1],2.20,'paint','coach lower body same rounded loft',150,30);
 skin(C,29.10,52.10,2.20,3.28,'glass','coach glazing conforms to shared body',150,28,.008);
 skin(C,29.10,52.10,3.28,x=>smoothAt(x)[2],'paint','coach upper crown same section family',150,36);
 for(const side of[-1,1]){
  C.pipe(Array.from({length:100},(_,i)=>{const x=29.10+23*i/99;return[x,side*(halfAt(x,2.20)+.018),2.20]}),.023,'gold','matching coach belt');
  for(let x=29.6;x<52.0;x+=1.22)C.pipe(Array.from({length:20},(_,i)=>{const z=2.20+1.08*i/19;return[x,side*(halfAt(x,z)+.018),z]}),.031,'paint','flush body following window mullion');
  for(const x of[30.6,40.6,50.6]){skin(C,x-.59,x+.59,1.17,3.23,'paint','body conforming sliding passenger door',16,30,.012);skin(C,x-.47,x+.47,2.37,3.17,'glass','door glazing',14,20,.026);for(const dx of[-.59,.59])C.pipe(Array.from({length:24},(_,i)=>{const z=1.17+2.06*i/23;return[x+dx,side*(halfAt(x+dx,z)+.029),z]}),.009,'steel','flush door reveal');C.rod([x+.43,side*(halfAt(x+.43,1.88)+.045),1.88],[x+.43,side*(halfAt(x+.43,2.13)+.045),2.13],.014,'gold','flush door handle');}
  addBrand(wordmark,3.7,[45.3,side*(halfAt(45.3,1.64)+.020),1.64],side,M.gold,coachShell,'same Flying Hongkonger coach lettering');
 }
 const rowXs=[...Array.from({length:8},(_,i)=>32+i*.92),...Array.from({length:8},(_,i)=>42+i*.92)];
 for(const x of rowXs){for(const y of[-1.112,-.612,.612,1.112])seat(P,x,y,D.coachFloor,1);for(const y of[-1.362,-.862,-.362,.362,.862,1.362])P.pipe([[x-.17,y,D.coachFloor+.40],[x+.16,y,D.coachFloor+.45]],.012,'gold','shared commuter armrest / 0.700 m clear aisle');}
 // Refined wood ceiling strips and practical standing-room grab rails, no chandeliers.
 for(let y=-1.32;y<1.34;y+=.12)P.box([40.60,y,3.60+.12*(1-(y/1.35)**2)],[22.8,.095,.025],'wood','longitudinal walnut ceiling slat');
 for(const s of[-1,1]){P.rod([30.0,s*.38,3.20],[51.2,s*.38,3.20],.021,'gold','continuous commuter handrail');for(const x of[31,39.1,40.6,42.1,50.2]){P.rod([x,s*.68,1.15],[x,s*.68,3.22],.022,'gold','standing vestibule pole');P.rod([x,s*.68,3.21],[x,s*.38,3.21],.02,'gold','pole to roof rail junction');}for(let x=30.4;x<51;x+=1.0){P.rod([x,s*.38,3.20],[x,s*.38,2.99],.010,'black','grab strap');P.torus([x,s*.38,2.90],.09,.013,'cream','commuter hanging handhold',[1,0,0]);}P.rod([30,s*.9,3.47],[51.2,s*.9,3.47],.025,'lamp','flush warm ceiling light strip');}
 // Flexible fairings are complete surfaces, with mechanical draft links beneath.
 function joint(a,b,name,gangway=false){skin(J,a,b,gangway?1.13:.43,3.93,'rubber',name+' continuous curved flexible fairing',14,36,-.035);for(let i=0;i<9;i++){const x=a+(b-a)*i/8;J.pipe(sectionLoop(x,gangway?1.13:.43,3.93,.020),.017,'iron',name+' curved concertina rib');}J.rod([a-.18,0,.88],[b+.18,0,.88],.11,'iron',name+' continuous draft link');J.box([(a+b)/2,0,.88],[.22,.28,.22],'steel',name+' joined coupler head');for(const side of[-1,1]){J.pipe([[a-.1,side*.43,1.02],[a+.16,side*.43,.64],[b-.16,side*.43,.64],[b+.1,side*.43,1.02]],.026,'black',name+' connected brake hose');J.rod([a-.08,side*.43,1.02],[a-.08,side*.43,1.20],.016,'red',name+' brake isolating cock');}if(gangway)J.box([(a+b)/2,0,1.15],[b-a,1.15,.06],'steel',name+' bridging footplate');}
 joint(20.10,20.32,'locomotive to oil water tender');joint(28.30,29.10,'tender to coach',true);
 for(const [a,b]of[[.8,20],[20.4,28.2],[29.2,52.0]])for(const s of[-1,1])J.rod([a,s*.42,1.02],[b,s*.42,1.02],.018,'iron','continuous through brake pipe');
 J.rod([51.95,0,.88],[52.55,0,.88],.11,'iron','coach next-vehicle coupling');J.box([52.55,0,.88],[.21,.27,.20],'steel','rear knuckle interface');
 // Flush side lamps mounted on the analytic skin, no exposed fastener rows.
 for(const side of[-1,1]){const x=2.12,z=1.70,y=side*(halfAt(x,z)+.035);const housing=E.add(new T.SphereGeometry(1,32,24),'steel','flush nose lamp shell',[x,y,z]);housing.scale.set(.57,.075,.17);housing.rotation.y=-.38;const lens=E.add(new T.SphereGeometry(1,32,24),'black','sealed dark nose lamp lens',[x,y+side*.055,z]);lens.scale.set(.50,.035,.135);lens.rotation.y=-.38;for(const q of[-.23,.11]){const o=E.add(new T.SphereGeometry(1,24,16),'lamp','sealed headlight',[x+q,y+side*.085,z+q*.38]);o.scale.set(.09,.021,.08);}}
 // Exact 1.75 m comparison figures. Standing figure spans Z=0 to 1.75.
 function human(x,y,z=0,seated=false,name='1.75 m full scale adult'){const h=group(name);const H=kit(T,M,h);h.position.set(x,y,z);if(!seated){H.rod([-.10,0,.10],[-.10,0,.85],.065,'uniform','leg');H.rod([.10,0,.10],[.10,0,.85],.065,'uniform','leg');H.box([0,0,1.10],[.38,.22,.52],'uniform','torso');H.rod([-.24,0,1.30],[-.25,0,.81],.045,'uniform','left arm');H.rod([.24,0,1.30],[.25,0,.81],.045,'uniform','right arm');H.add(new T.SphereGeometry(.115,20,16),'skin','head',[0,0,1.635]);H.box([-.1,-.04,.055],[.15,.27,.11],'black','shoe');H.box([.1,-.04,.055],[.15,.27,.11],'black','shoe');}else{H.box([0,0,.79],[.36,.24,.48],'uniform','seated torso');H.add(new T.SphereGeometry(.115,20,16),'skin','seated head',[0,0,1.155]);for(const s of[-1,1]){H.rod([0,s*.11,.55],[-.35,s*.11,.42],.065,'uniform','thigh');H.rod([-.35,s*.11,.42],[-.38,s*.11,.08],.055,'uniform','shin');H.rod([-.05,s*.22,.91],[-.42,s*.24,.85],.045,'uniform','pilot arm');}}h.userData={standingHeightM:1.75,scale:1,seated};return h;}
 const comparisonHuman=human(6,-3.15);human(5.7,0,D.cabFloor,true,'full size seated pilot');
 const track=group('06 retained 56E1 rail profile / 1.435 m gauge');const R=kit(T,M,track);for(const s of[-1,1]){const g=createRailGeometry(T,{lengthM:58,centerXM:25,centerZM:s*dat.railCentreAbsM,railTopM:0,maxSegmentLengthM:4});g.rotateX(Math.PI/2);R.add(g,'steel','retained 56E1 running rail');}for(let x=-4;x<54;x+=.65){R.box([x,0,-.23],[.22,2.55,.13],'cream','track sleeper');}
 setPhase(.30);root.updateMatrixWorld(true);
 function setCutaway(on){shell.visible=!on;coachShell.visible=!on;coachInside.traverse(o=>{if(o.name==='longitudinal walnut ceiling slat')o.visible=!on;});}
 function setCoachOnly(on){shell.visible=!on;interior.visible=!on;}
 const contact=sectionContactReport({radiusM:D.driverRadius,datums:dat});
 root.userData={dimensions:D,metres:true,retainedFamilies:['56E1 rail and GAME tread/flange','native cast wheel topology','forged connecting and coupling rods','original wordmark and red flying contours'],sourceBuffersLoaded:false,kinematicClosureChecked:true,contact,status:D.status};
 return{root,M,D,shell,interior,running,coach,coachShell,coachInside,connections,track,comparisonHuman,setPhase,setCutaway,setCoachOnly,dat,rodLinks,mains,wheels,contact};
}
