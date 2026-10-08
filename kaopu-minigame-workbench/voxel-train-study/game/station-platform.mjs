// R10 original, procedural period-inspired station furniture.
// Kowloon's masonry edge / slender columns / valanced canopy refer to the
// Andrew Suddaby photograph of 1 April 1958 (https://gwulo.com/media/11761).
// This compact game layout is not a reconstruction of an individual station.
import * as THREE from '../vendor/three.module.js';
import {Blocks} from './heritage.mjs';

export const PLATFORM_SPEC=Object.freeze({minX:-26,maxX:4.6,top:.82,minZ:2.06,maxZ:5.58,
  sign:[-14.6,2.55,5.454],driver:[-1.74,2.82,.78],clearWalkway:{min:[-26,.83,2.06],max:[4.6,2.48,4.6]}});
const C={wood:0xa58b61,woodDark:0x63533e,woodEnd:0x867153,cream:0xd5cbb1,
  ink:0x30443b,iron:0x36453e,ironEdge:0x586058,rust:0x77624b,roof:0x65736b,
  stone:0xaaa999,brick:0x8f826d,rope:0xc4b38a,leather:0x745844};
const Y=new THREE.Vector3(0,1,0);
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

class Batch{
  constructor(box){this.boxSource=box;this.p=[];this.n=[];this.c=[];this.uv=[];this.indices=[];this.parts=0;}
  add(source,color,position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],uvTransform=null){
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),p=source.attributes.position,n=source.attributes.normal,u=source.attributes.uv;
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),col=new THREE.Color(color),first=this.p.length/3;
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
      this.p.push(point.x,point.y,point.z);this.n.push(normal.x,normal.y,normal.z);this.c.push(col.r,col.g,col.b);
      const uv=uvTransform?uvTransform(p,i,u):[u?.getX(i)||0,u?.getY(i)||0];this.uv.push(...uv);
    }
    if(source.index)for(const i of source.index.array)this.indices.push(first+i);else for(let i=0;i<p.count;i++)this.indices.push(first+i);
    this.parts++;
  }
  box(x,y,z,w,h,d,color,rotation=[0,0,0],uvTransform=null){this.add(this.boxSource,color,[x,y,z],rotation,[w,h,d],uvTransform);}
  quad(x,y,z,w,h,color,normalZ=1){const first=this.p.length/3,col=new THREE.Color(color);
    for(const [u,v]of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){this.p.push(x+u*w,y+v*h,z);this.n.push(0,0,normalZ);this.c.push(col.r,col.g,col.b);this.uv.push(u+.5,v+.5);}
    this.indices.push(...(normalZ>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).map(i=>first+i));this.parts++;}
  disc(x,y,z,r,color,normalZ=1){const g=new THREE.CircleGeometry(r,8);this.add(g,color,[x,y,z],[0,normalZ>0?0:Math.PI,0]);g.dispose();}
  beam(a,b,width,color,depth=width){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y,delta.clone().normalize()));
    this.add(this.boxSource,color,start.add(end).multiplyScalar(.5).toArray(),[rotation.x,rotation.y,rotation.z],[width,delta.length(),depth]);}
  cylinder(x,y,z,r,h,color,{top=r,segments=12,axis='y',open=false}={}){
    const g=new THREE.CylinderGeometry(top,r,h,segments,1,open);this.add(g,color,[x,y,z],axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:[0,0,0]);g.dispose();}
  torus(x,y,z,r,tube,color,{axis='y',arc=Math.PI*2,segments=16}={}){
    const g=new THREE.TorusGeometry(r,tube,4,segments,arc);this.add(g,color,[x,y,z],axis==='y'?[Math.PI/2,0,0]:axis==='x'?[0,Math.PI/2,0]:[0,0,0]);g.dispose();}
  lathe(x,y,z,points,color,segments=12){const g=new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(...p)),segments);this.add(g,color,[x,y,z]);g.dispose();}
  mesh(material,name){const g=new THREE.BufferGeometry();
    for(const [name,values,size]of [['position',this.p,3],['normal',this.n,3],['color',this.c,3],['uv',this.uv,2]])g.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
    g.setIndex(this.indices);g.computeBoundingBox();g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
}

