// Controlled experiments share roots, lengths, cuts and the same guide IDs.
// Values are authored P01 controls, not measurements of a photographed subject.
export const EXPERIMENTS=[
 {id:'baseline',label:'基准发流',description:'连续方向场与中束聚合；其他实验每次只改变一项。',controls:{partOffset:0,fringeSweep:0,earBias:0}},
 {id:'part-small',hidden:true,label:'发缝左移 1 毫米 · 稳定性检查',description:'小步变化探针。',controls:{partOffset:-.001,fringeSweep:0,earBias:0}},
 {id:'part-left',label:'① 发缝左移',description:'只把分缝控制曲线向左移 12 毫米，保留毛囊和剪裁。',controls:{partOffset:-.012,fringeSweep:0,earBias:0}},
 {id:'fringe-open',label:'② 刘海减小侧扫',description:'只减小刘海横向梳理，检查额前过渡与末端方向。',controls:{partOffset:0,fringeSweep:.42,earBias:0}},
 {id:'ear-back',label:'③ 侧发更多绕耳后',description:'只改变耳周路线偏向，检查侧发与耳颈处的衔接。',controls:{partOffset:0,fringeSweep:0,earBias:1}}
];
export function configureExperiment(profile,id='baseline'){
 const experiment=EXPERIMENTS.find(e=>e.id===id);if(!experiment)throw Error('Unknown flow experiment: '+id);
 profile.RootDirectionField.controls={...experiment.controls};
 profile.experiment={...experiment};profile.id='p01-current-scalp04-'+id;
 for(const p of profile.PartingCurves[0].points)p[0]+=experiment.controls.partOffset;
 return experiment;
}
