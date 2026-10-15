/* SkinVariationDNA R01 — standalone semantic event maps on retained R03.1 body.
   Derived methods, not reference pixels or medically calibrated skin scans. */
window.KAOPU_SKIN_VARIATION_DNA_R01=(()=>{
'use strict';
const spec=[
 ['amount','自然变化总量',0,1.35],['vascular','血色与细血管',0,1.5],
 ['melanin','雀斑 / 日晒斑',0,1.5],['sebum','皮脂反射',0,1.5],
 ['eyePigment','眼下色素',0,1.5],['eyeVascular','眼下血色',0,1.5],
 ['acne','活动性粉刺',0,1.5],['pie','PIE 红痘印',0,1.5],
 ['pih','PIH 色素痘印',0,1.5],['scar','旧凹痕微法线',0,1.5],
 ['follicle','剃须后毛囊',0,1.5],['dryness','局部干燥',0,1.5],
 ['sun','日晒历史',0,1.5],['asymmetry','左右差异',0,1.5]
];
const presets={
 young:{amount:.88,vascular:.48,melanin:.12,sebum:.52,eyePigment:.12,eyeVascular:.18,acne:.58,pie:.14,pih:.06,scar:0,follicle:.28,dryness:.08,sun:.13,asymmetry:.32,phase:.08},
 adult:{amount:.94,vascular:.49,melanin:.47,sebum:.53,eyePigment:.55,eyeVascular:.39,acne:.24,pie:.49,pih:.48,scar:.12,follicle:.47,dryness:.27,sun:.42,asymmetry:.53,phase:.36},
 mature:{amount:.88,vascular:.59,melanin:.77,sebum:.40,eyePigment:.51,eyeVascular:.49,acne:.11,pie:.24,pih:.51,scar:.54,follicle:.46,dryness:.43,sun:.69,asymmetry:.64,phase:.64}
};
const clamp=x=>Math.max(0,Math.min(1,x));
const hash=a=>{let h=2166136261;for(const v of a)h=Math.imul(h^v,16777619);return(h>>>0).toString(16).padStart(8,'0');};
const random=k=>{let s=k>>>0;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};};
// The exported deterministic root registry is the one and only root source used for beard
// pixels. A later hair adapter must consume its identical roots and native beard gate.
function roots(seed,count=3400,span=96){
 const rnd=random(seed^0x81ac77),result=[],cells=46,buckets=Array.from({length:cells*cells},()=>[]);
 const g=(x,y)=>buckets[(((y%cells)+cells)%cells)*cells+(((x%cells)+cells)%cells)];
 for(let attempt=0;result.length<count&&attempt<count*12;attempt++){
  const x=rnd()*span,y=rnd()*span,gx=Math.floor(x/span*cells),gy=Math.floor(y/span*cells);
  let ok=true;
  for(let j=-1;j<=1&&ok;j++)for(let i=-1;i<=1&&ok;i++)for(const id of g(gx+i,gy+j)){
   const p=result[id];let dx=Math.abs(x-p.x),dy=Math.abs(y-p.y);
   if(Math.min(dx,span-dx)**2+Math.min(dy,span-dy)**2<.57**2){ok=false;break;}
  }
  if(ok){g(gx,gy).push(result.length);result.push({x,y,r:.06+rnd()*.065,weight:.42+rnd()*.56,angle:rnd()*Math.PI});}
 }
 return result;
}
function pack(old){
 const st=performance.now(),N=old.width,M=old.height,sz=N*M,span=96,scale=N/span;
 if(N!==M||old.layers!==5)throw Error('DNA needs native R03 five-layer square array');
 const data=new Uint8Array(sz*4*7);data.set(old.data);
 const A=new Float32Array(sz*4),B=new Float32Array(sz*4),F=new Float32Array(sz*4);
 const seed=old.report.seed||41731,rnd=random(seed^0x31bed91d),w=(v,m)=>(v%m+m)%m;
 function spot(dst,ch,x,y,rx,ry,ang,strength){
  const cx=x*scale,cy=y*scale,sx=Math.max(.45,rx*scale),sy=Math.max(.45,ry*scale);
  const C=Math.cos(ang),S=Math.sin(ang),R=Math.ceil(Math.max(sx,sy)*2.7);
  for(let iy=Math.floor(cy)-R;iy<=Math.ceil(cy)+R;iy++)for(let ix=Math.floor(cx)-R;ix<=Math.ceil(cx)+R;ix++){
   let dx=ix-cx,dy=iy-cy;if(dx>N/2)dx-=N;if(dx<-N/2)dx+=N;if(dy>M/2)dy-=M;if(dy<-M/2)dy+=M;
   const u=(dx*C+dy*S)/sx,v=(-dx*S+dy*C)/sy,z=u*u+v*v;if(z>8)continue;
   const k=(w(iy,M)*N+w(ix,N))*4+ch;dst[k]=Math.max(dst[k],Math.exp(-z)*strength);
  }
 }
 // Explicit event families; clustering, size, healing and asymmetry are not one noise.
 function events(target,ch,count,min,max,cluster){
  const centers=Array.from({length:Math.ceil(count/5)},()=>({x:rnd()*span,y:rnd()*span}));
  for(let i=0;i<count;i++){
   let x=rnd()*span,y=rnd()*span;
   if(rnd()<cluster){const p=centers[Math.floor(rnd()*centers.length)];x=w(p.x+(rnd()-.5)*11.6,span);y=w(p.y+(rnd()-.5)*20.2,span);}
   const r=min+Math.pow(rnd(),1.8)*(max-min);
   spot(target,ch,x,y,r,r*(.61+rnd()*.75),rnd()*Math.PI,.42+rnd()*.57);
  }
 }
 const counts={PIE:26,PIH:31,freckles:90,capillaries:64,flakes:24,pits:10};
 events(A,0,counts.PIE,.22,.91,.73);events(A,1,counts.PIH,.20,.81,.67);
 events(A,2,counts.freckles,.12,.62,.46);events(A,3,counts.capillaries,.12,.59,.4);
 events(B,1,counts.flakes,.11,.40,.49);events(B,2,counts.pits,.22,.92,.54);
 const grids=[11,19,43].map(k=>({n:k,v:Float32Array.from({length:k*k*2},()=>rnd())}));
 function field(x,y,c){
  let value=0;for(let k=0;k<3;k++){
   const g=grids[k],gx=x/N*g.n,gy=y/M*g.n,i=Math.floor(gx),j=Math.floor(gy);
   let u=gx-i,v=gy-j;u=u*u*(3-2*u);v=v*v*(3-2*v);
   const at=(a,b)=>g.v[(w(b,g.n)*g.n+w(a,g.n))*2+c];
   value+=((at(i,j)*(1-u)+at(i+1,j)*u)*(1-v)+(at(i,j+1)*(1-u)+at(i+1,j+1)*u)*v)*[.43,.34,.23][k];
  }
  return value;
 }
 for(let y=0;y<M;y++)for(let x=0;x<N;x++){const k=(y*N+x)*4;B[k]=field(x,y,0);B[k+3]=field(x,y,1);}
 // Replace old unconstrained random follicles with reusable roots.
 const registry=roots(seed);
 for(const p of registry)spot(F,0,p.x,p.y,p.r,p.r*.79,p.angle,p.weight);
 for(let k=0;k<sz;k++){
  data[(4*sz+k)*4]=Math.round(clamp(F[k*4])*255);
  for(let c=0;c<4;c++){
   data[(5*sz+k)*4+c]=Math.round(clamp(A[k*4+c])*255);
   data[(6*sz+k)*4+c]=Math.round(clamp(B[k*4+c])*255);
  }
 }
 const report={schema:'kaopu.skin-variation-dna/1',seed,
  channels:{layer3:['activeHalo','activeCore','oldHealed','razor'],layer4:['sharedBeardRoots','oldScar','mottle','lowerEyeNoise'],
   layer5:['PIE','PIH','freckles','capillaries'],layer6:['sebum','dryness','scarMicroNormalCandidate','underEyeDetail']},
  eventCounts:{...counts,follicleRoots:registry.length},follicleSource:'KAOPU_SHARED_FOLLICLE_ROOTS_R01',
  follicleChecksum:hash(data.subarray(4*sz*4,5*sz*4)),fingerprint:hash(data),
  sourcePixelsCopied:false,underEyeStructureBaked:false,piePihGeometry:false,vertexDisplacementImplemented:false,
  beardHairRuntimeIntegrated:false,clinicalCalibration:false,textureLayers:7,baseTextureBytes:data.byteLength,
  mipBytesEstimate:Math.round(data.byteLength*4/3),generationMS:performance.now()-st};
 return{...old,data,layers:7,report:{...old.report,textureLayers:7,textureBytes:data.byteLength,
   mipBytesEstimate:report.mipBytesEstimate,variationDNA:report}};
}
const declarations=String.raw`
uniform float uDnaOn,uDnaAmount,uDnaVascular,uDnaMelanin,uDnaSebum,uDnaEyePigment,uDnaEyeVascular;
uniform float uDnaAcne,uDnaPIE,uDnaPIH,uDnaScar,uDnaFollicle,uDnaDryness,uDnaSun,uDnaAsymmetry,uDnaDebug,uDnaPhase;
float dnVascular=0.,dnFreckles=0.,dnOil=0.,dnDry=0.,dnPIE=0.,dnPIH=0.,dnPit=0.,dnFollicle=0.;
float dnPapule=0.,dnPustule=0.,dnUnderPigment=0.,dnUnderVascular=0.,dnMask=0.;
`;
const colour=String.raw`
 // Rest-space triplanar sampling; pixel data has NO baked lighting or AO.
 vec4 dnA=p3Tri(p2MM+vec3(13.,41.,11.)+vec3(uDnaPhase*17.),p2W,96.,5.);
 vec4 dnB=p3Tri(p2MM+vec3(37.,7.,29.)+vec3(uDnaPhase*19.),p2W,96.,6.);
 float dnSide=mix(1.-.16*uDnaAsymmetry,1.+.16*uDnaAsymmetry,smoothstep(-.018,.022,p2P.x));
 float dnExclude=sdCover*p2Head*p2Front*(1.-clamp(lpMask,0.,1.))*(1.-clamp(p2Lid*.94,0.,.98));
 float dnCheek=clamp(.78*p2Cheek+.22*p2Jaw+.16*p2Forehead+.18*p2Chin,0.,1.)*dnExclude;
 float dnVessels=clamp(.76*p2Ala+.42*p2Nose+.65*p2Cheek+.26*p2Lid+.24*p2Ear,0.,1.)*p2Head*dnSide;
 float dnPigmentZone=clamp(.52*p2Cheek+.52*p2Forehead+.23*p2Temple+.18*p2Nose,0.,1.)*dnExclude;
 float dnAcneZone=clamp(.56*p2Cheek+.35*p2Forehead+.32*p2Chin+.18*p2Jaw,0.,1.)*dnExclude;
 dnPIE=dnA.r*dnAcneZone*uDnaPIE*dnSide;
 dnPIH=dnA.g*dnAcneZone*uDnaPIH*(2.-dnSide*.81);
 dnFreckles=dnA.b*dnPigmentZone*uDnaMelanin*clamp(.44+.56*uDnaSun,0.,1.5)*dnSide;
 dnVascular=(.32+.68*dnA.a)*dnVessels*uDnaVascular;
 dnPapule=p3AcneHalo*uDnaAcne*.82;
 dnPustule=p3AcneCore*uDnaAcne*.77*smoothstep(.61,.88,p3B.a);
 dnFollicle=p3B.r*p3ShaveZone*uDnaFollicle*dnSide;
 dnPit=dnB.b*dnAcneZone*uDnaScar;
 float dnEyeLower=p3EyeZone*(.64+.36*dnB.a)*dnSide;
 dnUnderPigment=dnEyeLower*uDnaEyePigment;
 dnUnderVascular=dnEyeLower*uDnaEyeVascular;
 dnOil=clamp((.78*rfNose+.62*rfForehead+.49*p2Chin+.05*p2Cheek)*(.64+.36*dnB.r),0.,1.)*uDnaSebum*dnExclude;
 dnDry=dnB.g*clamp(.42*p2Ala+.27*p2Chin+.21*p2Cheek+.10*p2Jaw,0.,1.)*uDnaDryness*dnExclude;
 dnMask=clamp(max(max(dnVascular,dnFreckles),max(max(dnPIE,dnPIH),max(dnPapule,max(dnFollicle,dnPit)))),0.,1.);
 vec3 dnColour=diffuseColor.rgb;
 dnColour*=mix(vec3(1.),vec3(1.065,.83,.87),clamp(dnVascular*.27,0.,.48));
 dnColour*=mix(vec3(1.),vec3(.81,.67,.60),clamp(dnFreckles*.46,0.,.6));
 dnColour*=mix(vec3(1.),vec3(1.08,.73,.77),clamp(dnPIE*.56,0.,.65));
 vec3 dnPIHTint=mix(vec3(.83,.66,.62),vec3(.76,.69,.68),smoothstep(.30,.74,uSDMel));
 dnColour*=mix(vec3(1.),dnPIHTint,clamp(dnPIH*.56,0.,.72));
 dnColour*=mix(vec3(1.),vec3(1.10,.65,.69),clamp(dnPapule*.58,0.,.64));
 dnColour*=mix(vec3(1.),vec3(1.055,1.03,.98),clamp(dnPustule*.25,0.,.22));
 dnColour*=mix(vec3(1.),vec3(.56,.66,.74),clamp(dnFollicle*.51,0.,.68));
 // Eye structure is governed by real geometry and lighting, NEVER painted dark AO.
 dnColour*=mix(vec3(1.),vec3(.82,.76,.77),clamp(dnUnderPigment*.27,0.,.40));
 dnColour*=mix(vec3(1.),vec3(.93,.80,.93),clamp(dnUnderVascular*.20,0.,.36));
 diffuseColor.rgb=mix(diffuseColor.rgb,dnColour,clamp(uDnaOn*uDnaAmount*sdCover,0.,1.));
 if(uDnaDebug>.5){
  vec3 dbg=vec3(0.);
  if(uDnaDebug<1.5)dbg=vec3(dnVascular*.8,dnVascular*.2,dnVascular*.28);
  else if(uDnaDebug<2.5)dbg=vec3(dnFreckles+dnPIH*.4,dnFreckles*.67+dnPIH*.2,dnFreckles*.25);
  else if(uDnaDebug<3.5)dbg=vec3(dnOil*.8,dnOil*.8,dnOil);
  else if(uDnaDebug<4.5)dbg=vec3(dnUnderPigment*.6,dnUnderVascular*.6,dnUnderVascular);
  else if(uDnaDebug<5.5)dbg=vec3(dnPapule+dnPIE*.75,dnPustule*.45,dnPIH+dnPit*.7);
  else if(uDnaDebug<6.5)dbg=vec3(dnFollicle*.65,dnFollicle*.8,dnFollicle);
  else if(uDnaDebug<7.5)dbg=vec3(dnDry*.8,dnDry*.9,dnDry);
  else dbg=vec3(dnMask,clamp(dnOil+dnDry,0.,1.),clamp(dnPit+dnUnderPigment,0.,1.));
  diffuseColor.rgb=mix(vec3(.012),clamp(dbg,0.,1.),sdCover);
 }
`;
const surface=String.raw`
 float dnEffect=clamp(uDnaOn*uDnaAmount,0.,1.3);
 float dnRough=roughnessFactor-.085*dnOil+.13*dnDry+.036*dnPapule+.018*dnPIE;
 roughnessFactor=mix(roughnessFactor,clamp(dnRough,.22,.82),sdSkin*dnEffect);
 // The scar is only a visual micro-normal candidate. NO true vertex displacement claimed.
 float dnMicro=(.000115*dnPapule-.000065*dnPit+.000021*dnDry)*dnEffect;
 vec2 dnDH=vec2(dFdx(dnMicro),dFdy(dnMicro));
 vec3 dnDX=dFdx(-vViewPosition),dnDY=dFdy(-vViewPosition);
 vec3 dnR1=cross(dnDY,normal),dnR2=cross(normal,dnDX);
 float dnDet=dot(dnDX,dnR1);
 vec3 dnSlope=sign(dnDet)*(dnDH.x*dnR1+dnDH.y*dnR2)/max(abs(dnDet),1e-14);
 dnSlope*=min(1.,.065/max(length(dnSlope),.0001));
 normal=normalize(normal-dnSlope*sdSkin*clamp(dnPapule+dnPit+dnDry,0.,1.));
`;
function validate(o){
 if(!o||typeof o!=='object')throw Error('Missing SkinVariationDNA recipe');
 for(const [k,,lo,hi] of spec)if(!Number.isFinite(o[k])||o[k]<lo||o[k]>hi)throw Error('DNA control outside range '+k);
 if(!Number.isFinite(o.phase)||o.phase<0||o.phase>1)throw Error('DNA phase outside range');
 return{...o};
}
return{version:'SKIN-VARIATION-DNA-R01',schema:'kaopu.skin-variation-dna/1',spec,presets,roots,pack,declarations,colour,surface,validate,
 facts:{originalCharacter:true,originalSSS:true,originalPores:true,piePihNoHeight:true,underEyeNoBakedStructuralShadow:true,
  scarDisplacementImplemented:false,beardHairAdapterConnected:false,externalReferencePixelsCopied:false}};
})();