function texture(width,height,paint){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');paint(ctx,width,height);const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;}
function woodTexture(){return texture(1024,512,(ctx,w,h)=>{
  ctx.fillStyle='#c4b69b';ctx.fillRect(0,0,w,h);const r=random(19580301);
  // Long, low-contrast fibres, small split grain and gently worn broad streaks.
  for(let i=0;i<1250;i++){const light=i%3===0;ctx.fillStyle=light?'rgba(245,237,216,.10)':'rgba(69,55,39,.075)';
    ctx.fillRect(r()*w,r()*h,20+r()*440,.6+r()*1.5);}
  for(let i=0;i<24;i++){ctx.fillStyle='rgba(246,232,199,.08)';ctx.fillRect(r()*w,r()*h,90+r()*330,3+r()*13);}
  for(let i=0;i<18;i++){ctx.fillStyle='rgba(54,45,31,.13)';ctx.fillRect(r()*w,r()*h,12+r()*80,.7);}
});}
function signTexture(plan){return texture(2048,640,(ctx,w,h)=>{
  ctx.fillStyle='#e5dfc6';ctx.fillRect(0,0,w,h);ctx.fillStyle='#c1bba4';ctx.fillRect(18,18,w-36,4);ctx.fillRect(18,h-22,w-36,4);
  // Avoid image-based lettering and mirrored DoubleSide text. Each face owns
  // its outward-facing geometry and shares this authored high-resolution map.
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#292f2a';
  const name=String(plan.name||'車站'),english=String(plan.english||'STATION').toUpperCase();
  const chineseSize=Math.min(196,464/Math.max(2,name.length));ctx.font=`600 ${chineseSize}px "Noto Serif CJK TC","Noto Serif CJK SC","Songti TC","SimSun",serif`;
  ctx.fillText(name,272,334,448);ctx.fillText(name,w-272,334,448);
  ctx.font=`${Math.min(196,1050/Math.max(7,english.length)*1.5)}px "Arial Narrow",Arial,sans-serif`;
  ctx.fillText(english,w/2,328,1050);
});}

function stationVariant(plan){const terminal=plan.index===0&&/Kowloon/i.test(plan.english||'');
  return terminal?'kowloon-masonry':plan.index===4?'tai-po-kau-open':plan.index===5?'tai-po-market':'country-'+['trunks','parcels','baskets'][Number(plan.index||0)%3];}
function obstacle(proof,kind,x,y,z,w,h,d){proof.obstacles.push({kind,min:[x-w/2,y-h/2,z-d/2],max:[x+w/2,y+h/2,z+d/2]});}

function buildDeck(deck,b,metal,proof){const terminal=proof.variant==='kowloon-masonry';
  if(proof.materialSurface==='masonry'){
    // Solid masonry platform, mortar gaps, staggered individual brick courses.
    b.box(-10.7,.37,3.82,30.6,.66,3.52,0x77756b);
    for(let row=0;row<5;row++)for(let x=-26+(row%2)*.30;x<4.6;x+=.60){const width=Math.min(.584,4.6-x);if(width<=0)continue;
      for(const z of [2.045,5.595])b.quad(x+width/2,.132+row*.112,z,width,.099,[0x918570,0x887d68,0x9b8d75][(row+Math.round(x*5)+150)%3],z<3?-1:1);}
    for(let x=-25.7;x<4.6;x+=.6)b.box(x,.733,2.13,.585,.10,.24,C.cream);
    deck.box(-10.7,.783,3.82,30.6,.074,3.52,0xb3b1a1);
    for(let x=-24.5;x<4.6;x+=1.7)b.box(x,.8204,3.88,.008,.001,3.30,0x8e8e82);
    for(const z of [3.26,4.42])b.box(-10.7,.8204,z,30.6,.001,.008,0x939387);
    proof.deck={type:'masonry',top:.82,planks:0};
  }else{
    const count=123,pitch=30.6/count,r=random(607+proof.stationIndex),palette=[0xb39c77,0xab926d,0xb59d78,0xa88e69,0xae9875];
    for(let i=0;i<count;i++){const x=-26+(i+.5)*pitch,tone=palette[Math.floor(r()*palette.length)],phase=r()*.55;
      deck.box(x,.755,3.82,pitch-.011,.13,3.52,tone,[0,0,0],(p,j)=>[(p.getZ(j)+.5)*.92+phase,(p.getX(j)+.5)*.35+(i%7)/10]);
      // Recessed nail heads in paired joist rows, with a few short worn edges.
      for(const z of [2.36,5.23])for(const dx of [-.068,.068])metal.cylinder(x+dx,.8208,z,.0075,.002,0x514d40,{segments:6});
      if(i%5===0)b.box(x,.8208,2.22+r()*.45,pitch*.58,.0016,.012,0xcbb692);
    }
    // Long edge boards conceal the ends of the transverse joists, while the
    // posts, lower ties and diagonal braces visibly support the deck.
    for(const z of [2.105,5.535])b.box(-10.7,.675,z,30.6,.18,.085,C.woodDark);
    for(let x=-25.68;x<4.6;x+=1.5){
      b.box(x,.575,3.82,.16,.20,3.44,C.woodEnd);
      for(const z of [2.40,5.22]){b.box(x,.375,z,.15,.68,.16,C.woodDark);b.box(x,.073,z,.29,.085,.29,0x858475);
        b.beam([x,.12,z],[x+.52,.57,z],.06,0x897354);}
    }
    b.box(-10.7,.796,2.112,30.6,.047,.092,0xccba97);
    proof.deck={type:'timber',top:.82,planks:count,seamWidth:.011,nailHeads:count*4};
  }
  // The same two exits as R09; open rear railing gaps align with alighting.
  for(const x of [-18.1,-11.1]){b.box(x,.64,5.7,1.55,.3,.42,0x929782);b.box(x,.36,6,1.55,.26,.40,0x939982);b.box(x,.17,6.27,1.55,.14,.29,0x929782);}
  if(!terminal)for(const [a,z]of [[-25.8,-23.8],[-20.0,-19.2],[-16.9,-12.4],[-9.95,-6.3]]){
    for(let x=a;x<z;x+=1.45)b.box(x,1.04,5.55,.075,.43,.075,0x687162);
    b.box((a+z)/2,1.25,5.55,z-a,.055,.055,0xb2b39c);
    if(proof.variant==='tai-po-kau-open')for(let x=a+.08;x<z;x+=.15)b.box(x,1.22,5.55,.035,.79,.036,0xcdd0bb);
  }
}

function bench(b,metal,proof,x,z,width=2.05){
  for(let i=0;i<4;i++)b.box(x,1.22,z-.22+i*.138,width,.065,.105,[0x948260,0xa08c65,0x8f7e5f,0x9b8967][i]);
  for(let i=0;i<3;i++)b.box(x,1.48+i*.12,z+.276,width,.078,.054,0x8e8062,[.11,0,0]);
  for(const side of [-1,1]){const q=x+side*width*.34;
    metal.beam([q,.835,z-.16],[q,1.20,z-.13],.058,C.iron);metal.beam([q,.835,z+.27],[q,1.82,z+.30],.060,C.iron);
    metal.box(q,.85,z+.04,.12,.045,.54,C.iron);metal.beam([q,1.16,z-.22],[q,1.16,z+.32],.064,C.iron);
    metal.beam([q,1.32,z-.13],[q,1.42,z+.19],.04,C.ironEdge);metal.box(q,1.43,z+.07,.065,.042,.37,C.woodDark);
  }
  metal.box(x,.995,z+.23,width*.71,.037,.035,C.iron);
  obstacle(proof,'bench',x,1.32,z+.03,width,1.0,.65);proof.benches++;
}
function trunk(b,metal,proof,x,z,{width=.76,height=.44,depth=.43,color=C.leather}={}){
  const y=.82+height/2;b.box(x,y,z,width,height,depth,color);b.box(x,y+height*.39,z,width+.018,.055,depth+.016,0x80654a);
  for(const side of [-1,1]){b.box(x+side*width*.31,y,z,.042,height+.025,depth+.025,0x3e493f);
    for(const dz of [-1,1])metal.box(x+side*(width/2-.055),y-height*.32,z+dz*(depth/2+.006),.11,.11,.018,C.iron);}
  metal.box(x,y+.075,z+depth/2+.015,.085,.085,.018,0xa69870);
  metal.beam([x-.085,y-.04,z+depth/2+.022],[x+.085,y-.04,z+depth/2+.022],.024,C.ironEdge);
  obstacle(proof,'trunk',x,y,z,width,height,depth);proof.luggage.trunks++;
}
function parcel(b,proof,x,z,{width=.49,height=.30,depth=.38,base=.82}={}){
  const y=base+height/2;b.box(x,y,z,width,height,depth,0xb7a67f);
  for(const t of [-.18,.18]){b.box(x+t*width,y,z,.014,height+.008,depth+.012,C.rope);}
  b.box(x,y,z,width+.012,height+.009,.014,C.rope);b.box(x+.10,y+height/2+.006,z,.11,.002,.075,0xdfd2ad);
  b.beam([x-.045,y+height/2+.006,z],[x+.025,y+height/2+.029,z+.035],.012,C.rope);
  obstacle(proof,'parcel',x,y,z,width,height,depth);proof.luggage.parcels++;
}
function basket(b,proof,x,z,r=.26,h=.42){
  const y=.82;b.lathe(x,y,z,[[r*.70,0],[r*.94,h*.12],[r,h*.78],[r*.88,h],[r*.80,h],[r*.86,h*.82],[r*.77,h*.08]],0x8c784f,16);
  // Open lattice around the side and a braided lip give a true basket silhouette.
  for(let j=0;j<7;j++)b.torus(x,y+.045+j*h*.135,z,r*(.95-.11*j/6),.009,j%2?0xb29a67:0xa78b58,{segments:16});
  for(let j=0;j<16;j++){const a=j*Math.PI/8,c=Math.cos(a),s=Math.sin(a);b.beam([x+c*r*.92,y+.035,z+s*r*.92],[x+c*r*.86,y+h-.015,z+s*r*.86],.013,0xc0a574);}
  b.torus(x,y+h,z,r*.86,.017,0xb6a171,{segments:20});b.torus(x,y+h+.015,z,r*.55,.018,0xab9564,{axis:'z',arc:Math.PI,segments:12});
  obstacle(proof,'basket',x,y+h/2,z,r*2,h+r*.55,r*2);proof.luggage.baskets++;
}

function marketDetails(b,metal,proof){
  // Small handcart, an empty notice frame and a clock: original shapes only,
  // informed by the Tai Po Market archive photograph, without copying its art.
  const x=-25.05,z=5.12;b.box(x,1.23,z,.84,.58,.47,0xbbbdaf);b.box(x,1.54,z,.91,.07,.52,0xd2cfb9);
  for(const side of [-1,1]){metal.cylinder(x+side*.32,.955,z+.26,.135,.054,C.iron,{axis:'z',segments:12});metal.cylinder(x+side*.32,.955,z+.29,.035,.026,C.ironEdge,{axis:'z',segments:8});}
  metal.beam([x-.56,1.40,z-.17],[x-.41,1.10,z-.17],.030,C.iron);metal.beam([x-.56,1.40,z+.17],[x-.41,1.10,z+.17],.030,C.iron);
  metal.beam([x-.56,1.40,z-.17],[x-.56,1.40,z+.17],.030,C.iron);obstacle(proof,'handcart',x,1.17,z,.96,.78,.58);
  b.box(-17.05,2.05,5.42,.70,.83,.06,0x716d56);b.quad(-17.05,2.05,5.457,.61,.73,0xd5c597);
  for(let i=0;i<7;i++)b.quad(-17.08,2.30-i*.075,5.459,.39-(i%3)*.07,.013,0x8b8064);
  metal.cylinder(-12.42,2.59,5.40,.225,.075,C.iron,{axis:'z',segments:24});b.disc(-12.42,2.59,5.441,.195,0xe4ddc2);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;metal.box(-12.42+Math.sin(a)*.163,2.59+Math.cos(a)*.163,5.446,.012,.035,.005,C.iron,[0,0,-a]);}
  metal.beam([-12.42,2.59,5.45],[-12.42,2.735,5.45],.014,C.iron);metal.beam([-12.42,2.59,5.45],[-12.505,2.63,5.45],.018,C.iron);
  proof.props={handcarts:1,noticeboards:1,clocks:1};
}

