/** Six existing R07/R02 catalogue identities. No invented body coefficients.
 * Source: CURRENT_HUMAN R07 @ 5543f756ca3af1428323696324303fa70b8de850.
 * Exact phenotypes/localChanges are resolved from the live native catalogue.
 */
export const ACTOR_PROFILES=Object.freeze([
  {id:'A',name:'林川',sex:'male',gender:0,stage:'adult',build:'tall-slim',presetId:'r02-adult-male-tall-slim',faceId:'P01',hair:'short',description:'高瘦 · 勤快，好奇'},
  {id:'B',name:'周叔',sex:'male',gender:0,stage:'adult',build:'short-heavy',presetId:'r02-adult-male-short-heavy',faceId:'P02',hair:'buzz',description:'矮壮 · 慢性子，爱歇脚'},
  {id:'C',name:'许宁',sex:'male',gender:0,stage:'adult',build:'sturdy',presetId:'r02-adult-male-sturdy',faceId:'P05',hair:'short',description:'结实 · 热心，爱走动'},
  {id:'D',name:'沈禾',sex:'female',gender:1,stage:'adult',build:'short-slim',presetId:'r02-adult-female-short-slim',faceId:'P06',hair:'medium',description:'纤细 · 安静，照看花草'},
  {id:'E',name:'夏岚',sex:'female',gender:1,stage:'adult',build:'tall-sturdy',presetId:'r02-adult-female-tall-sturdy',faceId:'P04',hair:'long',description:'高挑 · 利落，喜欢散步'},
  {id:'F',name:'苏圆',sex:'female',gender:1,stage:'adult',build:'rounded',presetId:'r02-adult-female-rounded',faceId:'P03',hair:'long',description:'圆润 · 悠闲，爱吃面包'}
].map(Object.freeze));
export default ACTOR_PROFILES;
