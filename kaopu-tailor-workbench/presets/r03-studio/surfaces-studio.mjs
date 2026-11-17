import {T,PI,BODY,V,plain,dispose,setAnatomy} from './surface-kernel-studio.mjs';
import {garment} from './garment-surfaces-studio.mjs';
import {OrbitControls} from '../../garments-r04/vendor/OrbitControls.js';
export {garment,setAnatomy};
function createBackdropTexture(){
 const c=document.createElement('canvas');c.width=768;c.height=512;
 const x=c.getContext('2d');
 const g=x.createRadialGradient(390,170,20,390,220,520);
 g.addColorStop(0,'#555149');g.addColorStop(.34,'#353731');g.addColorStop(.72,'#242722');g.addColorStop(1,'#141715');
 x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
 const v=x.createLinearGradient(0,0,0,c.height);
 v.addColorStop(0,'rgba(255,245,225,.10)');v.addColorStop(.48,'rgba(255,245,225,.015)');v.addColorStop(1,'rgba(0,0,0,.24)');
 x.fillStyle=v;x.fillRect(0,0,c.width,c.height);
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}
export class WardrobeRenderer{
 constructor(body,container,library){
  setAnatomy(body);this.library=library;this.container=container;this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','可拖动旋转的真实三维服装模特');
  container.replaceChildren(this.canvas);
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.06;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.background=new T.Color('#171917');this.target=V(0,body.height*.49,0);
  this.backdropTexture=createBackdropTexture();
  this.backdrop=new T.Mesh(new T.PlaneGeometry(14,9),new T.MeshBasicMaterial({map:this.backdropTexture,side:T.DoubleSide,toneMapped:false,depthWrite:false}));
  this.backdrop.position.set(0,2.35,-2.55);this.scene.add(this.backdrop);
  this.scene.add(new T.HemisphereLight('#fff5e7','#5a554c',.95));
  const key=new T.DirectionalLight('#fff0d8',3.45);key.position.set(-2.7,4.7,4.6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.65;key.shadow.camera.right=1.65;key.shadow.camera.top=2.1;key.shadow.camera.bottom=-1.7;key.shadow.camera.near=.1;key.shadow.camera.far=13;key.shadow.normalBias=.003;key.shadow.bias=-.00007;key.shadow.radius=5;key.target.position.set(0,.92,0);this.scene.add(key,key.target);
  const fill=new T.DirectionalLight('#d9e4f6',1.15);fill.position.set(3.6,2.3,3.2);this.scene.add(fill);
  const rim=new T.DirectionalLight('#fff6e8',2.05);rim.position.set(.7,3.6,-3.8);this.scene.add(rim);
  const front=new T.DirectionalLight('#f4eadb',.48);front.position.set(-.2,1.7,6);this.scene.add(front);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(body.positions,3));g.setIndex(body.indices);g.computeVertexNormals();
  this.body=new T.Mesh(g,new T.MeshPhysicalMaterial({color:'#d8c5b0',roughness:.57,metalness:0,sheen:.08,sheenRoughness:.92,clearcoat:.035,clearcoatRoughness:.9}));
  this.body.castShadow=true;this.body.receiveShadow=true;this.body.name='frozen-anatomical-display-mannequin';this.scene.add(this.body);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#252722',roughness:.9,metalness:.015}));floor.rotation.x=-PI/2;floor.position.y=-.018;floor.receiveShadow=true;this.scene.add(floor);
  const baseMat=new T.MeshPhysicalMaterial({color:'#3b3c36',roughness:.42,metalness:.22,clearcoat:.32,clearcoatRoughness:.36});
  const base=new T.Mesh(new T.CylinderGeometry(.435,.455,.026,96),baseMat);base.position.y=-.008;base.receiveShadow=true;base.castShadow=true;this.scene.add(base);
  const ring=new T.Mesh(new T.TorusGeometry(.405,.0045,8,96),new T.MeshStandardMaterial({color:'#b79b6b',metalness:.62,roughness:.34}));ring.rotation.x=PI/2;ring.position.y=.006;this.scene.add(ring);
  this.camera=new T.OrthographicCamera(-.9,.9,1.1,-1.1,.01,40);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.copy(this.target);this.controls.enableDamping=false;this.controls.enablePan=true;this.controls.minZoom=.72;this.controls.maxZoom=3.45;this.controls.maxPolarAngle=PI*.64;this.controls.addEventListener('change',()=>this.render());
  this.thumbCamera=new T.OrthographicCamera(-.76,.76,1.015,-1.015,.01,40);this.thumbCamera.position.set(2.65,1.5,7.25);this.thumbCamera.lookAt(this.target);
  this.scratch=document.createElement('canvas');this.scratch.width=480;this.scratch.height=640;this.scratchContext=this.scratch.getContext('2d',{alpha:false});this.scratchContext.imageSmoothingEnabled=true;this.scratchContext.imageSmoothingQuality='high';
  this.current=null;this.isDisposed=false;this.auto=false;this.seams=true;this.raf=0;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.view('angle');
  this.canvas.addEventListener('webglcontextlost',()=>{this.contextLost=true;container.dataset.error='WebGL 上下文丢失，请重新载入。'});
 }
 set(row){if(this.current){this.scene.remove(this.current);dispose(this.current)}this.current=garment(row,this.library);this.scene.add(this.current);this.selected=row;this.setSeams(this.seams);this.render();return this.current.userData.metrics}
 setSeams(show){this.seams=show;this.current?.traverse(o=>{if(o.userData.structureLine)o.visible=show});this.render()}
 setBody(show){this.body.visible=show;this.render()}
 view(name){const points={front:[0,1.03,7],angle:[2.55,1.45,7.2],side:[7,1.1,0],back:[0,1.05,-7],detail:[.3,1.26,6]};this.camera.position.set(...points[name]);this.controls.target.copy(name==='detail'?V(0,1.25,0):this.target);this.camera.zoom=name==='detail'?2.05:1;this.camera.updateProjectionMatrix();this.controls.update();this.render();this.viewName=name}
 resize(){const{width:w,height:h}=this.container.getBoundingClientRect();if(w<2||h<2||this.isDisposed)return;const extent=BODY.height*.56;this.camera.left=-extent*w/h;this.camera.right=extent*w/h;this.camera.top=extent;this.camera.bottom=-extent;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.render()}
 render(){if(!this.isDisposed)this.renderer.render(this.scene,this.camera)}
 capture(row){
  if(this.contextLost)throw Error('WebGL context lost');
  const temp=garment(row,this.library),prior=this.current?.visible,bodyVisible=this.body.visible,size=this.renderer.getSize(new T.Vector2()),ratio=this.renderer.getPixelRatio();
  if(this.current)this.current.visible=false;this.body.visible=true;this.scene.add(temp);
  try{
   this.renderer.setPixelRatio(1);this.renderer.setSize(480,640,false);this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.thumbCamera);
   this.scratchContext.clearRect(0,0,480,640);this.scratchContext.drawImage(this.canvas,0,0,480,640);
   return{src:this.scratch.toDataURL('image/webp',.94),metrics:temp.userData.metrics};
  }finally{
   this.scene.remove(temp);dispose(temp);if(this.current)this.current.visible=prior;this.body.visible=bodyVisible;
   this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.render();
  }
 }
 autoRotate(on){this.auto=on;cancelAnimationFrame(this.raf);const step=()=>{if(!this.auto||this.isDisposed)return;const v=this.camera.position.clone().sub(this.controls.target).applyAxisAngle(V(0,1,0),.005);this.camera.position.copy(this.controls.target).add(v);this.controls.update();this.render();this.raf=requestAnimationFrame(step)};if(on)step()}
 state(){return{mannequinVertexCount:this.body.geometry.attributes.position.count,mannequinTriangleCount:this.body.geometry.index.count/3,mannequinSource:'frozen-original-Anny-derived-display-pose',webglContexts:1,view:this.viewName,autoRotate:this.auto,showBody:this.body.visible,showSeams:this.seams,selected:this.selected?.id,metrics:this.current?.userData.metrics,geometryCount:this.renderer.info.memory.geometries,textureCount:this.renderer.info.memory.textures,contextLost:!!this.contextLost,thumbnailResolution:'480x640 WebP / 3D render'}}
 dispose(){if(this.isDisposed)return;this.isDisposed=true;this.auto=false;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.controls.dispose();dispose(this.scene);this.backdropTexture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove()}
}
