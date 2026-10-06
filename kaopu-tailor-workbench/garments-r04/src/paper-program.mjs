/* Original two-dimensional length and hem-ease alterations.
 * An attributed MIT GarmentCode four-panel net pattern is the immutable base.
 * Neck, shoulder, full armhole curves and temporary fixture UVs stay unchanged.
 */
import {clone,fingerprint} from './core.mjs';
import {meshPaper as meshOriginal,edgeLength} from './paper-mesher.mjs';
export {edgeLength};export const PROGRAM='kaopu-teacher-sleeveless-top-grading@1';
export function gradePaper(base,{bodyLengthDeltaMm=0,hemEaseMm=0}={}){
 if(!Number.isFinite(bodyLengthDeltaMm)||bodyLengthDeltaMm< -50||bodyLengthDeltaMm>80||!Number.isFinite(hemEaseMm)||hemEaseMm<0||hemEaseMm>120)throw Error('本例支持衣长 −50…+80 mm、下摆新增松量 0…120 mm');
 const spec=clone(base),records=[];
 for(const p of spec.panels){
  const old=base.panels.find(x=>x.id===p.id),side=spec.seams.find(s=>s.stageId==='sides'&&(s.a.panelId===p.id||s.b.panelId===p.id));if(!side)throw Error('上衣侧缝缺失');
  const endpoint=side.a.panelId===p.id?side.a:side.b,datum=Math.min(...old.edges[endpoint.edge].map(i=>old.uvMm[i][1])),width=Math.max(...old.uvMm.map(q=>Math.abs(q[0]))),sign=p.source.side==='L'?1:-1;
  p.uvMm=old.uvMm.map(([x,y])=>{const w=Math.max(0,Math.min(1,(y-datum)/(-datum)));return[x+sign*hemEaseMm/4*(Math.abs(x)/width)*w,y+bodyLengthDeltaMm*w];});
  records.push({panelId:p.id,operation:'extend lower torso and spread the hem below the underarm datum',datumYmm:datum,lengthDeltaMm:bodyLengthDeltaMm,hemAdditionPerPanelMm:hemEaseMm/4,unchanged:'neck, shoulder, complete armhole, and material above underarm datum'});
 }
 const panels=Object.fromEntries(spec.panels.map(p=>[p.id,p]));for(const s of spec.seams)s.easeMm=edgeLength(panels[s.b.panelId],s.b.edge)-edgeLength(panels[s.a.panelId],s.a.edge);
 spec.id=`kaopu-sleeveless-top-${bodyLengthDeltaMm}-${hemEaseMm}`;spec.revision=1;spec.source.onlineProgram={id:PROGRAM,controls:{bodyLengthDeltaMm,hemEaseMm},operationRecords:records,sourcePaperFingerprint:fingerprint(base),meaning:'bounded original 2D alterations of four-panel MIT teacher paper; fixed adult synthetic body; no solved 3D garment input'};return spec;
}
export function meshPaper(input,options){const s=meshOriginal(input,options);delete s.source.meshing.all28SourceStitchesRetained;s.source.meshing.sourceStitchCount=input.seams.length;s.source.meshing.allSourceStitchesRetained=s.seams.length===input.seams.length;return s;}
export function paperSummary(spec){let area=0,hem=0;for(const p of spec.panels){for(const t of p.triangles){const[a,b,c]=t.map(i=>p.uvMm[i]);area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;}const maxY=Math.max(...p.uvMm.map(q=>q[1]));const h=Object.entries(p.edges).find(([,ids])=>ids.every(i=>Math.abs(p.uvMm[i][1]-maxY)<1e-7));if(!h)throw Error('下摆水平边缺失');hem+=edgeLength(p,h[0]);}return{program:spec.source.onlineProgram,panels:spec.panels.length,seams:spec.seams.length,hemCircumferenceMm:hem,particleCount:spec.panels.reduce((n,p)=>n+p.uvMm.length,0),triangleCount:spec.panels.reduce((n,p)=>n+p.triangles.length,0),netMaterialAreaMm2:area};}
