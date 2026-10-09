/** Paper request bridge only. Does not bind clothing, simulate collisions or mutate the human. */
const clone=x=>structuredClone(x);
export function validateBodyProfile(input,schema){
 if(!input||input.schema!=='kaopu-tailor-body-measurements@1')throw Error('未知人物量体协议');
 if(typeof input.id!=='string'||!input.id.trim()||input.revision===undefined||input.revision===null||input.revision==='')throw Error('缺少人物标识或体型版本');
 if(input.units!=='cm')throw Error('量体接口当前仅接受厘米与角度；不能暗中缩放人体');
 if(!/^[a-f0-9]{64}$/.test(input.sourceSHA256||''))throw Error('缺少有效量体来源SHA256');
 if(input.kind!=='reference-body'&&!/^[a-f0-9]{64}$/.test(input.bodyGeometrySHA256||''))throw Error('当前人物必须携带体表几何SHA256');
 const b=input.bodyCm;if(!b||Array.isArray(b)||typeof b!=='object')throw Error('缺少完整人物量体');
 const angles=new Set(['shoulder_incl','arm_pose_angle','hip_inclination']);
 for(const k of schema.requiredBodyCm){if(typeof b[k]!=='number'||!Number.isFinite(b[k])||!angles.has(k)&&b[k]<=0)throw Error('缺少或无效量体字段：'+k);}
 for(const[k,v]of Object.entries(b))if(typeof v!=='number'||!Number.isFinite(v))throw Error('非法量体值：'+k);
 if(b.height-b.head_l-b.waist_line-b.hips_line<=0)throw Error('人体纵向尺寸关系无效');
 return clone(input);
}
export function makeRequest(preset,fullDesign,bodyProfile,schema){
 if(!preset?.id||preset.paperValid!==true)throw Error('该预设尚未通过纸样检查');
 const body=validateBodyProfile(bodyProfile,schema);
 if(!fullDesign||typeof fullDesign!=='object')throw Error('必须提供完整设计配方');
 for(const p of schema.parameters){
  const leaf=p.path.split('.').reduce((v,k)=>v?.[k],fullDesign);const v=leaf?.v;
  if(p.type==='bool'&&typeof v!=='boolean')throw Error('设计参数类型不符：'+p.path);
  if(['int','float'].includes(p.type)&&(!Number.isFinite(v)||p.type==='int'&&!Number.isInteger(v)||v<Math.min(...p.samplingRange)||v>Math.max(...p.samplingRange)))throw Error('设计参数范围不符：'+p.path);
  if(p.type.startsWith('select')&&!(v===null&&p.nullable)&&!p.samplingRange.includes(v))throw Error('设计选项无效：'+p.path);
 }
 return {schema:'kaopu-tailor-preset-request@1',presetId:preset.id,presetRevision:'P01',
  bodyIdentity:{id:body.id,revision:body.revision,measurementSHA256:body.sourceSHA256,geometrySHA256:body.bodyGeometrySHA256??null},
  generatorRequest:{bodyCm:clone(body.bodyCm),design:clone(fullDesign)},
  operation:'generate-paper',fabricProfile:null,sewingResult:null,bodyMutationAllowed:false,
  geometryReuseAllowed:false,physicalFitAccepted:false,dynamicWearCertified:false};
}
export function packetMatchesBody(packet,body){return packet?.bodyIdentity?.id===body?.id&&packet?.bodyIdentity?.revision===body?.revision&&packet?.bodyIdentity?.measurementSHA256===body?.sourceSHA256;}
