// Limited sizing preflight; not fabric calibration, fit certification or collision response.
const value=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o)?.v;
export function preflightSizing(pattern){
 const result={schema:'kaopu-source-paper-fit-preflight@1',assessed:false,blocking:false,policy:'non-elastic-straight-skirt',fabricElasticityCalibrated:false,garmentFitAccepted:false};
 if(!pattern)return{...result,reason:'paper-not-generated'};
 if(value(pattern.design,'meta.bottom')!=='Skirt2'||value(pattern.design,'skirt.flare')!==0||value(pattern.design,'skirt.bottom_cut')!==0||value(pattern.design,'skirt.rise')!==1)return{...result,reason:'construction-outside-this-sizing-check'};
 const panels=pattern.panels?.filter(p=>/^skirt_(front|back)$/.test(p.id));
 if(!panels||panels.length!==2)return{...result,reason:'not-two-source-skirt-panels'};
 const dimensions=[];
 for(const p of panels){
  const points=p.verticesMm;
  if(!Array.isArray(points)||points.length!==4||points.some(q=>q.length!==2||q.some(x=>!Number.isFinite(x))))return{...result,reason:'nonrectangular-source-panel'};
  const xs=points.map(q=>q[0]),ys=points.map(q=>q[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  if(points.some(([x,y])=>Math.min(Math.abs(x-xmin),Math.abs(x-xmax))>1e-7||Math.min(Math.abs(y-ymin),Math.abs(y-ymax))>1e-7))return{...result,reason:'nonrectangular-source-panel'};
  dimensions.push({panelId:p.id,widthMm:xmax-xmin,heightMm:ymax-ymin});
 }
 const hips=pattern.bodyCm?.hips,hipDepth=pattern.bodyCm?.hips_line;
 if(!(Number.isFinite(hips)&&hips>0&&Number.isFinite(hipDepth)&&hipDepth>0))return{...result,blocking:true,reason:'missing-required-source-body-measurements',message:'缺少原人体臀围或臀高数据，不能确认这条直裙的尺寸。'};
 if(Math.min(...dimensions.map(p=>p.heightMm))<hipDepth*10)return{...result,reason:'skirt-does-not-cover-full-recorded-hip-depth'};
 const paperCircumferenceMm=dimensions.reduce((s,p)=>s+p.widthMm,0),bodyHipMm=hips*10;
 const shortageMm=Math.max(0,bodyHipMm-paperCircumferenceMm),ruffle=value(pattern.design,'skirt.ruffle');
 const requiredCircumferenceIncreasePercent=Math.max(0,bodyHipMm/paperCircumferenceMm-1)*100;
 const suggestedRuffle=Number.isFinite(ruffle)&&ruffle>0?Math.ceil(ruffle*(bodyHipMm+10)/paperCircumferenceMm*100-1e-10)/100:null;
 const blocking=shortageMm>0.1;
 return{...result,assessed:true,blocking,reason:blocking?'straight-skirt-below-hip-girth':'no-net-hip-girth-deficit',paperCircumferenceMm,bodyHipMm,shortageMm,requiredCircumferenceIncreasePercent,dimensions,suggestedRuffle,suggestionEaseMm:10,automaticPatternChange:false,comparisonAssumption:'horizontal material circumference versus recorded net hips; excludes bias shear and fabric calibration',message:blocking?`当前直裙纸样周长 ${paperCircumferenceMm.toFixed(1)} mm，小于人台臀围 ${bodyHipMm.toFixed(1)} mm，缺少 ${shortageMm.toFixed(1)} mm；按当前横向裙围对照需增大约 ${requiredCircumferenceIncreasePercent.toFixed(1)}%。当前面料无实测弹性，已阻止长时间试算。请先改纸样。`:`直裙纸样周长 ${paperCircumferenceMm.toFixed(1)} mm，超过人台净臀围 ${(paperCircumferenceMm-bodyHipMm).toFixed(1)} mm；仅通过尺寸预检，仍需缝合与穿插检查。`};
}
