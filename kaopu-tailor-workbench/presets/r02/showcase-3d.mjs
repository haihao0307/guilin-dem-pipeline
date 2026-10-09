import * as THREE from '../../garments-r04/vendor/three.module.js';
import {OrbitControls} from '../../garments-r04/vendor/OrbitControls.js';

const Y_AXIS=new THREE.Vector3(0,1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const numeric=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
const value=(row,path,fallback)=>numeric(row?.overrides?.[path],fallback);
const bool=(row,path,fallback=false)=>typeof row?.overrides?.[path]==='boolean'?row.overrides[path]:fallback;
const choice=(row,path,fallback)=>row?.overrides?.[path]??fallback;
const hash=text=>[...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,2166136261);

function disposeObject(root){
 root.traverse(o=>{o.geometry?.dispose?.();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose?.();}});
 root.clear();
}
function material(color,roughness=.78,metalness=.02){return new THREE.MeshStandardMaterial({color,roughness,metalness,side:THREE.DoubleSide});}
function mesh(geometry,mat,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
 const m=new THREE.Mesh(geometry,mat);m.position.set(...position);m.rotation.set(...rotation);m.scale.set(...scale);return m;
}
function cylinderBetween(a,b,radius,mat,radiusEnd=radius,segments=20){
 const d=b.clone().sub(a),length=d.length(),g=new THREE.CylinderGeometry(radiusEnd,radius,length,segments,1,false),m=new THREE.Mesh(g,mat);
 m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(Y_AXIS,d.normalize());return m;
}
function palette(row){
 const sets=[['#d9bc83','#a9c7ca','#d9a9c5'],['#b8c99a','#d5b58a','#a9bed8'],['#d0aac1','#9ebfc6','#d7c994'],['#b2bfd5','#d7bc86','#9fc4aa'],['#c9b28d','#9fbec8','#c4aacb']];
 return sets[hash(row.id)%sets.length];
}
function ellipseCylinder(top,bottom,height,mat,y,sx=1,sz=.64,segments=36){
 const m=mesh(new THREE.CylinderGeometry(top,bottom,height,segments,1,false),mat,[0,y,0]);m.scale.set(sx,1,sz);return m;
}
function skirtGeometry(topX,bottomX,topZ,bottomZ,height,asymmetry=0,segments=48){
 const vertices=[],indices=[],topY=height/2;
 for(let i=0;i<segments;i++){
  const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a),bottomY=-height/2+asymmetry*(.5+.5*c);
  vertices.push(topX*c,topY,topZ*s,bottomX*c,bottomY,bottomZ*s);
 }
 for(let i=0;i<segments;i++){const n=(i+1)%segments,a=i*2,b=a+1,c=n*2,d=c+1;indices.push(a,b,c,b,d,c);}
 const topCenter=vertices.length/3;vertices.push(0,topY,0);const bottomCenter=vertices.length/3;vertices.push(0,-height/2,0);
 for(let i=0;i<segments;i++){const n=(i+1)%segments;indices.push(topCenter,n*2,i*2,bottomCenter,i*2+1,n*2+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function triangle(mat,points){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p),3));g.setIndex([0,1,2]);g.computeVertexNormals();return new THREE.Mesh(g,mat);}

