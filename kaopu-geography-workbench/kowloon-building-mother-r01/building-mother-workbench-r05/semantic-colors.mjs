// Display-only semantic categories, stable across growth/floors/cuts/noise.
export const SEMANTIC_COLORS=Object.freeze([
 {id:'foundation',label:'基础 / 基础联系梁',color:'#ca9a3d'},
 {id:'column',label:'框架柱',color:'#b564da'},
 {id:'beam',label:'框架梁',color:'#e48349'},
 {id:'floor',label:'楼板 / 地面 / 屋面',color:'#4faacb'},
 {id:'wall',label:'填充墙',color:'#91b96f'},
 {id:'stair',label:'楼梯 / 平台',color:'#d7647d'},
 {id:'handrail',label:'连续扶手 / 立杆',color:'#e4ce67'}
]);
export function semanticCategory(record){return /:foundation(?::|-beam:)/.test(record.nodeId)?'foundation':record.classKey==='roof'?'floor':record.classKey;}
export function displayColor(record,semantic=false){return semantic?(SEMANTIC_COLORS.find(c=>c.id===semanticCategory(record))?.color??'#a8adb1'):({wall:'#ada89e',column:'#92918b',beam:'#92918b',floor:'#a6a298',roof:'#92918b',stair:'#92918b',handrail:'#707879'}[record.classKey]??'#92918b');}