function canopy(b,metal,proof){if(proof.variant==='tai-po-kau-open'){proof.canopy={type:'open-platform',columns:0,walkwayClear:true};return;}
  const terminal=proof.variant==='kowloon-masonry',a=terminal?-25.45:-17.70,end=terminal?-10.1:-12.0;
  const frontZ=3.42,backZ=5.63,roofY=terminal?3.76:3.36,pitch=terminal?.048:.12,width=end-a;
  // The passenger corridor has no columns: these shallow game canopies are
  // cantilevered from the rear row, with real diagonal braces and tie members.
  const columns=terminal?[-24.8,-21.1,-17.45,-13.7,-10.7]:[-17.35,-12.4];
  for(const x of columns){
    if(terminal){b.box(x,.90,5.20,.33,.16,.34,C.cream);b.box(x,1.01,5.20,.21,.085,.22,C.cream);}
    metal.box(x,(roofY+.82)/2,5.20,.087,roofY-.82,.09,C.iron);
    metal.box(x,roofY-.14,5.20,.16,.17,.19,C.ironEdge);
    metal.beam([x,roofY-.64,5.20],[x,roofY-.10,4.25],.052,C.iron);
    metal.beam([x,roofY-.11,3.48],[x,roofY-.11,5.49],.055,C.iron);
    metal.beam([x,roofY-.11,3.48],[x,roofY+.13,4.52],.046,C.iron);
    metal.beam([x,roofY+.13,4.52],[x,roofY-.11,5.49],.046,C.iron);
    metal.beam([x-.33,roofY-.16,5.20],[x,roofY-.60,5.20],.044,C.iron);
    metal.beam([x+.33,roofY-.16,5.20],[x,roofY-.60,5.20],.044,C.iron);
    obstacle(proof,'canopy-column',x,(roofY+.82)/2,5.20,.14,roofY-.82,.14);
  }
  for(const z of [3.51,4.50,5.45])metal.box((a+end)/2,roofY-.05,z,width,.065,.063,C.iron);
  for(let x=a+.14;x<end;x+=.29){const w=Math.min(.287,end-x+.14);
    b.box(x,roofY+.08,4.525,w,.052,2.22,Math.round((x-a)/.29)%5===0?0x728078:C.roof,[pitch,0,0]);
    metal.box(x-w/2,roofY+.13,4.525,.017,.028,2.23,0x7a847a,[pitch,0,0]);
  }
  for(const z of [frontZ,backZ]){
    const y=roofY+.08-(z-4.525)*Math.sin(pitch);b.box((a+end)/2,y-.085,z,width,.17,.055,terminal?0xc7c6ad:0x747e6d);
    if(terminal)for(let x=a+.035;x<end;x+=.115){const front=z<4?-1:1;b.quad(x,y-.091,z+front*.030,.043,.195,0xd1ceb5,front);
      b.disc(x,y-.192,z+front*.031,.024,0xd1ceb5,front);}
  }
  // Curved gutter trough, capped ends and a modest rear downpipe.
  metal.cylinder((a+end)/2,roofY-.115,5.66,.051,width,C.ironEdge,{axis:'x',segments:10});
  metal.cylinder(a+.24,(roofY+.89)/2,5.65,.032,roofY-.89,C.iron,{segments:10});
  metal.beam([a+.24,.90,5.65],[a+.31,.84,5.70],.050,C.iron);
  proof.canopy={type:terminal?'long-valanced-cantilever':'compact-sloped-cantilever',minX:a,maxX:end,columns:columns.length,walkwayClear:true};
}

