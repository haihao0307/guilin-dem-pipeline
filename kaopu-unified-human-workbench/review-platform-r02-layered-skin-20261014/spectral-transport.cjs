// Build-time spectral calculation. Browser code uses the derived, quantified
// table; biological coefficients and colorimetry retain separate provenance.
const fs=require('fs'),crypto=require('crypto');
const DATA=JSON.parse(fs.readFileSync(__dirname+'/integration/TissueLayers.json','utf8'));
const csv=p=>new Map(fs.readFileSync(__dirname+'/research-data/'+p,'utf8').trim().split(/\r?\n/).map(s=>s.split(',').map(Number)).map(a=>[a[0],a.slice(1)]));
const cie=csv('cie-1931-2deg.csv'),d65=csv('cie-d65.csv');
const hb=csv('hemoglobin-prahl.csv');
if(hb.size<300)throw Error('Incomplete Prahl numeric data');
const H=DATA.hemoglobin,conv=2.303*H.hemoglobinGramsPerLiter/H.molecularWeightGramsPerMole/10;
const spectral=[];let normalization=0;
for(let nm=380;nm<=780;nm+=5){const lo=Math.floor(nm/2)*2,hi=lo+2,f=(nm-lo)/2,a=hb.get(lo),b=hb.get(hi),cmf=cie.get(nm),ill=d65.get(nm)?.[0];if(!a||!b||!cmf||!Number.isFinite(ill))throw Error('Missing spectral row '+nm);normalization+=ill*cmf[1];spectral.push({nm,cmf,ill,base:(.244+85.3*Math.exp(-(nm-154)/66.2))/10,mel:6.6e11*nm**-3.33/10,S:(2e5*nm**-1.5+2e12*nm**-4)/20,oxy:(a[0]*(1-f)+b[0]*f)*conv,deoxy:(a[1]*(1-f)+b[1]*f)*conv});}
const layers=Object.fromEntries(DATA.layers.map(x=>[x.id,x]));
const presets=DATA.appearancePresets;
function slab(K,S,d){if(d===0)return[0,1];if(K<1e-12)return[S*d/(1+S*d),1/(1+S*d)];const a=1+K/S,b=Math.sqrt(a*a-1),e=Math.exp(-b*S*d),den=a+b-(a-b)*e*e;return[(1-e*e)/den,2*b*e/den];}
function add(top,bottom){return top[0]+top[1]*top[1]*bottom/Math.max(1e-12,1-top[0]*bottom);}
function spectralRGB({mel=.04,blood=.025,thickness=1,lip=0,vessel=0,preset='luminous'}={}){
 const p=presets[preset],L=DATA.vermilion,epi=p.epi*Math.max(.6,Math.min(1.2,.77+.23*thickness)),oxygen=lip?.78:.76;
 const deep=lip?.012:Math.max(.0004,Math.min(.010,.0015+((blood-.018)/.024)*.002));
 const xyz=[0,0,0];
 for(const c of spectral){const h=c.oxy*oxygen+c.deoxy*(1-oxygen),ven=c.oxy*.58+c.deoxy*.42,S=c.S*p.scatter;
  let r=slab(c.base+(lip?.025:.0008)*h,S*.58,lip?3:layers.subcutis.effectiveOpticalMM)[0];
  r=add(slab(c.base+deep*h+vessel*ven,S*.88,(lip?L.deeperConnectiveMM:layers.reticular.mm)*thickness),r);
  r=add(slab(c.base+blood*h,S,lip?L.superficialConnectiveMM:layers.papillary.mm),r);
  r=add(slab(c.base+mel*c.mel,S*.72,(lip?L.viableEpitheliumMM:layers.epidermis.mm)*epi),r);
  r=add(slab(c.base,S*.45,lip?L.corneumMM:layers.corneum.mm),r);
  for(let j=0;j<3;j++)xyz[j]+=r*c.ill*c.cmf[j]/normalization;
 }
 const [x,y,z]=xyz;
 return[3.2406*x-1.5372*y-.4986*z,-.9689*x+1.8758*y+.0415*z,.0557*x-.2040*y+1.0570*z];
}
module.exports={DATA,presets,spectral,slab,add,spectralRGB};
if(require.main===module){
 const M=32,B=16,T=8,V=4,P=3,Q=2,count=M*B*T*V*P*Q,out=Buffer.alloc(count*3*2);let index=0,clipped=0;
 const limits={mel:[.005,.32],blood:[0,.10],thickness:[.42,1.55],vessel:[0,.014]};
 for(let lip=0;lip<Q;lip++)for(const preset of Object.keys(presets))for(let vi=0;vi<V;vi++)for(let ti=0;ti<T;ti++)for(let bi=0;bi<B;bi++)for(let mi=0;mi<M;mi++){
  const mel=(Math.sqrt(limits.mel[0])+(Math.sqrt(limits.mel[1])-Math.sqrt(limits.mel[0]))*mi/(M-1))**2,blood=limits.blood[1]*bi/(B-1),thickness=limits.thickness[0]+(limits.thickness[1]-limits.thickness[0])*ti/(T-1),vessel=limits.vessel[1]*vi/(V-1);
  const rgb=spectralRGB({mel,blood,thickness,vessel,preset,lip});
  for(const v of rgb){if(v<0||v>1)clipped++;out.writeUInt16LE(Math.round(Math.max(0,Math.min(1,v))*65535),index*2);index++;}
 }
 const result={schema:'kaopu.layered-spectral-lut/1',method:'81 wavelengths 380-780nm at 5nm; finite two-flux slabs; CIE 1931 2deg and D65 integration; linear sRGB',license:'CIE input data and derived color table: CC BY-SA 4.0; see licenses/CIE-DATA-NOTICE.md',dimensions:{melanin:M,blood:B,thickness:T,vessel:V,preset:P,lip:Q},limits,presetOrder:Object.keys(presets),presets,layout:'melanin fastest, then blood, thickness, vessel, preset, lip; RGB Uint16 little endian',encoding:'base64-rgb-uint16le',texels:count,clippedComponents:clipped,payloadSHA256:crypto.createHash('sha256').update(out).digest('hex'),data:out.toString('base64')};
 fs.writeFileSync(__dirname+'/integration/LayeredSpectralLUT.json',JSON.stringify(result));
 fs.writeFileSync(__dirname+'/research-data/spectral-samples.json',JSON.stringify({source:'Prahl hemoglobin numeric interpolation; CIE 1931 and D65 5nm subsamples; factual numerical research data, no source prose',samples:spectral},null,2));
 console.log(JSON.stringify({texels:count,bytes:out.length,clipped,face:spectralRGB(),lip:spectralRGB({mel:.025,blood:.065,lip:1}),payloadSHA256:result.payloadSHA256}));
}
