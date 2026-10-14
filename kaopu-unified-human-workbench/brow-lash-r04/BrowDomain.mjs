import * as THREE from '../full/source/registration-vendor/three.module.js';
import {curve2,sub,add,mul,bindOffsets} from '../brow-lash-r01/SurfaceBinding.mjs';
import {BoundSurfaceSampler} from '../brow-lash-r01/BoundSurfaceSampler.mjs';
import {domainWidth,BROW_REGIONS} from './Profiles.mjs';
export const DOMAIN_SCHEMA='kaopu/brow-growth-domain@1';
/** Candidate root-bearing patch on the retained skin, not a cosmetic hair-tip silhouette. */
export class BrowDomain{
 constructor(groom){this.groom=groom;this.mode='regions';this.opacity=.38;this.group=new THREE.Group();this.group.name='R04_BROW_ROOT_DOMAIN';groom.viewer.mesh.add(this.group);this.entries=[];this.revision=0;this.lastSignature='';this.build();}
 disposeGeometry(){for(const e of this.entries){e.object.geometry.dispose();e.object.material.dispose();this.group.remove(e.object);}this.entries=[];}
 build(){this.disposeGeometry();const g=this.groom,geo=g.viewer.mesh.geometry;this.anchors=[];this.eyes=[];this.failedQueries=0;
 for(const side of ['right','left']){
  const ids=side==='right'?[21,20,19,18,17]:[22,23,24,25,26],corner=side==='right'?[39,36]:[42,45];
  const controls=ids.map(i=>g.frame.project(g.landmark(i))),eyePoints=corner.map(i=>g.frame.project(g.landmark(i)));
  const eyeWidth=Math.abs(eyePoints[1][0]-eyePoints[0][0]),half=Math.max(.0035,Math.min(.0047,eyeWidth*.135));
  const dir=Math.sign(controls[4][0]-controls[0][0]);controls[0][0]-=dir*.00065;controls[4][0]+=dir*.00055;
  const at=(u,v)=>{const c=curve2(controls,u),a=curve2(controls,Math.max(0,u-.002)),b=curve2(controls,Math.min(1,u+.002)),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,nx=-dy/l*dir,ny=dx/l*dir,w=half*domainWidth(u);return[c[0]+nx*w*v,c[1]+ny*w*v];};
  const hit=(u,v,lift=.00006)=>{const xy=at(u,v),h=g.display.query(...xy);if(!h){this.failedQueries++;throw Error('眉毛范围超出当前表皮：'+side);}const p=add(h.position,mul(h.normal,lift)),anchor=bindOffsets(h,[p],geo);this.anchors.push(anchor);return{p,anchor,xy};};
  const center=Array.from({length:101},(_,i)=>hit(i/100,0)),widths=Array.from({length:101},(_,i)=>half*2*domainWidth(i/100));let length=0;for(let i=1;i<center.length;i++)length+=Math.hypot(...sub(center[i].p,center[i-1].p));
  this.eyes.push({side,controls,halfWidthM:half,centerlineLengthMM:length*1000,maxRootBandWidthMM:Math.max(...widths)*1000,innerCanthus:eyePoints[0],outerCanthus:eyePoints[1],medialEnd:at(0,0),lateralEnd:at(1,0),centerline:center.map(s=>s.p)});
  for(const region of BROW_REGIONS){const rows=Math.max(10,Math.ceil((region.b-region.a)*120)),cols=10,samples=[],indices=[];
   for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++)samples.push(hit(region.a+(region.b-region.a)*i/rows,-1+2*j/cols));
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(samples.flatMap(s=>s.p),3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const material=new THREE.MeshBasicMaterial({color:region.color,transparent:true,opacity:this.opacity,side:THREE.DoubleSide,depthTest:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,toneMapped:false});
   const mesh=new THREE.Mesh(geometry,material);mesh.name=`ROOT_DOMAIN_${side}_${region.id}`;mesh.renderOrder=8;mesh.frustumCulled=false;this.group.add(mesh);this.entries.push({type:'fill',object:mesh,samples});
  }
  const perimeter=[];for(let i=0;i<=120;i++)perimeter.push(hit(i/120,1,.000085));for(let i=119;i>=0;i--)perimeter.push(hit(i/120,-1,.000085));perimeter.push(perimeter[0]);this.line(side+'-boundary',perimeter,0xf5e5c2);
  for(const u of[.15,.75])this.line(side+'-region-'+u,Array.from({length:25},(_,i)=>hit(u,-1+2*i/24,.000085)),0xf5e5c2);
 }
 this.sampler=new BoundSurfaceSampler(geo,this.anchors);this.revision++;this.lastSignature='';this.sync();}
 line(name,samples,color){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(samples.flatMap(s=>s.p),3));const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:true,depthWrite:false,toneMapped:false}),line=new THREE.Line(geometry,material);line.name=name;line.frustumCulled=false;line.renderOrder=9;this.group.add(line);this.entries.push({type:'line',object:line,samples});}
 sync(){this.group.visible=this.mode!=='hidden';for(const e of this.entries){e.object.visible=e.type==='line'||this.mode==='regions';if(e.type==='fill')e.object.material.opacity=this.opacity;}const g=this.groom.viewer.mesh.geometry,signature=this.groom.signature();if(signature===this.lastSignature)return;this.lastSignature=signature;this.sampler.update(g,this.groom.viewer.mesh.morphTargetInfluences||[]);for(const e of this.entries){const a=e.object.geometry.attributes.position;for(let i=0;i<e.samples.length;i++)a.array.set(e.samples[i].anchor.sampled[0],i*3);a.needsUpdate=true;}}
 setMode(mode){if(!['regions','outline','hidden'].includes(mode))throw Error('未知范围显示模式');this.mode=mode;this.sync();this.groom.viewer.render();}
 setOpacity(value){if(!Number.isFinite(value)||value<.05||value>.7)throw Error('透明度必须在 .05–.7');this.opacity=value;this.sync();this.groom.viewer.render();}
 report(){return{schema:DOMAIN_SCHEMA,mode:this.mode,opacity:this.opacity,revision:this.revision,browHairCount:0,regions:BROW_REGIONS.map(({id,label,a,b})=>({id,label,u:[a,b]})),eyes:this.eyes,failedSurfaceQueries:this.failedQueries,surfaceBound:true,geometryVertices:this.entries.reduce((s,e)=>s+e.object.geometry.attributes.position.count,0),shapePresetsEnabled:false,rootDomainApproved:false,interpretation:'reference-guided candidate on existing landmarks, NOT a follicle scan or universal ideal shape'};}
 dispose(){this.disposeGeometry();this.group.removeFromParent();}
}
