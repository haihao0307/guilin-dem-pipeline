/** Authored ceramic RESEARCH receiver, not a recovered/calibrated material mother.
 * SI metres throughout. No downloaded images, textures or teacher assets.
 * Runtime supplied by caller (Three r170). See sources/provenance.json.
 */
export const TILE_CASES=Object.freeze({
  glazed:Object.freeze({id:'glazed',name:'长方釉面砖',english:'GLAZED CERAMIC',width:.198,height:.098,joint:.004,thickness:.008,glaze:1,color:'#aec3b6',body:'#ad8363',roughness:.22,description:'浅青釉、暖色陶坯。釉层完整处保留低粗糙介电反射；崩口露出较粗糙的陶坯。'}),
  unglazed:Object.freeze({id:'unglazed',name:'无釉陶砖',english:'UNGLAZED CERAMIC',width:.148,height:.148,joint:.004,thickness:.010,glaze:0,color:'#a7856b',body:'#ae8b70',roughness:.76,description:'烧结坯体直接暴露。湿润可临时加深颜色、收窄高光，但不会凭空长出永久釉层。'}),
  mosaic:Object.freeze({id:'mosaic',name:'小规格釉面马赛克',english:'GLAZED MOSAIC',width:.022,height:.022,joint:.003,thickness:.005,glaze:1,color:'#bac8bf',body:'#b29377',roughness:.25,description:'22 mm 方形陶瓷单元，3 mm 缝。逐片色差与较高接缝占比，保留同一套坯体／釉层关系。'})
});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:a));
const fract=x=>x-Math.floor(x), mix=(a,b,t)=>a*(1-t)+b*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function hash(n){return fract(Math.sin(n*12.9898+78.233)*43758.5453);}
export function normalizeOptions(options={}){
  const preset=TILE_CASES[options.finish??'glazed'];if(!preset)throw new RangeError('Unknown ceramic finish');
  return {...preset,width:clamp(options.width??preset.width,.016,.30),height:clamp(options.height??preset.height,.016,.30),joint:clamp(options.joint??preset.joint,.001,.012),wear:clamp(options.wear??.52),stain:clamp(options.stain??.52),wetness:clamp(options.wetness??0),mode:clamp(options.mode??0,0,5),variant:options.variant===0?0:1};
}
export function panelDimensions(targetWidth,targetHeight,options={}){
  const p=normalizeOptions(options),nx=Math.max(1,Math.round(targetWidth/(p.width+p.joint))),ny=Math.max(1,Math.round(targetHeight/(p.height+p.joint))),margin=p.joint*.5;
  return {nx,ny,width:nx*(p.width+p.joint),height:ny*(p.height+p.joint),margin,tileCount:nx*ny};
}
// Local chip events grow from tile edges as wear increases; the mask is shared by ALL response channels.
export function chipMask(x,y,seed,p){
  const wear=p.wear*p.variant;if(wear<=0)return 0;let result=0;
  for(let i=0;i<4;i++){
    const a=hash(seed+i*17.1),b=hash(seed+i*17.1+4.7),edge=Math.floor(a*4),along=b-.5;
    const cx=edge<2?(edge===0?-p.width*.5:p.width*.5):along*p.width;
    const cy=edge>=2?(edge===2?-p.height*.5:p.height*.5):along*p.height;
    const active=smoothstep(a*.52,a*.52+.14,wear),radius=Math.min(.0065,Math.min(p.width,p.height)*.19)*wear*(.4+.6*b);
    const distance=Math.hypot(x-cx,(y-cy)*(1.15+.45*b));
    result=Math.max(result,active*(1-smoothstep(radius*.68,radius,distance)));
  }return result;
}
/** CPU audit analogue for causal channels; shader also evaluates microheight and directional deposits. */
export function sampleChannels({x=0,y=0,seed=3,front=1,deposit=0,...options}={}){
  const p=normalizeOptions(options),chip=chipMask(x,y,seed,p)*front,glaze=p.glaze*front*(1-chip),wet=p.wetness*p.variant;
  return {chip,glaze,metalness:0,ior:1.5,roughness:mix(mix(.76,p.roughness,glaze)+chip*.06,.13,wet*.83),clearcoat:Math.max(glaze,wet*.82),clearcoatRoughness:mix(.16,.045,wet),height:glaze*.00032-chip*.0013,deposit:clamp(deposit)*p.stain*p.variant,wetness:wet};
}
export const ceramicGLSL=`
varying vec3 ctPosition;varying vec3 ctObjectNormal;varying vec3 ctCell;
uniform vec2 ctSize;uniform float ctWear;uniform float ctStain;uniform float ctWet;uniform float ctVariant;
uniform float ctGlaze;uniform float ctBaseRoughness;uniform float ctMode;uniform vec3 ctColor;uniform vec3 ctBody;
float ctHash(float n){return fract(sin(n*12.9898+78.233)*43758.5453);}
float ctNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(ctHash(dot(i,vec2(1.,113.))),ctHash(dot(i+vec2(1.,0.),vec2(1.,113.))),f.x),mix(ctHash(dot(i+vec2(0.,1.),vec2(1.,113.))),ctHash(dot(i+1.,vec2(1.,113.))),f.x),f.y);}
float ctChip(vec2 p,float seed){
 float wear=ctWear*ctVariant,result=0.;
 for(int i=0;i<4;i++){float a=ctHash(seed+float(i)*17.1),b=ctHash(seed+float(i)*17.1+4.7),edge=floor(a*4.);vec2 c;
 if(edge<2.)c=vec2((edge<1.?-.5:.5)*ctSize.x,(b-.5)*ctSize.y);else c=vec2((b-.5)*ctSize.x,(edge<3.?-.5:.5)*ctSize.y);
 float activation=smoothstep(a*.52,a*.52+.14,wear),radius=max(.000001,min(.0065,min(ctSize.x,ctSize.y)*.19)*wear*(.4+.6*b));
 float d=length((p-c)*vec2(1.,1.15+.45*b));result=max(result,activation*(1.-smoothstep(radius*.68,radius,d)));}
 return result;
}
void ctEvaluate(out vec3 color,out float rough,out float height,out float coating,out float coatingRough,out float chip,out float deposit){
 vec2 p=ctPosition.xy;float seed=ctCell.x*3.71+ctCell.y*13.9+ctCell.z*41.3;
 float front=smoothstep(.25,.85,ctObjectNormal.z);chip=ctChip(p,seed)*front;
 float glaze=ctGlaze*front*(1.-chip),wet=ctWet*ctVariant;
 float firing=ctHash(seed+8.2)-.5;
 // Firing variation is per piece; glaze pooling is tied to the physical border, not reused colour noise.
 float edge=min(ctSize.x*.5-abs(p.x),ctSize.y*.5-abs(p.y));
 float pooling=(1.-smoothstep(.0007,.003,edge))*front;
 vec3 firedBody=ctBody*(1.+firing*.12),firedGlaze=ctColor*(1.+firing*.085-pooling*.045);
 color=mix(firedBody,firedGlaze,glaze);
 // Vertical gravity transport: a persistent joint-fed path plus drips from the upper bed joint.
 float down=ctSize.y*.5-p.y,jointDistance=ctSize.x*.5-abs(p.x);
 float jointSource=smoothstep(.38,.80,ctHash(ctCell.x*2.7+ctCell.z*8.1));
 float jointFlow=exp(-max(0.,jointDistance)/.005)*jointSource;
 float sourceX=(ctHash(seed+9.1)-.5)*ctSize.x*.84;
 float damageDrip=0.;
 for(int j=0;j<4;j++){float a=ctHash(seed+float(j)*17.1),b=ctHash(seed+float(j)*17.1+4.7);if(floor(a*4.)>2.5){float chipX=(b-.5)*ctSize.x,source=ctChip(vec2(chipX,ctSize.y*.5),seed);damageDrip+=exp(-abs(p.x-chipX)/(.001+down*.012))*exp(-down/.24)*source;}}
 float dripSource=smoothstep(.61,.88,ctHash(seed+15.7))*.5;
 float spread=.0008+down*.018;
 float drip=exp(-abs(p.x-sourceX)/spread)*exp(-down/.20)*dripSource;
 float gravityVariation=.74+.26*ctNoise(vec2(p.x*190.+ctCell.x*21.,p.y*9.+ctCell.y*2.));
 deposit=clamp((jointFlow*.58+drip*.75+damageDrip*.65)*gravityVariation*ctStain*ctVariant*front,0.,.88);
 color=mix(color,vec3(.19,.17,.125),deposit*.56);
 color*=1.-wet*mix(.24,.055,glaze);
 // Different causes: smooth fired face waviness, sparse body pores, glaze film and chipped-body loss.
 float wave=(ctNoise(p*vec2(41.,53.)+seed)-.5)*.000065;
 float pore=pow(ctNoise(p*1450.+seed*3.1),7.)*.00016;
 height=wave-pore*(1.-glaze)+glaze*.00032-chip*.0013;
 rough=mix(mix(.76,ctBaseRoughness,glaze)+chip*.06,.13,wet*.83);
 rough=clamp(rough+deposit*.075,.06,.96);coating=max(glaze,wet*.82);coatingRough=mix(.16,.045,wet);
}
`;
function requireChunk(source,token){if(!source.includes(token))throw new Error('CERAMIC_R170_SOURCE_DRIFT '+token);}
export function createCeramicMaterial(T,p,shaders=[]){
  const material=new T.MeshPhysicalMaterial({color:0xffffff,roughness:p.roughness,metalness:0,ior:1.5,clearcoat:1,clearcoatRoughness:.16});
  const u={ctSize:{value:new T.Vector2(p.width,p.height)},ctWear:{value:p.wear},ctStain:{value:p.stain},ctWet:{value:p.wetness},ctVariant:{value:p.variant},ctGlaze:{value:p.glaze},ctBaseRoughness:{value:p.roughness},ctMode:{value:p.mode},ctColor:{value:new T.Color(p.color)},ctBody:{value:new T.Color(p.body)}};
  material.userData={uniforms:u,research:true,units:'metres'};material.name='Ceramic body + dielectric glaze / authored study';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,u);
    for(const token of ['#include <common>','#include <color_fragment>','#include <roughnessmap_fragment>','#include <normal_fragment_maps>','#include <clearcoat_normal_fragment_maps>','#include <lights_physical_fragment>','#include <opaque_fragment>'])requireChunk(shader.fragmentShader,token);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 tileCell;varying vec3 ctPosition;varying vec3 ctObjectNormal;varying vec3 ctCell;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nctPosition=position;ctObjectNormal=normal;ctCell=tileCell;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+ceramicGLSL)
      .replace('#include <color_fragment>','#include <color_fragment>\nvec3 ctBase;float ctRough,ctHeight,ctCoat,ctCoatRough,ctDamage,ctDeposit;ctEvaluate(ctBase,ctRough,ctHeight,ctCoat,ctCoatRough,ctDamage,ctDeposit);diffuseColor.rgb*=ctBase;')
      .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=ctRough;')
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
vec3 ctDx=dFdx(-vViewPosition),ctDy=dFdy(-vViewPosition),ctR1=cross(ctDy,normal),ctR2=cross(normal,ctDx);float ctDet=dot(ctDx,ctR1);
normal=normalize(abs(ctDet)*normal-sign(ctDet)*(dFdx(ctHeight)*ctR1+dFdy(ctHeight)*ctR2));`)
      .replace('#include <clearcoat_normal_fragment_maps>','#include <clearcoat_normal_fragment_maps>\n#ifdef USE_CLEARCOAT\nclearcoatNormal=normal;\n#endif')
      .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat=ctCoat;material.clearcoatRoughness=ctCoatRough;\n#endif')
      .replace('#include <opaque_fragment>',`if(ctMode>.5&&ctMode<1.5)outgoingLight=ctBase;else if(ctMode>1.5&&ctMode<2.5)outgoingLight=vec3(ctRough);else if(ctMode>2.5&&ctMode<3.5)outgoingLight=vec3(ctDamage);else if(ctMode>3.5&&ctMode<4.5)outgoingLight=vec3(ctCoat);else if(ctMode>4.5)outgoingLight=vec3(ctDeposit);
