/* Shared catalogue metadata and visibility rules for original design controls.
 * Sampling ranges are never promoted to fit-certified slider domains.
 */
export const STYLE_NAMES={Shirt:'基础上衣',FittedShirt:'合体上衣',Pants:'长裤',Skirt2:'抽褶直裙',PencilSkirt:'铅笔裙',SkirtManyPanels:'多片裙',SkirtCircle:'圆裙',AsymmSkirtCircle:'前后不对称圆裙',GodetSkirt:'插片裙',SkirtLevels:'层叠裙',LongSleeve:'长袖上衣',Strapless:'无肩带上衣',AsymmetricShirt:'左右不对称上衣',Turtle:'高领上衣',SimpleLapel:'翻领上衣',Hood2Panels:'连帽上衣',CuffBand:'收口长袖',CuffSkirt:'荷叶袖口上衣',CuffBandSkirt:'袖带与荷叶袖口',StraightWB:'直腰头裤装',FittedWB:'弧形腰头裤装',MetaGarmentDress:'连衣裙',MetaGarmentJumpsuit:'连体裤'};
export const GROUP_NAMES={meta:'整体组合',waistband:'腰头',shirt:'衣身',collar:'领口与衣领',sleeve:'袖子与袖口',left:'左侧独立设计',skirt:'直裙','flare-skirt':'圆裙与多片裙','godet-skirt':'插片裙','pencil-skirt':'铅笔裙','levels-skirt':'层叠裙',pants:'裤装'};
const LABELS={
 'meta.upper':'上装形制','meta.wb':'腰头形制','meta.bottom':'下装形制','waistband.waist':'腰口松量比例','waistband.width':'腰头高度比例','shirt.strapless':'无肩带','shirt.length':'衣长比例','shirt.width':'衣身宽度比例','shirt.flare':'衣摆展开比例',
 'collar.f_collar':'前领口曲线','collar.b_collar':'后领口曲线','collar.width':'领口宽度','collar.fc_depth':'前领深度','collar.bc_depth':'后领深度','collar.fc_angle':'前领角度','collar.bc_angle':'后领角度','collar.f_bezier_x':'前领曲线横向控制','collar.f_bezier_y':'前领曲线纵向控制','collar.b_bezier_x':'后领曲线横向控制','collar.b_bezier_y':'后领曲线纵向控制','collar.f_flip_curve':'翻转前领曲线','collar.b_flip_curve':'翻转后领曲线','collar.component.style':'衣领或帽子','collar.component.depth':'衣领深度','collar.component.lapel_standing':'竖立翻领','collar.component.hood_depth':'帽深比例','collar.component.hood_length':'帽长比例',
 'sleeve.sleeveless':'无袖','sleeve.armhole_shape':'袖窿曲线','sleeve.length':'袖长比例','sleeve.connecting_width':'袖窿连接宽度','sleeve.end_width':'袖口宽度比例','sleeve.sleeve_angle':'袖角度','sleeve.opening_dir_mix':'袖口朝向混合','sleeve.standing_shoulder':'竖起肩部','sleeve.standing_shoulder_len':'竖肩长度','sleeve.connect_ruffle':'袖山抽褶比例','sleeve.smoothing_coeff':'折角平滑量',
 'cuff.type':'袖口或裤脚收口','cuff.top_ruffle':'收口上缘抽褶比例','cuff.cuff_len':'收口长度比例','cuff.skirt_fraction':'荷叶部分长度占比','cuff.skirt_flare':'荷叶展开比例','cuff.skirt_ruffle':'荷叶抽褶比例',
 'left.enable_asym':'启用左侧独立设计','skirt.length':'裙长比例','skirt.rise':'裙腰高度比例','skirt.ruffle':'腰口抽褶比例','skirt.bottom_cut':'裙底开口','skirt.flare':'裙摆展开量',
 'flare-skirt.length':'圆裙长度比例','flare-skirt.rise':'圆裙腰高比例','flare-skirt.suns':'圆裙整圆份数','flare-skirt.skirt-many-panels.n_panels':'裙片数量','flare-skirt.skirt-many-panels.panel_curve':'裙片弯曲','flare-skirt.asymm.front_length':'前裙长度比例','flare-skirt.cut.add':'增加开衩','flare-skirt.cut.depth':'开衩深度','flare-skirt.cut.width':'开衩宽度','flare-skirt.cut.place':'开衩位置',
 'godet-skirt.base':'基础裙型','godet-skirt.insert_w':'插片宽度','godet-skirt.insert_depth':'插片深度','godet-skirt.num_inserts':'插片数量','godet-skirt.cuts_distance':'插片间距',
 'pencil-skirt.length':'铅笔裙长度比例','pencil-skirt.rise':'铅笔裙腰高比例','pencil-skirt.flare':'铅笔裙摆宽比例','pencil-skirt.low_angle':'裙摆斜角','pencil-skirt.front_slit':'前开衩','pencil-skirt.back_slit':'后开衩','pencil-skirt.left_slit':'左开衩','pencil-skirt.right_slit':'右开衩','pencil-skirt.style_side_cut':'侧边造型',
 'levels-skirt.base':'上层基础裙型','levels-skirt.level':'接层裙型','levels-skirt.num_levels':'层数','levels-skirt.level_ruffle':'接层抽褶比例','levels-skirt.length':'总裙长比例','levels-skirt.rise':'层叠裙腰高比例','levels-skirt.base_length_frac':'基础层长度占比','pants.length':'裤长比例','pants.width':'裤围比例','pants.flare':'裤脚展开比例','pants.rise':'裤腰高度比例'
};
export function parameterLabel(path){const left=path.startsWith('left.')&&path!=='left.enable_asym',key=left?path.slice(5):path,label=LABELS[key]||LABELS[key.slice(key.indexOf('cuff.'))];if(!label)throw Error('Untranslated original parameter: '+path);return(left?'左侧 · ':'')+label;}
export function valueAt(design,path){const v=path.split('.').reduce((d,k)=>d?.[k],design);return v&&typeof v==='object'&&'v'in v?v.v:v;}
export function initialDesign(schema,style){const design=structuredClone(schema.tree);for(const[path,value]of Object.entries(style.overrides)){const keys=path.split('.'),key=keys.pop(),d=keys.reduce((o,k)=>o[k],design);d[key].v=value;}return design;}
export function validateDesignSnapshot(snapshot,schema){const out=structuredClone(schema.tree);for(const p of schema.parameters){const v=valueAt(snapshot,p.path);if(p.type==='bool'&&typeof v!=='boolean')throw Error('参数类型错误：'+parameterLabel(p.path));if(['float','int'].includes(p.type)&&(!Number.isFinite(v)||p.type==='int'&&!Number.isInteger(v)||v<Math.min(...p.samplingRange)||v>Math.max(...p.samplingRange)))throw Error('参数超出范围：'+parameterLabel(p.path));if(p.type.startsWith('select')&&!(v===null&&p.type==='select_null')&&!p.samplingRange.includes(v))throw Error('未知选项：'+parameterLabel(p.path));const keys=p.path.split('.'),key=keys.pop();keys.reduce((d,k)=>d[k],out)[key].v=v;}return out;}
export function parameterState(path,design){
 const get=p=>valueAt(design,p),left=path.startsWith('left.'),prefix=left?'left.':'',p=left?path.slice(5):path,upper=get('meta.upper'),bottom=get('meta.bottom');
 const off=reason=>({enabled:false,reason}),on={enabled:true,reason:'教师采样范围；本次纸样与穿体分别校验'};
 if(path==='left.enable_asym')return upper?on:off('当前没有上装');
 if(left&&!get('left.enable_asym'))return off('先启用左侧独立设计');
 if(/^(shirt|collar|sleeve)\./.test(p)&&!upper)return off('当前没有上装');
 if(p==='shirt.strapless'&&upper!=='FittedShirt')return off('无肩带仅适用于合体上衣');
 if(['shirt.length','shirt.width','shirt.flare'].includes(p)&&upper==='FittedShirt')return off('合体上衣采用人体贴合制版规则');
 if(p.startsWith('waistband.')&&!get('meta.wb'))return off('当前未选择腰头');
 if(p.startsWith('pants.')&&bottom!=='Pants')return off('当前下装不是裤装');
 const consumed=new Set([bottom]);if(bottom==='GodetSkirt')consumed.add(get('godet-skirt.base'));if(bottom==='SkirtLevels'){consumed.add(get('levels-skirt.base'));consumed.add(get('levels-skirt.level'));}
 const families={'skirt.':['Skirt2'],'pencil-skirt.':['PencilSkirt'],'flare-skirt.':['SkirtCircle','AsymmSkirtCircle','SkirtManyPanels'],'godet-skirt.':['GodetSkirt'],'levels-skirt.':['SkirtLevels']};
 for(const[key,styles]of Object.entries(families))if(p.startsWith(key)&&!styles.some(s=>consumed.has(s)))return off('当前组合没有使用这一裙型');
 if(p.startsWith('flare-skirt.skirt-many-panels.')&&!consumed.has('SkirtManyPanels'))return off('仅用于多片裙');
 if(p.startsWith('flare-skirt.asymm.')&&!consumed.has('AsymmSkirtCircle'))return off('仅用于前后不对称圆裙');
 if(p.startsWith('flare-skirt.cut.')&&p!=='flare-skirt.cut.add'&&!get('flare-skirt.cut.add'))return off('先增加开衩');
 if(p.startsWith('sleeve.')&&get(prefix+'shirt.strapless'))return off('无肩带上装不使用袖子');
 if(p.startsWith('sleeve.')&&get(prefix+'sleeve.sleeveless')&&!['sleeve.sleeveless','sleeve.armhole_shape','sleeve.connecting_width','sleeve.smoothing_coeff'].includes(p))return off('当前选择无袖');
 if(p==='sleeve.smoothing_coeff'&&get(prefix+'sleeve.armhole_shape')!=='ArmholeAngle')return off('平滑量仅用于折角袖窿');
 if(p==='sleeve.standing_shoulder_len'&&!get(prefix+'sleeve.standing_shoulder'))return off('先启用竖肩');
 const cuffAt=path.indexOf('.cuff.');if(cuffAt>=0){const base=path.slice(0,cuffAt)+'.cuff.';if(!p.endsWith('cuff.type')&&!get(base+'type'))return off('先选择收口类型');const kind=get(base+'type');if(p.endsWith('cuff.skirt_fraction')&&kind!=='CuffBandSkirt')return off('仅用于袖带与荷叶组合');if((p.endsWith('cuff.skirt_flare')||p.endsWith('cuff.skirt_ruffle'))&&kind==='CuffBand')return off('纯收口带没有荷叶部分');}
 const component=get('collar.component.style');if(p.startsWith('collar.component.')&&p!=='collar.component.style'){if(!component)return off('先选择衣领或帽子');if(p.includes('hood_')&&component!=='Hood2Panels')return off('仅用于帽子');if(p.endsWith('lapel_standing')&&component!=='SimpleLapel')return off('仅用于翻领');}
 if(/collar\.[fb]_bezier_[xy]$/.test(p)){const side=p.includes('.f_')?'f':'b';if(get(prefix+'collar.'+side+'_collar')!=='Bezier2NeckHalf')return off('仅用于贝塞尔领口');}
 return on;
}