function lantern(metal,glass,warm,proof,x){const z=5.29,y=2.75;
  metal.cylinder(x,1.68,z,.035,1.72,C.iron,{segments:10});metal.cylinder(x,.87,z,.095,.10,C.iron,{segments:10});
  // A short curved neck sets the lantern head off the pole without a boxy arm.
  const arm=[];for(let i=0;i<=6;i++){const a=Math.PI*i/12;arm.push([x-.19+.19*Math.cos(a),2.54+.19*Math.sin(a),z]);}
  for(let i=1;i<arm.length;i++)metal.beam(arm[i-1],arm[i],.028,C.iron);
  // Distinct flared metal cap, chimney vent, framed amber glass and inner wick.
  metal.lathe(x,y,z,[[0,.225],[.052,.225],[.056,.18],[.10,.16],[.18,.09],[.176,.055]],C.iron,12);
  metal.lathe(x,y,z,[[.16,-.15],[.16,-.175],[.105,-.20],[.09,-.235],[0,-.235]],C.iron,12);
  glass.cylinder(x,y-.035,z,.121,.235,0xffd59a,{top:.139,segments:4,open:true});
  for(const dx of [-.095,.095])for(const dz of [-.095,.095])metal.beam([x+dx,y-.17,z+dz],[x+dx*1.16,y+.072,z+dz*1.16],.018,C.iron);
  warm.lathe(x,y-.1,z,[[0,0],[.034,.025],[.027,.082],[.008,.13],[0,.14]],0xffd995,10);
  metal.torus(x,y+.24,z,.060,.012,C.iron,{axis:'z',segments:12});
  obstacle(proof,'lantern',x,1.94,z,.37,2.23,.37);proof.lanternPositions.push([x,y,z]);
}

