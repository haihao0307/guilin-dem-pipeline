import {T,PI,BODY,V,plain,dispose,setAnatomy} from './surface-kernel.mjs';
import {garment} from './garment-surfaces.mjs';
import {OrbitControls} from '../../garments-r04/vendor/OrbitControls.js';
export {garment,setAnatomy};
export class WardrobeRenderer{
 constructor(body,container,library){
  setAnatomy(body);this.library=library;this.container=container;this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','可拖动旋转的三维模特与服装');container.replaceChildren(this.canvas);
  this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.99;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.scene.background=new T.Color('#e8e5df');this.camera=new T.OrthographicCamera(-.9,.9,1.1,-1.1,.01,40);this.target=V(0,body.height*.49,0);
  this.scene.add(new T.HemisphereLight('#ffffff','#a9a196',1.0));
  const key=new T.DirectionalLight('#fff5e5',3.0);key.position.set(-2.5,5,3);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-1.5;key.shadow.camera.right=1.5;key.shadow.camera.top=2;key.shadow.camera.bottom=-1.6;key.shadow.camera.near=.1;key.shadow.camera.far=12;key.shadow.normalBias=.003;key.shadow.bias=-.00007;key.shadow.radius=3;key.target.position.set(0,.9,0);this.scene.add(key,key.target);
  const fill=new T.DirectionalLight('#e4edff',.9);fill.position.set(3,2,3);this.scene.add(fill);const rim=new T.DirectionalLight('#ffffff',1.5);rim.position.set(1,3,-3);this.scene.add(rim);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(body.positions,3));g.setIndex(body.indices);g.computeVertexNormals();
  this.body=new T.Mesh(g,new T.MeshPhysicalMaterial({color:'#e4dfd5',roughness:.38,metalness:.04,clearcoat:.18,clearcoatRoughness:.34}));this.body.castShadow=true;this.body.receiveShadow=true;this.body.name='frozen-anatomical-display-mannequin';this.scene.add(this.body);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({color:'#57504a',opacity:.14}));floor.rotation.x=-PI/2;floor.position.y=-.007;floor.receiveShadow=true;this.scene.add(floor);const base=new T.Mesh(new T.CylinderGeometry(.43,.43,.015,96),plain('#c6c2b8',.5));base.position.y=-.008;base.receiveShadow=true;this.scene.add(base);
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.copy(this.target);this.controls.enableDamping=false;this.controls.enablePan=true;this.controls.minZoom=.75;this.controls.maxZoom=3.2;this.controls.maxPolarAngle=PI*.64;this.controls.addEventListener('change',()=>this.render());
  this.renderTarget=new T.WebGLRenderTarget(270,360,{samples:4});this.renderTarget.texture.colorSpace=T.SRGBColorSpace;this.thumbCamera=new T.OrthographicCamera(-.76,.76,1.015,-1.015,.01,40);this.thumbCamera.position.set(2.5,1.42,7);this.thumbCamera.lookAt(V(0,body.height*.49,0));this.pixels=new Uint8Array(270*360*4);this.scratch=document.createElement('canvas');this.scratch.width=270;this.scratch.height=360;this.scratchContext=this.scratch.getContext('2d');
  this.current=null;this.isDisposed=false;this.auto=false;this.seams=true;this.raf=0;this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();this.view('angle');this.canvas.addEventListener('webglcontextlost',()=>{this.contextLost=true;container.dataset.error='WebGL上下文丢失，请重新载入。'});
 }
 set(row){if(this.current){this.scene.remove(this.current);dispose(this.current)}this.current=garment(row,this.library);this.scene.add(this.current);this.selected=row;this.setSeams(this.seams);this.render();return this.current.userData.metrics}
 setSeams(show){this.seams=show;this.current?.traverse(o=>{if(o.userData.structureLine)o.visible=show});this.render()}
 setBody(show){this.body.visible=show;this.render()}
 view(name){const points={front:[0,1.03,7],angle:[2.5,1.42,7],side:[7,1.1,0],back:[0,1.05,-7],detail:[.3,1.26,6]};this.camera.position.set(...points[name]);this.controls.target.copy(name==='detail'?V(0,1.25,0):this.target);this.camera.zoom=name==='detail'?2.15:1;this.camera.updateProjectionMatrix();this.controls.update();this.render();this.viewName=name;}
 resize(){const{width:w,height:h}=this.container.getBoundingClientRect();if(w<2||h<2||this.isDisposed)return;const extent=BODY.height*.56;this.camera.left=-extent*w/h;this.camera.right=extent*w/h;this.camera.top=extent;this.camera.bottom=-extent;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.render()}
 render(){if(!this.isDisposed)this.renderer.render(this.scene,this.camera)}
 capture(row){
  if(this.contextLost)throw Error('WebGL context lost');
  const temp=garment(row,this.library),prior=this.current?.visible,bodyVisible=this.body.visible,size=this.renderer.getSize(new T.Vector2()),ratio=this.renderer.getPixelRatio();
  if(this.current)this.current.visible=false;this.body.visible=true;this.scene.add(temp);
  try{
   this.renderer.setPixelRatio(1);this.renderer.setSize(270,360,false);this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.thumbCamera);
   this.scratchContext.drawImage(this.canvas,0,0,270,360);
   return{src:this.scratch.toDataURL('image/webp',.91),metrics:temp.userData.metrics};
  }finally{
   this.scene.remove(temp);dispose(temp);if(this.current)this.current.visible=prior;this.body.visible=bodyVisible;
   this.renderer.setPixelRatio(ratio);this.renderer.setSize(size.x,size.y,false);this.render();
  }
 }
 autoRotate(on){this.auto=on;cancelAnimationFrame(this.raf);const step=()=>{if(!this.auto||this.isDisposed)return;const v=this.camera.position.clone().sub(this.controls.target).applyAxisAngle(V(0,1,0),.005);this.camera.position.copy(this.controls.target).add(v);this.controls.update();this.render();this.raf=requestAnimationFrame(step)};if(on)step()}
 state(){return{mannequinVertexCount:this.body.geometry.attributes.position.count,mannequinTriangleCount:this.body.geometry.index.count/3,mannequinSource:'frozen-original-Anny-derived-display-pose',webglContexts:1,view:this.viewName,autoRotate:this.auto,showBody:this.body.visible,showSeams:this.seams,selected:this.selected?.id,metrics:this.current?.userData.metrics,geometryCount:this.renderer.info.memory.geometries,textureCount:this.renderer.info.memory.textures,contextLost:!!this.contextLost}}
 dispose(){if(this.isDisposed)return;this.isDisposed=true;this.auto=false;cancelAnimationFrame(this.raf);this.resizeObserver.disconnect();this.controls.dispose();dispose(this.scene);this.renderTarget.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.canvas.remove()}
}
