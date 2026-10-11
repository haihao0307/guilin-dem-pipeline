import {CommonViewer} from '../full/ui/Viewer.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
import {DenseSurface} from './DenseSurface.mjs';
/** Reuses the current workbench canvas, renderer, skin pipeline and controls.
 * The production model owns native parameter evaluation; this view evaluates a
 * derived fixed-stencil surface after every original geometry update. */
export class IntegratedViewer extends CommonViewer{
 constructor(options){
  super(options);this.nativeGeometry=this.geometry;this.surfaces=new Map();this.eyeGray=new THREE.MeshStandardMaterial({color:0xb6b6b6,roughness:1,metalness:0});this.eyeGrid=new THREE.MeshStandardMaterial({color:0xb6b6b6,roughness:1,metalness:0});
  for(const [mat,grid]of [[this.eyeGray,false],[this.eyeGrid,true]]){
   mat.onBeforeCompile=s=>{s.vertexShader='attribute vec3 csRest;attribute float csType;varying vec3 vETRest;varying float vETType;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvETRest=csRest;vETType=csType;');s.fragmentShader='varying vec3 vETRest;varying float vETType;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat tone=vETType>5.5?.12:vETType>4.5?.45:1.;diffuseColor.rgb*=tone;${grid?'vec2 uv=vETRest.xy*1000.;vec2 a=abs(fract(uv-.5)-.5)/max(fwidth(uv),vec2(.001));float line=1.-min(min(a.x,a.y),1.);diffuseColor.rgb*=1.-line*.55;':''}`);
   };mat.customProgramCacheKey=()=>grid?'ET11-fixed-rest-grid':'ET11-gray-eye-structure';
  }
  // Preserve the host skin shader and add only a stable iris microstructure field.
  const material=this.skin.material,previous=material.onBeforeCompile;
  material.onBeforeCompile=s=>{previous(s);s.fragmentShader=s.fragmentShader.replace("if(vCSType>4.5&&vCSType<5.5)csOther=vec3(.070,.047,.025);",`if(vCSType>4.5&&vCSType<5.5){vec2 q=vec2(abs(vCSRest.x)-.03085,vCSRest.y-.74813);float angle=atan(q.y,q.x);float radial=length(q);float fiber=.65+.16*sin(angle*97.+radial*1300.)+.10*sin(angle*177.-radial*1900.);csOther=vec3(.094,.062,.037)*fiber;}`);};material.customProgramCacheKey=()=> 'ET11-native-tissue-and-iris';material.needsUpdate=true;this.update();
 }
 update(){
  if(!this.nativeGeometry)return super.update();
  this.inNativeUpdate=true;this.geometry=this.nativeGeometry;this.mesh.geometry=this.nativeGeometry;super.update();this.inNativeUpdate=false;
  const settings=this.model.eyeSurface.settings,level=settings.enabled?settings.resolution:0;
  if(level){if(!this.surfaces.has(level))this.surfaces.set(level,new DenseSurface(this.nativeGeometry,this.model.bodyCount,level));const surface=this.surfaces.get(level);this.geometry=surface.update(this.nativeGeometry);this.mesh.geometry=this.geometry;}
  this.render();
 }
 render(){
  if(this.inNativeUpdate)return;
  if(this.nativeGeometry&&this.model?.eyeSurface){const s=this.model.eyeSurface.settings;this.mesh.material=s.grid?this.eyeGrid:s.gray?this.eyeGray:this.material;this.mesh.material.wireframe=this.wire;}
  super.render();
 }
 setBand(v){if(!this.nativeGeometry)return super.setBand(v);const shown=this.geometry;this.geometry=this.nativeGeometry;super.setBand(v);this.geometry=shown;this.update();}
 report(){return {version:'ET11-U1',nativeVertices:this.model.vertexCount,displayVertices:this.geometry.attributes.position.count,nativeTriangles:this.model.faces.length/3,displayTriangles:this.geometry.index.count/3,resolution:this.model.eyeSurface.settings.resolution,oneRenderer:true,oneCanvas:true,staticHeadReplacement:false,restCoordinates:'source-native rest metres, fixed-stencil interpolation',derivedSurfaceExportAvailable:true,baseTopologyUnchanged:true};}
 exportSurface(){const p=this.geometry.attributes.position.array,out=new Float32Array(p.length);for(let i=0;i<p.length;i+=3){out[i]=p[i];out[i+1]=-p[i+2];out[i+2]=p[i+1];}return {schema:'kaopu/derived-eye-surface@1',positions:out,faces:Uint32Array.from(this.geometry.index.array),metadata:this.report(),units:'metres / Z up / front -Y',profile:this.model.archive()};}
 dispose(){if(this.surfaces){for(const s of this.surfaces.values())s.dispose();this.surfaces.clear();this.geometry=this.nativeGeometry;this.eyeGray.dispose();this.eyeGrid.dispose();}super.dispose();}
}
