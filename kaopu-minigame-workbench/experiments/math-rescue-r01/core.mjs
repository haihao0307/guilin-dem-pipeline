/** Finite educational game. Not a proof or implementation of research theorems. */
export const VERSION='rescue-r01.1';
export const ANCHORS={A:[1,2],B:[2,3],C:[1,4],D:[2,5]};
export const LIMIT=1.5;
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const ropeFits=(a,b)=>distance(ANCHORS[a],ANCHORS[b])<=LIMIT+1e-9;
export const TASKS={
 near1:{name:'接回林林',short:'林林回岸',need:[],person:'lin',kind:'rescue',detail:'近处挂点已经就绪。一拍到安全区。'},
 near2:{name:'接回阿山',short:'阿山回岸',need:[],person:'shan',kind:'rescue',detail:'近处挂点已经就绪。一拍到安全区。'},
 first:{name:'牵引修理师',short:'修理师 · 第一次',need:[],kind:'engineer',detail:'他卡在窄缝，需要两拍。先解除卡扣。'},
 engineer:{name:'接回修理师',short:'修理师回岸',need:['first'],person:'engineer',kind:'rescue',detail:'救出他，下一拍可开启泵站旁路。'},
 anchor:{name:'设置远端锚',short:'A → B · 设锚',need:[],from:'A',to:'B',kind:'rig',detail:'从A接到B。每段上限1.50，这一段1.41。'},
 basket:{name:'固定接力吊篮',short:'B → C · 吊篮',need:['anchor'],from:'B',to:'C',kind:'rig',detail:'从B接到C。只有上拍扣紧的锚点才能接力。'},
 cross:{name:'搭接最后缺口',short:'C → D · 搭接',need:['basket'],from:'C',to:'D',cost:1,kind:'rig',detail:'用1份备用连接材料搭到伤员处；下一拍拉回。'},
 pull:{name:'沿绳接回阿遥',short:'阿遥 · 沿绳返回',need:['cross'],person:'yao',kind:'rescue',detail:'最后一次标准牵引。完成后安全扣释放绞盘。'},
 valve:{name:'开启泵站旁路',short:'打开预装旁路',need:['engineer'],kind:'supply',detail:'修理师打开预装阀门，不用备用材料。供给达到100%。'},
 platform:{name:'升降台接回阿遥',short:'阿遥 · 平台返回',need:['basket','valve'],person:'yao',kind:'rescue',detail:'吊篮已就绪、全网额定供给齐备，平台一拍接回。'},
 widen:{name:'加宽一条旧路',short:'旧路扩容 +1',need:[],cost:1,kind:'supply',detail:'消耗唯一备用材料；全网供给最高87.5%，仍未额定。'}
};
export const ORDER=['near1','near2','first','engineer','anchor','basket','cross','pull','valve','platform','widen'];
export function initial(){return {beat:0,done:[],saved:[],material:1,history:[],status:'playing'};}
export function supply(s){return s.done.includes('valve')?1:s.done.includes('widen')?.875:.75;}
export function blocked(s,id){const t=TASKS[id];if(!t)return '不存在的任务';if(s.status!=='playing')return '本局已结束，撤回一拍或重新出发';if(s.done.includes(id))return '任务已完成';if(t.person&&s.saved.includes(t.person))return '已经平安回岸';let n=t.need.filter(x=>!s.done.includes(x));if(n.length){if(t.from){const f=s.done.includes('basket')?'C':s.done.includes('anchor')?'B':'A',d=distance(ANCHORS[f],ANCHORS[t.to]);if(d>LIMIT)return `${f}→${t.to} 长${d.toFixed(2)}，绳子还差${(d-LIMIT).toFixed(2)}；先完成${n.map(x=>TASKS[x].name).join('、')}`;}return '需上拍完成：'+n.map(x=>TASKS[x].name).join('、');}if((t.cost||0)>s.material)return '备用材料已经用完';if(t.from&&!ropeFits(t.from,t.to))return '超过单段绳长';return '';}
export function available(s){return ORDER.filter(x=>!blocked(s,x));}
export function step(s,ids){if(s.status!=='playing')throw Error('本局已结束');if(ids.length>3)throw Error('只有三台绞盘');if(new Set(ids).size!==ids.length)throw Error('一个任务不能重复');let cost=0,people=[];for(const id of ids){let b=blocked(s,id);if(b)throw Error(b);cost+=TASKS[id].cost||0;if(TASKS[id].person)people.push(TASKS[id].person);}if(new Set(people).size!==people.length)throw Error('同一个人只能选一种接回方式');if(cost>s.material)throw Error('备用材料不够');let n=structuredClone(s);n.beat++;n.done.push(...ids);n.saved.push(...people);n.material-=cost;n.history.push({beat:n.beat,ids:[...ids],saved:[...people],supply:supply(n),material:n.material});n.status=n.saved.length===4?'won':n.beat>=4?'lost':'playing';return n;}
export function undo(s){if(!s.history.length)return initial();let n=initial();for(const h of s.history.slice(0,-1))n=step(n,h.ids);return n;}
export function failure(s){if(s.saved.includes('yao'))return '主线接回了阿遥，但还有同伴没能撤离。';if(s.done.includes('cross'))return '阿遥只差最后一次牵引。长链启动晚了一拍。';if(s.done.includes('basket')&&!s.done.includes('valve'))return `吊篮就绪，但平台供给仅${supply(s)*100}%。旧路加宽不能代替旁路。`;if(s.done.includes('valve')&&!s.done.includes('basket'))return '泵站恢复了，但吊篮没有及时接到远端。';return '远端接力没能及时完成。设锚与修理师都可以在第一拍开始。';}
export const SOLUTIONS={direct:[['anchor','near1','near2'],['basket','first'],['cross','engineer'],['pull']],bypass:[['near1','near2','first'],['engineer','anchor'],['basket','valve'],['platform']]};
// Exact optimal uniform rates for the three selectable finite K2,3 instances.
export function flowWitness(mode='base'){
 const hubs=['U','V'],rim=['X','Y','Z'],edges={};for(const h of hubs)for(const r of rim)edges[h+r]={capacity:mode==='wide'&&h==='U'&&r==='X'?2:1,load:0};if(mode==='bypass')edges.UV={capacity:1,load:0};
 const paths=[];function add(demand,path,amount){paths.push({demand,path,amount});for(let i=0;i<path.length-1;i++){let key=path[i]+path[i+1];if(!edges[key])key=path[i+1]+path[i];edges[key].load+=amount;}}
 if(mode==='base'){for(const [a,b]of[['X','Y'],['Y','Z'],['Z','X']])for(const h of hubs)add(a+b,[a,h,b],.375);for(const r of rim)add('UV',['U',r,'V'],.25);}
 else if(mode==='bypass'){for(const[a,b]of[['X','Y'],['Y','Z'],['Z','X']])for(const h of hubs)add(a+b,[a,h,b],.5);add('UV',['U','V'],1);}
 else if(mode==='wide'){add('XY',['X','U','Y'],11/16);add('XY',['X','V','Y'],3/16);add('ZX',['Z','U','X'],11/16);add('ZX',['Z','V','X'],3/16);add('YZ',['Y','U','Z'],3/16);add('YZ',['Y','V','Z'],11/16);add('UV',['U','X','V'],5/8);add('UV',['U','Y','V'],1/8);add('UV',['U','Z','V'],1/8);}
 return {rate:mode==='bypass'?1:mode==='wide'?.875:.75,edges,paths};
}
