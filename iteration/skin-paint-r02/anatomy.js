/* Native material-space anchors from this retained character, not donor UVs. */
window.KAOPU_PAINT_ANATOMY=function(model){
 const f=model.faceSurface.fields,g=model.gnm;
 const lm=i=>f.landmark(f.rest,i),mid=(a,b)=>a.map((v,i)=>(v+b[i])*.5),abs=p=>[Math.abs(p[0]),p[1],p[2]];
 const region=name=>{const index=g.meta.regionNames.indexOf(name);let p=[0,0,0],n=0;for(let i=0;i<g.numVertices;i++)if(g.regionId[i]===index&&g.materialId[i]===0){n++;p[0]+=Math.abs(g.template[i*3]);p[1]+=g.template[i*3+1];p[2]+=g.template[i*3+2];}if(!n)throw Error('Missing own facial region '+name);return p.map(x=>x/n);};
 const malar=region('left_zygomatic'),infra=region('left_infraorbital'),cheek=mid(malar,infra),eye=abs(mid(lm(46),lm(47))),ala=abs(lm(35)),chin=abs(lm(8)),lip=mid(lm(51),lm(57)),temple=region('left_temple'),jaw=region('left_parotid');
 eye[1]-=.0025;const socket=abs(mid(lm(43),lm(44)));socket[1]+=.003;
 const muzzle=[.014,lip[1]+.013,lip[2]],chinPatch=[.014,chin[1]+.012,chin[2]];
 const names={uP2Cheek:cheek,uP2Ala:ala,uP2Lid:eye,uP2Socket:socket,uP2Temple:temple,uP2Muzzle:muzzle,uP2Chin:chinPatch,uP2Jaw:jaw};
 const U=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,{value:v}]));
 window.__PAINT_ANATOMY__={source:'same model.gnm.template, own canonical barycentric landmark map and semantic regions',coordinateSpace:'fRest native template metres',anchors:names,landmarks:{nose:lm(30),chin:lm(8),eyeOuter:lm(45),eyeInner:lm(42),mouthRight:lm(54)},clinicalCalibration:false};return U;
};