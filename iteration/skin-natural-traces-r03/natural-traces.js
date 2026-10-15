/* SKIN-NATURAL-TRACES-R03.
   Procedural lived-in skin marks for the retained KAOPU character.
   No donor texture pixels, no copied scan, no disease simulation.
   The masks are artistic, seeded, sparse and anatomically gated in material space. */
window.KAOPU_TRACE_R03={
 version:'skin-natural-traces-r03-v1',
 controls:[
  ['amount','自然痕迹总量',0,1.5,1.00],
  ['acne','活动粉刺',0,1.5,.48],
  ['healed','痘印 / 色沉',0,1.5,.42],
  ['shave','剃须痕迹',0,1.5,.62],
  ['eye','眼周变化',0,1.5,.52],
  ['scar','微小凹痕',0,1.5,.28],
  ['asymmetry','左右不对称',0,1.5,.58]
 ],
 defaults:{amount:1,acne:.48,healed:.42,shave:.62,eye:.52,scar:.28,asymmetry:.58,debug:0},
 pack(packed){
  const t0=performance.now(),N=packed.width,H=packed.height,size=N*H,oldLayers=packed.layers||Math.round(packed.data.length/(size*4)),layers=oldLayers+2;
  const out=new Uint8Array(size*4*layers);out.set(packed.data);
  const A=new Float32Array(size*4),B=new Float32Array(size*4),span=96,scale=N/span;
  let state=((packed.report.seed||41731)^0x6f4a7c15)>>>0;
  const rnd=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
  const wrap=(v,n)=>(v%n+n)%n,idx=(x,y)=>wrap(y,H)*N+wrap(x,N);
  function splat(buf,ch,cx,cy,rx,ry,angle,strength,power=1){
   cx*=scale;cy*=scale;rx=Math.max(.55,rx*scale);ry=Math.max(.55,ry*scale);
   const c=Math.cos(angle),s=Math.sin(angle),R=Math.ceil(Math.max(rx,ry)*2.8);
   for(let y=Math.floor(cy)-R;y<=Math.ceil(cy)+R;y++)for(let x=Math.floor(cx)-R;x<=Math.ceil(cx)+R;x++){
    let dx=x-cx,dy=y-cy;if(dx>N/2)dx-=N;if(dx<-N/2)dx+=N;if(dy>H/2)dy-=H;if(dy<-H/2)dy+=H;
    const u=(dx*c+dy*s)/rx,v=(-dx*s+dy*c)/ry,d=u*u+v*v;if(d>7.3)continue;
    const k=idx(x,y)*4+ch,val=Math.exp(-d)*strength;buf[k]=Math.max(buf[k],Math.pow(val,power));
   }
  }
  // Active blemishes: a broad erythema halo and a smaller raised core.
  const activeCount=12+Math.floor(rnd()*7);
  for(let i=0;i<activeCount;i++){
   const x=rnd()*span,y=rnd()*span,halo=.65+rnd()*1.35,aspect=.72+rnd()*.62,a=rnd()*Math.PI,k=.55+rnd()*.43;
   splat(A,0,x,y,halo,halo*aspect,a,k,.88);
   splat(A,1,x,y,.14+rnd()*.31,.12+rnd()*.26,a,k,.72);
  }
  // Healed marks are more numerous, flatter and less saturated than active lesions.
  const healedCount=28+Math.floor(rnd()*17);
  for(let i=0;i<healedCount;i++){
   const r=.22+rnd()*.92;splat(A,2,rnd()*span,rnd()*span,r,r*(.58+rnd()*.78),rnd()*Math.PI,.32+rnd()*.58,.94);
  }
  // Razor irritation is clustered and directionally elongated; anatomy gating happens in shader.
  const razorCount=70+Math.floor(rnd()*36);
  for(let i=0;i<razorCount;i++){
   const x=rnd()*span,y=rnd()*span,ang=(rnd()-.5)*.65+(rnd()>.5?0:Math.PI*.5);
   splat(A,3,x,y,.13+rnd()*.24,.35+rnd()*.72,ang,.20+rnd()*.50,1.05);
  }
  // Shaved follicle roots: dense, irregular, sub-millimetre dots, not geometric hairs.
  const follicleCount=1150+Math.floor(rnd()*260);
  for(let i=0;i<follicleCount;i++){
   const r=.045+rnd()*.115;splat(B,0,rnd()*span,rnd()*span,r,r*(.68+rnd()*.55),rnd()*Math.PI,.20+rnd()*.72,.72);
  }
  // Tiny pitted scars: sparse depressions, never interpreted as active inflammation.
  const scarCount=10+Math.floor(rnd()*10);
  for(let i=0;i<scarCount;i++){
   const r=.22+rnd()*.72;splat(B,1,rnd()*span,rnd()*span,r,r*(.55+rnd()*.78),rnd()*Math.PI,.28+rnd()*.55,.90);
  }
  // Two independent smooth fields: mesoscopic chroma drift and periorbital irregularity.
  function field(channel,levels,weights,phase){
   const grids=levels.map((n,k)=>({n,v:Float32Array.from({length:n*n},()=>{const q=rnd();return Math.max(0,Math.min(1,q*.82+.09+Math.sin((q+phase+k)*6.283)*.035));})}));
   const sample=(g,x,y)=>{const gx=x/N*g.n,gy=y/H*g.n,ix=Math.floor(gx),iy=Math.floor(gy);let u=gx-ix,v=gy-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);const at=(a,b)=>g.v[wrap(b,g.n)*g.n+wrap(a,g.n)];return(at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;};
   for(let y=0;y<H;y++)for(let x=0;x<N;x++){let v=0;for(let k=0;k<grids.length;k++)v+=sample(grids[k],x,y)*weights[k];B[(y*N+x)*4+channel]=Math.max(0,Math.min(1,v));}
  }
  field(2,[5,11,23,47],[.22,.31,.29,.18],.13);
  field(3,[4,9,19,37],[.31,.33,.24,.12],.47);
  const offA=oldLayers*size*4,offB=(oldLayers+1)*size*4;let sums=[0,0,0,0,0,0,0,0];
  for(let i=0;i<size;i++)for(let c=0;c<4;c++){
   const a=Math.round(Math.max(0,Math.min(1,A[i*4+c]))*255),b=Math.round(Math.max(0,Math.min(1,B[i*4+c]))*255);
   out[offA+i*4+c]=a;out[offB+i*4+c]=b;sums[c]+=a/255;sums[c+4]+=b/255;
  }
  let h=2166136261;for(const v of out)h=Math.imul(h^v,16777619);
  return{...packed,data:out,layers,report:{...packed.report,traceKernel:'skin-natural-traces-r03-v1',traceLayers:2,textureLayers:layers,textureBytes:out.byteLength,mipBytesEstimate:out.byteLength*4/3,traceSpanMM:span,traceCounts:{active:activeCount,healed:healedCount,razor:razorCount,follicle:follicleCount,scar:scarCount},traceMeans:{activeHalo:sums[0]/size,activeCore:sums[1]/size,healed:sums[2]/size,razor:sums[3]/size,follicle:sums[4]/size,scar:sums[5]/size,mottle:sums[6]/size,eye:sums[7]/size},traceFingerprint:(h>>>0).toString(16).padStart(8,'0'),traceGenerationMS:performance.now()-t0,sourcePixelsCopied:false,clinicalCalibration:false,diseaseSimulation:false}};
 },
 declarations:`
uniform float uTraceAmount,uTraceAcne,uTraceHealed,uTraceShave,uTraceEye,uTraceScar,uTraceAsymmetry,uTraceDebug;
float p3AcneHalo=0.,p3AcneCore=0.,p3Healed=0.,p3Razor=0.,p3Follicle=0.,p3Scar=0.,p3Eye=0.,p3Mottle=0.,p3TraceMask=0.;
vec4 p3Tri(vec3 mm,vec3 weights,float tile,float layer){
 vec4 a=texture(uSSGField,vec3(mm.yz/tile+vec2(.071,.337),layer));
 vec4 b=texture(uSSGField,vec3(mm.zx/tile+vec2(.419,.113),layer));
 vec4 c=texture(uSSGField,vec3(mm.xy/tile+vec2(.257,.619),layer));
 return a*weights.x+b*weights.y+c*weights.z;
}
`,
 colour:`
 // Sparse event fields are evaluated in stable rest-material space, then gated by facial anatomy.
 vec4 p3A=p3Tri(p2MM+vec3(17.,3.,29.),p2W,96.,3.);
 vec4 p3B=p3Tri(p2MM+vec3(41.,11.,7.),p2W,96.,4.);
 float p3Side=mix(1.-.18*uTraceAsymmetry,1.+.18*uTraceAsymmetry,smoothstep(-.018,.022,p2P.x));
 p3Side*=mix(.92,1.08,p3B.b);
 float p3NoLip=1.-clamp(lpMask,0.,1.),p3NoEye=1.-clamp(p2Lid*1.35,0.,1.);
 float p3AcneZone=clamp(.52*p2Cheek+.34*p2Forehead+.32*p2Chin+.19*p2Jaw+.10*p2Ala,0.,1.)*p2Head*p2Front*p3NoLip*p3NoEye;
 float p3HealedZone=clamp(.40*p2Cheek+.30*p2Forehead+.31*p2Chin+.25*p2Jaw+.12*p2Temple,0.,1.)*p2Head*p2Front*p3NoLip;
 float p3ShaveZone=clamp(p2Beard*(1.-p2Lid)*(1.-clamp(lpMask,0.,1.)),0.,1.);
 float p3EyeZone=clamp(p2Lid*.72+p2Socket*.70+p2Temple*.12,0.,1.)*p2Head*p2Front*p3NoLip;
 p3AcneHalo=clamp(p3A.r*p3AcneZone*uTraceAcne*p3Side,0.,1.);
 p3AcneCore=clamp(p3A.g*p3AcneZone*uTraceAcne*p3Side,0.,1.);
 p3Healed=clamp(p3A.b*p3HealedZone*uTraceHealed*(2.-p3Side*.82),0.,1.);
 p3Razor=clamp(p3A.a*p3ShaveZone*uTraceShave*p3Side,0.,1.);
 p3Follicle=clamp(p3B.r*p3ShaveZone*uTraceShave*(.70+.30*p3Side),0.,1.);
 p3Scar=clamp(p3B.g*p3HealedZone*uTraceScar*(2.-p3Side*.76),0.,1.);
 p3Mottle=(p3B.b-.5)*clamp(.48*p2Cheek+.24*p2Forehead+.18*p2Temple+.10*p2Jaw,0.,1.)*uTraceAsymmetry*p2Head;
 p3Eye=clamp((.44+.56*p3B.a)*p3EyeZone*uTraceEye*(2.-p3Side*.88),0.,1.);
 p3TraceMask=clamp(max(max(p3AcneHalo,p3AcneCore),max(max(p3Healed,p3Razor),max(p3Follicle,max(p3Scar,p3Eye)))),0.,1.);
 vec3 p3Paint=diffuseColor.rgb;
 p3Paint*=1.+p3Mottle*vec3(.032,-.010,-.018);
 p3Paint*=mix(vec3(1.),vec3(1.075,.77,.79),p3AcneHalo*.52);
 p3Paint*=mix(vec3(1.),vec3(1.09,.66,.68),p3AcneCore*.62);
 vec3 p3Post=mix(vec3(1.045,.82,.80),vec3(.72,.62,.64),smoothstep(.28,.72,uSDMel));
 p3Paint*=mix(vec3(1.),p3Post,p3Healed*.48);
 p3Paint*=mix(vec3(1.),vec3(1.035,.82,.84),p3Razor*.38);
 p3Paint*=mix(vec3(1.),vec3(.48,.57,.63),p3Follicle*.38);
 p3Paint*=mix(vec3(1.),vec3(.89,.84,.955),p3Eye*.28);
 p3Paint*=mix(vec3(1.),vec3(.91,.86,.88),p3Scar*.13);
 diffuseColor.rgb=mix(diffuseColor.rgb,p3Paint,sdCover*uTraceAmount*p3NoLip);
 if(uTraceDebug>.5){
  vec3 p3Dbg=vec3(0.);
  if(uTraceDebug<1.5)p3Dbg=vec3(p3AcneHalo,p3AcneCore*.35,0.);
  else if(uTraceDebug<2.5)p3Dbg=vec3(p3Healed*.70,p3Healed*.30,p3Scar);
  else if(uTraceDebug<3.5)p3Dbg=vec3(p3Razor,p3Follicle*.75,p3Follicle);
  else if(uTraceDebug<4.5)p3Dbg=vec3(p3Eye*.42,p3Eye*.34,p3Eye);
  else p3Dbg=vec3(p3TraceMask,p3Mottle*.5+.5,p3Scar);
  diffuseColor.rgb=mix(vec3(.018),p3Dbg,sdCover);
 }
`,
 surface:`
 // Correlated surface response: active cores rise, pitted scars sink, razor irritation dries locally.
 float p3LocalRough=roughnessFactor-p3AcneCore*.035+p3Healed*.010+p3Razor*.052+p3Follicle*.020+p3Scar*.022+p3Eye*.012;
 roughnessFactor=mix(roughnessFactor,clamp(p3LocalRough,.23,.82),sdSkin*uTraceAmount);
 float p3Height=(p3AcneCore*.00024-p3Scar*.000105)*uTraceAmount;
 vec2 p3DH=vec2(dFdx(p3Height),dFdy(p3Height));
 vec3 p3DX=dFdx(-vViewPosition),p3DY=dFdy(-vViewPosition),p3R1=cross(p3DY,normal),p3R2=cross(normal,p3DX);
 float p3Det=dot(p3DX,p3R1);
 vec3 p3Slope=sign(p3Det)*(p3DH.x*p3R1+p3DH.y*p3R2)/max(abs(p3Det),1e-14);
 p3Slope*=min(1.,.10/max(length(p3Slope),.0001));
 normal=normalize(normal-p3Slope*sdSkin*max(p3AcneCore,p3Scar));
`
};
