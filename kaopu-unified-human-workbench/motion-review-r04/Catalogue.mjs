export const BASELINE={character:'HUMAN-INTEGRATED-R04',characterCommit:'e5df3bcba13ba566d6da27d5cb051e91956055b3',sourceCommit:'fde66f8246cc49f604e5deb24fcc4128d8c9772b'};
const r=(id,label,group,kind,note,extra={})=>({id,label,group,kind,note,playable:true,...extra});
export const CATALOGUE=[
 r('idle','自然站立','01 站立与待机','basic','自有静止姿态：双足支撑、手臂放松、手掌朝向身体。不是外部动捕。',{task:'idle',duration:4,continuous:true}),
 r('idle-breathe','站立 · 轻微呼吸','01 站立与待机','basic','自有脊柱小幅周期姿态，双足保持支撑；不宣称真实胸廓呼吸力学。',{task:'idle-breathe',duration:5,continuous:true}),
 r('walk-loop','连续行走','02 行走与跑步','capture2','CMU16_15完整步态周期。初始朝向、肘部平面与手掌已统一校准，平地脚跟/脚尖支撑。',{sourceKey:'walkCycle',continuous:true}),
 r('run-loop','连续跑步','02 行走与跑步','capture2','CMU16_35完整跑步周期。循环位移累计；可切换原地观察。',{sourceKey:'runCycle',continuous:true}),
 r('walk','行走 → 停步','02 行走与跑步','capture','CMU16_33有限片段：原始行走和停步，不作为无限循环。',{sourceKey:'walk'}),
 r('run','跑步 → 停步','02 行走与跑步','capture','CMU16_57有限跑步、减速与停止。不是连续跑周期。',{sourceKey:'run'}),
 r('turn-left','走步左转 90°','03 转向','turn','在已有行走采样上编排弧线路径，并重新约束支撑脚；不是新采集的原地转身。',{direction:1,sourceKey:'walkCycle'}),
 r('turn-right','走步右转 90°','03 转向','turn','与左转共用原始步态，方向独立编排，双足接触在转弯后重解。',{direction:-1,sourceKey:'walkCycle'}),
 r('squat-cycle','下蹲 → 起身','04 下蹲与起身','basic','CMU22_14实测下降与起身高度时序，加自有原生骨架姿态。双足支撑，双手随膝前方移动。',{task:'squat-cycle',duration:4.6}),
 r('squat-down','下蹲并保持','04 下蹲与起身','basic','同一次蹲起的下降段。保留姿态，不算另一份独立动捕。',{task:'squat-down',duration:2.3}),
 r('stand-up','从蹲姿起身','04 下蹲与起身','basic','同一采集的上升时序，不用倒放下降片段冒充。',{task:'stand-up',duration:2.3}),
 r('jump','小跳 → 落地','05 跳跃与手势','capture','CMU16_01小幅跳跃。检查起跳、腾空和落地缓冲。',{sourceKey:'jump'}),
 r('natural-wave','站立挥手','05 跳跃与手势','capture2','CMU143_25挥手片段。身体为采集重定向，手指为独立原生放松姿态。',{sourceKey:'waveNatural',continuous:false}),
 r('natural-stretch','全身伸展','05 跳跃与手势','capture2','CMU143_30伸展时序。没有添加伪造的同步打哈欠口型。',{sourceKey:'stretchNatural',continuous:false})
];
export const COUNTS={bodyEntries:CATALOGUE.length,boxingPrograms:0,boxingExcerpts:0,facialChannels:0,legacyEntries:0,scenarios:0};