function createMannequin(){
 const group=new THREE.Group(),plastic=material('#b9c8cf',.36,.08),joint=material('#9fb0b8',.42,.05),dark=material('#667a84',.48,.18);
 group.name='neutral-plastic-mannequin';
 group.add(mesh(new THREE.SphereGeometry(.115,28,20),plastic,[0,1.72,0],[0,0,0],[.9,1.14,.86]));
 group.add(mesh(new THREE.CylinderGeometry(.065,.075,.14,22),joint,[0,1.54,0]));
 group.add(ellipseCylinder(.18,.205,.48,plastic,1.285,1.18,.73));
 group.add(mesh(new THREE.SphereGeometry(.22,28,18),plastic,[0,1.34,0],[0,0,0],[1.35,.85,.72]));
 group.add(mesh(new THREE.SphereGeometry(.195,28,18),plastic,[0,.99,0],[0,0,0],[1.18,.85,.78]));
 const shoulderL=new THREE.Vector3(-.27,1.45,0),elbowL=new THREE.Vector3(-.42,1.20,.018),wristL=new THREE.Vector3(-.47,.965,.04);
 const shoulderR=shoulderL.clone().multiply(new THREE.Vector3(-1,1,1)),elbowR=elbowL.clone().multiply(new THREE.Vector3(-1,1,1)),wristR=wristL.clone().multiply(new THREE.Vector3(-1,1,1));
 for(const[a,b,r]of[[shoulderL,elbowL,.064],[elbowL,wristL,.052],[shoulderR,elbowR,.064],[elbowR,wristR,.052]])group.add(cylinderBetween(a,b,r,plastic,r*.91));
 group.add(mesh(new THREE.SphereGeometry(.058,18,14),joint,wristL.toArray(),[0,0,.1],[.72,1.22,.55]));
 group.add(mesh(new THREE.SphereGeometry(.058,18,14),joint,wristR.toArray(),[0,0,-.1],[.72,1.22,.55]));
 const hipL=new THREE.Vector3(-.105,.91,0),kneeL=new THREE.Vector3(-.115,.49,.014),ankleL=new THREE.Vector3(-.105,.10,.035);
 const hipR=hipL.clone().multiply(new THREE.Vector3(-1,1,1)),kneeR=kneeL.clone().multiply(new THREE.Vector3(-1,1,1)),ankleR=ankleL.clone().multiply(new THREE.Vector3(-1,1,1));
 for(const[a,b,r]of[[hipL,kneeL,.085],[kneeL,ankleL,.065],[hipR,kneeR,.085],[kneeR,ankleR,.065]])group.add(cylinderBetween(a,b,r,plastic,r*.86));
 group.add(mesh(new THREE.SphereGeometry(.09,20,15),joint,[-.105,.045,.075],[0,0,0],[.78,.42,1.35]));
 group.add(mesh(new THREE.SphereGeometry(.09,20,15),joint,[.105,.045,.075],[0,0,0],[.78,.42,1.35]));
 group.add(mesh(new THREE.CylinderGeometry(.36,.40,.045,48),dark,[0,-.015,0]));
 group.add(mesh(new THREE.CylinderGeometry(.034,.034,.13,18),dark,[0,.055,0]));
 group.userData={shoulderL,elbowL,wristL,shoulderR,elbowR,wristR};
 return group;
}

