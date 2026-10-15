import * as T from '../geometry-orbit-r01/vendor/three.module.js';
export const PALETTE={stone:0xc9bb9e,trim:0xe0d3b6,brick:0xb09170,plaster:0xe8ddc7,roof:0x535e62,iron:0x34514b,darkIron:0x263b39,wood:0x77583c,woodLight:0xb09365,glass:0xa2c6cc,floor:0xafa897,paving:0xbcb5a5,ground:0xa8ac9a,road:0x858b85,soil:0x827663,black:0x303533,paper:0xd9cfad,brass:0xb69a58,blue:0x437d99,red:0xba6b46,green:0x64835c};
export class AssemblyBuilder{
 constructor(){this.root=new T.Group();this.buckets=new Map();this.elements=[];this.layer='envelope';this.group='unassigned';this.part=0;this.materials={};}
 set(layer,group){this.layer=layer;this.group=group;}
 add(g,mat='stone',matrix=null){if(matrix)g.applyMatrix4(matrix);if(g.index)g=g.toNonIndexed();
 // Ear clipping can emit collinear side triangles on stepped profiles. Remove only zero-area faces.
 const pos=g.attributes.position,keep=[];for(let i=0;i<pos.count;i+=3){const a=new T.Vector3().fromBufferAttribute(pos,i),u=new T.Vector3().fromBufferAttribute(pos,i+1).sub(a),v=new T.Vector3().fromBufferAttribute(pos,i+2).sub(a);if(u.cross(v).lengthSq()>1e-14)keep.push(i,i+1,i+2);}if(keep.length!==pos.count){for(const[k,att]of Object.entries(g.attributes)){const values=[];for(const i of keep)for(let j=0;j<att.itemSize;j++)values.push(att.array[i*att.itemSize+j]);g.setAttribute(k,new T.Float32BufferAttribute(values,att.itemSize));}}
 if(!g.attributes.normal)g.computeVertexNormals();const key=this.layer+':'+mat;let b=this.buckets.get(key);if(!b)this.buckets.set(key,b={positions:[],normals:[],ranges:[]});const first=b.positions.length/3; for(const q of g.attributes.position.array)b.positions.push(q);for(const q of g.attributes.normal.array)b.normals.push(q);g.computeBoundingBox();this.elements.push({id:`${this.group}:${++this.part}`,group:this.group,layer:this.layer,material:mat,start:first,count:g.attributes.position.count,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()]});g.dispose();}
 box(c,size,mat='stone'){const g=new T.BoxGeometry(...size);g.translate(...c);this.add(g,mat);}
 cyl(c,r,h,mat='stone',rt=r,segments=16){const g=new T.CylinderGeometry(rt,r,h,segments,1);g.translate(...c);this.add(g,mat);}
 rod(a,b,r=.055,mat='iron',sides=8){const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);if(d.length()<1e-6)return;const g=new T.CylinderGeometry(r,r,d.length(),sides,1);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());this.add(g,mat);}
 beam(a,b,w=.16,d=.2,mat='iron'){const av=new T.Vector3(...a),bv=new T.Vector3(...b),v=bv.clone().sub(av),g=new T.BoxGeometry(w,v.length(),d);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());this.add(g,mat);}
 lathe(c,profile,mat='stone',segments=12){const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),segments);g.translate(...c);this.add(g,mat);}
 extrude(points,depth,map,mat='stone',holes=[]){const s=new T.Shape(points.map(p=>new T.Vector2(...p)));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(...p))));const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16});const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setXYZ(i,...map(a.getX(i),a.getY(i),a.getZ(i)-depth/2));g.computeVertexNormals();this.add(g,mat);}
 quad(points,mat='roof'){points=points.filter((p,i)=>i===0||p.some((v,j)=>Math.abs(v-points[i-1][j])>1e-9));if(points.length<3)return;const g=new T.BufferGeometry(),p=[];for(let i=1;i<points.length-1;i++)for(const j of[0,i,i+1])p.push(...points[j]);g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();this.add(g,mat);}
 prism(top,thickness,mat='roof'){// All faces are generated from the same boundary; no height-field triangulation.
  top=top.filter((p,i)=>i===0||p.some((v,j)=>Math.abs(v-top[i-1][j])>1e-9));const down=top.map(p=>[p[0],p[1]-thickness,p[2]]);this.quad(top,mat);this.quad([...down].reverse(),mat);for(let i=0;i<top.length;i++)this.quad([top[i],down[i],down[(i+1)%top.length],top[(i+1)%top.length]],mat);
 }
 tube(points,r=.05,mat='iron'){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));this.add(new T.TubeGeometry(curve,12,r,6,false),mat);}
 finish(){let triangles=0;for(const[key,b]of this.buckets){const[layer,mat]=key.split(':'),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));g.computeBoundingBox();g.computeBoundingSphere();let m=this.materials[mat];if(!m){m=new T.MeshStandardMaterial({color:PALETTE[mat],roughness:mat==='iron'?.62:mat==='wood'?.72:.89,metalness:['iron','darkIron','brass'].includes(mat)?.28:0,side:T.DoubleSide,transparent:mat==='glass',opacity:mat==='glass'?.26:1,depthWrite:mat!=='glass'});if(mat==='glass'){m.roughness=.28;m.metalness=.15;}this.materials[mat]=m;}const mesh=new T.Mesh(g,m);mesh.name=key;mesh.userData={layer,material:mat};mesh.castShadow=!['ground','road','glass','routes'].includes(mat)&&layer!=='site';mesh.receiveShadow=mat!=='glass';this.root.add(mesh);triangles+=b.positions.length/9;}this.root.updateMatrixWorld(true);return{root:this.root,elements:this.elements,triangles,materials:this.materials};}
}
export function archOutline(u,b,r,spring,segments=24){const p=[[u-r,b],[u-r,b+spring]];for(let i=1;i<=segments;i++){const a=Math.PI-i*Math.PI/segments;p.push([u+r*Math.cos(a),b+spring+r*Math.sin(a)]);}p.push([u+r,b]);return p;}
export const rectangle=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
export const wallMap=(axis,fixed,origin=0)=>axis==='x'?(u,y,d)=>[fixed+d,y,origin+u]:(u,y,d)=>[origin+u,y,fixed+d];
export function wall(B,axis,fixed,a,b,y0,y1,depth,openings=[],mat='brick'){
 const outline=o=>o.kind==='arch'?archOutline(o.u,o.bottom,o.radius,o.spring):[[o.u-o.width/2,o.bottom],[o.u-o.width/2,o.top],[o.u+o.width/2,o.top],[o.u+o.width/2,o.bottom]];const ground=openings.filter(o=>Math.abs(o.bottom-y0)<1e-7).sort((a,b)=>a.u-b.u),holes=openings.filter(o=>o.bottom>y0+1e-7).map(outline);let shape=[[a,y0]];for(const o of ground)shape.push(...outline(o));shape.push([b,y0],[b,y1],[a,y1]);
 B.extrude(shape,depth,wallMap(axis,fixed),mat,holes);
}
export function archDress(B,axis,fixed,u,b,r,spring,w=.32,depth=.82){
 const map=wallMap(axis,fixed),n=15,gap=.006;
 for(const s of[-1,1])B.extrude(rectangle(u+s*r+(s<0?-w:0),b,u+s*r+(s>0?w:0),b+spring),depth,map,'trim');
 for(let i=0;i<n;i++){const a=i*Math.PI/n+gap,c=(i+1)*Math.PI/n-gap,pts=[];for(let j=0;j<=3;j++){const t=a+(c-a)*j/3;pts.push([u+(r+w)*Math.cos(t),b+spring+(r+w)*Math.sin(t)]);}for(let j=3;j>=0;j--){const t=a+(c-a)*j/3;pts.push([u+r*Math.cos(t),b+spring+r*Math.sin(t)]);}B.extrude(pts,depth,map,i===7?'stone':'trim');}
}
export function sash(B,axis,fixed,u,b,w,h,arched=false){
 const map=wallMap(axis,fixed),r=w/2,spring=h-r;
 if(arched){B.extrude(archOutline(u,b,r,spring),.018,map,'glass');const pts=archOutline(u,b,r,spring);for(let i=0;i<pts.length-1;i++)B.beam(map(...pts[i],0),map(...pts[i+1],0),.085,.09,'wood');}
 else{B.extrude(rectangle(u-w/2,b,u+w/2,b+h),.018,map,'glass');for(const s of[-1,1])B.beam(map(u+s*w/2,b,0),map(u+s*w/2,b+h,0),.09,.09,'wood');for(const y of[b,b+h])B.beam(map(u-w/2,y,0),map(u+w/2,y,0),.09,.09,'wood');}
 const straight=arched?spring:h;B.beam(map(u,b,0),map(u,b+straight,0),.065,.09,'wood');for(const t of[.33,.66])B.beam(map(u-w/2,b+straight*t,0),map(u+w/2,b+straight*t,0),.06,.08,'wood');if(arched){for(const a of[Math.PI/4,Math.PI/2,Math.PI*3/4])B.beam(map(u,b+spring,0),map(u+r*Math.cos(a),b+spring+r*Math.sin(a),0),.045,.06,'wood');}
 const c=map(u,b-.08,0);B.box(c,axis==='x'?[.7,.16,w+.3]:[w+.3,.16,.7],'trim');
}
export function hipRoof(B,x0,x1,z0,z1,eave,ridge,axis='z',mat='roof'){
 const cx=(x0+x1)/2,cz=(z0+z1)/2;
 if(axis==='z'){const h=Math.min((x1-x0)/2,(z1-z0)/2-.01),za=z0+h,zb=z1-h;B.prism([[x0,eave,z0],[cx,ridge,za],[cx,ridge,zb],[x0,eave,z1]],.18,mat);B.prism([[cx,ridge,za],[x1,eave,z0],[x1,eave,z1],[cx,ridge,zb]],.18,mat);B.prism([[x0,eave,z0],[x1,eave,z0],[cx,ridge,za],[cx,ridge,za]],.18,mat);B.prism([[x1,eave,z1],[x0,eave,z1],[cx,ridge,zb],[cx,ridge,zb]],.18,mat);B.rod([cx,ridge+.04,za],[cx,ridge+.04,zb],.085,mat,8);}
 else{const h=Math.min((z1-z0)/2,(x1-x0)/2-.01),xa=x0+h,xb=x1-h;B.prism([[x0,eave,z0],[xa,ridge,cz],[xb,ridge,cz],[x1,eave,z0]],.18,mat);B.prism([[xa,ridge,cz],[x0,eave,z1],[x1,eave,z1],[xb,ridge,cz]],.18,mat);B.prism([[x0,eave,z1],[x0,eave,z0],[xa,ridge,cz],[xa,ridge,cz]],.18,mat);B.prism([[x1,eave,z0],[x1,eave,z1],[xb,ridge,cz],[xb,ridge,cz]],.18,mat);B.rod([xa,ridge+.04,cz],[xb,ridge+.04,cz],.085,mat,8);}
}
