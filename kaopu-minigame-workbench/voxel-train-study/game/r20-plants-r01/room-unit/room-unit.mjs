import {createRoomRecipe} from './room-recipe.mjs';
import {createRoomMaterialLibrary,evaluateRoomSurfaceField} from './room-weathering.mjs';
import {planWallUnit} from './foundation/wall-geometry.mjs';
import {subtractOpening} from './foundation/wall-score.mjs';
export function buildDwellingUnit(input,{THREE,createHostMaterialLibrary}={}){
 const s=createRoomRecipe(input),{width:w,depth:d,height:h,wallThickness:t}=s;
 const surfaces=createRoomMaterialLibrary(THREE,{recipe:s.surface,createHostMaterialLibrary});
 const root=new THREE.Group();root.name='One original native dwelling';
 const groups={static:new THREE.Group(),front:new THREE.Group(),roof:new THREE.Group(),door:new THREE.Group()};for(const [name,g] of Object.entries(groups)){g.name='room-'+name;root.add(g);}
 const mats={plaster:surfaces.get('plaster',{color:'#b9b39c'}),interior:surfaces.get('plaster',{color:'#a8afa2'}),concrete:surfaces.get('concrete',{color:'#77786e'}),iron:surfaces.get('iron',{color:'#414a45'}),rustIron:surfaces.get('iron',{color:'#705846'}),zinc:surfaces.get('zinc',{color:'#737e78'}),wood:surfaces.get('wood',{color:'#6f543a'}),darkWood:surfaces.get('wood',{color:'#473f31'}),glass:surfaces.get('glass',{color:'#72958d',opacity:.32,roughness:.2}),cloth:surfaces.get('cloth',{color:'#bcb59a'}),clothBlue:surfaces.get('cloth',{color:'#576c75'}),clothRed:surfaces.get('cloth',{color:'#8d5e51'}),ceramic:surfaces.get('ceramic',{color:'#b2bdac'}),water:surfaces.get('glass',{color:'#3d5750',opacity:.68,roughness:.12})};
 for(const key of ['cloth','clothBlue','clothRed','zinc'])mats[key].side=THREE.DoubleSide;
 const batches=new Map(),geometries=[],colliders=[],fieldSamples=[];let disposed=false,doorOpen=s.doorOpen;
 const P=new THREE.Vector3(),N=new THREE.Vector3();
 function bake(g,mat='plaster',group='static',transform=null,{deform=false,normal=null,tag=''}={}){
  if(transform)g.applyMatrix4(transform);const p=g.attributes.position,n=g.attributes.normal;
  if(deform){for(let i=0;i<p.count;i++){
   P.fromBufferAttribute(p,i);N.fromBufferAttribute(n,i);const a=P.toArray(),nn=normal||N.toArray(),f=evaluateRoomSurfaceField(a,nn,s.surface);
   const relief=Math.max(-.011,Math.min(.006,f.height??((f.plasterThickness??.008)-.012)));
   // Every face remains a solid bounded slab. Recesses share the surface field;
   // no separate repair sticker or material-pass geometry is added later.
   p.setXYZ(i,P.x+N.x*relief,P.y+N.y*relief,P.z+N.z*relief);
   if(i%53===0)fieldSamples.push({p:a,damage:f.damage,height:relief,substrateExposure:f.substrateExposure});
  }g.computeVertexNormals();}
  const key=group+'/'+mat;let b=batches.get(key);if(!b){b={position:[],normal:[],color:[],index:[],mat,group,tags:new Set()};batches.set(key,b);}const off=b.position.length/3;
  for(let i=0;i<p.count;i++){b.position.push(p.getX(i),p.getY(i),p.getZ(i));b.normal.push(g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i));b.color.push(1,1,1);}
  if(g.index)for(const ix of g.index.array)b.index.push(off+ix);else for(let i=0;i<p.count;i++)b.index.push(off+i);if(tag)b.tags.add(tag);g.dispose();
 }
 function transform(pos,rot=[0,0,0]){return new THREE.Matrix4().compose(new THREE.Vector3(...pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),new THREE.Vector3(1,1,1));}
 function box(pos,size,mat,group='static',opts={}){const seg=opts.deform?size.map(v=>Math.max(1,Math.min(28,Math.ceil(v/.18)))):[1,1,1];bake(new THREE.BoxGeometry(...size,...seg),mat,group,transform(pos,opts.rotation),opts);}
 function rod(a,b,r,mat='iron',group='static',segments=8){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),v=bv.clone().sub(av);const g=new THREE.CylinderGeometry(r,r,v.length(),segments,1,false);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());bake(g,mat,group,null,{tag:'native-rod'});}
 function sphere(pos,size,mat='cloth',group='static'){const g=new THREE.SphereGeometry(1,14,8);g.scale(...size);g.translate(...pos);bake(g,mat,group);}
 function wallRect(rect,holes,frame,mat,group){let rs=[rect];for(const hole of holes)rs=rs.flatMap(r=>subtractOpening(r,hole));for(const r of rs){const center=[(r[0]+r[2])/2,(r[1]+r[3])/2,0],dim=[r[2]-r[0],r[3]-r[1],t];let m=frame.clone().multiply(transform(center));bake(new THREE.BoxGeometry(...dim,Math.max(1,Math.ceil(dim[0]/.18)),Math.max(1,Math.ceil(dim[1]/.18)),1),mat,group,m,{deform:true,tag:'bounded-solid-wall'});}}
 const door=s.door,fw=s.frontWindow,sw=s.sideWindow;
 wallRect([-w/2,0,w/2,h],[[door.x-door.width/2,0,door.x+door.width/2,door.height],[fw.x-fw.width/2,fw.bottom,fw.x+fw.width/2,fw.bottom+fw.height]],transform([0,0,0]),'plaster','front');
 wallRect([-d/2,0,d/2,h],[],transform([-w/2,0,-d/2],[0,-Math.PI/2,0]),'plaster','static');
 wallRect([-d/2,0,d/2,h],[[(-sw.z-d/2)-sw.width/2,sw.bottom,(-sw.z-d/2)+sw.width/2,sw.bottom+sw.height]],transform([w/2,0,-d/2],[0,Math.PI/2,0]),'plaster','static');
 wallRect([-w/2,0,w/2,h],[],transform([0,0,-d],[0,Math.PI,0]),'interior','static');
 box([0,-.07,-d/2],[w+.16,.14,d+.16],'concrete','static',{deform:true,tag:'solid-floor'});
 // Finite roof is part of the complete room. Inspection cutaway only hides it.
 box([0,h+.025,-d/2],[w+.30,.10,d+.28],'concrete','roof',{deform:true,tag:'solid-roof'});
 // A narrow corrugated zinc front awning is generated directly from its waves.
 const awn=new THREE.PlaneGeometry(w+.44,.72,90,3);const ap=awn.attributes.position;for(let i=0;i<ap.count;i++){const x=ap.getX(i),z=ap.getY(i);ap.setXYZ(i,x,h-.04+Math.cos(x*2*Math.PI/.092)*.010+z*.13,z+.25);}awn.computeVertexNormals();bake(awn,'zinc','roof',null,{tag:'wave-generated-awning'});
 for(const x of [-1.55,1.55]){rod([x,h-.11,.04],[x,h-.40,.54],.015,'rustIron','roof');rod([x,h-.4,.54],[x,h-.48,.07],.015,'rustIron','roof');}
 function component(plan,offset,yaw=0,frontGroup='front'){
  const matrix=transform(offset,[0,yaw,0]),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
  for(const p of plan.parts){if(['pierced-wall','younger-plaster-repair','ceramic-tile'].includes(p.tag)||p.tag.startsWith('pipe'))continue;
   let mat=({wall:'plaster',repair:'plaster',sill:'concrete',frame:plan.score.kind==='tile-door'?'wood':'iron',glass:'glass',iron:'iron',door:'wood'})[p.material]||'iron';
   const group=p.group==='door'?'door':frontGroup;let g;
   if(p.shape==='box'){g=new THREE.BoxGeometry(...p.size);g.translate(...p.position);}else{const a=new THREE.Vector3(...p.a),b=new THREE.Vector3(...p.b);g=new THREE.CylinderGeometry(p.radius,p.radius,a.distanceTo(b),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());}
   bake(g,mat,group,p.group==='door'?null:matrix,{tag:p.tag});
  }
  if(plan.hinge){groups.door.position.fromArray(new THREE.Vector3(...plan.hinge.position).applyMatrix4(matrix).toArray());groups.door.rotation.y=doorOpen?plan.hinge.openAngle:0;}
 }
 const win=planWallUnit({kind:'cage-window',object:{seed:s.seed+11},dimensions:{width:1.75,height:h,thickness:t},opening:{width:fw.width,height:fw.height,bottom:fw.bottom},material:{repair:0},cage:{depth:.40,barSpacing:.17}});
 component(win,[fw.x,0,0]);
 const dp=planWallUnit({kind:'tile-door',object:{seed:s.seed+12},dimensions:{width:1.7,height:h,thickness:t},opening:{width:door.width,height:door.height,bottom:0},material:{repair:0},pipe:{enabled:false},door:{open:doorOpen}});component(dp,[door.x,0,0]);
 const side=planWallUnit({kind:'plaster-window',object:{seed:s.seed+13},dimensions:{width:1.6,height:h,thickness:t},opening:{width:sw.width,height:sw.height,bottom:sw.bottom},material:{repair:0}});component(side,[w/2,0,sw.z],Math.PI/2,'static');
 // Traceable gutter → downpipe → wall drain. Water supply is a second typed run.
 const rainPoints=[[-1.77,h-.10,.62],[1.59,h-.10,.62],[1.59,h-.18,.20],[1.59,.24,.20],[1.59,.10,.37],[1.59,.10,.62]];
 for(let i=1;i<rainPoints.length;i++)rod(rainPoints[i-1],rainPoints[i],i===1?.045:.031,'rustIron');
 for(const y of [.45,1.45,2.35]){box([1.59,y,.115],[.12,.032,.045],'iron');rod([1.54,y,.2],[1.64,y,.2],.009,'iron');}
 const supplyPoints=[[-1.69,.12,-.08],[-1.69,1.12,-.08],[-1.69,1.12,-2.7]];for(let i=1;i<supplyPoints.length;i++)rod(supplyPoints[i-1],supplyPoints[i],.012,'iron');
 // Low steel bed and native fabric mattress, with a clear central route.
 const bed={x:-1.03,z:-3.04,width:.84,length:1.92};
 box([bed.x,.34,bed.z],[.91,.10,2.00],'iron');
 for(const x of [bed.x-.4,bed.x+.4])for(const z of [bed.z-.86,bed.z+.86])rod([x,.03,z],[x,.39,z],.024,'iron');
 for(const z of [bed.z-.94,bed.z+.94]){rod([bed.x-.43,.39,z],[bed.x-.43,.74,z],.021,'iron');rod([bed.x+.43,.39,z],[bed.x+.43,.74,z],.021,'iron');rod([bed.x-.43,.74,z],[bed.x+.43,.74,z],.021,'iron');}
 box([bed.x,.45,bed.z],[bed.width,.16,bed.length],'cloth');sphere([bed.x,.575,bed.z-.61],[.32,.075,.19],'cloth');
 function fabricRect(x,y,z,width,length,material,phase=0){const g=new THREE.PlaneGeometry(width,length,16,24),p=g.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i),v=p.getY(i);p.setXYZ(i,x+u,y+.025*Math.sin(u*17+phase)*Math.sin(v*7)+.010*Math.sin(v*31+u*9),z+v);}g.computeVertexNormals();bake(g,material);}
 fabricRect(bed.x,.551,bed.z+.30,.89,1.17,'clothBlue',1.2);
 colliders.push({id:'bed',min:[bed.x-.46,0,bed.z-1],max:[bed.x+.46,.80,bed.z+1]});
 // Reused timber rules for desk, stool, shelf, storage chest. No borrowed meshes.
 box([1.03,.77,-.74],[1.00,.075,.62],'wood');for(const x of [.63,1.43])for(const z of [-.98,-.5])box([x,.40,z],[.05,.75,.05],'darkWood');
 colliders.push({id:'table',min:[.52,0,-1.05],max:[1.54,.85,-.4]});
 box([.88,.40,-1.48],[.38,.06,.35],'wood');for(const x of [.75,1.01])for(const z of [-1.60,-1.36])box([x,.2,z],[.043,.39,.043],'darkWood');
 box([1.24,.53,-3.77],[.66,1.05,.67],'wood');for(const y of [.28,.7]){box([1.24,y,-3.425],[.61,.37,.025],'darkWood');rod([1.17,y,-3.39],[1.31,y,-3.39],.009,'iron');}
 colliders.push({id:'cupboard',min:[.88,0,-4.13],max:[1.60,1.10,-3.40]});
 box([.72,1.83,-4.16],[1.70,.055,.28],'wood');for(const x of [.10,1.25]){rod([x,1.58,-4.19],[x,1.81,-4.02],.011,'iron');box([x,1.71,-4.21],[.035,.30,.03],'iron');}
 // Small kettle, enamel basin, stacked containers, folded towel and a repair box.
 const lathe=(points,pos,mat,segments=16)=>{const g=new THREE.LatheGeometry(points.map(v=>new THREE.Vector2(...v)),segments);g.translate(...pos);bake(g,mat);};
 lathe([[.07,0],[.115,.02],[.13,.12],[.10,.18],[.04,.19]],[.88,.81,-.73],'zinc');sphere([.88,1.015,-.73],[.035,.015,.035],'iron');rod([.96,.92,-.73],[1.10,.99,-.73],.027,'zinc');
 for(let i=0;i<8;i++){const a=i*Math.PI/7,b=(i+1)*Math.PI/7;rod([.88+Math.cos(a)*.11,1+Math.sin(a)*.10,-.73],[.88+Math.cos(b)*.11,1+Math.sin(b)*.10,-.73],.010,'iron');}
 lathe([[.035,0],[.09,.018],[.12,.06],[.125,.065],[.116,.055],[.08,.025]],[1.29,.814,-.65],'ceramic');
 for(const [x,ht,r] of [[.3,.16,.065],[.56,.22,.08],[1.12,.13,.09]])lathe([[r,0],[r,ht],[r*.85,ht+.015]],[x,1.86,-4.15],'ceramic',12);
 box([-1.08,.12,-1.5],[.44,.22,.32],'wood');box([-1.08,.235,-1.5],[.47,.028,.34],'darkWood');rod([-1.15,.265,-1.5],[-1.0,.265,-1.5],.012,'iron');
 lathe([[.11,0],[.14,.02],[.17,.27],[.176,.285],[.155,.28],[.13,.03]],[1.48,.01,-1.67],'zinc');
 // Two native cloth garments and a towel hang from a sagging line, away from door.
 const lineA=[.05,2.42,.62],lineB=[1.52,2.43,.62],linePoints=[];for(let i=0;i<=14;i++){const q=i/14;linePoints.push([lineA[0]+q*(lineB[0]-lineA[0]),2.42-.06*Math.sin(q*Math.PI),.62]);if(i)rod(linePoints[i-1],linePoints[i],.004,'iron');}
 function garment(cx,topY,z,width,length,mat,shirt){
  const pts=shirt?[[-.15,0],[-.30,-.07],[-.5,-.21],[-.40,-.34],[-.25,-.27],[-.26,-1],[.26,-1],[.25,-.27],[.40,-.34],[.5,-.21],[.30,-.07],[.15,0],[.10,-.10],[-.10,-.10]]:[[-.5,0],[-.5,-1],[.5,-1],[.5,0]];
  const shape=new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x*width,y*length)));let g=new THREE.ShapeGeometry(shape,2).toNonIndexed();
  // Refine the fixed silhouette twice, then evaluate its hanging-wave surface.
  for(let k=0;k<3;k++){const a=g.attributes.position.array,v=[];for(let i=0;i<a.length;i+=9){const A=Array.from(a.slice(i,i+3)),B=Array.from(a.slice(i+3,i+6)),C=Array.from(a.slice(i+6,i+9)),ab=A.map((x,j)=>(x+B[j])/2),bc=B.map((x,j)=>(x+C[j])/2),ca=C.map((x,j)=>(x+A[j])/2);for(const p of [A,ab,ca,ab,B,bc,ca,bc,C,ab,bc,ca])v.push(...p);}g.dispose();g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));}
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),fall=-y/length;p.setXYZ(i,cx+x,topY+y,z+.026*Math.sin(x*37+fall*1.7)*fall+.03*Math.sin(fall*3.1));}g.computeVertexNormals();bake(g,mat);
  for(const x of [cx-width*.14,cx+width*.14])box([x,topY+.025,z],[.018,.062,.025],'wood');
 }
 garment(.40,2.36,.63,.67,.65,'cloth',true);garment(.96,2.36,.64,.55,.57,'clothRed',true);garment(1.38,2.38,.65,.25,.67,'clothBlue',false);
 // A visible tungsten bulb and wire provide a physically located interior light.
 rod([.13,h-.06,-2.04],[.13,2.28,-2.04],.004,'iron');
 sphere([.13,2.24,-2.04],[.042,.059,.042],'ceramic');
 lathe([[.12,0],[.085,.08],[.045,.09]],[.13,2.30,-2.04],'zinc');
 const lamp=new THREE.PointLight(0xffcf8a,13,5.5,2);lamp.position.set(.13,2.18,-2.04);root.add(lamp);
 // Narrow service threshold remains unoccupied. Common kitchen/toilet is an
 // unresolved external graph destination, not a fabricated room behind paint.
 box([door.x,-.025,.27],[door.width+.18,.055,.38],'concrete');
 let triangles=0,bytes=0;
 for(const b of batches.values()){
  const g=new THREE.BufferGeometry();for(const key of ['position','normal','color'])g.setAttribute(key,new THREE.Float32BufferAttribute(b[key],3));g.setIndex(b.index);g.computeBoundingBox();g.computeBoundingSphere();geometries.push(g);const mesh=new THREE.Mesh(g,mats[b.mat]);mesh.name=b.group+'/'+b.mat;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.tags=[...b.tags];groups[b.group].add(mesh);triangles+=g.index.count/3;bytes+=g.index.array.byteLength;for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;
 }
 const graph={nodes:[{id:'front-common-corridor',position:[door.x,.01,.55],type:'walk',destination:'shared-kitchen-toilet-network',connected:false},{id:'inside-entry',position:[door.x,.01,-.55],type:'walk'},{id:'central-room',position:[0,.01,-1.7],type:'walk'},{id:'bedside',position:[-.05,.01,-3],type:'walk'}],edges:[{from:'front-common-corridor',to:'inside-entry',width:dp.opening.clearWidth,height:dp.opening.clearHeight,enabled:doorOpen},{from:'inside-entry',to:'central-room',width:.82,height:2.3,enabled:true},{from:'central-room',to:'bedside',width:.80,height:2.3,enabled:true}]};
 const proof={schema:s.schema,id:s.id,units:'metres',originalProcedural:true,singleRecipe:true,externalMeshes:0,imageTextures:0,completeRoom:true,standingFloor:true,closedRoof:true,bedCount:1,bedCountMeaning:'one inspection furnishing; not final population rule',shapeAndSurfaceField:s.surface,fieldSamples,geometryFieldBoundM:[-.011,.006],wallCoreMinThicknessM:t-.022,stats:{triangles,geometryBytes:bytes,drawCalls:batches.size,materials:Object.keys(mats).length},graph,colliders,utilityPaths:[{role:'rainwater',points:rainPoints,from:'gutter',to:'external-drain',endConnected:false},{role:'water-supply',points:supplyPoints,from:'external-common-service',to:'reserved-interior-endpoint',endConnected:false}],doorOpen,cutaway:false,construction:'single build from immutable metric recipe, field generated shape and material together'};
 root.userData.dwelling=proof;
 function setDoorOpen(value){if(typeof value!=='boolean')throw Error('Boolean door state required');doorOpen=value;groups.door.rotation.y=value?dp.hinge.openAngle:0;proof.doorOpen=value;graph.edges[0].enabled=value;}
 function measure(){root.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(root);return{...proof.stats,bounds:{min:b.min.toArray(),max:b.max.toArray()}};}
 surfaces.update(0,{wetness:s.wetness});
 return{root,groups,recipe:s,proof,measure,setDoorOpen,
  update(seconds,weather={}){if(disposed)throw Error('Disposed room');surfaces.update(seconds,{wetness:weather.wetness??s.wetness});},
  setInspectionCutaway(value){groups.roof.visible=!value;groups.front.visible=!value;groups.door.visible=!value;proof.cutaway=!!value;},
  dispose(){if(disposed)return;for(const g of geometries)g.dispose();surfaces.dispose();root.removeFromParent();root.clear();disposed=true;}};
}