function topGarment(row,colors){
 const group=new THREE.Group(),[primary,secondary,accent]=colors,main=material(primary,.83,0),second=material(secondary,.82,0),trim=material(accent,.78,0);
 const fitted=row.style==='FittedShirt'||row.style==='Strapless'||bool(row,'shirt.strapless',false),strapless=row.style==='Strapless'||bool(row,'shirt.strapless',false);
 const width=clamp(value(row,'shirt.width',fitted?1:1.08),.78,1.55),length=clamp(value(row,'shirt.length',1),.55,1.85),height=.39+.16*(length-.55)/1.3;
 const topY=strapless?1.39:1.47,bottomY=Math.max(.91,topY-height),center=(topY+bottomY)/2;
 group.add(ellipseCylinder(fitted?.165:.19*width,fitted?.17:.185*width,topY-bottomY,main,center,1.26,.69));
 if(strapless){group.add(mesh(new THREE.TorusGeometry(.168, .012,10,38),trim,[0,topY,0],[Math.PI/2,0,0],[1.24,1,.68]));}
 const sleeveless=strapless||bool(row,'sleeve.sleeveless',row.style==='Shirt'||row.style==='FittedShirt'),asym=row.style==='AsymmetricShirt'||bool(row,'left.enable_asym',false);
 const sleeveRatio=clamp(value(row,'sleeve.length',row.style==='LongSleeve'||['Turtle','SimpleLapel','Hood2Panels','CuffBand','CuffSkirt','CuffBandSkirt'].includes(row.style)?.88:.30),.18,1);
 const shoulders=[new THREE.Vector3(-.285,1.445,0),new THREE.Vector3(.285,1.445,0)],elbows=[new THREE.Vector3(-.42,1.20,.018),new THREE.Vector3(.42,1.20,.018)],wrists=[new THREE.Vector3(-.47,.965,.04),new THREE.Vector3(.47,.965,.04)];
 const makeSleeve=(side,longness,mat)=>{
  if(longness<=0)return;
  const s=shoulders[side],e=elbows[side],w=wrists[side],mid=longness<.55?s.clone().lerp(e,clamp(longness/.55,.25,1)):e.clone().lerp(w,clamp((longness-.55)/.45,0,1));
  group.add(cylinderBetween(s,mid,.102,mat,.074,24));
  const cuff=choice(row,'sleeve.cuff.type',row.style==='CuffBand'?'CuffBand':row.style==='CuffSkirt'?'CuffSkirt':row.style==='CuffBandSkirt'?'CuffBandSkirt':null);
  if(cuff&&longness>.68){const dir=mid.clone().sub(s).normalize(),a=mid.clone().addScaledVector(dir,-.035),b=mid.clone().addScaledVector(dir,.035);group.add(cylinderBetween(a,b,.084,trim,.084,24));if(cuff!=='CuffBand'){const c=b.clone().addScaledVector(dir,.075);group.add(cylinderBetween(b,c,.085,second,.13,24));}}
 };
 if(!sleeveless){makeSleeve(0,sleeveRatio,second);makeSleeve(1,asym?Math.max(.28,sleeveRatio*.35):sleeveRatio,asym?trim:second);}else if(asym){makeSleeve(0,.88,second);}
 const collar=choice(row,'collar.component.style',row.style==='Turtle'?'Turtle':row.style==='SimpleLapel'?'SimpleLapel':row.style==='Hood2Panels'?'Hood2Panels':null);
 if(collar==='Turtle')group.add(mesh(new THREE.CylinderGeometry(.105,.12,.18,28),trim,[0,1.535,0],[0,0,0],[1,.72,.72]));
 if(collar==='SimpleLapel'){
  const l=triangle(second,[[-.15,1.48,.135],[-.012,1.25,.145],[-.02,1.47,.155]]),r=triangle(trim,[[.15,1.48,.135],[.012,1.25,.145],[.02,1.47,.155]]);group.add(l,r);
 }
 if(collar==='Hood2Panels'){
  const hood=mesh(new THREE.SphereGeometry(.22,28,18,0,Math.PI*2,0,Math.PI*.76),second,[0,1.61,-.055],[0,0,0],[.95,1.12,.78]);hood.material.side=THREE.BackSide;group.add(hood);
 }
 group.userData={bottomY,materials:[main,second,trim]};return group;
}
function addWaistband(group,row,colors,y=1.01){
 const band=material(colors[2],.79,0),curved=row.style==='FittedWB'||choice(row,'meta.wb',null)==='FittedWB',h=.055+.05*clamp(value(row,'waistband.width',.25),.1,.5);
 const m=ellipseCylinder(curved?.174:.18,curved?.19:.18,h,band,y,1.22,.68);group.add(m);
}
function skirtGarment(row,colors,topY=1.02){
 const group=new THREE.Group(),main=material(colors[0],.88,0),second=material(colors[1],.87,0),accent=material(colors[2],.84,0);
 let type=row.style;if(row.style==='MetaGarmentDress')type=choice(row,'meta.bottom','Skirt2');
 const lengthKey=type==='PencilSkirt'?'pencil-skirt.length':type==='Skirt2'?'skirt.length':'flare-skirt.length';
 const ratio=clamp(value(row,lengthKey,type==='Skirt2'?.42:.58),.2,.82),height=.36+.58*ratio,bottomY=Math.max(.08,topY-height),actual=topY-bottomY;
 const flare=type==='PencilSkirt'?.20:type==='Skirt2'?.29:type==='GodetSkirt'?.34:type==='SkirtLevels'?.38:type==='AsymmSkirtCircle'?.47:type==='SkirtManyPanels'?.43:.49;
 if(type==='SkirtLevels'){
  const levels=clamp(Math.round(value(row,'levels-skirt.num_levels',2))+1,2,4),part=actual/levels;
  for(let i=0;i<levels;i++){const y=topY-part*(i+.5),top=.20+i*.035,bottom=.27+i*.055;group.add(mesh(skirtGeometry(top,bottom,.125+i*.01,.20+i*.015,part*.94,0,38),[main,second,accent][i%3],[0,y,0]));}
 }else{
  const asym=type==='AsymmSkirtCircle'?.11:0,g=skirtGeometry(.19,flare,.125,flare*.58,actual,asym,48),m=mesh(g,type==='PencilSkirt'?main:type==='GodetSkirt'?second:main,[0,(topY+bottomY)/2,0]);group.add(m);
  if(type==='GodetSkirt')for(const x of[-.18,0,.18])group.add(mesh(new THREE.ConeGeometry(.105,.31,22),accent,[x,bottomY+.15,.018]));
  if(type==='SkirtManyPanels')for(let i=-2;i<=2;i++){const line=mesh(new THREE.BoxGeometry(.006,actual*.94,.008),accent,[i*.085,(topY+bottomY)/2,.23],[0,0,i*.03]);line.material.transparent=true;line.material.opacity=.55;group.add(line);}
 }
 addWaistband(group,row,colors,topY+.025);group.userData={bottomY};return group;
}
function pantsGarment(row,colors,topY=1.02){
 const group=new THREE.Group(),main=material(colors[0],.88,0),second=material(colors[1],.86,0),accent=material(colors[2],.82,0),ratio=clamp(value(row,'pants.length',.88),.25,1),bottomY=topY-(.38+.63*ratio),width=clamp(value(row,'pants.width',1.05),.75,1.6),flare=clamp(value(row,'pants.flare',1),.45,1.5),crotchY=.84;
 group.add(ellipseCylinder(.19*width,.20*width,topY-crotchY,main,(topY+crotchY)/2,1.18,.7));
 for(const side of[-1,1]){
  const x=.105*side,top=.095*width,bottom=.07*width*flare,h=crotchY-bottomY,m=mesh(new THREE.CylinderGeometry(bottom,top,h,28,1,false),side<0?second:main,[x,(crotchY+bottomY)/2,0]);m.scale.z=.76;group.add(m);
  const cuff=choice(row,'pants.cuff.type',null);if(cuff){const ch=.055+.06*value(row,'pants.cuff.cuff_len',.08),cm=ellipseCylinder(bottom*1.03,bottom*1.03,ch,accent,bottomY+ch/2,1,.76);cm.position.x=x;group.add(cm);if(cuff!=='CuffBand'){const frill=mesh(new THREE.CylinderGeometry(bottom*1.45,bottom*.95,.09,28,1,false),accent,[x,bottomY-.025,0]);frill.scale.z=.76;group.add(frill);}}
 }
 addWaistband(group,row,colors,topY+.025);group.userData={bottomY};return group;
}
function buildGarment(row){
 const group=new THREE.Group(),colors=palette(row),category=row.category||'';
 if(category==='上装'){group.add(topGarment(row,colors));}
 else if(category==='裤装'){group.add(pantsGarment(row,colors));}
 else if(category==='半裙'){group.add(skirtGarment(row,colors));}
 else if(category==='连衣裙'){
  const top=topGarment(row,colors);group.add(top);group.add(skirtGarment(row,[colors[1],colors[0],colors[2]],top.userData.bottomY+.035));
 }
 else if(category==='连体裤'){
  const top=topGarment(row,colors);group.add(top);group.add(pantsGarment(row,[colors[1],colors[0],colors[2]],top.userData.bottomY+.035));
 }else group.add(topGarment(row,colors));
 group.rotation.y=-.08;group.name='garment-form-preview';return group;
}

