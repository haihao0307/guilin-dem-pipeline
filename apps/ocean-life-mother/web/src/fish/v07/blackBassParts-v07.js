import {BLACK_BASS_R1_CARD} from './blackBassData-v07.js';
import {lerp,smoothstep,buildCurveTube,transformJawPointWeighted,buildCranialMesh,buildLowerJawMesh,buildMouthCavityMesh,buildEllipsoidMesh} from './blackBassGeometry-v07.js';

function lipPoints(side, which, mouthOpenRad=0){
  const c=BLACK_BASS_R1_CARD.lipCurves;
  return c.u.map((u,i)=>{
    const p=[side*c.lateral[i], which==='upper'?c.upperY[i]:c.lowerY[i], u];
    if(which==='lower') return transformJawPointWeighted(p,mouthOpenRad,smoothstep(0.815,0.875,u));
    return p;
  });
}

export function buildLipBand(which,{mouthOpenRad=0,crossSegments=34}={}) {
  if(which!=='upper'&&which!=='lower') throw new Error('lip band');
  const c=BLACK_BASS_R1_CARD.lipCurves;
  const rows=c.u.length, cols=crossSegments, positions=[],indices=[];
  const index=(shell,row,col)=>(shell*rows*cols+row*cols+col);
  for(let shell=0;shell<2;shell++){
    const shellSign=shell?1:-1;
    for(let i=0;i<rows;i++){
      for(let j=0;j<cols;j++){
        const q=j/(cols-1), side=-1+2*q, centerBulge=1-side*side;
        const x=side*c.lateral[i];
        const y0=which==='upper'?c.upperY[i]:c.lowerY[i];
        const y=y0+shellSign*c.radiusNormal[i]*(0.68+0.32*centerBulge);
        const u=c.u[i]+0.0028*centerBulge*(1-smoothstep(0.965,1.0,c.u[i]));
        let p=[x,y,u];
        if(which==='lower') p=transformJawPointWeighted(p,mouthOpenRad,smoothstep(0.815,0.875,u));
        positions.push(...p);
      }
    }
  }
  for(let shell=0;shell<2;shell++)for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){
    const a=index(shell,i,j),b=index(shell,i,j+1),c0=index(shell,i+1,j+1),d=index(shell,i+1,j);
    if(shell===0)indices.push(a,c0,b,a,d,c0);else indices.push(a,b,c0,a,c0,d);
  }
  for(let i=0;i<rows-1;i++)for(const j of[0,cols-1]){
    const a=index(0,i,j),b=index(0,i+1,j),c0=index(1,i+1,j),d=index(1,i,j);
    if(j===0)indices.push(a,b,c0,a,c0,d);else indices.push(a,c0,b,a,d,c0);
  }
  for(const i of[0,rows-1])for(let j=0;j<cols-1;j++){
    const a=index(0,i,j),b=index(0,i,j+1),c0=index(1,i,j+1),d=index(1,i,j);
    if(i===0)indices.push(a,c0,b,a,d,c0);else indices.push(a,b,c0,a,c0,d);
  }
  return {positions,indices,rowCount:rows,crossSegments:cols};
}

export function buildLipMeshes({mouthOpenRad=0}={}) {
  return {
    upper:buildLipBand('upper',{mouthOpenRad:0}),
    lower:buildLipBand('lower',{mouthOpenRad})
  };
}

export function buildMaxillaryMeshes() {
  const y=[-0.039,-0.036,-0.032,-0.027,-0.021,-0.015];
  const u=[0.812,0.830,0.850,0.872,0.895,0.918];
  const lateral=[0.0560,0.0585,0.0580,0.0555,0.0510,0.0450];
  const rx=[0.0016,0.0017,0.0017,0.0016,0.0014,0.0010];
  const rn=[0.0048,0.0048,0.0045,0.0040,0.0033,0.0023];
  const make=side=>buildCurveTube(u.map((v,i)=>[side*lateral[i],y[i],v]),rx,rn,{radialSegments:12});
  return {left:make(-1),right:make(1)};
}

function widthAtU(u){
  const s=BLACK_BASS_R1_CARD.cranialProfile;
  if(u<=s[0][0]) return s[0][1]; if(u>=s.at(-1)[0]) return s.at(-1)[1];
  let i=1; while(s[i][0]<u)i++;
  const a=s[i-1],b=s[i],t=(u-a[0])/(b[0]-a[0]); return lerp(a[1],b[1],t);
}

