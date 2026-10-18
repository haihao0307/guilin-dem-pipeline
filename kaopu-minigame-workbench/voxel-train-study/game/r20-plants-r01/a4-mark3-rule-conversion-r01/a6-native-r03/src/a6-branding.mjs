import number from './branding/number88.mjs';
import company from './branding/company_plaque-gold.mjs';
import wordmark from './branding/wordmark.mjs';
import angelLeft from './branding/angel_left.mjs';
import angelRight from './branding/angel_right.mjs';
import {contourShapes} from './branding/contours-injected.mjs';
import {createA6ShellSampler} from './a6-locomotive-shell.mjs';
import {sampleTenderHalfWidth} from './a6-tender-shell.mjs';
const sharedMasterInstances=new WeakMap();
/** Existing user-brand contour masters retained; only design instances are fitted. */
export function createA6Branding(T,{loco,tender,materialLibrary}){
 const group=new T.Group();group.name='A6 retained brand artwork / independent parametric placement';
 const sampler=createA6ShellSampler({width:loco.parameters.width,topHeight:loco.parameters.topHeight,cabShift:loco.parameters.cabShift}), identity=new T.Matrix4().toArray();
 let shared=sharedMasterInstances.get(materialLibrary);
 if(!shared){shared={gold:materialLibrary.create('gold',{restMatrix:identity,units:'m'}),red:materialLibrary.create('red',{restMatrix:identity,units:'m'})};sharedMasterInstances.set(materialLibrary,shared);}
 const {gold,red}=shared;
 group.userData.ownedMaterials=[];group.userData.sharedMasterMaterials=true;group.userData.branding=[];
 function place(recipe,{width,z,y,side,halfWidth,material,name}){
  const scale=width/recipe.size_px[0],height=recipe.size_px[1]*scale;
  const g=new T.ExtrudeGeometry(contourShapes(T,recipe),{depth:.005/scale,bevelEnabled:false,curveSegments:1});
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
   const u=p.getX(i)*scale-width/2,v=p.getY(i)*scale+height/2,d=p.getZ(i)*scale;
   const yy=y+v,zz=z-side*u,h=halfWidth(yy,zz);
   if(!Number.isFinite(h)||h<=0)throw Error('Brand artwork outside shell domain '+name);
   p.setXYZ(i,side*(h+.008+d),yy,zz);
  }
  g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name=name;group.add(mesh);
  const record={asset:recipe.asset,widthM:width,heightM:height,centre:[side*halfWidth(y,z),y,z],side,retainedContour:true};
  mesh.userData.branding=record;group.userData.branding.push(record);
 }
 for(const side of[-1,1]){
  place(wordmark,{width:4.9,z:8.1,y:3.05,side,halfWidth:sampler.halfWidthAt,material:gold,name:'Flying Hongkonger retained large wordmark'});
  place(number,{width:.58,z:5.30,y:2.48,side,halfWidth:sampler.halfWidthAt,material:gold,name:'88 below and behind driver'});
  place(company,{width:.58,z:6.20,y:2.48,side,halfWidth:sampler.halfWidthAt,material:gold,name:'陆港铁路 retained complete nameplate aft of 88'});
  const tenderHalf=(y,z)=>sampleTenderHalfWidth(y,z,tender.parameters);
  place(side<0?angelLeft:angelRight,{width:1.7,z:17.7,y:2.80,side,halfWidth:tenderHalf,material:red,name:'retained rear red flying emblem'});
 }
 return group;
}
