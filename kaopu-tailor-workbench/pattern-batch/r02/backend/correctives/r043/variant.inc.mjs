async function generateNativeVariant43(data){
 stop();requestId=data.requestId;nativeBinding=null;spec=analytic=lab=null;resetContinuation();requirePerson(data.person,R04_LOCK.person);
 const row=R04_ROWS[data.presetId];if(!row||await sha(data.paperText)!==row.decodedSHA256)throw Error('参数变体必须从该款已冻结的原纸样派生。');
 const original=JSON.parse(data.paperText),token=epoch,parameters=data.parameters||{},easeCm=data.easeCm??0,waistEaseCm=data.waistEaseCm??0;
 const schema=await json(new URL('../../../parameter-schema.json',import.meta.url).href),byPath=new Map(schema.parameters.map(p=>[p.path,p]));
 if(!Number.isFinite(easeCm)||easeCm<0||easeCm>12)throw Error('试穿松量支持0至12厘米；不是无限制放大模型。');
 if(!Number.isFinite(waistEaseCm)||waistEaseCm<0||waistEaseCm>6)throw Error('腰头加放量支持0至6厘米，增大时需另验支承。');
 const design=structuredClone(original.design),changes=[];
 for(const[path,value]of Object.entries(parameters)){
  const rule=byPath.get(path);if(!rule)throw Error('未知原生参数：'+path);
  if(rule.type==='bool'&&typeof value!=='boolean')throw Error('布尔参数类型不符：'+path);
  if(rule.type==='int'||rule.type==='float'){if(!Number.isFinite(value)||(rule.type==='int'&&!Number.isInteger(value))||value<Math.min(...rule.samplingRange)||value>Math.max(...rule.samplingRange))throw Error('超出原制版参数范围：'+path);}
  if(rule.choices&&!rule.choices.some(v=>v===value))throw Error('原程序不支持该选项：'+path);
  let at=design;const keys=path.split('.');for(const k of keys.slice(0,-1))at=at[k];const old=at[keys.at(-1)].v;at[keys.at(-1)].v=value;if(old!==value)changes.push({path,from:old,to:value});
 }
 const patternBodyCm=structuredClone(original.bodyCm),sizing=[];
 // Positive ease changes only garment drafting dimensions, not the displayed/colliding person.
 for(const[key,back,extra]of[['bust','back_width',easeCm],['waist','waist_back_width',waistEaseCm],['hips','hip_back_width',easeCm]])if(extra){const before=patternBodyCm[key],ratio=(before+extra)/before;patternBodyCm[key]+=extra;if(Number.isFinite(patternBodyCm[back]))patternBodyCm[back]*=ratio;sizing.push({measurement:key,fromCm:before,toCm:patternBodyCm[key],classification:'garment-drafting-ease-not-person-measurement'});}
 if(!engine){const imported=await import(new URL('pattern-engine.mjs',patternBase).href);engine=imported.createPatternEngine();}
 const paramsHash=await sha(stable43({parameters,easeCm,waistEaseCm}));
 for(const k in profile)profile[k]=0;
 const start=performance.now(),generated=await engine.generate({bodyCm:patternBodyCm,design:{style:row.style,...design},validateIntersections:true},{assetBase:patternBase},p=>{if(token===epoch)emit('runtime',p)});
 if(token!==epoch)return;profile.pythonMs=performance.now()-start;
 const originalRuntime=await engine.generate({bodyCm:original.bodyCm,design:{style:row.style,...original.design},validateIntersections:true},{assetBase:patternBase});
 if(token!==epoch)return;
 const sameGeometry=await cuttingGeometryHash43(generated)===await cuttingGeometryHash43(originalRuntime);
 if(sameGeometry){emit('parameter-inactive',{presetId:row.id,parameterRequestSHA256:paramsHash,changes,geometryChanged:false,message:'本次参数在当前领型、袖型或版式条件下没有改变裁片；未冒充调节生效。'});return;}
 analytic=await recoverExplicitPantsCuffGathering(prepareNativeSource(generated));
 config={kind:'analytic',variant43:true,recipe:{bodyCm:patternBodyCm,design:{style:row.style,...design}}};
 spec=compileWithinNativeBudget(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'common-native-default-r04',sizingOrigin:'explicit-source-parameter-variant'}});validate2(spec);
 nativeBinding={person:structuredClone(R04_LOCK.person),presetId:row.id,basePresetId:row.id,recipeHash:generated.recipeHash,paperSHA256:await sha(JSON.stringify(generated)),basePaperSHA256:row.decodedSHA256,materialSHA256:await materialHash(spec),nativeAnchor:R04_LOCK.nativeAnchor,patternSizingOrigin:'EXPLICIT_GENERATED_GARMENT_VARIANT_NOT_CHANGED_PERSON',parameterRequestSHA256:paramsHash,parameters:structuredClone(parameters),easeCm,waistEaseCm,changes,sizing};
 spec.source.nativeBinding=structuredClone(nativeBinding);spec.source.bodyId='common-native-default-r04';spec.source.patternSizingOrigin=nativeBinding.patternSizingOrigin;
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);emit('paper',{spec,analytic,positionsM,variant:true,geometryChanged:true,binding:nativeBinding,fitPreflight:fit,canSew:!fit.blocking,physicalStatus:'原制版程序生成了实际新裁片；需重新缝合，不沿用旧成衣。'},[positionsM.buffer]);
}
const stable43=x=>JSON.stringify(x&&typeof x==='object'?Array.isArray(x)?x.map(v=>JSON.parse(stable43(v))):Object.fromEntries(Object.keys(x).sort().map(k=>[k,JSON.parse(stable43(x[k]))])):x);
async function cuttingGeometryHash43(d){return sha(stable43(d.panels.map(p=>({id:p.id,verticesMm:p.verticesMm,edges:p.edges,placement:p.placement}))));}
