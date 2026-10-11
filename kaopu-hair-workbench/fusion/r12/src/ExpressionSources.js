/**
 * GNM source-workflow expression adapters, not new models or DCC runtimes.
 * Source recipes: MIT, © Enrique Velasco Mairal / Iman Shirani (2026).
 * Model coefficients: Google GNM, Apache-2.0. See licenses/ and PROVENANCE.json.
 */
import {expressionSourceData as data} from './ExpressionSourceData.js';

const LABELS={surprise:'惊讶',disgust:'厌恶',suck:'吸吮',compress_face:'收紧面部',stretch_face:'拉伸面部',happy:'愉快',squint:'眯眼',platysma:'颈阔肌',blow:'鼓气',funneler:'漏斗口型',smile_wide:'宽笑',corners_down:'嘴角下拉',pucker:'噘嘴',wink_left:'左眨眼',wink_right:'右眨眼',mouth_left:'嘴偏左',mouth_right:'嘴偏右',lips_roll_in:'嘴唇内卷',snarl:'露齿',tongue_center:'伸舌'};
const MAX_LABELS={X:'X · 原作者休止组合',A:'A · 张口组合',B:'B · 闭唇组合',C:'C · 横向展唇组合',D:'D · 中等张口组合',E:'E · 圆唇组合',F:'F · 唇部收拢组合',G:'G · 小张口组合',H:'H · 小张口变体'};
const SOURCES={
  'maya-semantic':{id:'maya-semantic',label:'Maya 流程 · 官方语义表情',kind:'official-semantic-fixed-sample',repository:'https://github.com/enriquevelmai/gnm-maya',commit:'87948c08670ffea1fed82bb7af97f76245dd6644',count:20,note:'复现 Maya 20 类采样流程，固定 seed=类别序号；仍由当前 Google GNM 网格求值，不运行 Maya，也不含局部 ARKit 蒙版。'},
  'max-pca':{id:'max-pca',label:'3ds Max 流程 · PCA 口型实验',kind:'author-pca-fallback-recipe',repository:'https://github.com/imanshirani/GNM-Bridge-for-3ds-Max',commit:'7388a269cd414a8103bb42e6f21e89d1712edfec',count:9,note:'移植作者 constants.py 后备组合，仅第200–349维含非零值，其余表情归零。PCA口型实验，不是FACS、语音识别或精确音素；X也不等于全零中性。'},
};
function source(id){const value=Object.prototype.hasOwnProperty.call(SOURCES,id)&&SOURCES[id];if(!value)throw new RangeError('Unknown expression source: '+id);return value;}
function vectors(id){source(id);return id==='maya-semantic'?data.maya:data.max;}
function validateArray(value,length,name){if(!(Array.isArray(value)||ArrayBuffer.isView(value))||value.length!==length)throw new TypeError(name+' requires '+length+' values');for(const v of value)if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>1000)throw new RangeError(name+' contains an invalid coefficient');}

/** Fresh metadata, so UI code cannot mutate the internal catalog. */
export function listExpressionSources(){return Object.values(SOURCES).map(x=>({...x}));}
/** The real zero-neutral control is present separately in each source. */
export function listExpressionPresets(sourceId){const v=vectors(sourceId);return [{id:'neutral',label:'清除表情 · 真正中性',kind:'zero-neutral'},...Object.keys(v).map(id=>({id,label:sourceId==='maya-semantic'?(LABELS[id]??id):MAX_LABELS[id],kind:source(sourceId).kind}))];}
/** Pure output; never touches the model, identity, pose, hair, or sampler RNG. */
export function createSourceExpression(sourceId,presetId,{strength=1}={}){
  const v=vectors(sourceId);
  if(typeof strength!=='number'||!Number.isFinite(strength)||strength<0||strength>1.5)throw new RangeError('strength must be finite and between 0 and 1.5');
  if(presetId==='neutral')return new Float32Array(383);
  if(!Object.prototype.hasOwnProperty.call(v,presetId))throw new RangeError('Unknown expression preset: '+presetId);
  validateArray(v[presetId],383,'expression');
  if(strength===0)return new Float32Array(383);
  return Float32Array.from(v[presetId],x=>x*strength);
}
/** Optional immutable bridge to window.gnmStudy.setState(). Keep the host format
 * and version verbatim; validate all four vectors before creating a new state.
 * The caller is responsible for recording source selection in its own UI state.
 */
export function createExpressionState(current,sourceId,presetId,options){
  if(!current||typeof current!=='object'||!current.params)throw new TypeError('A current GNM state with params is required');
  const p=current.params;
  for(const [key,n] of [['identity',253],['expression',383],['rotations',12],['translation',3]])validateArray(p[key],n,key);
  const expression=createSourceExpression(sourceId,presetId,options);
  return {...current,params:{...p,identity:Array.from(p.identity),expression:Array.from(expression),rotations:Array.from(p.rotations),translation:Array.from(p.translation)}};
}
