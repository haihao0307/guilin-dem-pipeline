// KAOPU street-study geometry, metres. Laundry spans adapted from frozen KST1.
export function buildObject(T,family,materials){
 const root=new T.Group();const stats={parts:0};
 const put=(g,m,p=[0,0,0])=>{const o=new T.Mesh(g,m);o.position.fromArray(p);o.castShadow=true;o.receiveShadow=true;root.add(o);stats.parts++;return o};
 const box=(w,h,d,p,m=materials.metal)=>put(new T.BoxGeometry(w,h,d),m,p);
 const rod=(a,b,r=.025,m=materials.metal)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),dir=bv.clone().sub(av);const o=put(new T.CylinderGeometry(r,r,dir.length(),20),m,av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return o};
 const bolt=(x,y,z,m=materials.metal)=>put(new T.CylinderGeometry(.022,.022,.035,6),m,[x,y,z]);
 if(family==='lamp'){
  box(.50,.09,.50,[0,.045,0],materials.masonry);box(.28,.026,.28,[0,.103,0]);
  for(const x of [-.103,.103])for(const z of [-.103,.103])bolt(x,.135,z);
  put(new T.CylinderGeometry(.052,.079,3.40,32),materials.metal,[0,1.84,0]);
  for(const y of [.22,2.65])put(new T.CylinderGeometry(.083,.083,.055,32),materials.metal,[0,y,0]);
  box(.09,.34,.024,[0,.61,.076]);for(const y of [.49,.74]){const b=bolt(0,y,.095);b.rotation.x=Math.PI/2;}
  const pts=[[0,3.5,0],[.12,3.72,0],[.4,3.8,0],[.76,3.8,0]].map(p=>new T.Vector3(...p));put(new T.TubeGeometry(new T.CatmullRomCurve3(pts),28,.044,16,false),materials.metal);
  const shade=put(new T.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI*.5),materials.metal,[.76,3.75,0]);shade.scale.set(.31,.14,.22);
  const lens=put(new T.CircleGeometry(.21,32),materials.lens,[.76,3.733,0]);lens.rotation.x=Math.PI/2;lens.scale.x=1.3;
 }else if(family==='rack'){
  box(2.25,2.38,.12,[0,1.19,-.12],materials.masonry);
  for(const x of [-.9,.9]){box(.15,.26,.028,[x,1.72,0]);for(const y of [1.63,1.81]){const b=bolt(x,y,.025);b.rotation.x=Math.PI/2;}rod([x,1.72,.04],[x,1.88,1.33],.025);rod([x,1.35,.04],[x,1.88,1.28],.019);}
  for(const z of [.52,.92,1.33]){const pts=[];for(let j=0;j<=18;j++){const t=j/18;pts.push(new T.Vector3(-.9+1.8*t,1.88-.1*Math.sin(Math.PI*t),z))}put(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.009,8,false),materials.metal)}
  // A single small cloth gives scale without hiding the metal structure.
  const cloth=new T.PlaneGeometry(.45,.56,12,14),pos=cloth.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.025*Math.sin(x*25)*(1-(y+.28)/.56))}cloth.computeVertexNormals();put(cloth,materials.cloth,[-.28,1.48,1.33]);
 }else if(family==='sign'){
  box(.28,2.8,.65,[-.88,1.4,-.18],materials.masonry);
  // R02 frame sized for close material inspection, with KST1 bracket/anchor topology.
  const x0=-.45,x1=1.05,y0=1.,y1=2.45,z=.66;
  for(const y of [y0,y1]){box(.13,.22,.04,[-.88,y,.17]);rod([-.88,y,.18],[x0,y,z],.038);rod([-.88,y-.23,.18],[x0,y,z],.031);}
  box(1.5,.065,.09,[(x0+x1)/2,y0,z]);box(1.5,.065,.09,[(x0+x1)/2,y1,z]);box(.065,1.45,.09,[x0,(y0+y1)/2,z]);box(.065,1.45,.09,[x1,(y0+y1)/2,z]);
  box(1.38,1.33,.025,[(x0+x1)/2,(y0+y1)/2,z],materials.sign);
  for(const x of [x0+.08,x1-.08])for(const y of [y0+.09,y1-.09]){const b=bolt(x,y,z+.06);b.rotation.x=Math.PI/2;}
  // Visible bracing and three horizontal metal carriers behind the sign face.
  for(const y of [1.12,1.7,2.33])rod([x0+.05,y,z-.055],[x1-.05,y,z-.055],.018);
 }else{
  box(6.6,.14,9,[0,.02,0],materials.metal);
  for(const x of [-3.43,3.43]){box(.24,.27,9,[x,.095,0],materials.masonry);for(let z=-4.;z<=4.;z+=1.)box(.25,.012,.016,[x,.236,z],materials.joint)}
  if(family==='asphalt'){
   // Two drainage grates tie gutter staining to a real receiver/location.
   for(const z of [-2.6,2.6]){box(.32,.012,.55,[3.0,.099,z],materials.drain);for(let k=0;k<6;k++)box(.24,.008,.018,[3.0,.108,z-.21+k*.084],materials.joint)}
  }
 }
 root.userData.stats=stats;return root;
}
