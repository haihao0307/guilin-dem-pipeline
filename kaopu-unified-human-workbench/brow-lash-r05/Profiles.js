(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.__R05Profiles=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const mix=(a,b,t)=>a*(1-t)+b*t;
  const DEFAULTS=Object.freeze({
    seed:7319,density:1.24,span:.98,bandWidth:.94,arch:.08,peak:.60,peakSharpness:1,
    headFullness:1.05,bodyFullness:1.14,tailFullness:.88,
    headAngle:64,bodyAngle:16,tailAngle:-8,crossFlow:19,
    strandLength:1,lengthVariation:.28,edgeShortening:.24,laydown:.98,lift:.12,clump:.10,rootJitter:.10,
    fiberWidth:.92,vellus:.20,asymmetry:.04,roughness:.50,color:'#52372b',
    brows:true,lashes:true,showDomain:false
  });
  const PRESETS=Object.freeze({
    natural:{label:'自然高密',note:'眉头上扬 · 眉身顺流 · 眉尾收细',values:{}},
    straight:{label:'平直浓眉',note:'低拱宽眉身 · 尾部平稳',values:{density:1.18,bandWidth:.96,arch:-.06,peak:.56,headFullness:1.08,bodyFullness:1.14,tailFullness:.84,headAngle:52,bodyAngle:7,tailAngle:-4,crossFlow:15,strandLength:.94,fiberWidth:.98,clump:.08,edgeShortening:.20}},
    softArch:{label:'柔弧眉',note:'缓慢起拱 · 柔和回落',values:{density:1.12,bandWidth:.82,arch:.30,peak:.63,peakSharpness:.78,headAngle:62,bodyAngle:20,tailAngle:-10,crossFlow:19,tailFullness:.74,strandLength:.95}},
    highArch:{label:'高眉峰',note:'峰位靠外 · 眉尾明显下收',values:{density:1.08,bandWidth:.74,arch:.56,peak:.67,peakSharpness:1.55,headFullness:.88,bodyFullness:1.02,tailFullness:.68,headAngle:68,bodyAngle:18,tailAngle:-24,crossFlow:20,strandLength:.90,fiberWidth:.88}},
    feather:{label:'羽状上扬',note:'眉头与眉身向上梳理',values:{density:1.15,bandWidth:.88,arch:.18,peak:.59,headAngle:82,bodyAngle:32,tailAngle:8,crossFlow:11,lift:.20,laydown:.82,clump:.06,lengthVariation:.32,strandLength:.96,edgeShortening:.18,rootJitter:.12}},
    strong:{label:'粗浓英气',note:'高密宽带 · 毛干更粗',values:{density:1.30,bandWidth:1,arch:.04,headFullness:1.18,bodyFullness:1.22,tailFullness:.95,headAngle:58,bodyAngle:12,tailAngle:-7,crossFlow:22,strandLength:1.00,fiberWidth:1.05,vellus:.12,clump:.12,color:'#3d2a22'}},
    fine:{label:'细长淡眉',note:'窄带细毛 · 皮肤可见',values:{density:1.24,bandWidth:.58,arch:.18,peak:.62,headFullness:.88,bodyFullness:.94,tailFullness:.76,headAngle:63,bodyAngle:17,tailAngle:-12,crossFlow:16,strandLength:.88,fiberWidth:.68,vellus:.28,color:'#694a3b',roughness:.57}},
    shortDense:{label:'短浓眉',note:'缩短眉尾 · 保留厚眉身',values:{density:1.25,span:.80,bandWidth:.94,arch:.03,headFullness:1.12,bodyFullness:1.18,tailFullness:.46,headAngle:58,bodyAngle:10,tailAngle:-3,crossFlow:21,strandLength:.88,fiberWidth:1.00,edgeShortening:.27}},
    angular:{label:'清晰折角',note:'中外段转折更明确',values:{density:1.15,bandWidth:.78,arch:.44,peak:.58,peakSharpness:1.85,headAngle:66,bodyAngle:8,tailAngle:-22,crossFlow:20,tailFullness:.72,strandLength:.92,clump:.08}},
    rounded:{label:'圆弧自然',note:'峰位居中 · 尾部缓降',values:{density:1.12,bandWidth:.84,arch:.22,peak:.52,peakSharpness:.62,headAngle:58,bodyAngle:24,tailAngle:1,crossFlow:18,tailFullness:.78,strandLength:.93,clump:.09}}
  });
  const numericRanges=Object.freeze({
    density:[.45,1.3],span:[.65,1],bandWidth:[.42,1],arch:[-.35,.65],peak:[.35,.78],peakSharpness:[.5,2],
    headFullness:[.35,1.25],bodyFullness:[.35,1.25],tailFullness:[.2,1.25],
    headAngle:[20,90],bodyAngle:[-12,48],tailAngle:[-38,28],crossFlow:[0,35],strandLength:[.6,1.4],lengthVariation:[0,.45],edgeShortening:[0,.45],
    laydown:[.45,1.15],lift:[.02,.5],clump:[0,.5],rootJitter:[0,.18],fiberWidth:[.5,1.45],vellus:[0,.38],asymmetry:[0,.25],roughness:[.25,.75]
  });
  function validate(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('眉毛配方必须为对象');
    const out={...DEFAULTS,...input};
    for(const k of Object.keys(out))if(!(k in DEFAULTS))throw Error('未知眉毛参数 '+k);
    for(const [k,[a,b]] of Object.entries(numericRanges)){
      const v=out[k];if(!Number.isFinite(v)||v<a||v>b)throw Error(k+' 越界');
    }
    if(!Number.isInteger(out.seed)||out.seed<0||out.seed>2147483647)throw Error('seed 越界');
    if(!/^#[0-9a-f]{6}$/i.test(out.color))throw Error('颜色格式错误');
    for(const k of ['brows','lashes','showDomain'])if(typeof out[k]!=='boolean')throw Error(k+' 必须为布尔值');
    return out;
  }
  function preset(id){const p=PRESETS[id];if(!p)throw Error('未知眉形 '+id);return validate(p.values);}
  function hash01(seed,index,salt=0){let x=(seed^(index*0x9e3779b1)^(salt*0x85ebca6b))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);x^=x>>>16;return(x>>>0)/4294967296;}
  function regionFullness(u,s){
    if(u<.16)return mix(s.headFullness,s.bodyFullness,smooth(.02,.18,u));
    if(u<.74)return s.bodyFullness;
    return mix(s.bodyFullness,s.tailFullness,smooth(.70,1,u));
  }
  function centerShift(u,s){
    const sigma=.22/Math.sqrt(s.peakSharpness);
    const g=Math.exp(-.5*Math.pow((u-s.peak)/sigma,2));
    const headEase=smooth(0,.12,u),tailEase=1-smooth(.88,1,u);
    return clamp(s.arch*g*headEase*tailEase,-.72,.72);
  }
  function occupiedHalfWidth(u,s){
    const head=.68+.32*smooth(0,.16,u),tail=1-.62*smooth(.68,1,u),spanEnd=.16+.84*s.span;
    if(u>spanEnd)return 0;
    const endFade=1-smooth(spanEnd-.06,spanEnd,u);
    return clamp(s.bandWidth*head*tail*endFade,.02,1);
  }
  function inclusion(u,v,s,randomValue){
    const half=occupiedHalfWidth(u,s);if(half<=0)return false;
    const d=Math.abs(v-centerShift(u,s))/half;if(d>1)return false;
    const edge=.52+.48*(1-smooth(.62,1,d));
    const probability=clamp(s.density*regionFullness(u,s)*edge,0,1);
    return randomValue<probability;
  }
  function flowAngleDeg(u,s){
    if(u<.28)return mix(s.headAngle,s.bodyAngle,smooth(.04,.28,u));
    return mix(s.bodyAngle,s.tailAngle,smooth(.48,1,u));
  }
  function lengthScale(u,v,s,r0,r1){
    const center=1-.18*Math.abs(v-centerShift(u,s));
    const region=.88+.16*Math.sin(Math.PI*clamp(u));
    const variation=1+(r0*2-1)*s.lengthVariation;
    const isVellus=r1<s.vellus;
    return Math.max(.32,s.strandLength*center*region*variation*(isVellus?(.42+.22*r0):1));
  }
  function sideModifiers(side,s){const sign=side==='left'?1:-1;return{arch:1+sign*s.asymmetry*.35,width:1-sign*s.asymmetry*.18,angle:sign*s.asymmetry*8};}
  return{DEFAULTS,PRESETS,numericRanges,validate,preset,hash01,regionFullness,centerShift,occupiedHalfWidth,inclusion,flowAngleDeg,lengthScale,sideModifiers,clamp,smooth,mix};
});
