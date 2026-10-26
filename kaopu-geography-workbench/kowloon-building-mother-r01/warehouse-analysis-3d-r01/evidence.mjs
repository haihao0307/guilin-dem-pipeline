export const STATUS_LABELS={observed:'图像可见观察',documented:'来源记载（非现场复核）',hypothesis:'候选解释',unknown:'未知 / null',design_intent:'生成显示意图'};
const anchors=Object.freeze({'WH-O-005':['p024'],'WH-I-002':['p024','p012']});
export function claimScope(claim,patchId){const ids=anchors[claim.id]??[];if(ids.includes(patchId))return{mapped:true,text:claim.status==='observed'?'已登记图集区域与该源面对应；只证明图像痕迹，不证明三维尺度或真实构造。':'代码对该源面的显示规则；不是实楼事实。'};return{mapped:false,text:ids.length?'该条只关联 '+ids.join(' / ')+'，不自动关联当前面。':claim.status==='unknown'?'缺少证据；不在三维中补画实体。':'照片/整栋记录范围；未取得它与当前源面的精确配准。'};}
export function filteredClaims(data,status,patchId){return data.claims.filter(c=>status==='all'||c.status===status).map(c=>({claim:c,...claimScope(c,patchId)})).sort((a,b)=>Number(b.mapped)-Number(a.mapped));}
