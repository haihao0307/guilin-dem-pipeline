/** Author-defined, bounded ear morphology controls, not a population model or
 * a biological age simulator. Units refer to the retained metre-scale chart. */
export const EAR_VERSION='EAR-R02.0';
export const EAR_SCHEMA='kaopu/ear-structure@2';
export const EAR_GROUPS=[
 ['区域生长与贴头关系',[
  ['cartilageGrowth','软骨框架展开',0,1,.5,'耳轮、耳舟、分叉一起展开；耳根固定。'],
  ['conchaGrowth','耳甲区生长比例',0,1,.5,'耳甲增深时，根部外展与对耳轮支撑一起调整。'],
  ['lobuleGrowth','耳垂组织比例',0,1,.5,'增加非软骨组织量，同时分配高度、宽度与厚度。'],
  ['rootAngle','耳根外展角 °',-9,12,0,'绕耳根旋转，不把整耳平移离开头皮。'],
  ['size','耳廓高度比例',.88,1.12,1,'保留原版尺度控制，与区域生长分开。'],
  ['width','耳廓宽度比例',.86,1.14,1,'改变轮廓宽度，不改变人物头部。'],
  ['projection','耳廓外展补偿 mm',-1.5,3,0,'受耳根衰减控制的外展补偿。'],
  ['tilt','耳轴倾角 °',-7,7,0,'绕耳廓参考中心倾转，耳根连续过渡。']]],
 ['耳轮、分叉与窝沟',[
  ['helix','耳轮隆起',0,1.4,.92,'外轮缘连续，不是另粘一圈圆管。'],
  ['helixRoll','耳轮卷曲',0,1,.58,'卷边向内转，与耳舟宽度联动。'],
  ['upperRoundness','上轮圆润度',0,1,.6,'重新分配上部弧度，避免只拉一个尖角。'],
  ['darwin','耳轮小结节',0,1,.06,'上后段有限的自然局部形态变异。'],
  ['antihelix','对耳轮主干',0,1.4,1.08,'Y形软骨支撑主干。'],
  ['superiorCrus','对耳轮上脚',0,1.4,.92,'上脚和主干相连。'],
  ['inferiorCrus','对耳轮下脚',0,1.4,.9,'下脚分隔耳甲艇与三角窝。'],
  ['crusSpread','上下脚张开',0,1,.5,'两脚与三角窝同步展开，不另画两条沟。'],
  ['scaphaWidth','耳舟宽窄',0,1,.5,'外轮与对耳轮之间的带状凹区。'],
  ['fold','三角窝深浅',0,1.3,.85,'形态强度受分叉张开与耳甲比例共同约束。']]],
 ['耳甲、耳屏与入口',[
  ['concha','耳甲腔深度',0,1.3,.92,'耳甲艇和耳甲腔分别成形，保持连接。'],
  ['conchaWidth','耳甲腔宽窄',0,1,.5,'腔体变宽时周边支撑同步移位。'],
  ['cymbaRatio','耳甲艇 / 腔比例',0,1,.52,'分配上下两个腔区，不是一个圆洞。'],
  ['tragus','耳屏突出',0,1.3,.85,'耳道前缘的支撑折面。'],
  ['tragusAngle','耳屏倾向 °',-12,12,0,'前缘转向和入口宽度关联。'],
  ['antitragus','对耳屏突出',0,1.3,.82,'与耳屏隔着屏间切迹。'],
  ['notchWidth','屏间切迹宽度',0,1,.5,'两个支撑间保留开口，不用黑色盖住。']]],
 ['耳垂软组织',[
  ['lobule','耳垂基底饱满',0,1.2,.5,'保留原版软组织量控制。'],
  ['lobuleAttachment','游离 → 附着耳垂',0,1,.45,'附着型向脸侧回接；游离型保留下缘。'],
  ['lobuleFullness','耳垂厚薄',0,1,.5,'厚度与纵向延伸做近似体积补偿。'],
  ['lobuleHang','耳垂下垂程度',0,1,.35,'只对软组织区起作用，不把软骨一起拉下。']]],
 ['表面与近景受光',[
  ['redness','局部血色',0,1,.3,'低幅分区色差，不用红色假造结构。'],
  ['pores','毛孔起伏',0,1.4,.55,'沿耳表面切向的微法线，远处自动过滤。'],
  ['poreSize','毛孔尺度 mm',.16,.5,.28,'纹理频率与观察距离相匹配。'],
  ['creaseRelief','细小皮肤褶理',0,1,.35,'软组织与薄皮区分配不同细褶。'],
  ['roughness','表面粗糙度',.4,.82,.61,'改变高光宽度。'],
  ['oil','表面油脂',0,1,.25,'只降低局部粗糙度，不加透明壳。'],
  ['transmission','薄区逆光近似',0,1,.22,'有界实时近似，不是测量过的多层散射。']]]
];
export const EAR_CONTROLS=EAR_GROUPS.flatMap(x=>x[1]);
export const EAR_RANGES=Object.fromEntries(EAR_CONTROLS.map(([k,,a,b])=>[k,[a,b]]));
export const EAR_DEFAULT=Object.fromEntries(EAR_CONTROLS.map(([k,,,,v])=>[k,v]));
export const MATERIAL_KEYS=new Set(EAR_GROUPS.at(-1)[1].map(x=>x[0]));
export const EAR_PRESETS=[
 {id:'balanced',name:'自然均衡',values:{}},
 {id:'compact',name:'小巧贴头',values:{cartilageGrowth:.23,conchaGrowth:.27,lobuleGrowth:.25,size:.94,width:.97,rootAngle:-5,helixRoll:.72,concha:.62,lobuleAttachment:.82,lobuleHang:.12}},
 {id:'rounded',name:'宽圆卷轮',values:{cartilageGrowth:.82,width:1.075,upperRoundness:.92,helixRoll:.82,helix:1.15,scaphaWidth:.69,crusSpread:.63,conchaWidth:.66,lobuleFullness:.67}},
 {id:'long-free',name:'修长游离耳垂',values:{size:1.075,width:.96,cartilageGrowth:.63,lobuleGrowth:.86,lobuleAttachment:.08,lobuleHang:.82,lobuleFullness:.43,rootAngle:2,upperRoundness:.36}},
 {id:'deep',name:'深甲立体分叉',values:{conchaGrowth:.84,concha:1.20,antihelix:1.2,superiorCrus:1.16,inferiorCrus:1.14,crusSpread:.70,cymbaRatio:.65,tragus:1.03,notchWidth:.62,rootAngle:4}},
 {id:'shallow',name:'浅甲附着耳垂',values:{conchaGrowth:.20,concha:.48,antihelix:.64,superiorCrus:.54,inferiorCrus:.58,crusSpread:.30,lobuleAttachment:.95,lobuleGrowth:.36,lobuleHang:.14,rootAngle:-4}},
 {id:'soft-lobe',name:'厚轮柔软耳垂',values:{helix:1.23,helixRoll:.74,lobuleGrowth:.88,lobuleFullness:.88,lobule:.86,lobuleHang:.63,lobuleAttachment:.25,antihelix:.79,creaseRelief:.60}},
 {id:'variant',name:'后轮轻结节',values:{darwin:.70,upperRoundness:.42,cartilageGrowth:.65,scaphaWidth:.56,helixRoll:.46,rootAngle:3,lobuleAttachment:.58}}
];
export function presetEar(id){const p=EAR_PRESETS.find(p=>p.id===id);if(!p)throw Error('未知耳形预设');return {...EAR_DEFAULT,...p.values};}
export function generatedPair(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('种子必须是 0–4294967295 的整数');
 let x=seed>>>0;const rng=()=>{x=(x+0x6d2b79f5)|0;let t=Math.imul(x^x>>>15,1|x);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
 const ai=Math.floor(rng()*EAR_PRESETS.length),bi=Math.floor(rng()*EAR_PRESETS.length),a=presetEar(EAR_PRESETS[ai].id),b=presetEar(EAR_PRESETS[bi].id),mix=.15+.50*rng(),left={},right={};
 // Shared phenotype first; bounded, correlated bilateral asymmetry second.
 const asym=(rng()-.5)*.026;
 for(const[k,[lo,hi]]of Object.entries(EAR_RANGES)){
  const common=a[k]*(1-mix)+b[k]*mix,delta=MATERIAL_KEYS.has(k)?0:(hi-lo)*asym*(.5+rng()*.5);
  left[k]=Math.max(lo,Math.min(hi,common+delta));right[k]=Math.max(lo,Math.min(hi,common-delta));
 }
 return {left,right,generation:{seed,basis:'authored-correlated-regional-growth-v1',parents:[EAR_PRESETS[ai].id,EAR_PRESETS[bi].id]}};
}
