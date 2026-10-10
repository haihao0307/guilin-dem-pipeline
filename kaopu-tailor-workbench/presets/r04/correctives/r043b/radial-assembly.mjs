/** R04.3b: rigid initial staging from native radial-skirt edges, not a display deformation.
 * Only numerical initial placement and temporary sewing fixtures change. All rest
 * vertices, triangles, seam pairs, body vertices and review thresholds are retained.
 */
const length=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const world=(p,uv)=>{const b=p.placement.rigidBasis,t=p.placement.translationMm;return [0,1,2].map(k=>b[k*3]*uv[0]+b[k*3+1]*uv[1]+t[k]);};
function nativeEdgeData(spec,refs){const panels=new Map(spec.panels.map(p=>[p.id,p])),out=new Map();for(const r of refs){const p=panels.get(r.panelId),edge=p?.edges['e'+r.edge];if(!edge)throw Error('RADIAL_SOURCE_EDGE_MISSING');if(!out.has(p.id))out.set(p.id,{p,edges:[],length:0,uv:[0,0]});const a=out.get(p.id);a.edges.push(edge);for(let j=1;j<edge.length;j++){const u=p.uvMm[edge[j-1]],v=p.uvMm[edge[j]],l=length(u,v);a.length+=l;a.uv[0]+=(u[0]+v[0])*.5*l;a.uv[1]+=(u[1]+v[1])*.5*l;}}for(const a of out.values())a.uv=a.uv.map(v=>v/a.length);return out;}
export function stageRadialSkirt(spec,analytic,body){
 const aggregate=analytic.interfaces.find(i=>/^SkirtManyPanels_\d+$/.test(i.component)&&i.name==='top');
 if(!aggregate)return {enabled:false,reason:'not an original radial-panel skirt'};
 // Use the composite's authoritative split references; child top interfaces can
 // retain old edge numbers after waistband subdivision. We never change the seam.
 const top=nativeEdgeData(spec,aggregate.edges),hemRefs=analytic.interfaces.filter(i=>/^skirt_panel_\d+$/.test(i.component)&&i.name==='bottom').flatMap(i=>i.edges),hem=nativeEdgeData(spec,hemRefs);
 const wbTop=nativeEdgeData(spec,analytic.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='top').flatMap(i=>i.edges));
 const wbBottom=nativeEdgeData(spec,analytic.interfaces.filter(i=>/^wb_/.test(i.component)&&i.name==='bottom').flatMap(i=>i.edges));
 if(top.size<3||top.size!==hem.size||wbTop.size!==2||wbBottom.size!==2)throw Error('RADIAL_SOURCE_TOPOLOGY_NOT_SUPPORTED');
 const waist=sum([...wbTop.values()].map(x=>x.length)),topY=sum([...wbTop.values()].map(x=>world(x.p,x.uv)[1]))/2,bottomY=sum([...wbBottom.values()].map(x=>world(x.p,x.uv)[1]))/2;
 const section=body.positionsMm.filter(p=>Math.abs(p[1]-bottomY)<15&&Math.abs(p[0])<300);if(section.length<8)throw Error('RADIAL_BODY_SECTION_UNAVAILABLE');
 const cz=(Math.min(...section.map(p=>p[2]))+Math.max(...section.map(p=>p[2])))/2,rx=Math.max(...section.map(p=>Math.abs(p[0]))),rz=Math.max(...section.map(p=>Math.abs(p[2]-cz)));
 const topR=Math.max(waist/(2*Math.PI)+24,rx+16,rz+16),hemR=sum([...hem.values()].map(x=>x.length))/(2*Math.PI),moves=[];
 for(const [id,a]of top){const p=a.p,h=hem.get(id);if(!h)throw Error('RADIAL_MISSING_HEM');const before=structuredClone(p.placement),center=world(p,a.uv),vx=center[0],vz=center[2]-cz,L=Math.hypot(vx,vz);if(L<1)throw Error('RADIAL_AMBIGUOUS_ORIENTATION');const rad=[vx/L,0,vz/L],tangent=[rad[2],0,-rad[0]],oldT=[before.rigidBasis[0],before.rigidBasis[3],before.rigidBasis[6]],dot=tangent[0]*oldT[0]+tangent[2]*oldT[2];if(dot<0)for(let k=0;k<3;k++)tangent[k]*=-1;
  const dy=a.uv[1]-h.uv[1];if(dy<=0)throw Error('RADIAL_INVERTED_MATERIAL_AXIS');const sin=Math.min(.8,Math.max(0,(hemR-topR)/dy)),co=Math.sqrt(1-sin*sin),vertical=[-sin*rad[0],co,-sin*rad[2]],normal=[tangent[1]*vertical[2]-tangent[2]*vertical[1],tangent[2]*vertical[0]-tangent[0]*vertical[2],tangent[0]*vertical[1]-tangent[1]*vertical[0]];
  const target=[topR*rad[0],bottomY,cz+topR*rad[2]],basis=[];for(let k=0;k<3;k++)basis.push(tangent[k],vertical[k],normal[k]);p.placement.rigidBasis=basis;p.placement.translationMm=target.map((v,k)=>v-tangent[k]*a.uv[0]-vertical[k]*a.uv[1]);moves.push({panelId:id,sourceTopEdges:a.edges,topRestLengthMm:a.length,hemRestLengthMm:h.length,before,initialPlacement:structuredClone(p.placement),rigidOnly:true});
 }
 // Sewing jig at the two lateral waistband junctions. Every fixture is explicitly
 // temporary and is removed before the gravity stage; the final ring is unpinned.
 let pins=0;for(const a of wbTop.values()){const ids=[...new Set(a.edges.flatMap(e=>[e[0],e.at(-1)]))];const ps=ids.map(i=>[i,world(a.p,a.p.uvMm[i])]).sort((a,b)=>a[1][0]-b[1][0]);for(const[i,w]of[ps[0],ps.at(-1)]){const sign=w[0]<0?-1:1,z=cz+(a.p.id.includes('back')?-.4:.4);if(!a.p.temporaryPins.includes(i))a.p.temporaryPins.push(i);a.p.temporaryPinTargetsMm[i]=[sign*(rx+4),topY,z];pins++;}}
 spec.source.radialAssembly43b={enabled:true,method:'rigid tangent-plane placement from aggregate native top/hem interfaces and exact-body waist section; temporary lateral sewing jig',waistRestPerimeterMm:waist,initialTopRadiusMm:topR,initialHemRadiusMm:hemR,temporaryFixtures:pins,fixtureRelease:'before gravity; zero permanent pins',moves,bodyChanged:false,restMaterialChanged:false,seamsChanged:false};return spec.source.radialAssembly43b;
}
function sum(a){return a.reduce((s,v)=>s+v,0);}
