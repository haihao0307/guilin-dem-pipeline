(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FishProductionKnowledgeR09 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const version = '1.0.0';
  const schema = 'FISH_PRODUCTION_CARD_R09_1';
  const docs = 'knowledge/fish-motion/';
  const stages = [
    {id:'identity',label:'来源与身份',dependencies:[]},
    {id:'surface',label:'完整来源表面',dependencies:['identity']},
    {id:'spine',label:'连续脊椎与截面',dependencies:['surface']},
    {id:'fins',label:'鱼鳍与鳍根',dependencies:['surface','spine']},
    {id:'cranial',label:'头部 · 眼 · 口 · 鳃',dependencies:['surface','spine']},
    {id:'behavior',label:'个体与群体行为',dependencies:['spine','fins']},
    {id:'verify',label:'来源、运动与交付验证',dependencies:['surface','spine','fins','behavior']}
  ];
  const rules = [
    {id:'identity.no-name-inference',stages:['identity'],text:'来源标题是素材标签；具体物种、软骨/硬骨母型和群游习性需要独立证据，不从文件名推定。未知身份不妨碍已证据化的原表面复刻。',source:docs+'FISH_FACTORY_FRAMEWORK_R01.md'},
    {id:'identity.no-universal-template',stages:['identity','spine','fins'],text:'共同接口复用，组件数量、根部、融合或缺失由来源决定。软骨鱼、无颌类或不同鳍推进母型不能套用当前硬骨鱼运动配置。',source:docs+'FISH_FACTORY_FRAMEWORK_R01.md'},
    {id:'surface.original-is-truth',stages:['surface','verify'],text:'保留原索引、UV、法线、材质通道、原像素和完整细节残差；数学函数组织原信息，不能以通用几何体、减面或降低纹理代替来源。',source:docs+'R02_RENDER_AND_UNIFIED_FRAMEWORK.md'},
    {id:'surface.dynamic-continuity',stages:['surface','spine','fins','verify'],text:'静止恒等不能代替动态验收。原重合点、鳍根、三角形应变和精确法线都要在完整动作周期检查；源已有嘴缝、薄鳍边不能盲目补洞。',source:'fish-five-r01/evidence/R02_REGRESSION_CASES.json'},
    {id:'spine.one-transport',stages:['spine','fins','cranial'],text:'身体用连续中心线与正交截面运输；头段稳定，摆动向后传导。鳍局部权重不能扩散到身体，局部器官与身体使用同一空间运输。',source:docs+'FISH_FACTORY_FRAMEWORK_R01.md'},
    {id:'fins.root-zero',stages:['fins'],text:'已测鳍根零位移、鳍尖递增柔性；左右胸鳍分别控制。背/臀鳍的推进角色依母型及证据确定，不能统一当装饰或把所有鱼设为尾鳍推进。',source:docs+'R02_RENDER_AND_UNIFIED_FRAMEWORK.md'},
    {id:'cranial.local-hold',stages:['cranial'],text:'口、鳃、眼分别放行。未知口鳃保持来源合法姿态；头骨权重不等于独立下颌或鳃盖控制。局部 HOLD 不阻断已测眼睛或其余工位。',source:'fish-five-r01/data/oral-runtime-r04.json'},
    {id:'eyes.shape-axis-separate',stages:['cranial'],components:['eyes'],text:'源眼表面外形坐标与视轴分开；近球形眼不能把退化 PCA 最短轴当虹膜轴，不能用人眼比例替代源眼窝。限幅停留/扫视必须保持接触。',source:docs+'FISH_FACTORY_FRAMEWORK_R01.md'},
    {id:'behavior.not-universal-school',stages:['behavior','verify'],text:'30 条是展示容量，不是全部来源天然紧密群游的断言。BCF/MPF、速度、转弯和群游策略保留物种证据与工程候选的区别。',source:docs+'R08_COLLECTIVE_MOTION_MODELS.md'},
    {id:'behavior.accepted-controls',stages:['behavior'],text:'邻居对齐、吸引和前后调速经推进/转向加速度限制及完整源包络预测避碰；身体和鳍读取实际接受速度与转向，相位连续，不用位置瞬移维持队形。',source:docs+'R08_CONTROL_SPACE_AUDIT.md'},
    {id:'units.no-metres-inference',stages:['identity','spine','behavior','verify'],text:'规范体长 BL 不证明真实厘米。速度区分源世界长度/s 与 BL/s，转速为 rad/s；动画片段时长不能直接当摆尾频率。',source:docs+'R08_IMPLEMENTATION_AND_REUSE.md'},
    {id:'performance.bounded-cost',stages:['surface','behavior','verify'],text:'完整表面与纹理共享、每鱼只保留独立状态。30 条最多 435 对；当前仍是平方配对。约 34 KB 是求解器数值缓冲，不是整个项目或显存。',source:docs+'R08_IMPLEMENTATION_AND_REUSE.md'},
    {id:'acceptance.not-self-approved',stages:['verify'],text:'当前工位可制作不等于已科学标定、视觉接受或发布通过；独立核查绑定新源码和真实运行产物，用户视觉接受不得由制作端自动置真。',source:'knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md'}
  ];
  const formulas = [
    {id:'surface.chart-residual',stages:['surface'],expression:'p₀(u,θ) = chart(u,θ) + residual(u,θ)',units:'u 无量纲；p₀/residual 为规范 BL 坐标',meaning:'全源地址与残差逐点保留；不是有限系数消除任意源细节。',owner:'fish-five-r01/src/app.js (source reconstruction shader)',verification:'fish-five-r01/scripts/verify-gpu-r02.mjs'},
    {id:'spine.phase-transport',stages:['spine'],expression:'φ(t+Δt)=φ(t)+2π f Δt; Cᵢ=Cᵢ₋₁+normalize(Tᵢ₋₁+Tᵢ)Δs; p=C(u)+N(u)y+B(u)z',units:'f Hz；φ rad；Δs/y/z BL；T/N/B 单位正交',meaning:'实际 sampleSpine 以源拟合或柔性包络求角度，按半径限制曲率；不是将各段独立线性摆动。',owner:'fish-five-r01/src/behavior.js#sampleSpine / deform; 海狼保留原 R14 对应函数',verification:'fish-five-r01/scripts/verify-behavior-r03.mjs'},
    {id:'fins.local-wave',stages:['fins'],expression:'q = root + R(axis, w(ξ)·[A sin(φ+kξ)+bias])(p₀-root), w(0)=0',units:'ξ/w 无量纲；A/φ/bias rad；p₀/root BL',meaning:'局部鳍条波先应用，再接身体运输；轴、根、权重必须来自当前来源。公式描述接口，具体鳍 shader 使用来源映射。',owner:'fish-five-r01/src/app.js (fin deformation shader); fish-five-r01/src/behavior.js#update',verification:'fish-five-r01/scripts/verify-gpu-r02.mjs'},
    {id:'cranial.eye-quintic-scan',stages:['cranial'],components:['eyes'],expression:'e(u)=10u³−15u⁴+6u⁵; q=q_from+(q_target−q_from)e(u), u=clamp((t−start)/duration,0,1)',units:'q rad；t/start/duration s；u/e 无量纲',meaning:'实际独立眼睛限幅扫视/停留实现；边界速度/加速度连续，工程参数不是鱼眼生理标定。',type:'CURRENT_IMPLEMENTATION',owner:'fish-five-r01/src/ocular-r04.js#evaluate / update',verification:'fish-five-r01/scripts/verify-ocular-r04.mjs'},
    {id:'cranial.jaw-exponential',stages:['cranial'],components:['mouth'],expression:'q_next=q+(q_target−q)(1−exp(−10Δt)); q_target=min(q_max,0.011+0.011 effort+0.003 wave)',units:'q rad；Δt s；10 s⁻¹；effort/wave 无量纲',meaning:'实际两 Tuna 候选下颌更新，鳃输出为零。速率和开合值是展示工程参数，源下颌映射与科学标定分开。',type:'CURRENT_IMPLEMENTATION',owner:'fish-five-r01/src/oral-r04.js#update',verification:'fish-five-r01/scripts/verify-oral-r04.mjs'},
    {id:'behavior.acceleration-integration',stages:['behavior'],expression:'v_next = v + a Δt; ω_next = ω + α Δt; ψ_next = ψ + ω_next Δt; x_next = x + v_next direction(ψ_next,pitch_next) Δt',units:'v 源长度/s；a 源长度/s²；ω rad/s；α rad/s²；Δt s',meaning:'实际新朝向/完整旋转包络进入有限控制空间投影；不把单个速度上限当向心加速度界。',owner:'fish-five-r01/src/schooling-r08.js#step; behavior.js#update; legacy-school-r08.js',verification:'fish-five-r01/scripts/verify-schooling-r08.mjs'},
    {id:'behavior.nearest-approach',stages:['behavior'],expression:'t_CPA=clamp(-r·v_rel / |v_rel|²,0,horizon)',units:'r 源长度；v_rel 源长度/s；t_CPA s',meaning:'近邻预测候选与旋转 OBB 的分离判据联合使用；有限测试不是任意外部输入安全定理。',owner:'fish-five-r01/src/schooling-r08.js#step / clearance',verification:'fish-five-r01/scripts/verify-schooling-r08.mjs'},
    {id:'verify.performance-normalization',stages:['verify'],expression:'BL_speed = world_speed / measured_body_length; pairs=N(N-1)/2',units:'BL/s；pairs 无量纲',meaning:'体长必须量可见变形后的来源；性能应分 CPU/帧时间/JS内存/GPU资源/文件大小报告。',owner:'fish-five-r01/src/schooling-r08.js#snapshot',verification:'fish-five-r01/scripts/verify-runtime-r08.mjs'}
  ];
  const checks = {
    identity:['核对完整源条目、哈希、许可和原作者；标题与科学身份分开','记录 TARGET_ARCHETYPE、CONFUSION_SET 和最大偏差；未知不臆测'],
    surface:['静止源索引/UV/纹理逐项对应','完整动作周期检查源重合点、三角形应变、法线与新裂缝','图像/通用形体不能替代真实源表面'],
    spine:['头段稳定；单位切线及正交截面；静止运输恒等','相位切换连续；身体传导沿中心线；检查可见体长与曲率'],
    fins:['逐鳍根、轴、顶点域；根零位移','左右与中线鳍分别检验；曲率最大时无破碎'],
    cranial:['眼：源外形/视轴分离、限幅和眼窝接触','口：只转确认的独立源下颌；下唇不可重复叠加','鳃：无确认局部映射则保持源姿态'],
    behavior:['真实接受速度/角速输入脊椎和鳍；固定种子可复现','邻居、鼠标进入/离开、恢复、完整包络间距与保护计数','报告 30 条容量范围；工程参数与生物标定分开'],
    verify:['独立核查当前源码与原表面/完整纹理保留','真实桌面/移动运行，交互、首帧、file:// 零核心网络请求','公网版本/资源与当前冻结版本一致；人工接受保持待确认']
  };
  for(const formula of formulas) if(!formula.type) formula.type = formula.id==='surface.chart-residual'||formula.id==='fins.local-wave'?'MATHEMATICAL_CONTRACT':'CURRENT_IMPLEMENTATION';
  const measurementKeys = ['surface','axis','fins','eyes','mouth','gills','envelope','gait','physicalUnits'];
  const sourceStatuses=['SOURCE_MEASURED','SOURCE_DERIVED'];
  const absenceKeys=['fins','eyes','mouth','gills'];
  const available = (m,key) => !!m && (sourceStatuses.includes(m.status)||(key==='gait'&&m.status==='ENGINEERING_CANDIDATE')) && typeof m.reference === 'string' && m.reference.length > 0 && /^[a-f0-9]{64}$/.test(m.referenceSha256||'');
  const clone = x => JSON.parse(JSON.stringify(x));
  function createCard(id, label) {
    if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,80}$/.test(id)) throw new Error('Card id must be a stable lowercase identifier');
    const measurements = {}; for (const key of measurementKeys) measurements[key] = {status:'UNKNOWN',reference:null,summary:'待来源进入与测量；不按名字猜测。'};
    return {schema,knowledgeVersion:version,id,label:label||id,source:{title:label||id,entrySha256:null,payloadSha256:null,metadata:null,metadataSha256:null,license:null,attribution:null,licenseStatus:'UNKNOWN',sourceUrl:null},identity:{speciesStatus:'UNKNOWN',speciesName:null,targetArchetype:'UNKNOWN',confusionSet:[],evidence:[],largestDeviation:'SOURCE_ENTRY_REQUIRED'},measurements,behavior:{status:'UNKNOWN',profileRef:null,groupingEvidence:'UNKNOWN',parameterEvidence:[]},evidenceBindings:[],acceptance:{visualAcceptance:false,productionReady:false,scientificCalibration:false,independentVerification:'NOT_RUN',publication:'NOT_RUN'}};
  }
  function validateCard(card) {
    const errors=[],warnings=[];
    if (!card || typeof card !== 'object') return {valid:false,errors:['CARD_REQUIRED'],warnings};
    if (card.schema!==schema) errors.push('CARD_SCHEMA_MISMATCH');
    if (card.knowledgeVersion!==version) errors.push('KNOWLEDGE_VERSION_MISMATCH');
    if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(card.id||'')) errors.push('INVALID_CARD_ID');
    if (!card.source || !card.identity || !card.measurements || !card.behavior || !card.acceptance) errors.push('CARD_SECTIONS_REQUIRED');
    for (const key of ['entrySha256','payloadSha256']) if (card.source?.[key]!=null && !/^[a-f0-9]{64}$/.test(card.source[key])) errors.push('INVALID_SOURCE_HASH:'+key);
    for (const key of measurementKeys) {
      const m=card.measurements?.[key];
      if (!m || !['UNKNOWN','MEASUREMENT_REQUIRED','HOLD_LOCAL','SOURCE_MEASURED','SOURCE_DERIVED','ENGINEERING_CANDIDATE','CONFIRMED_ABSENT'].includes(m.status)) errors.push('INVALID_MEASUREMENT_STATUS:'+key);
      else if (m.status==='CONFIRMED_ABSENT' && !absenceKeys.includes(key)) errors.push('INVALID_COMPONENT_ABSENCE:'+key);
      else if (m.status==='ENGINEERING_CANDIDATE' && key!=='gait') errors.push('CANDIDATE_CANNOT_PROVE_SOURCE:'+key);
      else if (['SOURCE_MEASURED','SOURCE_DERIVED','ENGINEERING_CANDIDATE','CONFIRMED_ABSENT'].includes(m.status) && (!m.reference || !/^[a-f0-9]{64}$/.test(m.referenceSha256||''))) errors.push('MEASUREMENT_REFERENCE_REQUIRED:'+key);
    }
    if (!['UNKNOWN','SOURCE_LABEL_ONLY','CONFIRMED'].includes(card.identity?.speciesStatus)) errors.push('INVALID_SPECIES_STATUS');
    if (card.identity?.speciesStatus==='CONFIRMED' && (!card.identity.speciesName || !card.identity.evidence?.length)) errors.push('SPECIES_CONFIRMATION_REQUIRES_EVIDENCE');
    if (card.acceptance?.scientificCalibration===true && !card.acceptance.scientificEvidence?.length) errors.push('SCIENTIFIC_CALIBRATION_REQUIRES_EVIDENCE');
    for(const p of card.behavior?.parameterEvidence||[]) if(Object.prototype.hasOwnProperty.call(p,'value')) {
      const units={speed:'source-length/s',burst:'source-length/s',maxTurn:'rad/s',maxAngularAcceleration:'rad/s2',maxAcceleration:'source-length/s2',frequency:'Hz',amplitude:'rad',neighborCount:'count'};
      if(!Number.isFinite(p.value)||!units[p.key]||p.unit!==units[p.key]||!['SOURCE_MEASURED','RESEARCH_RELATION','ENGINEERING_CANDIDATE'].includes(p.evidenceClass)||!p.reference) errors.push('INVALID_PARAMETER_EVIDENCE:'+p.key);
    }
    const bindings=Array.isArray(card.evidenceBindings)?card.evidenceBindings:[];
    const bound=(reference,sha)=>bindings.some(b=>b.path===String(reference||'').split('#')[0]&&b.sha256===sha&&/^[a-f0-9]{64}$/.test(sha||''));
    for(const [key,m] of Object.entries(card.measurements||{})) if(m?.referenceSha256&&!bound(m.reference,m.referenceSha256)) errors.push('MEASUREMENT_BINDING_MISMATCH:'+key);
    if(card.source?.metadataSha256&&!bound(card.source.metadata,card.source.metadataSha256)) errors.push('SOURCE_METADATA_BINDING_MISMATCH');
    for(const b of bindings) if(!b.path||b.path.includes('..')||/^[\\/]|^[a-z]:/i.test(b.path)||!/^[a-f0-9]{64}$/.test(b.sha256||'')) errors.push('INVALID_EVIDENCE_BINDING');
    if (card.identity?.speciesStatus!=='CONFIRMED') warnings.push('SPECIES_IDENTITY_UNCONFIRMED');
    if (card.behavior?.status==='ENGINEERING_CANDIDATE') warnings.push('BEHAVIOR_NOT_BIOLOGICALLY_CALIBRATED');
    if (card.acceptance?.productionReady===true && (card.acceptance.visualAcceptance!==true || card.acceptance.independentVerification!=='PASSED')) errors.push('PRODUCTION_ACCEPTANCE_REQUIRES_INDEPENDENT_AND_USER_EVIDENCE');
    return {valid:errors.length===0,errors,warnings};
  }
  function resolve(card, requestedStage) {
    const component = ['eyes','mouth','gills'].includes(requestedStage)?requestedStage:null;
    const stage = component?'cranial':requestedStage;
    const descriptor=stages.find(x=>x.id===stage);
    if (!descriptor) throw new Error('Unknown production stage: '+requestedStage);
    const validation=validateCard(card), requirements=[];
    const requireValue=(id,label,path,status,reference,met,scope='stage')=>requirements.push({id,label,path,status:status||'UNKNOWN',reference:reference||null,met:!!met,scope});
    const sourceReady=!!card?.source?.entrySha256 && !!card?.source?.payloadSha256 && !!card?.source?.metadata && /^[a-f0-9]{64}$/.test(card?.source?.metadataSha256||'') && !!card?.source?.license && !!card?.source?.attribution && card?.source?.licenseStatus==='SOURCE_RECORDED';
    requireValue('source.entry','完整来源、哈希、许可与作者','source',sourceReady?'SOURCE_MEASURED':'SOURCE_ENTRY_REQUIRED',card?.source?.metadata,sourceReady);
    const need = key => {const m=card?.measurements?.[key];requireValue('measurement.'+key,key,'measurements.'+key,m?.status,m?.reference,available(m,key),['eyes','mouth','gills'].includes(key)?key:'stage');};
    if (stage!=='identity') need('surface');
    if (['spine','fins','cranial','behavior','verify'].includes(stage)) need('axis');
    if (['fins','behavior','verify'].includes(stage)) need('fins');
    if (['behavior','verify'].includes(stage)) {need('envelope');need('gait');requireValue('behavior.profile','有证据分类的行为配置','behavior.profileRef',card?.behavior?.status,card?.behavior?.profileRef,!!card?.behavior?.profileRef && ['SOURCE_MEASURED','ENGINEERING_CANDIDATE'].includes(card?.behavior?.status));}
    if (component) need(component);
    const components={};
    if (stage==='cranial') for (const key of ['eyes','mouth','gills']) {
      const m=card?.measurements?.[key], met=available(m,key);
      components[key]={status:m?.status||'UNKNOWN',reference:m?.reference||null,readyToBuild:validation.valid&&sourceReady&&available(card?.measurements?.surface,'surface')&&available(card?.measurements?.axis,'axis')&&met,blocked:met?[]:[{id:'measurement.'+key,label:key,status:m?.status||'UNKNOWN',scope:key}],action:m?.status==='CONFIRMED_ABSENT'?'保留经证实的缺失；禁止生成或驱动此组件':met?'仅在已证据化源映射内工作':'HOLD_LOCAL：保持来源姿态，补测后独立放行'};
    }
    const blocked=requirements.filter(x=>!x.met);
    for (const error of validation.errors) blocked.push({id:error,label:error,path:'card',status:'INVALID_CARD',reference:null,met:false,scope:'schema'});
    const unknowns=measurementKeys.filter(k=>!available(card?.measurements?.[k],k)&&card?.measurements?.[k]?.status!=='CONFIRMED_ABSENT').map(k=>({id:'measurement.'+k,label:k,path:'measurements.'+k,status:card?.measurements?.[k]?.status||'UNKNOWN',reference:card?.measurements?.[k]?.reference||null,scope:k}));
    if(card?.identity?.speciesStatus!=='CONFIRMED') unknowns.unshift({id:'identity.species',label:'具体物种身份',path:'identity.speciesStatus',status:'UNKNOWN',scope:'biology'});
    if(card?.behavior?.groupingEvidence==='UNKNOWN') unknowns.push({id:'behavior.grouping',label:'物种真实群游习性',path:'behavior.groupingEvidence',status:'UNKNOWN',scope:'biology'});
    let readyToBuild=blocked.length===0;
    if(stage==='cranial'&&!component) readyToBuild=readyToBuild&&Object.values(components).some(x=>x.readyToBuild);
    const selectedFormulas=formulas.filter(f=>f.stages.includes(stage)&&(!component||!f.components||f.components.includes(component)));
    return {knowledgeVersion:version,cardId:card?.id||null,stage,component,label:descriptor.label+(component?' · '+component:''),readyToBuild,status:readyToBuild?'BOUNDED_WORK_ALLOWED':'HOLD_LOCAL',rules:clone(rules.filter(r=>r.stages.includes(stage)&&(!component||!r.components||r.components.includes(component)))),formulas:clone(selectedFormulas),dependencies:descriptor.dependencies.slice(),requirements,required:clone(requirements),blocked,unknowns,components,checks:checks[stage].slice(),verification:selectedFormulas.map(f=>({id:f.id,script:f.verification})),acceptanceState:clone(card?.acceptance||{visualAcceptance:false,productionReady:false,scientificCalibration:false}),validation,identity:clone(card?.identity||{}),source:clone(card?.source||{}),evidence:clone(card?.measurements||{}),evidenceBindings:clone(card?.evidenceBindings||[])};
  }
  return {version,schema,stages:clone(stages),rules:clone(rules),formulas:clone(formulas),createCard,createTemplate:createCard,validateCard,resolve,context:resolve};
});