function originalAttendant(){const b=new Blocks(),sx=-4.8;
  // Exact R09 stationary block geometry. No motion or new narrative is added.
  b.box(sx,1.34,4.8,.29,.43,.21,0x40564d);b.box(sx,1.68,4.8,.23,.24,.22,0xc5a480);b.box(sx,1.83,4.8,.29,.08,.28,0x262d27);for(const z of [4.71,4.89])b.box(sx,.99,z,.1,.38,.1,0x383b32);b.box(sx+.18,1.33,4.8,.09,.37,.09,0x657668);b.box(sx+.22,1.43,4.8,.04,.51,.04,0x90764a);b.box(sx+.39,1.62,4.8,.3,.19,.025,0xc5b66e);
  return b.geometry();
}

export function createStationPlatform(plan){
  const group=new THREE.Group();group.name='Flat station platform: '+plan.name;
  const proof={version:'station-r10',originalProcedural:true,historicalReconstruction:false,stationIndex:Number(plan.index||0),variant:stationVariant(plan),deckTop:.82,materialSurface:'masonry',obstacles:[],benches:0,luggage:{trunks:0,parcels:0,baskets:0},props:{handcarts:0,noticeboards:0,clocks:0},lanternPositions:[],attendantUnchanged:true,signFaces:2};
  const box=new THREE.BoxGeometry(1,1,1),deck=new Batch(box),b=new Batch(box),metal=new Batch(box),roof=new Batch(box),glass=new Batch(box),warm=new Batch(box);
  buildDeck(deck,b,metal,proof);canopy(roof,metal,proof);bench(b,metal,proof,-23.6,4.91);bench(b,metal,proof,-7.35,4.91,1.80);
  if(proof.variant==='kowloon-masonry'){bench(b,metal,proof,-16.8,4.91,1.50);trunk(b,metal,proof,-25.25,5.13,{width:.65,height:.40});parcel(b,proof,-25.21,5.13,{width:.40,height:.23,depth:.32,base:1.22});}
  else if(proof.variant==='tai-po-market'){marketDetails(b,metal,proof);basket(b,proof,-16.95,5.22,.24,.39);basket(b,proof,-16.29,5.22,.20,.34);b.beam([-17.0,1.30,5.22],[-16.25,1.24,5.22],.034,0xaf9970);}
  else if(proof.variant==='tai-po-kau-open'){parcel(b,proof,-25.16,5.22,{width:.44,height:.28});}
  else if(proof.variant==='country-parcels'){trunk(b,metal,proof,-21.9,5.20);parcel(b,proof,-21.91,5.20,{width:.53,height:.23,base:1.26});parcel(b,proof,-25.16,5.22,{width:.60,height:.34});}
  else if(proof.variant==='country-baskets'){basket(b,proof,-25.05,5.15,.25,.38);basket(b,proof,-21.85,5.22,.20,.34);parcel(b,proof,-21.30,5.23,{width:.40,height:.28,depth:.32});}
  else{trunk(b,metal,proof,-21.85,5.20);trunk(b,metal,proof,-25.16,5.15,{width:.61,height:.34,color:0x71664c});basket(b,proof,-21.10,5.25,.18,.29);}
  for(const x of [-24.4,-18.85,-9.6])lantern(metal,glass,warm,proof,x);
  // Frame and bolt heads are real geometry; sign planes are independently
  // front-facing from both platform and track, so letters never mirror.
  b.box(-14.6,2.55,5.405,4.31,.82,.082,0xd4cfb6);
  for(const x of [-16.72,-12.48])b.box(x,2.55,5.464,.035,.78,.025,C.cream);
  for(const y of [2.16,2.94])b.box(-14.6,y,5.464,4.26,.025,.025,C.cream);
  for(const x of [-16.60,-12.60])for(const y of [2.235,2.865])for(const z of [5.453,5.358])metal.cylinder(x,y,z,.010,.006,0x958c72,{axis:'z',segments:6});
  if(proof.variant==='tai-po-kau-open')for(const x of [-16.42,-12.78]){b.box(x,1.64,5.405,.105,1.64,.11,0xd8d8bf);b.box(x,1.04,5.405,.11,.45,.115,C.iron);}
  else for(const x of [-16.0,-13.2])metal.beam([x,2.97,5.405],[x,proof.canopy.type.startsWith('long')?3.55:3.15,5.405],.025,C.iron);

  const terminal=proof.variant==='kowloon-masonry';
  const structural=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.90,metalness:.025});
  const metalMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.70,metalness:.30});
  const roofMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.16});
  const deckMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0,...(proof.materialSurface==='timber'?{map:woodTexture()}: {})});
  group.add(deck.mesh(deckMaterial,'Station deck surface'),b.mesh(structural,'Station supports, edge, furniture and luggage'),metal.mesh(metalMaterial,'Station ironwork, lantern caps and fittings'),roof.mesh(roofMaterial,'Station sloping roof and valance'));
  const glassMaterial=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.38,roughness:.24,metalness:.04,emissive:0x8d622c,emissiveIntensity:.21,depthWrite:false,side:THREE.DoubleSide});
  const glassMesh=glass.mesh(glassMaterial,'Station lantern glass');glassMesh.castShadow=false;group.add(glassMesh);
  const glow=warm.mesh(new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),'Station warm lamp wicks');glow.castShadow=false;group.add(glow);
  const signMaterial=new THREE.MeshBasicMaterial({map:signTexture(plan),side:THREE.FrontSide,toneMapped:true});
  const signGeometry=new THREE.PlaneGeometry(4.20,.74),sign=new THREE.Mesh(signGeometry,signMaterial);sign.name='Station sign front';sign.position.set(...PLATFORM_SPEC.sign);group.add(sign);
  const reverseSign=new THREE.Mesh(signGeometry,signMaterial);reverseSign.name='Station sign back';reverseSign.position.set(-14.6,2.55,5.358);reverseSign.rotation.y=Math.PI;group.add(reverseSign);
  const attendant=new THREE.Mesh(originalAttendant(),structural);attendant.name='Preserved original stationary station attendant';attendant.castShadow=attendant.receiveShadow=true;group.add(attendant);
  const zone=new Blocks(),radius=Number.isFinite(plan.radius)?plan.radius:2.8;
  for(const z of [-1.22,1.22])zone.box(5,.38,z,radius*2,.08,.065,0xffffff);
  for(const x of [5-radius,5+radius])zone.box(x,.38,0,.065,.08,2.5,0xffffff);
  zone.box(5,1.02,1.85,.10,1.65,.10,0xffffff);zone.box(5,1.96,1.85,.53,.42,.12,0xffffff);
  const zoneMaterial=new THREE.MeshStandardMaterial({color:0xcfb96d,roughness:.7,emissive:0x242012}),stopZone=new THREE.Mesh(zone.geometry(),zoneMaterial);stopZone.name='Unchanged stopping zone';stopZone.castShadow=stopZone.receiveShadow=true;group.add(stopZone);
  box.dispose();group.updateMatrixWorld(true);
  let meshes=0,triangles=0;group.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  proof.drawCalls=meshes;proof.triangles=triangles;proof.signAnchor=PLATFORM_SPEC.sign.slice();proof.signPosition=PLATFORM_SPEC.sign.slice();proof.signSize=[4.20,.74];proof.signTextureSize=[2048,640];proof.lampPositions=proof.lanternPositions;proof.clearWalkway=PLATFORM_SPEC.clearWalkway;group.userData.stationProof=proof;
  let disposed=false;
  return{group,zoneMaterial,sign,proof,dispose(){if(disposed)return;disposed=true;
    // Shared front/back sign material, geometry and attendant/furniture material
    // are released exactly once. Every texture belongs to this station instance.
    const geometries=new Set(),materials=new Set(),textures=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
    for(const resource of [...textures,...materials,...geometries])resource.dispose();group.clear();
  }};
}
