// A group owns ROOTS and complete root-to-tip paths. No face/height groups.
// x<0 is image-left in the frontal inspection camera, not anatomical left.
export const BUNDLES=Object.freeze([
 {id:'bang-sweep',name:'A · 斜刘海',color:'#c8464a',kind:'fringe',layer:'front',evidence:'visible-flow; inferred-root-patch',origin:'前额上方偏分左侧的前排根区',route:'沿前额头皮向画面左下方斜梳',end:'左眉上方至眉尾；不延长为侧帘',quota:24},
 {id:'bang-wisps',name:'B · 中央碎刘海',color:'#c8464a',kind:'fringe',layer:'front',evidence:'visible-flow; inferred-root-patch',origin:'偏分右缘邻近发际线的小根区',route:'先贴前额曲面，再向下略偏右',end:'额头中下部，长短错开',quota:4},
 {id:'frame-left',name:'C · 左贴脸长束',color:'#46a85f',kind:'body',layer:'face-frame',evidence:'visible-flow; inferred-root-patch',origin:'左前额至颞侧前缘根区',route:'绕开额角、沿脸颊外侧下行',end:'颈侧至肩上，末端向内',quota:18},
 {id:'frame-right',name:'D · 右贴脸长束',color:'#d3b43e',kind:'body',layer:'face-frame',evidence:'visible-flow; inferred-root-patch',origin:'右前额至颞侧前缘根区',route:'沿分缝右侧、绕额角向下',end:'颈侧至肩上，末端向内',quota:22},
 {id:'outer-left',name:'E · 左外层长束',color:'#3165ac',kind:'body',layer:'outer',evidence:'visible-silhouette; inferred-root-patch',origin:'偏分左侧冠部和上颞根区',route:'先沿头顶向左铺开，再越过颞侧下行',end:'左肩上方；形成外侧轮廓',quota:26},
 {id:'outer-right',name:'F · 右外层长束',color:'#26a5aa',kind:'body',layer:'outer',evidence:'visible-silhouette; inferred-root-patch',origin:'偏分右侧冠部和上颞根区',route:'先沿头顶向右铺开，再向下',end:'右肩上方；形成外侧轮廓',quota:26},
 {id:'under-left',name:'G · 左耳侧内层',color:'#995ac1',kind:'body',layer:'under',evidence:'partly-occluded; inferred',origin:'左下颞、耳上与耳后前半根区',route:'较短路线绕耳外侧下垂，位于外层以内',end:'颈侧；不单独制造外壳',quota:12},
 {id:'under-right',name:'H · 右耳侧内层',color:'#995ac1',kind:'body',layer:'under',evidence:'partly-occluded; inferred',origin:'右下颞、耳上与耳后前半根区',route:'绕耳外侧下垂，位于外层以内',end:'颈侧；不单独制造外壳',quota:12},
 {id:'back-left',name:'I · 左后上层',color:'#995ac1',kind:'body',layer:'back',evidence:'inferred-unseen',origin:'左后冠至枕部上方根区',route:'沿后脑向后下方，再自然下垂',end:'左后颈至肩上；接续侧面长度',quota:18},
 {id:'back-right',name:'J · 右后上层',color:'#995ac1',kind:'body',layer:'back',evidence:'inferred-unseen',origin:'右后冠至枕部上方根区',route:'沿后脑向后下方，再自然下垂',end:'右后颈至肩上；接续侧面长度',quota:18},
 {id:'nape',name:'K · 后颈内层',color:'#995ac1',kind:'body',layer:'nape',evidence:'inferred-unseen',origin:'后枕下部和已通过后颈根区',route:'短路线沿后颈下行，留在后上层之内',end:'肩背上方；被后上层覆盖',quota:12}
]);
export const GUIDE_COUNT=BUNDLES.reduce((n,b)=>n+b.quota,0); // 192, unchanged exchange count
export function bundleOf(root,r){
 const p=root.chartP||root.p,dx=p[0]-r.partMM*.001;
 if(p[2]>.077 && p[1]>.336 && p[1]<.390){
  if(dx>=-.003 && dx<.006 && p[2]>.100 && p[1]<.378)return 'bang-wisps';
  if(dx<-.003 && dx>-.063)return 'bang-sweep';
 }
 if(p[2]>.065)return dx<0?'frame-left':'frame-right';
 if(p[2]>-.027)return (p[1]>.335?'outer-':'under-')+(dx<0?'left':'right');
 if(p[1]>.318)return dx<0?'back-left':'back-right';
 return 'nape';
}
export const bundleSpec=id=>BUNDLES.find(b=>b.id===id);
// Stratified farthest sampling WITHIN each root patch, not shell sampling.
export function selectBundleGuides(roots,r){
 const selected=[];
 for(const spec of BUNDLES){
  const bank=roots.filter(root=>root.active&&bundleOf(root,r)===spec.id);
  if(bank.length<spec.quota)throw Error('根区样本不足：'+spec.id+' '+bank.length);
  const center=bank.reduce((v,r)=>v.map((x,k)=>x+r.chartP[k]/bank.length),[0,0,0]);
  const d2=(a,b)=>a.reduce((n,x,k)=>n+(x-b[k])**2,0);
  let first=bank.reduce((a,b)=>d2(a.chartP,center)<d2(b.chartP,center)?a:b),chosen=[first],used=new Set([first.id]),dist=bank.map(()=>Infinity);
  while(chosen.length<spec.quota){const last=chosen.at(-1);for(let i=0;i<bank.length;i++)dist[i]=Math.min(dist[i],d2(last.chartP,bank[i].chartP));let best=-1;for(let i=0;i<bank.length;i++)if(!used.has(bank[i].id)&&(best<0||dist[i]>dist[best]))best=i;chosen.push(bank[best]);used.add(bank[best].id);}
  selected.push(...chosen);
 }
 return selected;
}
export function buildBundlePlan(roots,curves,r){
 const groups=BUNDLES.map(spec=>({...spec,rootIds:roots.filter(p=>p.active&&bundleOf(p,r)===spec.id).map(p=>p.id),guideRootIds:curves.filter(c=>c.bundleId===spec.id).map(c=>c.rootId),tipTargets:curves.filter(c=>c.bundleId===spec.id).map(c=>({rootId:c.rootId,position:c.points.slice(-3),designed:c.styleProfile.target.slice()}))}));
 return {schema:'kaopu/root-bundle-plan@1',method:'approved scalp roots -> continuous complete guide -> individual tip',coordinates:'head-aligned-Yup-Zfront; native bindings per guide',partitionAuthority:'exclusive scalp root patch; NOT surface-face color',rootSampleMeaning:'engineering samples, not observed biological follicles',groups,rootBindings:roots.filter(p=>p.active).map(p=>({rootId:p.id,triangle:p.f,barycentric:p.b.slice(),bundleId:bundleOf(p,r)})),unseenPolicy:'back, hidden roots and depth are authored hypotheses; front tracing constrains flow and silhouette only'};
}
export function validateBundlePlan(plan,guides){
 if(plan?.schema!=='kaopu/root-bundle-plan@1'||plan.groups?.length!==BUNDLES.length||plan.rootBindings?.length!==3067)throw Error('发束根区契约无效');
 if(!['head-aligned-Yup-Zfront; native bindings per guide','native-common-viewer-Yup'].includes(plan.coordinates))throw Error('发束坐标不明');
 const all=plan.groups.flatMap(g=>g.rootIds),owners=new Map(plan.rootBindings.map(r=>[r.rootId,r]));
 if(plan.rootBindings.some(r=>!Number.isInteger(r.rootId)||r.rootId<0||r.rootId>=3300||!Number.isInteger(r.triangle)||r.triangle<0||r.triangle>=50624||!Array.isArray(r.barycentric)||r.barycentric.length!==3||r.barycentric.some(v=>!Number.isFinite(v)||v<0||v>1)||Math.abs(r.barycentric.reduce((n,v)=>n+v,0)-1)>1e-8))throw Error('根区原生绑定无效');
 if(all.length!==3067||new Set(all).size!==3067||owners.size!==3067)throw Error('根区遗漏或重复');
 if(new Set(plan.groups.map(g=>g.id)).size!==BUNDLES.length)throw Error('发束分组重复');
 for(const spec of BUNDLES){const g=plan.groups.find(g=>g.id===spec.id);if(!g||g.guideRootIds.length!==spec.quota||g.rootIds.some(id=>owners.get(id)?.bundleId!==spec.id))throw Error('发束根区归属无效');}
 for(const group of plan.groups){if(group.tipTargets.length!==group.guideRootIds.length||new Set(group.tipTargets.map(t=>t.rootId)).size!==group.tipTargets.length)throw Error('发梢列表无效');for(const tip of group.tipTargets){if(!group.guideRootIds.includes(tip.rootId)||!Array.isArray(tip.position)||!Array.isArray(tip.designed)||tip.position.length!==3||tip.designed.length!==3||[...tip.position,...tip.designed].some(v=>!Number.isFinite(v)))throw Error('发梢数据无效');const g=guides.find(g=>g.rootId===tip.rootId);if(!g)throw Error('发梢没有对应导向');const p=g.designPoints||g.points;if(p&&tip.position.some((v,k)=>Math.abs(v-p[p.length-3+k])>1e-8))throw Error('发梢终点与导向不一致');}}
 for(const g of guides){const owner=owners.get(g.rootId),binding=g.binding||{triangle:g.face,barycentric:g.barycentric},group=plan.groups.find(b=>b.id===g.bundleId||b.id===g.styleProfile?.bundleId);if(!owner||!group||owner.bundleId!==group.id||!group.guideRootIds.includes(g.rootId)||owner.triangle!==binding.triangle||JSON.stringify(owner.barycentric)!==JSON.stringify(binding.barycentric))throw Error('发束与原生根点绑定不一致');}
 return plan;
}

export const PARENTS=[{id:'fringe',name:'A · 前额刘海',color:'#c8464a'},{id:'frame-left',name:'B · 左贴脸长束',color:'#46a85f'},{id:'frame-right',name:'C · 右贴脸长束',color:'#d3b43e'},{id:'outer-left',name:'D · 左外长束',color:'#3165ac'},{id:'outer-right',name:'E · 右外长束',color:'#26a5aa'},{id:'posterior',name:'F · 顶后及遮挡内层',color:'#995ac1'}];
export const parentOf=id=>id.startsWith('bang')?'fringe':id.startsWith('frame')||id.startsWith('outer')?id:'posterior';
