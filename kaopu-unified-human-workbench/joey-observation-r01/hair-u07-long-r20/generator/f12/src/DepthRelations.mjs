const roots=(patch,n)=>Array.from({length:n},(_,i)=>patch+'/'+i);
const group=(id,name,color,sources,role)=>({id,name,color,sources,role,rootAssignment:'authored from visible flow; concealed scalp extent inferred'});
const groups=[
 group('fringe-left','中分左额后梳长束','#388346',roots('bang-sweep',4),'由左额根区向颞侧、耳后及肩下连续生长；额头保持露出'),
 group('front-wisps','中分右额后梳长束','#c99a57',roots('bang-wisps',4),'由右额根区向颞侧、耳后及肩下连续生长；不设短刘海'),
 group('temple-left','左颞侧过渡层','#2696a3',roots('frame-left',4),'从额角绕耳向后下方，和侧后长层交叠'),
 group('outer-left','左外轮廓长层','#ad3836',['outer-left/0','outer-left/1'],'较后的冠部源区向外展开，支撑外轮廓'),
 group('middle-left','左侧中间长层','#b2a42d',['outer-left/2','outer-left/3'],'位于外层前方和内侧，越过颞侧后回收'),
 group('inner-left','左耳后内层','#35549b',roots('under-left',3),'耳后下方的内层厚度和颈侧收尾'),
 group('back-left','左侧后方补足层','#574577',roots('back-left',4),'遮挡后层，按连续根区和侧面轮廓推定'),
 group('face-right','右颞侧后梳长层','#34733e',roots('frame-right',4),'绕开耳前面部，向耳后与肩下长层衔接'),
 group('outer-right','右外轮廓长层','#269daa',['outer-right/0','outer-right/1'],'较后的冠部源区支撑外侧轮廓'),
 group('middle-right','右侧中间长层','#a94591',['outer-right/2','outer-right/3'],'位于贴脸层之后、外轮廓层之前'),
 group('inner-right','右侧遮挡内层','#655078',roots('under-right',3),'内层厚度，精确范围为推定'),
 group('back-right','右侧后方补足层','#365488',roots('back-right',4),'后冠至枕部的连续补足'),
 group('nape','后颈底层','#4e466d',roots('nape',5),'较低根区的底层填充')
];
export const DEPTH_RELATIONS=Object.freeze({schema:'kaopu/reference-depth-relations@1',referenceStudy:'u07-center-part-ear-swept-long-r19',referenceView:'near-front; hidden rear depth inferred',imagePublished:false,groups,relations:[
 {front:'fringe-left',behind:'temple-left',zone:'front-temple',evidence:'visible overlap; root extent inferred'},
 {front:'middle-left',behind:'outer-left',zone:'upper lateral overlap',evidence:'visible layered flow; precise depth inferred'},
 {front:'temple-left',behind:'inner-left',zone:'ear and neck border',evidence:'visible overlap and exposed ear; root extent inferred'},
 {front:'face-right',behind:'middle-right',zone:'face-framing overlap',evidence:'visible overlap; precise depth inferred'},
 {front:'middle-right',behind:'outer-right',zone:'lateral overlap',evidence:'visible layered flow; precise depth inferred'}
],rule:'relations are local to the stated zone and reference camera; no global front/back sort, no depth inferred from colour alone',unseen:'concealed roots, rear connections and exact thickness remain authored hypotheses',geometry:'center-part bilateral root-owned long paths, ear-swept corridors, long posterior layers and unchanged full volumetric transverse fields'});
export function depthGroup(id){const g=groups.find(g=>g.sources.includes(id));if(!g)throw Error('Missing reference depth group: '+id);return g;}
