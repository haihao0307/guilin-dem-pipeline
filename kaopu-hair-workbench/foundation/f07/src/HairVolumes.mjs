import {TeacherSkinBVH} from './SurfaceQuery.mjs';
import {clamp,smooth,mix} from './approved/LegacyFoundation.mjs';
export const VOLUME_GROUPS=Object.freeze([
 {id:'crown-left',name:'左发顶／分缝',color:'#b79b72',parent:null,evidence:'front-observed; depth inferred'},
 {id:'crown-right',name:'右发顶／分缝',color:'#b7af7d',parent:null,evidence:'front-observed; depth inferred'},
 {id:'curtain-left',name:'左侧主发体',color:'#77aaa2',parent:'crown-left',evidence:'front outline observed; side depth inferred'},
 {id:'curtain-right',name:'右侧主发体',color:'#7f9cb5',parent:'crown-right',evidence:'front outline observed; side depth inferred'},
 {id:'back',name:'后脑连续发体',color:'#a38fb3',parent:null,evidence:'inferred from smooth side-to-back continuation'},
 {id:'fringe',name:'碎刘海／前缘',color:'#c29386',parent:null,evidence:'front observed'},
 {id:'tip-left',name:'左发尾内收层',color:'#a6b778',parent:'curtain-left',evidence:'front observed; underside inferred'},
 {id:'tip-right',name:'右发尾内收层',color:'#81b8b2',parent:'curtain-right',evidence:'front observed; underside inferred'},
 {id:'tip-back',name:'后发尾连接层',color:'#b797a6',parent:'back',evidence:'inferred; follows continuous common hem'}
]);
// Measured in the own P01 head-aligned engineering frame. Front photograph
// constrains a proposed outline, not absolute recovered millimetres or depth.
const ROWS=[
 [.425,.002,.003,.003,0], [.414,.043,.055,.048,0],
 [.397,.067,.087,.071,0], [.376,.084,.109,.086,.02],
 [.358,.095,.123,.097,.34], [.338,.102,.122,.102,.83],
 [.315,.106,.114,.104,.97], [.282,.109,.107,.104,.96],
 [.244,.108,.101,.103,.90], [.205,.105,.096,.098,.86],
 [.168,.101,.091,.094,.84], [.140,.094,.083,.087,.84],
 [.122,.087,.075,.080,.84]
];
export function envelopeAt(y,r){
 const hem=.122-r.bobLengthMM*.001,top=.425,restY=.122+(clamp(y,hem,top)-hem)/(top-hem)*(top-.122);let k=0;while(k<ROWS.length-2&&restY<ROWS[k+1][0])k++;
 const a=ROWS[k],b=ROWS[k+1],t=clamp((a[0]-restY)/(a[0]-b[0]),0,1),h=b[0]-a[0],slope=(row,next,i)=>(next[i]-row[i])/(next[0]-row[0]),harm=(x,y)=>x*y<=0?0:2*x*y/(x+y),v=a.map((x,i)=>{if(i===0)return restY;const d=slope(a,b,i),m0=k?harm(slope(ROWS[k-1],a,i),d):d,m1=k+2<ROWS.length?harm(d,slope(b,ROWS[k+2],i)):d;return (2*t*t*t-3*t*t+1)*x+(t*t*t-2*t*t+t)*m0*h+(-2*t*t*t+3*t*t)*b[i]+(t*t*t-t*t)*m1*h;}),bottom=smooth((.165-restY)/.043),width=(r.bobWidthMM-10)*.001;
 return {y,hem,rx:v[1]+width*(1-smooth((restY-.397)/.028))-r.bobCurlMM*.00035*bottom,frontZ:v[2]-r.bobCurlMM*.00020*bottom,backZ:v[3]-r.bobCurlMM*.00020*bottom,opening:v[4],centerX:r.partMM*.001*smooth((restY-.33)/.095),centerZ:.008};
}
export function volumeGroup(y,theta,hem=.122){
 const a=(theta%(Math.PI*2)+Math.PI*2)%(Math.PI*2),right=a<Math.PI,back=a>2.10&&a<4.18;
 if(y<hem+.035)return back?'tip-back':right?'tip-right':'tip-left';
 if(y>.352)return right?'crown-right':'crown-left';
 return back?'back':right?'curtain-right':'curtain-left';
}
export function shapePoint(y,theta,r,inner=false){const e=envelopeAt(y,r),c=Math.cos(theta),s=Math.sin(theta),thickness=inner?.022:0;const lateral=(s<0?r.bobLeftMM:r.bobRightMM)*.001*s*s*(1-smooth((y-.38)/.045)),back=c<0?r.bobBackMM*.001*c*c:0;return[e.centerX+Math.max(.001,e.rx+lateral-thickness)*s,y-(inner&&y>.41?.006:0),e.centerZ+Math.max(.001,(c>=0?e.frontZ:e.backZ)+back-thickness)*c];}
export function buildHairVolume(r,head=null){
 const hem=.122-r.bobLengthMM*.001,rows=73,cols=144,positions=[],uv=[],indices=[],faceGroups=[];
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows;j++){
  const y=.425+ (hem-.425)*j/(rows-1),e=envelopeAt(y,r);
  for(let k=0;k<=cols;k++){const u=k/cols,theta=e.opening+(Math.PI*2-e.opening*2)*u,p=shapePoint(y,theta,r,layer===1);positions.push(...p);uv.push(u,j/(rows-1));}
 }
 let adjustedVertices=0;const bvh=head?new TeacherSkinBVH({template:head.positions,triangles:head.triangles,componentId:head.components}):null;
 if(bvh)for(let k=0;k<=cols;k++){
  let floor=hem;for(let layer=0;layer<2;layer++)for(let j=rows-1;j>=0;j-=3){const id=(layer*rows*(cols+1)+j*(cols+1)+k)*3;if(positions[id+1]>.23)continue;floor=Math.max(floor,supportHem(bvh,positions[id],positions[id+2],hem));}
  if(floor>hem)for(let layer=0;layer<2;layer++)for(let j=0;j<rows;j++){const id=(layer*rows*(cols+1)+j*(cols+1)+k)*3,y=positions[id+1];if(y<.23){positions[id+1]+=Math.min(.065,floor-hem)*smooth((.23-y)/(.23-hem));adjustedVertices++;}}
 }

 const n=rows*(cols+1),face=(a,b,c,g)=>{indices.push(a,b,c);faceGroups.push(g);};
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows-1;j++)for(let k=0;k<cols;k++){
  const a=layer*n+j*(cols+1)+k,b=a+cols+1,y=.425+(hem-.425)*(j+.5)/(rows-1),e=envelopeAt(y,r),theta=e.opening+(Math.PI*2-e.opening*2)*(k+.5)/cols,g=volumeGroup(y,theta,hem);
  if(layer===0){face(a,b,a+1,g);face(a+1,b,b+1,g);}else{face(a,a+1,b,g);face(a+1,b+1,b,g);}
 }
 for(let j=0;j<rows-1;j++)for(const k of[0,cols]){const a=j*(cols+1)+k,b=a+cols+1,y=.425+(hem-.425)*j/(rows-1),g=volumeGroup(y,k===0?1:5,hem);face(a,a+n,b,g);face(b,a+n,b+n,g);}
 for(const j of[0,rows-1])for(let k=0;k<cols;k++){const a=j*(cols+1)+k,g=volumeGroup(j===0?.425:hem,(k+.5)/cols*Math.PI*2,hem);face(a,a+1,a+n,g);face(a+1,a+n+1,a+n,g);}
 return {schema:'kaopu/hair-shape-volume@1',units:'metre',coordinateSystem:'own P01 head-aligned frame',recipe:{partMM:r.partMM,bobLengthMM:r.bobLengthMM,bobWidthMM:r.bobWidthMM,bobCurlMM:r.bobCurlMM,bobFringeMM:r.bobFringeMM,bobBackMM:r.bobBackMM,bobLeftMM:r.bobLeftMM,bobRightMM:r.bobRightMM},groups:structuredClone(VOLUME_GROUPS),positions,triangles:indices,uv,faceGroups,hem,top:.425,rows,cols,materialSlots:{body:null,fringe:null},uvConvention:'U around hair volume; V crown=0 to hem=1; final strand UV uses root=0 to tip=1',contactGuard:{mode:'static monotone hem trim above native shoulders',adjustedVertices,clearanceMM:3,dynamic:false},evidence:{front:'artist-authored from one supplied photo',side:'inferred',back:'inferred',top:'inferred'},algorithm:'original piecewise smooth loft; research principles only; no imported hair asset or claimed reproduction of Hair Meshes/Tonic'};
}