export function buildOperculumFlapMesh(side,{segments=28}={}){
  const [cy,cu]=BLACK_BASS_R1_CARD.operculum.centerYU;
  const [ry,ru]=BLACK_BASS_R1_CARD.operculum.radiiYU;
  const positions=[],indices=[];
  for(let layer=0;layer<2;layer++){
    for(let i=0;i<=segments;i++){
      const a=Math.PI*i/segments;
      const y=cy+ry*Math.cos(a);
      const uOuter=cu+ru*Math.sin(a);
      const u=uOuter-(layer?0.0105*(0.55+0.45*Math.sin(a)):0);
      const w=widthAtU(u);
      positions.push(side*(w+0.0010-layer*0.00045),y,u);
    }
  }
  const n=segments+1;
  for(let i=0;i<segments;i++){
    const a=i,b=i+1,c=n+i+1,d=n+i;
    if(side<0)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d);
  }
  return {positions,indices};
}

export function buildOperculumEdgeMesh(side){
  const [cy,cu]=BLACK_BASS_R1_CARD.operculum.centerYU;
  const [ry,ru]=BLACK_BASS_R1_CARD.operculum.radiiYU;
  const pts=[];
  for(let i=0;i<=16;i++){
    const a=Math.PI*i/16;
    const y=cy+ry*Math.cos(a),u=cu+ru*Math.sin(a),w=widthAtU(u);
    pts.push([side*(w+0.0038),y,u]);
  }
  return buildCurveTube(pts,0.00055,0.00085,{radialSegments:9});
}

export function buildCommissureMeshes({mouthOpenRad=0}={}){
  const make=side=>{
    const upper=[side*0.061,-0.021,0.812];
    const baseLower=[side*0.061,-0.030,0.812];
    const lower=transformJawPointWeighted(baseLower,mouthOpenRad,0.08);
    const mid=[side*0.064,lerp(upper[1],lower[1],0.52),0.808];
    return buildCurveTube([upper,mid,lower],[0.0022,0.0026,0.0022],[0.0030,0.0034,0.0030],{radialSegments:10});
  };
  return {left:make(-1),right:make(1)};
}

export function buildEyeMeshes() {
  const radii = BLACK_BASS_R1_CARD.eyes.radii;
  return {
    left: buildEllipsoidMesh(BLACK_BASS_R1_CARD.eyes.leftCenter, radii),
    right: buildEllipsoidMesh(BLACK_BASS_R1_CARD.eyes.rightCenter, radii)
  };
}

export function buildBlackBassHeadMouth(options = {}) {
  const mouthOpenRad=options.jaw?.mouthOpenRad??0;
  const cranium = buildCranialMesh(options.cranium ?? {});
  const lowerJaw = buildLowerJawMesh({...options.jaw,mouthOpenRad});
  const mouthCavity = buildMouthCavityMesh({...options.cavity,mouthOpenRad});
  const eyes = buildEyeMeshes();
  const maxillary = buildMaxillaryMeshes();
  const lips = buildLipMeshes({mouthOpenRad});
  const commissure=buildCommissureMeshes({mouthOpenRad});
  return {
    schema: 'kaopu.fish.generated-parts/0.7',
    identity: 'Micropterus_salmoides_FISH_R1_T01',
    sourceMeshRuntimeDependency: false,
    parts: {
      cranium,
      operculumFlapLeft:buildOperculumFlapMesh(-1),
      operculumFlapRight:buildOperculumFlapMesh(1),
      operculumEdgeLeft:buildOperculumEdgeMesh(-1),
      operculumEdgeRight:buildOperculumEdgeMesh(1),
      lowerJaw,
      mouthCavity,
      eyeLeft: eyes.left,
      eyeRight: eyes.right,
      maxillaryLeft: maxillary.left,
      maxillaryRight: maxillary.right,
      upperLip: lips.upper,
      lowerLip: lips.lower,
      commissureLeft:commissure.left,
      commissureRight:commissure.right
    },
    anchors: {
      eyes: [[...BLACK_BASS_R1_CARD.eyes.leftCenter],[...BLACK_BASS_R1_CARD.eyes.rightCenter]],
      jawHinge: [...BLACK_BASS_R1_CARD.jaw.hinge],
      maxillaryRear: [...BLACK_BASS_R1_CARD.maxillary.rearAnchor]
    },
    acceptance: { numeric: true, visual: false, user: false }
  };
}
