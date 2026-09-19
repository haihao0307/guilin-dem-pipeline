import * as THREE from 'three';

function rng(seed=1944){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
function makeFlagMaps(){
  const random=rng(10251944),w=2048,h=1024;
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#e7dfce');bg.addColorStop(.48,'#dcd3c0');bg.addColorStop(1,'#cfc3ad');g.fillStyle=bg;g.fillRect(0,0,w,h);
  const cx=w*.34,cy=h*.50,red='#9f1821',radius=h*.205;
  g.fillStyle=red;
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16,half=Math.PI/32,R=3500;
    g.beginPath();g.moveTo(cx,cy);g.lineTo(cx+Math.cos(a-half)*R,cy+Math.sin(a-half)*R);g.lineTo(cx+Math.cos(a+half)*R,cy+Math.sin(a+half)*R);g.closePath();g.fill();
  }
  g.beginPath();g.arc(cx,cy,radius,0,Math.PI*2);g.fill();
  g.globalCompositeOperation='multiply';
  for(let y=0;y<h;y+=3){g.strokeStyle=`rgba(75,57,42,${.012+random()*.018})`;g.lineWidth=.55;g.beginPath();g.moveTo(0,y+.3);g.lineTo(w,y+.3);g.stroke()}
  for(let x=0;x<w;x+=4){g.strokeStyle=`rgba(78,60,44,${.008+random()*.014})`;g.lineWidth=.45;g.beginPath();g.moveTo(x+.2,0);g.lineTo(x+.2,h);g.stroke()}
  g.globalCompositeOperation='source-over';
  for(let i=0;i<1100;i++){
    const x=random()*w,y=random()*h,r=.5+random()*4.2;
    g.fillStyle=`rgba(${35+random()*55|0},${24+random()*40|0},${18+random()*28|0},${.006+random()*.035})`;g.beginPath();g.ellipse(x,y,r*2.2,r,random()*Math.PI,0,Math.PI*2);g.fill();
  }
  g.fillStyle='rgba(106,82,59,.16)';g.fillRect(0,0,30,h);
  g.strokeStyle='rgba(83,62,44,.5)';g.lineWidth=3;g.setLineDash([12,10]);g.strokeRect(15,15,w-30,h-30);g.setLineDash([]);
  const bleach=g.createLinearGradient(w*.55,0,w,0);bleach.addColorStop(0,'rgba(240,232,215,0)');bleach.addColorStop(1,'rgba(240,232,215,.13)');g.fillStyle=bleach;g.fillRect(0,0,w,h);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=12;

  const n=document.createElement('canvas');n.width=1024;n.height=512;const ng=n.getContext('2d'),img=ng.createImageData(n.width,n.height);
  for(let y=0;y<n.height;y++)for(let x=0;x<n.width;x++){
    const gx=Math.sin(x*Math.PI)*.08+Math.sin(x*.42)*.06,gy=Math.sin(y*.55)*.07;const i=(y*n.width+x)*4;
    img.data[i]=128+gx*20;img.data[i+1]=128+gy*20;img.data[i+2]=248;img.data[i+3]=255;
  }ng.putImageData(img,0,0);const normal=new THREE.CanvasTexture(n);normal.anisotropy=8;
  return{map,normal};
}
function cylinder(r,h,mat,segments=28){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),mat);m.castShadow=m.receiveShadow=true;return m}
function tube(points,r,mat){const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,r,10,false),mat);m.castShadow=true;return m}

export function buildHistoricalFlag(boatRoot,mats,initialHeight=1.72){
  const root=new THREE.Group();root.name='source_derived_physical_flag';boatRoot.add(root);
  const state={height:initialHeight,wind:.62,width:.86,clothHeight:.54,frame:0,visible:true};
  const texture=makeFlagMaps();let cloth=null,base=null,pole=null;
  function rebuild(height=state.height){
    state.height=height;while(root.children.length)root.remove(root.children[0]);
    pole=cylinder(.025,height,mats.darkWood,32);pole.position.set(2.44,.82+height/2,-.34);root.add(pole);
    const socket=cylinder(.055,.18,mats.brass,30);socket.position.set(2.44,.89,-.34);root.add(socket);
    const collar=cylinder(.039,.032,mats.brass,28);collar.position.set(2.44,.82+height*.73,-.34);root.add(collar);
    const finial=new THREE.Mesh(new THREE.SphereGeometry(.045,28,18),mats.brass);finial.position.set(2.44,.82+height+.035,-.34);finial.castShadow=true;root.add(finial);
    const geo=new THREE.PlaneGeometry(state.width,state.clothHeight,64,64);geo.translate(-state.width/2,0,0);
    base=Float32Array.from(geo.attributes.position.array);
    const material=new THREE.MeshPhysicalMaterial({map:texture.map,normalMap:texture.normal,normalScale:new THREE.Vector2(.24,.24),roughness:.89,metalness:0,side:THREE.DoubleSide,sheen:1,sheenColor:new THREE.Color(0xd6cbb8),sheenRoughness:.82,clearcoat:0,transparent:false});
    cloth=new THREE.Mesh(geo,material);cloth.name='65x65_physical_cloth';cloth.position.set(2.44,.82+height-state.clothHeight*.56,-.34);cloth.castShadow=true;root.add(cloth);
    root.add(tube([new THREE.Vector3(2.44,.82+height*.96,-.34),new THREE.Vector3(2.425,.82+height*.86,-.34),new THREE.Vector3(2.44,.82+height*.73,-.34)],.006,mats.rope));
    for(const yy of[.82+height-.055,.82+height-state.clothHeight+.055]){
      const tie=new THREE.Mesh(new THREE.TorusGeometry(.038,.006,8,24),mats.rope);tie.rotation.x=Math.PI/2;tie.position.set(2.44,yy,-.34);root.add(tie);
    }
  }
  function update(time,wind=state.wind){
    state.wind=wind;if(!cloth||!base)return;const a=cloth.geometry.attributes.position.array;
    for(let i=0;i<a.length;i+=3){const x=base[i],y=base[i+1],u=THREE.MathUtils.clamp(-x/state.width,0,1),v=y/state.clothHeight+.5;
      const main=Math.sin(time*.0042*(.55+wind)+u*8.2+v*1.8)*(.018+.070*wind)*u;
      const fine=Math.sin(time*.0075*(.4+wind)+u*18-v*7)*.018*u*wind;
      const curl=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.010;
      a[i]=x-.012*u*u;a[i+1]=y-.035*u*u+curl;a[i+2]=main+fine;
    }
    cloth.geometry.attributes.position.needsUpdate=true;
    if((state.frame++%3)===0)cloth.geometry.computeVertexNormals();
  }
  function setVisible(v){root.visible=v;state.visible=v}
  rebuild(initialHeight);
  return{root,state,update,rebuild,setVisible,get cloth(){return cloth},get pole(){return pole}};
}