#include <opaque_fragment>`);
    shaders.push(shader);
  };
  material.customProgramCacheKey=()=> 'kaopu-ceramic-research-r04-1';return material;
}
function tileGeometry(T,w,h,t){
  const b=Math.min(.00125,Math.min(w,h)*.035,t*.23),positions=[];
  const ring=(inset,z)=>{const x=w/2-inset,y=h/2-inset,k=b*.45;return [[-x+k,-y,z],[x-k,-y,z],[x,-y+k,z],[x,y-k,z],[x-k,y,z],[-x+k,y,z],[-x,y-k,z],[-x,-y+k,z]];};
  const back=ring(0,-t/2),edge=ring(0,t/2-b),front=ring(b,t/2);
  const tri=(a,b,c)=>positions.push(...a,...b,...c);
  for(let i=0;i<8;i++){const n=(i+1)%8;tri([0,0,t/2],front[i],front[n]);tri([0,0,-t/2],back[n],back[i]);for(const[a,c]of [[back,edge],[edge,front]]){tri(a[i],a[n],c[n]);tri(a[i],c[n],c[i]);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData={units:'metres',tileWidth:w,tileHeight:h,thickness:t,bevel:b,actualTileGeometry:true};return g;
}
function mortarMaterial(T,p){
  const mat=new T.MeshPhysicalMaterial({color:'#8c8b7c',roughness:.91,metalness:0,clearcoat:1,clearcoatRoughness:.10});
  const u={mWet:{value:p.wetness*p.variant},mStain:{value:p.stain*p.variant},mMode:{value:p.mode}};mat.userData.uniforms=u;
  mat.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nmPosition=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float mWet,mStain,mMode;varying vec3 mPosition;')
  .replace('#include <color_fragment>','#include <color_fragment>\nfloat mortarGrain=fract(sin(dot(floor(mPosition*2300.),vec3(17.13,28.73,9.1)))*43758.5);diffuseColor.rgb*=1.-mWet*.30-mStain*.12;diffuseColor.rgb*=.96+.08*mortarGrain;')
  .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.91,.35,mWet);')
  .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat=mWet*.65;\n#endif')
  .replace('#include <opaque_fragment>','if(mMode>1.5&&mMode<2.5)outgoingLight=vec3(roughnessFactor);else if(mMode>2.5&&mMode<3.5)outgoingLight=vec3(0.);else if(mMode>3.5&&mMode<4.5)outgoingLight=vec3(mWet*.65);\n#include <opaque_fragment>');};mat.customProgramCacheKey=()=> 'kaopu-ceramic-mortar-r04-1';return mat;
}
/** Independent receiver; never mutates a caller scene. update() accepts wear/stain/wetness/mode. */
export function buildTileCase(T,options={}){
  const p=normalizeOptions(options),group=new T.Group(),materials=[],geometries=[],shaders=options.shaders??[];
  const front=panelDimensions(.86,1.5,p),side=panelDimensions(.36,1.5,p),column=panelDimensions(.20,1.10,p),height=front.height;
  const tileMat=createCeramicMaterial(T,p,shaders),mortar=mortarMaterial(T,p),substrate=new T.MeshStandardMaterial({color:'#b3b1a3',roughness:.94});materials.push(tileMat,mortar,substrate);
  let count=0,panelID=0;
  function box(w,h,d,position,mat,name){const geom=new T.BoxGeometry(w,h,d);geometries.push(geom);const mesh=new T.Mesh(geom,mat);mesh.position.fromArray(position);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh;}
  function panel(spec,position,rotation,name){
    const holder=new T.Group();holder.position.fromArray(position);holder.rotation.y=rotation;holder.name=name;group.add(holder);
    const g=tileGeometry(T,p.width,p.height,p.thickness);geometries.push(g);
    const cells=new Float32Array(spec.tileCount*3),mesh=new T.InstancedMesh(g,tileMat,spec.tileCount),matrix=new T.Matrix4();let index=0;const id=++panelID;
    for(let y=0;y<spec.ny;y++)for(let x=0;x<spec.nx;x++){const cx=(x+.5)*(p.width+p.joint)-spec.width*.5,cy=(y+.5)*(p.height+p.joint)-spec.height*.5;matrix.makeTranslation(cx,cy,p.thickness*.5+.002);mesh.setMatrixAt(index,matrix);cells.set([x,y,id],index*3);index++;}
    g.setAttribute('tileCell',new T.InstancedBufferAttribute(cells,3));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name+' / individual beveled ceramic tiles';mesh.userData={tileCount:spec.tileCount,units:'metres',joint:p.joint,mortarRecess:.002+p.thickness};mesh.computeBoundingSphere();holder.add(mesh);count+=spec.tileCount;
    const backing=new T.PlaneGeometry(spec.width,spec.height);geometries.push(backing);const grout=new T.Mesh(backing,mortar);grout.receiveShadow=true;grout.name=name+' / recessed mortar';holder.add(grout);
  }
  const W=front.width,D=side.width;
  box(W,height,D,[0,height*.5,-D*.5],substrate,'Wall substrate');
  panel(front,[0,height*.5,0],0,'Wall front');panel({...side,ny:front.ny,height,tileCount:side.nx*front.ny},[W*.5,height*.5,-D*.5],Math.PI*.5,'Wall right return');
  box(W+.04,.025,D+.04,[0,height+.012,-D*.5],substrate,'Wall coping');
  const C=column.width,CH=column.height,cx=-W*.5-C*.5-.10,cz=.10;
  box(C,CH,C,[cx,CH*.5,cz],substrate,'Column core');
  for(let i=0;i<4;i++){const a=i*Math.PI*.5;panel(column,[cx+Math.sin(a)*(C*.5+.002),CH*.5,cz+Math.cos(a)*(C*.5+.002)],a,'Column face '+(i+1));}
  box(C+.034,.022,C+.034,[cx,CH+.011,cz],substrate,'Column cap');
  const bounds=new T.Box3().setFromObject(group),center=bounds.getCenter(new T.Vector3());group.children.forEach(o=>{o.position.x-=center.x;});
  group.name='R04 ceramic '+p.id+' / '+(p.variant?'study':'dry intact baseline');
  group.userData.state=p;group.userData.materials=materials;group.userData.receiver={kind:'ceramic',status:'authored research; not a recovered mother',finish:p.id,units:'metres',width:p.width,height:p.height,joint:p.joint,thickness:p.thickness,tileCount:count,panels:panelID,variant:p.variant,wallHeight:height,wallWidth:W,columnWidth:C,allTilesHavePhysicalThickness:true};
  group.userData.update=(next={})=>{for(const k of ['wear','stain','wetness','mode'])if(next[k]!==undefined)p[k]=clamp(next[k],0,k==='mode'?5:1);const u=tileMat.userData.uniforms;u.ctWear.value=p.wear;u.ctStain.value=p.stain;u.ctWet.value=p.wetness;u.ctMode.value=p.mode;const m=mortar.userData.uniforms;m.mWet.value=p.wetness*p.variant;m.mStain.value=p.stain*p.variant;m.mMode.value=p.mode;return group;};
  group.userData.dispose=()=>{for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};return group;
}
