import * as boundary from '../kernel/approved/BoundaryKernel.mjs';
import {point,normalArray,growth} from '../kernel/NativeSurface.mjs';
import {unit} from './HairStyleProfile.mjs';
const references=[
 ['frontotemporal','额颞转折',.350,.076],['temporal-peak','颞尖参考',.333,.056],
 ['infratemple','颞下过渡',.314,.047],['sideburn','鬓角下缘',.282,.037],['above-ear','耳上衔接',.3055,.013]
];
export function buildTemporalReview(chart,surface,records){
 const edges=boundary.domain(chart).boundary,normals=normalArray(surface.head.positions,surface.head.triangles),anchors=[];
 for(const side of [-1,1])for(const [index,[id,label,y,z]]of references.entries()){
  const candidates=edges.filter(e=>e.p[0]*side>.05&&e.p[2]>.0&&e.p[2]<.11),distance=e=>(e.p[1]-y)**2+(e.p[2]-z)**2+.15*(Math.abs(e.p[0])-.08)**2;
  const e=candidates.reduce((a,b)=>distance(a)<distance(b)?a:b),binding=surface.support(e.f,e.b);if(!binding)throw Error('Temporal landmark has no native support');
  const p=point(surface.head,binding.f,binding.b),n=unit(point(surface.head,binding.f,binding.b,normals));
  anchors.push({id:(side<0?'left-':'right-')+id,index:index+1,label,side:side<0?'left':'right',chartPoint:e.p,triangleId:binding.f,barycentric:binding.b,point:p,normal:n,status:id==='temporal-peak'?'authored temporal-peak review reference; not a measured anatomical tip':'authored boundary review anchor',changesGrowthDomain:false});
 }
 const bands=anchors.map(a=>({...a,eligible:0,active:0}));
 for(const r of records){const p=r.chartP;if(Math.abs(p[0])<.055||p[1]>.370||p[2]<.003||p[2]>.10||growth(p)>.024||!r.active&&growth(p)<0)continue;
  const index=p[2]>=.068?1:p[2]>=.052?2:p[2]>=.041?3:p[2]>=.026?4:5,a=bands.find(a=>a.side===(p[0]<0?'left':'right')&&a.index===index);if(r.eligible)a.eligible++;if(r.active)a.active++;
 }
 return{anchors,bands:bands.map(({id,label,index,side,eligible,active})=>({id,label,index,side,eligible,active})),source:'nearest points on unchanged approved chart boundary, mapped through original native barycentric binding',status:'authored review landmarks and edge bands; not population measurements or replacement hairline',growthDomainModified:false};
}
