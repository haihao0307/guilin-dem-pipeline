import {TUNA_R03_PROFILE as P, sectionAt} from './source-bundle.mjs';

const lerp=(a,b,t)=>a+(b-a)*t;

function tube(points,radius,{segments=8,name='detail',material='fin',transparent=false}={}){
  const positions=[],indices=[],params=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    let t=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];let tl=Math.hypot(...t)||1;t=t.map(v=>v/tl);
    let seed=Math.abs(t[1])<.88?[0,1,0]:[0,0,1];
    let e1=[seed[1]*t[2]-seed[2]*t[1],seed[2]*t[0]-seed[0]*t[2],seed[0]*t[1]-seed[1]*t[0]];let l=Math.hypot(...e1)||1;e1=e1.map(v=>v/l);
    const e2=[t[1]*e1[2]-t[2]*e1[1],t[2]*e1[0]-t[0]*e1[2],t[0]*e1[1]-t[1]*e1[0]];
    const r=Array.isArray(radius)?radius[i]:radius;
    for(let j=0;j<segments;j++){
      const q=2*Math.PI*j/segments,c=Math.cos(q),s=Math.sin(q);
      positions.push(p[0]+r*(e1[0]*c+e2[0]*s),p[1]+r*(e1[1]*c+e2[1]*s),p[2]+r*(e1[2]*c+e2[2]*s));
      params.push(i/Math.max(1,points.length-1),j/segments,0,0);
    }
  }
  for(let i=0;i<points.length-1;i++)for(let j=0;j<segments;j++){
    const a=i*segments+j,b=i*segments+(j+1)%segments,c=(i+1)*segments+(j+1)%segments,d=(i+1)*segments+j;indices.push(a,b,c,a,c,d);
  }
  return{name,positions,indices,params,material,transparent};
}

function bodySurface(u,y,side,offset=.0018){const s=sectionAt(u);return [u-.5,y,side*(s[1]+offset)];}

function medianRay(name,u0,y0,u1,y1){
  return tube([[u0-.5,y0,-.0014],[lerp(u0,u1,.53)-.5,lerp(y0,y1,.53),0],[u1-.5,y1,.0014]],.00062,{segments:7,name,material:'fin',transparent:true});
}

export function buildFinRayDetails(){
  const parts=[];
  const dorsal=[[.58,.143,.60,.188],[.61,.139,.63,.207],[.64,.133,.66,.214],[.67,.126,.69,.190],[.70,.116,.73,.149]];
  dorsal.forEach((v,i)=>parts.push(medianRay(`dorsalRay${i}`,...v)));
  const rear=[[.27,.063,.285,.096],[.31,.073,.33,.117],[.35,.084,.37,.119],[.39,.091,.41,.112],[.43,.094,.45,.103]];
  rear.forEach((v,i)=>parts.push(medianRay(`rearDorsalRay${i}`,...v)));
  const anal=[[.245,-.119,.26,-.158],[.285,-.132,.30,-.177],[.325,-.142,.34,-.181],[.365,-.146,.38,-.172],[.405,-.151,.42,-.161]];
  anal.forEach((v,i)=>parts.push(medianRay(`analRay${i}`,...v)));
  const upper=[[-.45,-.035,-.53,.065],[-.46,-.036,-.57,.105],[-.47,-.038,-.62,.152],[-.47,-.041,-.67,.193],[-.46,-.045,-.70,.212]];
  upper.forEach((v,i)=>parts.push(tube([[v[0],v[1],0],[lerp(v[0],v[2],.5),lerp(v[1],v[3],.5),0],[v[2],v[3],0]],.00075,{segments:7,name:`caudalUpperRay${i}`,material:'fin',transparent:true})));
  const lower=[[-.45,-.060,-.53,-.125],[-.46,-.061,-.57,-.165],[-.47,-.063,-.62,-.208],[-.47,-.066,-.67,-.238],[-.46,-.068,-.70,-.245]];
  lower.forEach((v,i)=>parts.push(tube([[v[0],v[1],0],[lerp(v[0],v[2],.5),lerp(v[1],v[3],.5),0],[v[2],v[3],0]],.00075,{segments:7,name:`caudalLowerRay${i}`,material:'fin',transparent:true})));
  return parts;
}

function pairedSurfaceCurve(name,rows,material='operculum'){
  const out=[];
  for(const side of[-1,1]){
    const pts=rows.map(([u,y,o])=>bodySurface(u,y,side,o));
    out.push(tube(pts,[.00055,.00072,.00072,.00055],{segments:8,name:`${name}${side<0?'Left':'Right'}`,material}));
  }
  return out;
}

export function buildHeadDetailParts(){
  const parts=[];
  parts.push(...pairedSurfaceCurve('maxillary',[[.985,-.029,.0022],[.945,-.021,.0025],[.895,-.010,.0028],[.84,-.003,.0024]],'lip'));
  parts.push(...pairedSurfaceCurve('preoperculum',[[.80,.056,.0022],[.775,.025,.0028],[.755,-.015,.0030],[.765,-.061,.0024]],'operculum'));
  parts.push(...pairedSurfaceCurve('supraorbital',[[.92,.030,.0018],[.885,.045,.0022],[.84,.052,.0020],[.80,.047,.0016]],'operculum'));
  return parts;
}

export function enhanceTuna(base){
  if(!base||base.branch!=='tuna'||!Array.isArray(base.parts))throw new Error('tuna base required');
  const details=[...buildFinRayDetails(),...buildHeadDetailParts()];
  const names=new Set(base.parts.map(p=>p.name));
  for(const part of details){if(names.has(part.name))throw new Error(`duplicate part:${part.name}`);names.add(part.name)}
  return{...base,schema:'kaopu.original-fish.generated/0.3.3',parts:[...base.parts,...details],detailRevision:'R03.3_FIN_RAYS_HEAD_FOLDS'};
}
