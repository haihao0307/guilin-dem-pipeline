import * as THREE from 'three';

function rng(seed=934857){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}

function buildWoodMaps(){
  const random=rng(19441025);
  const size=2048;
  const base=document.createElement('canvas');base.width=base.height=size;
  const g=base.getContext('2d');
  const grad=g.createLinearGradient(0,0,0,size);grad.addColorStop(0,'#3b2d22');grad.addColorStop(.46,'#211b17');grad.addColorStop(1,'#171411');g.fillStyle=grad;g.fillRect(0,0,size,size);
  for(let i=0;i<520;i++){
    const y=random()*size, amp=2+random()*18, phase=random()*20, warm=random()>.76;
    g.strokeStyle=warm?`rgba(143,98,58,${.025+random()*.15})`:`rgba(5,5,4,${.04+random()*.20})`;
    g.lineWidth=.4+random()*3.6;g.beginPath();g.moveTo(-20,y);
    for(let x=0;x<=size+32;x+=64){g.lineTo(x,y+Math.sin(x*.012+phase)*amp+Math.sin(x*.003+phase*1.7)*amp*.42)}g.stroke();
  }
  for(let p=0;p<18;p++){
    const y=p*size/18+(random()-.5)*14;g.fillStyle='rgba(7,6,5,.48)';g.fillRect(0,y, size,2+random()*3);
    g.fillStyle='rgba(143,106,69,.08)';g.fillRect(0,y+3,size,1.5);
  }
  for(let i=0;i<340;i++){
    const x=random()*size,y=random()*size,l=8+random()*125;
    g.strokeStyle=`rgba(${120+random()*80|0},${85+random()*45|0},${45+random()*35|0},${.05+random()*.22})`;
    g.lineWidth=.6+random()*4;g.beginPath();g.moveTo(x,y);g.lineTo(x+l,y+(random()-.5)*8);g.stroke();
  }
  for(let i=0;i<180;i++){
    const x=random()*size,y=random()*size,r=.6+random()*3.2;g.fillStyle=`rgba(3,3,2,${.28+random()*.46})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
    if(random()>.63){g.strokeStyle='rgba(135,61,27,.35)';g.lineWidth=.8;g.beginPath();g.arc(x,y,r+2,0,Math.PI*2);g.stroke()}
  }
  for(let i=0;i<900;i++){
    const x=random()*size,y=size*(.62+random()*.38),w=2+random()*24,h=.5+random()*5;
    g.fillStyle=`rgba(210,205,180,${.015+random()*.10})`;g.fillRect(x,y,w,h);
  }
  const baseMap=new THREE.CanvasTexture(base);baseMap.colorSpace=THREE.SRGBColorSpace;baseMap.wrapS=baseMap.wrapT=THREE.RepeatWrapping;baseMap.anisotropy=8;

  const ns=1024,normal=document.createElement('canvas');normal.width=normal.height=ns;const nctx=normal.getContext('2d');
  const id=nctx.createImageData(ns,ns),data=id.data;
  for(let y=0;y<ns;y++)for(let x=0;x<ns;x++){
    const wave=Math.sin(y*.18+Math.sin(x*.015)*2.1)*.35+Math.sin(y*.055+x*.006)*.18;
    const pore=((x*17+y*31+((x*y)%97))%101===0)?-.8:0;
    const gx=Math.cos(x*.011+y*.003)*.06,gy=wave+pore;
    const i=(y*ns+x)*4;data[i]=128+gx*28;data[i+1]=128+gy*30;data[i+2]=246;data[i+3]=255;
  }nctx.putImageData(id,0,0);const normalMap=new THREE.CanvasTexture(normal);normalMap.wrapS=normalMap.wrapT=THREE.RepeatWrapping;

  const rough=document.createElement('canvas');rough.width=rough.height=1024;const rctx=rough.getContext('2d');rctx.fillStyle='#e8e8e8';rctx.fillRect(0,0,1024,1024);
  for(let i=0;i<260;i++){rctx.strokeStyle=`rgba(${90+random()*70|0},${90+random()*70|0},${90+random()*70|0},${.05+random()*.18})`;rctx.lineWidth=1+random()*5;const y=random()*1024;rctx.beginPath();rctx.moveTo(0,y);rctx.bezierCurveTo(260,y+20*(random()-.5),760,y+20*(random()-.5),1024,y);rctx.stroke()}
  const roughnessMap=new THREE.CanvasTexture(rough);roughnessMap.wrapS=roughnessMap.wrapT=THREE.RepeatWrapping;
  return{baseMap,normalMap,roughnessMap};
}

export function createMaterials(renderer){
  const maxAniso=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const woodMaps=buildWoodMaps();Object.values(woodMaps).forEach(t=>t.anisotropy=maxAniso);
  const hull=new THREE.MeshPhysicalMaterial({map:woodMaps.baseMap,normalMap:woodMaps.normalMap,normalScale:new THREE.Vector2(.42,.42),roughnessMap:woodMaps.roughnessMap,roughness:.9,metalness:.015,clearcoat:.025,clearcoatRoughness:.9,side:THREE.FrontSide});
  const innerWood=new THREE.MeshPhysicalMaterial({color:0x6c5138,map:woodMaps.baseMap,normalMap:woodMaps.normalMap,normalScale:new THREE.Vector2(.34,.34),roughness:.88,metalness:.01});
  const repairWood=new THREE.MeshPhysicalMaterial({color:0x725335,map:woodMaps.baseMap,normalMap:woodMaps.normalMap,normalScale:new THREE.Vector2(.38,.38),roughness:.86,metalness:.015});
  const darkWood=new THREE.MeshStandardMaterial({color:0x2c2016,map:woodMaps.baseMap,roughness:.94,metalness:0});
  const castIronGreen=new THREE.MeshPhysicalMaterial({color:0x39483d,roughness:.66,metalness:.58,clearcoat:.06,clearcoatRoughness:.62});
  const blackIron=new THREE.MeshPhysicalMaterial({color:0x1b2020,roughness:.64,metalness:.72});
  const steel=new THREE.MeshPhysicalMaterial({color:0x626866,roughness:.48,metalness:.82});
  const oiledSteel=new THREE.MeshPhysicalMaterial({color:0x343a38,roughness:.34,metalness:.78,clearcoat:.12,clearcoatRoughness:.38});
  const rust=new THREE.MeshStandardMaterial({color:0x743c20,roughness:.92,metalness:.32});
  const brass=new THREE.MeshPhysicalMaterial({color:0x85652f,roughness:.43,metalness:.82});
  const copper=new THREE.MeshPhysicalMaterial({color:0x6f422b,roughness:.52,metalness:.7});
  const fadedRed=new THREE.MeshStandardMaterial({color:0x6f211d,roughness:.8,metalness:.18});
  const rope=new THREE.MeshStandardMaterial({color:0x766244,roughness:1,metalness:0});
  const rubber=new THREE.MeshStandardMaterial({color:0x121414,roughness:.86,metalness:.02});
  const glass=new THREE.MeshPhysicalMaterial({color:0xb7c2b1,roughness:.14,metalness:0,transmission:.35,transparent:true,opacity:.88,thickness:.02});
  return{hull,innerWood,repairWood,darkWood,castIronGreen,blackIron,steel,oiledSteel,rust,brass,copper,fadedRed,rope,rubber,glass,woodMaps};
}

export function applyHullMaterial(root,materials){
  root.traverse(o=>{if(!o.isMesh)return;o.material=materials.hull;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=true;const uv=o.geometry.getAttribute('uv');if(!uv){
      const pos=o.geometry.getAttribute('position'),arr=new Float32Array(pos.count*2);for(let i=0;i<pos.count;i++){arr[i*2]=(pos.getX(i)+1.7)/4.6;arr[i*2+1]=(pos.getY(i)+.1)/1.05}o.geometry.setAttribute('uv',new THREE.BufferAttribute(arr,2));
    }});
}
