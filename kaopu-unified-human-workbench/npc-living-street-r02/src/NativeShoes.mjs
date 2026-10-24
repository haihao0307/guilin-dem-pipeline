/**
 * R02 wearer adapter for the user's original R14 footwear generator.
 * Source: Humanoid-Rig-Lab-Next@02671d8595e410aca4f81047133f984d6f7950da.
 * All construction parts, indices, rest-material coordinates and native shaders
 * are retained. Only a measured wearer transform and foot-bone attachment are
 * added here. This is a visual fitting adapter, not a pressure/comfort solver.
 */
import {THREE as T} from './NativeBinding.mjs';
import {buildStyle, STYLES} from '../vendor/appearance/shoe-native/r14/src/model.mjs';
import {StyleMaterials} from '../vendor/appearance/shoe-native/r14/src/materials.mjs';
import {prepareSharedNativeShoe} from '../vendor/appearance/shoe-shared-original.mjs';
import scanData from '../vendor/appearance/shoes-r14/scan-data.json';
import {measureNativeFoot,createNativeShoeField,createNativeShoeApertureField,fitNativeShoeGeometry} from './NativeShoeFit.mjs';

export const STYLE_BY_ACTOR = Object.freeze({A:'canvas',B:'canvas',C:'canvas',D:'canvas',E:'canvas',F:'canvas'});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const unit=a=>{const n=Math.hypot(...a);if(n<1e-8)throw Error('Degenerate native foot direction');return a.map(x=>x/n);};
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const C=new T.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),CI=C.clone().invert();
const rowMatrix=m=>new T.Matrix4().fromArray(m).transpose();
function convexHullRF(points) {
  const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),unique=sorted.filter((p,i)=>i===0||p[0]!==sorted[i-1][0]||p[1]!==sorted[i-1][1]);
  const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lower=[],upper=[];
  for(const p of unique){while(lower.length>=2&&turn(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
  for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(upper.length>=2&&turn(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

function measureFoot(actor,side) {
  const {rig,binding}=actor,footId=rig.index.get('foot.'+side),foot=rig.restP[footId];
  const toe=rig.restP[rig.index.get('toe2-1.'+side)];
  const forward=unit([toe[0]-foot[0],toe[1]-foot[1],0]);
  const right=[-forward[1],forward[0],0],rest=actor.nativeSource.positions;
  const descendants=new Set(rig.descendants[footId]);descendants.add(footId);
  const samples=[];let minF=Infinity,maxF=-Infinity,minR=Infinity,maxR=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<actor.nativeSource.bodyCount;i++) {
    let w=0;const start=binding.range[i*2],n=binding.range[i*2+1];
    for(let k=0;k<n;k++){const q=(start+k)*8;if(descendants.has(binding.packed[q+3]))w+=binding.packed[q+4];}
    const p=xyz(rest,i);
    // Include the full heel and toes. Ankle blending above the actual ankle
    // joint is excluded from the sizing measurement, not from the body mesh.
    if(w<.35||p[2]>foot[2]+.009)continue;
    const d=sub(p,foot),f=dot(d,forward),r=dot(d,right);
    samples.push(p);minF=Math.min(minF,f);maxF=Math.max(maxF,f);minR=Math.min(minR,r);maxR=Math.max(maxR,r);minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);
  }
  if(samples.length<20)throw Error(`No native ${side} foot surface for ${actor.id}`);
  return {footId,foot,forward,right,minF,maxF,minR,maxR,minZ,maxZ,samples,
    length:maxF-minF,width:maxR-minR,centerF:(minF+maxF)/2,centerR:(minR+maxR)/2};
}

/** Pure original-geometry fitting entry for native-motion numerical tests.
 * Does not initialize materials, a renderer, a DOM or a substitute body. */
export function fitNativeShoeSide(actor,side,{styleId=STYLE_BY_ACTOR[actor.id]||'canvas',getModel=buildStyle}={}) {
  const style=STYLES.find(s=>s.id===styleId);if(!style)throw Error('Unknown native shoe style '+styleId);
  const foot=measureNativeFoot(actor,side),targetLength=foot.length+.028,scaleM=targetLength/style.length;
  const width=clamp((foot.width+.009)/(style.width*scaleM),.88,1.15);
  const params={length:1,width,instep:4,thickness:1.35,bend:0},sourceModel=getModel(styleId,params);
  const centerF=foot.minF-.004+targetLength*.5,centerR=foot.centerR;
  const baseField=createNativeShoeField(foot,sourceModel.last,{scaleM,centerF,centerR});
  const field=createNativeShoeApertureField(actor,sourceModel,baseField,foot);
  const model=fitNativeShoeGeometry(sourceModel,field);
  const center=[foot.foot[0]+foot.forward[0]*centerF+foot.right[0]*centerR,
    foot.foot[1]+foot.forward[1]*centerF+foot.right[1]*centerR,field.baseZ];
  const restNative=new T.Matrix4().set(foot.right[0],0,foot.forward[0],center[0],
    foot.right[1],0,foot.forward[1],center[1],0,1,0,center[2],0,0,0,1);
  const solePointsNative=[],fullNativeBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},projected=[];
  let minSole=Infinity,fullVertexCount=0,minRelativeHeight=Infinity,maxRelativeHeight=-Infinity;
  for(const part of model.parts) {
    const isSole=/sole|heel|rubber|welt/.test(part.id+' '+part.role);
    const p=part.geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
      const q=new T.Vector3(p.getX(i)*(side==='L'?-scaleM:scaleM),p.getY(i)*scaleM,p.getZ(i)*scaleM).applyMatrix4(restNative);
      const point=[q.x,q.y,q.z],relative=sub(point,foot.foot);fullVertexCount++;
      for(let k=0;k<3;k++){fullNativeBounds.min[k]=Math.min(fullNativeBounds.min[k],point[k]);fullNativeBounds.max[k]=Math.max(fullNativeBounds.max[k],point[k]);}
      projected.push([dot(relative,foot.right),dot(relative,foot.forward)]);minRelativeHeight=Math.min(minRelativeHeight,relative[2]);maxRelativeHeight=Math.max(maxRelativeHeight,relative[2]);
      if(isSole){solePointsNative.push(point);minSole=Math.min(minSole,q.z);}
    }
  }
  if(!solePointsNative.length)throw Error('Original shoe has no measurable sole');
  const record={attachmentBone:'foot.'+side,boneId:foot.footId,solePointsNative,
    soleLiftM:foot.minZ-minSole,minRestSoleNativeZ:minSole,restFootMinNativeZ:foot.minZ,
    footLengthM:foot.length,footWidthM:foot.width,wearerScaleMPerMm:scaleM,styleId,params,
    sourceTriangles:sourceModel.report.triangles,sourceParts:sourceModel.parts.length,restNative:restNative.toArray(),fitValidated:false,
    fullNativeBounds,footLocalEnvelope:{schema:'complete-original-shoe-convex-prism/1',units:'m',originNative:foot.foot.slice(),rightNative:foot.right.slice(),forwardNative:foot.forward.slice(),
      hullRF:convexHullRF(projected),heightRangeM:[minRelativeHeight,maxRelativeHeight],vertices:fullVertexCount,parts:model.parts.length,
      transform:'origin + right*r + forward*f + nativeZ*height; actual foot skin matrix; native-to-display [x,z,-y]; actor root',
      poseScope:'current frozen neutral wearer geometry; no dynamic-upper envelope claim'},
    wearerFit:model.report.wearerFit};
  return {model,sourceModel,field,foot,scaleM,params,restNative,record};
}

export async function createNativeShoeSystem({renderer}={}) {
  if(!renderer)throw Error('Native footwear needs the existing renderer');
  const materials=new StyleMaterials(renderer,scanData);await materials.init();
  const resources=new Map(),wearers=new Set();
  function resource(styleId,params) {
    const key=JSON.stringify([styleId,params]);
    if(!resources.has(key)) {
      const model=buildStyle(styleId,params);
      resources.set(key,{model,key});
    }
    return resources.get(key);
  }
  function attach(actor,{styleId=STYLE_BY_ACTOR[actor.id]||'canvas'}={}) {
    const style=STYLES.find(s=>s.id===styleId);if(!style)throw Error('Unknown native shoe style '+styleId);
    const perSide={},attachments=[];
    for(const side of ['L','R']) {
      const fit=fitNativeShoeSide(actor,side,{styleId,getModel:(id,p)=>resource(id,p).model});
      const {foot,scaleM,params,restNative,record}=fit;
      const shared=prepareSharedNativeShoe(fit.model,materials),res={shared,model:fit.model};
      const shoe=shared.create({name:`${actor.id}/${side}/${styleId}`,mirror:side==='L'});
      const attach=new T.Group();attach.name=`native-foot-${actor.id}-${side}`;
      attach.matrixAutoUpdate=false;actor.root.add(attach);attach.add(shoe);
      shoe.scale.multiplyScalar(scaleM/.001);
      const restDisplay=C.clone().multiply(restNative);
      perSide[side]=record;
      attachments.push({side,foot,attach,shoe,restDisplay,res});
    }
    const footwear={source:'shoe-r14/02671d85',styleId,perSide,
      soleLiftM:Math.max(...Object.values(perSide).map(s=>s.soleLiftM)),
      originalConstruction:true,originalMaterials:true,wearerFitValidated:false,physics:false,
      update(){for(const a of attachments){a.attach.matrix.copy(C).multiply(rowMatrix(actor.rig.skinMatrices[a.foot.footId])).multiply(CI).multiply(a.restDisplay);a.attach.matrixWorldNeedsUpdate=true;}},
      report(){return {actor:actor.id,styleId,source:this.source,soleLiftM:this.soleLiftM,
        sourceConstructionRetained:true,materials:'native R14 StyleMaterials + original scan channels',
        perSide:Object.fromEntries(Object.entries(perSide).map(([side,s])=>[side,{...s,solePointsNative:undefined,soleVertexCount:s.solePointsNative.length}])),
        wearerFitValidated:this.wearerFitValidated,pressureComfortSolved:false};},
      dispose(){for(const a of attachments){a.res.shared.release(a.shoe);a.res.shared.disposeGeometry();a.attach.removeFromParent();}wearers.delete(footwear);}};
    actor.footwear=footwear;wearers.add(footwear);footwear.update();return footwear;
  }
  return {attach,update(){for(const f of wearers)f.update();},
    report(){return [...wearers].map(f=>f.report());},
    dispose(){for(const f of [...wearers])f.dispose();for(const r of resources.values())for(const p of r.model.parts)p.geometry.dispose();materials.dispose();}};
}

export async function attachNativeShoes(actor,{renderer,...options}={}) {
  const system=await createNativeShoeSystem({renderer});const footwear=system.attach(actor,options);
  footwear.system=system;return footwear;
}
