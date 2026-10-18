import {earRestProfile} from './EarRestGroom.mjs';
import {crownVolumeProfile} from './CrownRestVolume.mjs';
import {upperRestProfile} from './UpperRestGroom.mjs';
import {fringeRestProfile} from './FringeRestGroom.mjs';
import {staticRestProfile} from './StaticRestGroom.mjs';
import {cutProfile} from './CutGroomField.mjs';
import {silhouetteProfile} from './SilhouetteWisps.mjs';
import {volumeProfile} from './VolumeFlow.mjs';
// Flow controls retain R06 cuts; explicit R07 cut studies change only endpoints.
// Values are authored P01 controls, not measurements of a photographed subject.
export const EXPERIMENTS=[
 {id:'current-rest',primary:true,label:'当前长度 · 静态发型',description:'当前主方案：主体下段、分缝刘海、顶部旋涡与耳周同高束群过渡；第一轮整体尚未验收。',controls:{partOffset:0,fringeSweep:0,earBias:0,restPreset:'current-rest'}},
 {id:'baseline',label:'基准发流',description:'连续方向场与中束聚合；其他实验每次只改变一项。',controls:{partOffset:0,fringeSweep:0,earBias:0}},
 {id:'part-small',hidden:true,label:'发缝左移 1 毫米 · 稳定性检查',description:'小步变化探针。',controls:{partOffset:-.001,fringeSweep:0,earBias:0}},
 {id:'part-left',label:'① 发缝左移',description:'发缝左移 12 毫米，连续梳理上段；保留原毛囊、下垂出口与剪裁。',controls:{partOffset:-.012,fringeSweep:0,earBias:0}},
 {id:'fringe-open',label:'② 刘海减小侧扫',description:'只减小刘海横向梳理，检查额前过渡与末端方向。',controls:{partOffset:0,fringeSweep:.42,earBias:0}},
 {id:'ear-back',label:'③ 侧发更多绕耳后',description:'保留既有耳后方案，检查侧发与耳颈处的衔接。',controls:{partOffset:0,fringeSweep:0,earBias:1}},
 {id:'part-wide',label:'④ 发缝影响范围加宽',description:'发缝影响宽度由 9 改为 14 毫米，检查方向变化；不删除毛囊。',controls:{partOffset:0,fringeSweep:0,earBias:0,partWidth:.014}},
 {id:'hairline-low',label:'⑤ 发际根部更贴肤',description:'边缘抬升由 0.08 改为 0.04，连续过渡至内部；不移动发根。',controls:{partOffset:0,fringeSweep:0,earBias:0,hairlineLift:.04}},
 {id:'cut-u',label:'⑥ 当前长度 · 柔和 U 形剪裁',description:'沿既有发流剪出连续下缘；保留刘海和鬓角，不缩放头发或改毛囊边界。',controls:{partOffset:0,fringeSweep:0,earBias:0,cutPreset:'cut-u'}},
 {id:'cut-layered',label:'⑦ 当前长度 · 轻层次剪裁',description:'同一 U 形下缘叠加随发根高度连续变化的轻层次；检查后枕、后颈和侧发的发尾衔接。',controls:{partOffset:0,fringeSweep:0,earBias:0,cutPreset:'cut-layered'}},
 {id:'silhouette-round',label:'⑧ 立体侧后轮廓',description:'保留根部和原发尾高度，以中束局部关系梳理侧后方下垂路径；不再推向同一后平面。',controls:{partOffset:0,fringeSweep:0,earBias:0,routePreset:'silhouette-round'}},
 {id:'silhouette-framing',label:'⑨ 立体轮廓 · 耳前渐层',description:'在立体侧后路径上，单独调整耳前长束的终止高度，检查与原鬓角短束的过渡。',controls:{partOffset:0,fringeSweep:0,earBias:0,routePreset:'silhouette-framing'}},
 {id:'volume-flow',label:'⑩ 连续三维发流',description:'造型曲线约束共享方向场，再从原生发根连续追踪到区域剪裁；检查头顶到耳周的衔接。',controls:{partOffset:0,fringeSweep:0,earBias:0,volumePreset:'volume-flow'}}
];
const defaults=new WeakMap();
export function configureExperiment(profile,id='baseline',overrides={}){
 const experiment=EXPERIMENTS.find(e=>e.id===id);if(!experiment)throw Error('Unknown flow experiment: '+id);
 if(!defaults.has(profile))defaults.set(profile,{revision:profile.revision,part:structuredClone(profile.PartingCurves[0]),hairlineLift:profile.RootLiftField.hairline,directionMode:profile.RootDirectionField.mode,cut:structuredClone(profile.CutField),rest:structuredClone(profile.RestShape),clumps:structuredClone(profile.ClumpGraph)});const initial=defaults.get(profile),controls={...experiment.controls,...overrides};
 profile.revision=initial.revision;profile.RootDirectionField.controls=controls;profile.RootDirectionField.mode=initial.directionMode;profile.PartingCurves[0]=structuredClone(initial.part);profile.PartingCurves[0].width=controls.partWidth??initial.part.width;profile.RootLiftField.hairline=controls.hairlineLift??initial.hairlineLift;
 profile.CutField=controls.cutPreset?cutProfile(initial.cut,controls.cutPreset):structuredClone(initial.cut);
 profile.RestShape=structuredClone(initial.rest);profile.ClumpGraph=structuredClone(initial.clumps);delete profile.SilhouetteField;delete profile.VolumeFlowField;delete profile.StaticRestField;delete profile.FringeRestField;delete profile.UpperRestField;delete profile.CrownVolumeField;delete profile.EarRestField;
 if(controls.routePreset){profile.SilhouetteField=silhouetteProfile(profile,controls.routePreset);profile.CutField=cutProfile(initial.cut,'cut-layered');delete profile.CutField.study;profile.CutField.referenceStudy='cut-layered';profile.CutField.mode='authored lower silhouette routes; inherited end heights plus optional ear-front graduation';profile.CutField.policy={rootMotion:false,fringeUnchanged:true,templeUnchanged:true,protectedRootArc:.045};profile.RestShape={...profile.RestShape,source:'R07 light-layer current groom with explicit source-wisp local loft after 45 mm fixed root arc'};profile.ClumpGraph.partMembership='fixed material side and semantic/ear route; regenerate hierarchy from complete new curves';}
 if(controls.volumePreset){configureExperiment(profile,'silhouette-framing');delete profile.SilhouetteField;profile.VolumeFlowField=volumeProfile(profile);profile.RootDirectionField.controls=controls;profile.RootDirectionField.mode='style-curve constrained shared 3D volume; native tangent/lift launch';profile.RestShape.source='Native-root RK2 streamlines through shared style-curve-constrained 3D field';profile.CutField.mode='regional heights inherited from silhouette-framing; new root-to-tip flow';profile.CutField.policy={rootMotion:false,nativeRootPoints:1,fringeUnchanged:true,templeUnchanged:false};profile.ClumpGraph.partMembership='same semantic material routes; native-root-connected mid/micro hierarchy from new full curves';}
 if(controls.restPreset){configureExperiment(profile,'volume-flow');profile.StaticRestField=staticRestProfile();profile.FringeRestField=fringeRestProfile(profile);profile.UpperRestField=upperRestProfile(profile);profile.CrownVolumeField=crownVolumeProfile();profile.RootDirectionField.mode='R09 body, R10 parted fringe, R11 compact crown tangent/launch field';profile.EarRestField=earRestProfile();profile.revision='static-rest-13';profile.RootDirectionField.controls=controls;profile.RestShape.source='Frozen R09 body flow with reviewed connected-wisp rest; separate part-aware fringe field; compact crown launch and native-normal upper volume with fixed downstream points';profile.CutField.mode='body regional heights with bounded graduation; separate fringe brow-to-temple envelope';profile.CutField.policy={rootMotion:false,bodyRestProtectedRootArc:profile.StaticRestField.protectedRootArc,upperSourceReach:.080,upperMinY:.335,tipsUnchangedByUpper:true,fringeUnchanged:false,fringeField:profile.FringeRestField.revision};}
 profile.experiment={...experiment,controls};profile.id=id==='current-rest'?'p01-current-rest13':'p01-current-flow06-'+id;
 for(const p of profile.PartingCurves[0].points)p[0]+=controls.partOffset;
 return profile.experiment;
}
