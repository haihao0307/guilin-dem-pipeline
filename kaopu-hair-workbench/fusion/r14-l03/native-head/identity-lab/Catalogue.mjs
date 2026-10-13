/** ET13 semantic controls. Each native key is verified at runtime against the
 * existing catalog. They EDIT existing coefficients, never a substitute mesh.
 * Named eye styles are editable artistic combinations, not anatomical classes. */
export const IDENTITY_VERSION='ET13-I1';
const single=(group,key,label,ends='减小 / 增大')=>({id:key,group,label,ends,keys:[key],paired:false});
const pair=(group,key,label,ends='减小 / 增大')=>({id:key,group,label,ends,keys:['l-'+key,'r-'+key],paired:true});
export const NATIVE_FEATURES=[
 ...[['head-scale-horiz-incr','脸部宽度','窄 / 宽'],['head-scale-vert-incr','脸部长度','短 / 长'],['head-scale-depth-incr','头部前后深度','浅 / 深'],['head-fat-incr','面部饱满度','瘦削 / 饱满'],['head-age-incr','面部年龄形态','年轻倾向 / 熟龄倾向'],['head-angle-out','面部倾斜','内收 / 外展']].map(v=>single('脸型',...v)),
 ...[['eye-scale-incr','眼睛整体大小','小 / 大'],['eye-height1-incr','眼裂高度 · 鼻侧','窄 / 高'],['eye-height2-incr','眼裂高度 · 中央','窄 / 高'],['eye-height3-incr','眼裂高度 · 颞侧','窄 / 高'],['eye-corner1-up','外眼角高度','下 / 上'],['eye-corner2-up','内眼角高度','下 / 上'],['eye-trans-out','眼距','近 / 远'],['eye-trans-up','眼部上下位置','下 / 上'],['eye-eyefold-up','上睑褶皱位置','低 / 高'],['eye-eyefold-angle-up','上睑褶皱倾斜','内倾 / 外倾'],['eye-epicanthus-out','内眼角覆盖','内收 / 外展'],['eye-push1-out','眼部前后 · 原生区域1','后 / 前'],['eye-push2-out','眼部前后 · 原生区域2','后 / 前'],['eye-bag-incr','下眼睑眼袋体积','小 / 大'],['eye-bag-height-incr','眼袋高度','低 / 高'],['eye-bag-out','眼袋前突','收回 / 前突']].map(v=>pair('眼睛',...v)),
 ...[['eyebrows-trans-forward','眉弓前突','低平 / 前突'],['eyebrows-trans-up','眉弓上下位置','低 / 高'],['eyebrows-angle-up','眉弓倾斜','下倾 / 上倾'],['forehead-trans-forward','额头前突','平 / 突'],['forehead-scale-vert-incr','额头高度','低 / 高'],['forehead-temple-incr','太阳穴体积','凹 / 满']].map(v=>single('眉额',...v)),
 ...[['nose-scale-depth-incr','鼻部整体前突','低平 / 高挺'],['nose-scale-vert-incr','鼻部长度','短 / 长'],['nose-scale-horiz-incr','鼻部整体宽度','窄 / 宽'],['nose-point-width-incr','鼻头宽度','小鼻头 / 宽鼻头'],['nose-volume-incr','鼻部体积','小 / 大'],['nose-point-up','鼻尖朝向','下垂 / 上翘'],['nose-hump-incr','鼻梁隆起','平顺 / 隆起'],['nose-curve-convex','鼻梁曲率','内凹 / 外凸'],['nose-greek-incr','鼻根连续度','原生负向 / 原生正向'],['nose-width1-incr','鼻宽 · 原生分区1','窄 / 宽'],['nose-width2-incr','鼻宽 · 原生分区2','窄 / 宽'],['nose-width3-incr','鼻宽 · 原生分区3','窄 / 宽'],['nose-flaring-incr','鼻翼张开','内收 / 张开'],['nose-nostrils-width-incr','鼻孔宽度','窄 / 宽'],['nose-nostrils-angle-up','鼻孔倾角','下 / 上'],['nose-septumangle-incr','鼻小柱角度','原生负向 / 原生正向'],['nose-base-up','鼻底位置','下 / 上'],['nose-trans-up','整鼻高度位置','下 / 上'],['nose-trans-out','鼻部左右偏移','左 / 右'],['nose-compression-uncompress','鼻部压缩','压缩 / 舒展']].map(v=>single('鼻子',...v)),
 ...[['mouth-scale-horiz-incr','嘴巴宽度','小嘴 / 大嘴'],['mouth-scale-vert-incr','嘴巴高度','低 / 高'],['mouth-upperlip-volume-incr','上唇厚度','薄 / 厚'],['mouth-lowerlip-volume-incr','下唇厚度','薄 / 厚'],['mouth-upperlip-height-incr','上唇红唇高度','窄 / 宽'],['mouth-lowerlip-height-incr','下唇红唇高度','窄 / 宽'],['mouth-upperlip-width-incr','上唇宽度','窄 / 宽'],['mouth-lowerlip-width-incr','下唇宽度','窄 / 宽'],['mouth-cupidsbow-incr','唇峰显著度','平缓 / 明显'],['mouth-cupidsbow-width-incr','唇峰间距','近 / 远'],['mouth-upperlip-middle-up','上唇中央','下 / 上'],['mouth-lowerlip-middle-up','下唇中央','下 / 上'],['mouth-angles-up','嘴角倾斜','下垂 / 上扬'],['mouth-trans-forward','嘴唇前突','收 / 突'],['mouth-trans-up','口部上下位置','下 / 上'],['mouth-trans-out','口部左右偏移','左 / 右'],['mouth-philtrum-volume-incr','人中体积','平 / 明显'],['mouth-laugh-lines-out','鼻唇沟形态','浅 / 明显'],['mouth-dimples-out','酒窝形态','浅 / 明显']].map(v=>single('嘴唇',...v)),
 ...[['cheek-trans-up','颧颊高度','低 / 高'],['cheek-volume-incr','面颊体积','瘦 / 满'],['cheek-inner-incr','内侧面颊','收 / 满'],['cheek-bones-incr','颧骨显著度','低平 / 明显']].map(v=>pair('颊颏',...v)),
 ...[['chin-height-incr','下巴长度','短 / 长'],['chin-width-incr','下巴宽度','尖窄 / 宽'],['chin-prominent-incr','下巴前突','收 / 突'],['chin-bones-incr','下颏骨性','柔和 / 突出'],['chin-cleft-incr','下巴凹沟','平 / 深'],['chin-prognathism-incr','下颌前突','收 / 突'],['chin-jaw-drop-incr','下颌下移','收 / 下移']].map(v=>single('颊颏',...v)),
 ...[['ear-scale-incr','耳朵大小','小 / 大'],['ear-scale-vert-incr','耳朵长度','短 / 长'],['ear-scale-depth-incr','耳朵深度','薄 / 厚'],['ear-lobe-incr','耳垂大小','小 / 大'],['ear-trans-up','耳朵上下位置','低 / 高'],['ear-trans-forward','耳朵前后位置','后 / 前'],['ear-rot-forward','耳朵外翻','收 / 翻'],['ear-shape-round','耳廓圆润','原生负向 / 圆润'],['ear-shape-triangle','耳廓尖角','原生负向 / 尖角'],['ear-flap-incr','耳廓折叠','少 / 多'],['ear-wing-incr','耳翼外展','收 / 展']].map(v=>pair('耳朵',...v))
];
export const HOST_SKIN=[['tone','整体肤色',0,1],['warmth','肤色冷暖',0,1],['redness','基础血色',0,1],['variation','基础色差',0,1],['lipMix','唇色覆盖',0,1],['detail','基础肌理总强度',0,1.5],['roughness','基础粗糙度',.3,.9],['oil','基础油脂',0,1]];
export const BODY_FEATURES=[['height','身高形态'],['weight','体重形态'],['muscle','肌肉形态'],['age','年龄形态（非岁数）'],['proportions','身体比例'],['gender','原生体型轴']];
export const EYE_STYLES={
 natural:{label:'原生眼型',native:{},shape:{crease:0}},
 round:{label:'圆眼倾向',native:{'eye-scale-incr':.30,'eye-height1-incr':.24,'eye-height2-incr':.28,'eye-height3-incr':.18},shape:{crease:.25}},
 narrow:{label:'细长眼倾向',native:{'eye-height1-incr':-.27,'eye-height2-incr':-.32,'eye-height3-incr':-.22},shape:{crease:0}},
 triangular:{label:'三角眼倾向',native:{'eye-height1-incr':-.12,'eye-height2-incr':.18,'eye-height3-incr':-.29,'eye-corner1-up':-.18},shape:{crease:.35}},
 peach:{label:'桃花眼倾向',native:{'eye-height1-incr':.10,'eye-height2-incr':.25,'eye-height3-incr':-.10,'eye-corner1-up':.22,'eye-eyefold-angle-up':.15},shape:{crease:.65}},
 single:{label:'单眼皮倾向',native:{'eye-eyefold-up':0},shape:{crease:-1}},
 double:{label:'双眼皮倾向',native:{'eye-eyefold-up':.15},shape:{crease:.85}}
};
export function nativeKeys(row,side='both'){return row.paired&&side!=='both'?row.keys.filter(k=>k.startsWith(side==='left'?'l-':'r-')):row.keys;}
export function verifyCatalogue(controller){return NATIVE_FEATURES.map(row=>({...row,available:row.keys.every(k=>controller.catalog.byKey.has('anny.localChanges:'+k)),nativePaths:row.keys.map(k=>'anny.localChanges:'+k)}));}
export function writeFeature(controller,id,value,side='both'){
 const row=NATIVE_FEATURES.find(r=>r.id===id);if(!row||!Number.isFinite(value)||Math.abs(value)>.85)throw Error('身份参数超出本页的保守范围 [-0.85,0.85]');
 const s=controller.state();if(s.headShapeComposition!=='shared-layers/1'&&s.owners.headShape!=='anny')throw Error('当前头形来源不接受Anny局部参数；先在原系统选择共同头形叠加。');
 for(const key of nativeKeys(row,side)){const r=controller.catalog.byKey.get('anny.localChanges:'+key);if(!r||!controller.status(r).editable)throw Error('原生参数未激活：'+key);s.anny.localChanges[key]=value;}return controller.commit(s);
}
export function seededRandom(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function variedNativeState(state,seed,strength=.35){
 const s=structuredClone(state),r=seededRandom(seed),ids=['head-scale-horiz-incr','head-scale-vert-incr','head-fat-incr','eye-scale-incr','eye-height2-incr','eye-trans-out','nose-scale-depth-incr','nose-point-width-incr','nose-scale-horiz-incr','nose-hump-incr','eyebrows-trans-forward','mouth-scale-horiz-incr','mouth-upperlip-volume-incr','mouth-lowerlip-volume-incr','chin-height-incr','chin-width-incr','cheek-bones-incr'];
 if(s.headShapeComposition!=='shared-layers/1'&&s.owners.headShape!=='anny')throw Error('随机身份需要原生共同头形或Anny头形来源');
 for(const id of ids){const row=NATIVE_FEATURES.find(q=>q.id===id),v=(r()*2-1)*strength;for(const k of row.keys)s.anny.localChanges[k]=v;}return s;
}
