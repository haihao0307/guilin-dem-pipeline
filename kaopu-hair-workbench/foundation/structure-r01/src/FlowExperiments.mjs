import {cutProfile} from './CutGroomField.mjs';
// Flow controls retain R06 cuts; explicit R07 cut studies change only endpoints.
// Values are authored P01 controls, not measurements of a photographed subject.
export const EXPERIMENTS=[
 {id:'baseline',label:'基准发流',description:'连续方向场与中束聚合；其他实验每次只改变一项。',controls:{partOffset:0,fringeSweep:0,earBias:0}},
 {id:'part-small',hidden:true,label:'发缝左移 1 毫米 · 稳定性检查',description:'小步变化探针。',controls:{partOffset:-.001,fringeSweep:0,earBias:0}},
 {id:'part-left',label:'① 发缝左移',description:'发缝左移 12 毫米，连续梳理上段；保留原毛囊、下垂出口与剪裁。',controls:{partOffset:-.012,fringeSweep:0,earBias:0}},
 {id:'fringe-open',label:'② 刘海减小侧扫',description:'只减小刘海横向梳理，检查额前过渡与末端方向。',controls:{partOffset:0,fringeSweep:.42,earBias:0}},
 {id:'ear-back',label:'③ 侧发更多绕耳后',description:'保留既有耳后方案，检查侧发与耳颈处的衔接。',controls:{partOffset:0,fringeSweep:0,earBias:1}},
 {id:'part-wide',label:'④ 发缝影响范围加宽',description:'发缝影响宽度由 9 改为 14 毫米，检查方向变化；不删除毛囊。',controls:{partOffset:0,fringeSweep:0,earBias:0,partWidth:.014}},
 {id:'hairline-low',label:'⑤ 发际根部更贴肤',description:'边缘抬升由 0.08 改为 0.04，连续过渡至内部；不移动发根。',controls:{partOffset:0,fringeSweep:0,earBias:0,hairlineLift:.04}},
 {id:'cut-u',label:'⑥ 当前长度 · 柔和 U 形剪裁',description:'沿既有发流剪出连续下缘；保留刘海和鬓角，不缩放头发或改毛囊边界。',controls:{partOffset:0,fringeSweep:0,earBias:0,cutPreset:'cut-u'}},
 {id:'cut-layered',label:'⑦ 当前长度 · 轻层次剪裁',description:'同一 U 形下缘叠加随发根高度连续变化的轻层次；检查后枕、后颈和侧发的发尾衔接。',controls:{partOffset:0,fringeSweep:0,earBias:0,cutPreset:'cut-layered'}}
];
const defaults=new WeakMap();
export function configureExperiment(profile,id='baseline',overrides={}){
 const experiment=EXPERIMENTS.find(e=>e.id===id);if(!experiment)throw Error('Unknown flow experiment: '+id);
 if(!defaults.has(profile))defaults.set(profile,{part:structuredClone(profile.PartingCurves[0]),hairlineLift:profile.RootLiftField.hairline,cut:structuredClone(profile.CutField)});const initial=defaults.get(profile),controls={...experiment.controls,...overrides};
 profile.RootDirectionField.controls=controls;profile.PartingCurves[0]=structuredClone(initial.part);profile.PartingCurves[0].width=controls.partWidth??initial.part.width;profile.RootLiftField.hairline=controls.hairlineLift??initial.hairlineLift;
 profile.CutField=controls.cutPreset?cutProfile(initial.cut,controls.cutPreset):structuredClone(initial.cut);
 profile.experiment={...experiment,controls};profile.id='p01-current-flow06-'+id;
 for(const p of profile.PartingCurves[0].points)p[0]+=controls.partOffset;
 return profile.experiment;
}