export class ShowcaseRenderer{
 constructor({thumbnail=false}={}){
  this.thumbnail=thumbnail;this.canvas=document.createElement('canvas');this.canvas.className='showcase-canvas';this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,preserveDrawingBuffer:thumbnail,powerPreference:'high-performance'});
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x0a171f,1);this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(27,4/3,.01,20);this.camera.position.set(2.65,1.45,4.45);this.target=new THREE.Vector3(0,.98,0);
  this.scene.add(new THREE.HemisphereLight(0xd9eff5,0x3a2b25,2.2));const key=new THREE.DirectionalLight(0xffefd4,3);key.position.set(-2.8,4,4);this.scene.add(key);const rim=new THREE.DirectionalLight(0x87b9d5,2);rim.position.set(3,2,-3);this.scene.add(rim);
  const floor=mesh(new THREE.CircleGeometry(.58,64),material('#304751',.42,.18),[0,-.037,0],[-Math.PI/2,0,0]);this.scene.add(floor);
  const pedestal=mesh(new THREE.CylinderGeometry(.45,.50,.055,64),material('#445b66',.38,.22),[0,-.014,0]);this.scene.add(pedestal);
  const back=mesh(new THREE.PlaneGeometry(2.25,2.35),new THREE.MeshStandardMaterial({color:'#102832',roughness:1,metalness:0}),[0,1.05,-.62]);this.scene.add(back);
  const railMat=material('#536b75',.34,.28);for(const x of[-.98,.98])this.scene.add(mesh(new THREE.BoxGeometry(.025,2.23,.025),railMat,[x,1.05,-.59]));for(const y of[.02,2.08])this.scene.add(mesh(new THREE.BoxGeometry(1.98,.025,.025),railMat,[0,y,-.59]));
  this.mannequin=createMannequin();this.scene.add(this.mannequin);this.garment=null;this.controls=null;this.container=null;this.resizeObserver=null;this.raf=0;this.disposed=false;this.view('angle');
 }
 setPreset(row){if(this.garment){disposeObject(this.garment);this.scene.remove(this.garment);}this.garment=buildGarment(row);this.scene.add(this.garment);this.current=row;this.render();}
 view(kind='angle'){
  const positions={front:[0,1.18,4.8],angle:[2.55,1.36,4.15],side:[4.7,1.22,.05],back:[0,1.18,-4.8]};this.camera.position.set(...positions[kind]);this.camera.lookAt(this.target);if(this.controls){this.controls.target.copy(this.target);this.controls.update();}this.render();
 }
 render(){if(this.disposed)return;this.camera.lookAt(this.controls?.target||this.target);this.renderer.render(this.scene,this.camera);}
 capture(row,width=360,height=270){if(this.disposed)throw Error('缩略图渲染器已经释放');this.renderer.setPixelRatio(1);this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.view('angle');this.setPreset(row);this.render();try{return this.canvas.toDataURL('image/webp',.84);}catch{return this.canvas.toDataURL('image/png');}}
 mount(container){if(this.disposed)throw Error('详情渲染器已经释放');this.container=container;container.replaceChildren(this.canvas);this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.target.copy(this.target);this.controls.minDistance=2.5;this.controls.maxDistance=7;this.controls.maxPolarAngle=Math.PI*.63;this.controls.minPolarAngle=Math.PI*.23;this.controls.addEventListener('change',()=>this.render());this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.loop();}
 resize(){if(!this.container||this.disposed)return;const b=this.container.getBoundingClientRect();if(b.width<2||b.height<2)return;this.renderer.setSize(Math.round(b.width),Math.round(b.height),false);this.camera.aspect=b.width/b.height;this.camera.updateProjectionMatrix();this.render();}
 loop(){if(this.disposed||!this.controls)return;this.controls.update();this.render();this.raf=requestAnimationFrame(()=>this.loop());}
 diagnostics(){return{thumbnail:this.thumbnail,hasRenderer:!!this.renderer,hasControls:!!this.controls,garmentObjectCount:this.garment?this.garment.children.length:0,currentId:this.current?.id||null,canvasConnected:this.canvas.isConnected};}
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.resizeObserver?.disconnect();this.controls?.dispose();if(this.garment)disposeObject(this.garment);disposeObject(this.mannequin);this.scene.traverse(o=>{o.geometry?.dispose?.();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose?.();});this.scene.clear();this.renderer.renderLists?.dispose?.();this.renderer.forceContextLoss?.();this.renderer.dispose();this.canvas.remove();this.renderer=this.scene=this.camera=this.controls=this.container=null;}
}