export function supportHem(bvh,x,z,hem){const hit=bvh.segmentHit([x,.235,z],[x,hem-.012,z]);return hit&&hit.normal[1]>.05&&hit.point[1]<.225?Math.max(hem,hit.point[1]+.004):hem;}

export function validateHairVolume(v,guides){
 if(v?.schema!=='kaopu/hair-shape-volume@1'||v.units!=='metre'||v.groups?.length!==9||v.evidence?.back!=='inferred'||v.materialSlots?.body!==null||v.materialSlots?.fringe!==null)throw Error('大型体积契约无效');
 const ids=new Set(VOLUME_GROUPS.map(g=>g.id)),count=v.positions?.length/3;
 if(!Number.isInteger(count)||count<100||count>40000||v.positions.some(x=>!Number.isFinite(x)||Math.abs(x)>1)||v.uv?.length!==count*2||v.uv.some(x=>!Number.isFinite(x)||x<0||x>1)||v.triangles?.length%3||v.faceGroups?.length!==v.triangles.length/3||v.triangles.some(x=>!Number.isInteger(x)||x<0||x>=count)||v.faceGroups.some(g=>!ids.has(g)))throw Error('大型网格或UV无效');
 const b=v.nativeBinding;if(!b||b.coordinates!=='native-common-viewer-Yup'||!Number.isInteger(b.triangle)||b.triangle<0||b.triangle>=50624||b.barycentric?.length!==3||b.barycentric.some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(b.barycentric.reduce((s,x)=>s+x,0)-1)>1e-8||b.offsets?.length!==v.positions.length||b.offsets.some(x=>!Number.isFinite(x)||Math.abs(x)>1))throw Error('大型原生头部锚点无效');
 const map=new Map(guides.map(g=>[g.rootId,g]));if(v.rootOwnership?.length!==guides.length||new Set(v.rootOwnership.map(g=>g.rootId)).size!==guides.length)throw Error('发组根点归属缺失');
 for(const r of v.rootOwnership){const g=map.get(r.rootId);if(!g||JSON.stringify(g.binding)!==JSON.stringify(r.binding)||!Array.isArray(r.groups)||r.groups.some(id=>!ids.has(id)))throw Error('发组与原生导向不对应');}
 return v;
}
