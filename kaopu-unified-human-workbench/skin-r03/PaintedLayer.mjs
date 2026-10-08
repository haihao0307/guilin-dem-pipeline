import * as THREE from '../full/source/registration-vendor/three.module.js';
export const VERSION='unified-human-skin/r03-painted';
const ASSET=new URL('./assets/',import.meta.url),S={enabled:true,amount:1,detail:.8,bodyVariation:.75};let latest=null;
const GLSL=`
uniform sampler2D paintColor,paintGradient,paintMaterial,paintBody;uniform float paintAmount,paintDetail,paintBodyVariation;uniform vec3 paintToneAnchor;
vec2 paintUV(vec3 p){float t=atan(p.x,p.z-.046);float a=abs(t);float u=a<=1.18?.37*a/1.18:.37+.13*(a-1.18)/(3.14159265359-1.18);return vec2(.5+sign(t)*u,(p.y-.568)/.292);}
`;
function patch(base,U){const mat=base.material,prior=mat.onBeforeCompile;mat.customProgramCacheKey=()=>VERSION;
 mat.onBeforeCompile=sh=>{prior(sh);Object.assign(sh.uniforms,U);let f=sh.fragmentShader;f=GLSL+f;
 const swap=(a,b)=>{if(!f.includes(a))throw Error('Paint shader anchor missing '+a);f=f.replace(a,b);};
 swap('#include <roughnessmap_fragment>',`
 vec2 pUV=paintUV(vKRest);float pHead=smoothstep(.584,.624,vKRest.y)*kCover*paintAmount;vec3 pData=texture2D(paintMaterial,pUV).rgb;vec3 pAtlas=texture2D(paintColor,pUV).rgb*exp(-kPigment*vec3(1.,1.43,1.8));
 vec2 bodyUV=vec2(clamp((vKRest.x+.63)/1.26,.002,.998),clamp((vKRest.y+1.)/1.66,.002,.998));vec4 bodyFront=texture2D(paintBody,vec2(bodyUV.x,bodyUV.y*.5)),bodyBack=texture2D(paintBody,vec2(bodyUV.x,.5+bodyUV.y*.5));vec4 bodyColor=mix(bodyBack,bodyFront,smoothstep(-.35,.35,vKRestNormal.z));
 vec3 bodySkin=kCR.rgb*mix(vec3(.59,.34,.27),bodyColor.rgb,paintBodyVariation)/vec3(.59,.34,.27)*exp(-kPigment*vec3(1.,1.43,1.8));vec3 painted=mix(bodySkin,pAtlas,pHead);if(uhMode>.5){painted*=clamp(uhTone/paintToneAnchor,vec3(.15),vec3(2.5));painted=mix(painted,uhLipColor,pHead*pData.g*max(uhLipMix-.32,0.));painted*=vec3(1.+(uhRedness-.34)*uhR.y*.14,1.-(uhRedness-.34)*uhR.y*.13,1.-(uhRedness-.34)*uhR.y*.075);painted=mix(painted,uhBaseColor,uhBaseMix);}diffuseColor.rgb=mix(diffuseColor.rgb,painted,kCover*paintAmount);kAlbedo=diffuseColor.rgb;
 uhLip=mix(uhLip,pData.g,pHead);uhRegionRadius=mix(uhRegionRadius,.93-.12*pData.g,pHead);
 #include <roughnessmap_fragment>`);
 swap('#include <normal_fragment_begin>',`roughnessFactor=mix(roughnessFactor,clamp(pData.r+kRoughness-.57,.25,.86),pHead);\n#include <normal_fragment_begin>`);
 const anchor='if(abs(kDet)>1e-14)normal=normalize(abs(kDet)*normal-sign(kDet)*(kHx*kR1+kHy*kR2));';
 swap(anchor,`vec4 pGrad=(texture2D(paintGradient,pUV)-.5)*.32;vec2 dh=(pGrad.xy*uhMeso+pGrad.zw*uhMicro)*paintDetail*kDetailStrength;vec2 pDx=dFdx(pUV),pDy=dFdy(pUV);pDx.x-=floor(pDx.x+.5);pDy.x-=floor(pDy.x+.5);kHx=mix(kHx,dot(dh,pDx),pHead);kHy=mix(kHy,dot(dh,pDy),pHead);${anchor}`);
 sh.fragmentShader=f;
 };mat.needsUpdate=true;
}
export class PaintedLayer{
 constructor(base){this.base=base;this.v=base.v;this.textures=[];this.ready=false;this.errors=[];this.dead=false;latest=this;}
 async start(){try{
  const r=await fetch(new URL('paint-manifest.json',ASSET));if(!r.ok)throw Error('完整贴图清单未加载');this.manifest=await r.json();if(this.manifest.topologySha256!==this.v.model.canonical.topologySha256)throw Error('人体拓扑已变，拒绝旧贴图映射');
  const load=async(name,color)=>{const t=await new THREE.TextureLoader().loadAsync(new URL(name,ASSET).href);if(this.dead){t.dispose();throw Error('贴图已取消');}t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=this.v.renderer.capabilities.getMaxAnisotropy();t.wrapS=THREE.RepeatWrapping;this.textures.push(t);return t;};
  const [color,gradient,material,body]=await Promise.all([load('head-albedo-4k.jpg',true),load('head-gradients-4k.png'),load('head-material-4k.png'),load('body-color-atlas.png',true)]);if(this.dead)return;
  this.U={paintToneAnchor:{value:this.base.uh.U.uhTone.value.clone()},paintColor:{value:color},paintGradient:{value:gradient},paintMaterial:{value:material},paintBody:{value:body},paintAmount:{value:1},paintDetail:{value:S.detail},paintBodyVariation:{value:S.bodyVariation}};patch(this.base,this.U);this.ready=true;this.sync();
 }catch(e){this.errors.push(e.message);if(!this.dead){status('贴图载入未完成：'+e.message);console.error(e);}throw e;}}
 sync(){if(!this.ready||this.dead)return;this.U.paintAmount.value=S.enabled?S.amount:0;this.U.paintDetail.value=S.detail;this.U.paintBodyVariation.value=S.bodyVariation;this.v.render();ui();}
 report(){return{version:VERSION,ready:this.ready,settings:{...S},errors:this.errors.slice(),manifest:this.manifest,textureDimensions:this.U?['paintColor','paintGradient','paintMaterial','paintBody'].map(k=>{const t=this.U[k].value;return[t.image.width,t.image.height];}):[],textureChannels:['head-albedo','head-gradients','head-material','body-color'],geometryEdited:false,scanPortraitUsedAsPlane:false};}
 dispose(){this.dead=true;for(const t of this.textures)t.dispose();if(latest===this)latest=null;}
}
function status(s){const e=document.getElementById('paint-status');if(e)e.textContent=s;}
function ui(){for(const b of document.querySelectorAll('[data-paint]'))b.setAttribute('aria-pressed',String(S.enabled===(b.dataset.paint==='on')));status(latest?.ready?'4K 完整头部颜色与微结构 · 原参数人体':'等待完整人物与贴图');}
function set(v){for(const k of ['amount','detail','bodyVariation'])if(Number.isFinite(v[k]))S[k]=Math.max(0,Math.min(k==='detail'?1.5:1,v[k]));if('enabled'in v)S.enabled=!!v.enabled;latest?.sync();return{...S};}
export function mountPaintControls(){const host=document.getElementById('skin-panel');if(!host)return;const e=document.createElement('div');e.className='uh-controls';e.innerHTML=`<div class="uh-row"><strong>R03 · 完整色彩贴图</strong><button data-paint="on" aria-pressed="true">完整贴图</button><button data-paint="off">上一版皮肤</button><button id="paint-close">嘴唇 / 面颊近看</button><button id="paint-maps">查看实际贴图</button><span id="paint-status" role="status">等待人体载入</span></div>`;host.prepend(e);for(const b of e.querySelectorAll('[data-paint]'))b.onclick=()=>{window.commonSkin.set({enabled:true});set({enabled:b.dataset.paint==='on'});};e.querySelector('#paint-close').onclick=()=>{const v=latest?.v;if(!v)return;v.view('face');v.camera.position.copy(v.orbit.target).add(new THREE.Vector3(.095,0,.52));v.orbit.update();v.render();};
 const modal=document.createElement('dialog');modal.id='paint-map-dialog';modal.style='width:min(1100px,92vw);max-height:90vh;background:#17252f;color:#cdd6db;border:1px solid #927b61;padding:20px;border-radius:10px';modal.innerHTML=`<button id="paint-map-close" style="float:right">关闭</button><h2>实际材质贴图，不是屏幕肖像</h2><p>头部保留完整4K扫描色彩，经五官对应重绘到当前人体；身体为独立绘制的颜色变化，未冒充全身扫描。</p><div id="paint-map-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"></div>`;document.body.append(modal);e.querySelector('#paint-maps').onclick=()=>{const g=modal.querySelector('#paint-map-grid');g.replaceChildren();for(const[file,label]of [['head-albedo-4k.jpg','头部颜色 / 唇色 / 眉须 / 痘印'],['head-material-4k.png','粗糙度 / 唇区 / 覆盖'],['head-gradients-4k.png','中频与微孔 · 数据通道'],['body-color-atlas.png','身体前后色素绘制']]){const f=document.createElement('figure');f.style.margin='0';const c=document.createElement('figcaption');c.textContent=label;const im=new Image();im.src=new URL(file,ASSET).href;im.style.width='100%';f.append(c,im);g.append(f);}modal.showModal();};modal.querySelector('#paint-map-close').onclick=()=>modal.close();
 window.paintedSkin={version:VERSION,set,report:()=>latest?.report()||{ready:false,version:VERSION},_layer:()=>latest};ui();
}
