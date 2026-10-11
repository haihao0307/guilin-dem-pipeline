import {makeSpline} from '../eye-transfer/EyelidKnowledge.mjs';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const at=(P,i)=>[P[i*3],P[i*3+1],P[i*3+2]];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const unit=a=>{const n=Math.hypot(...a);if(n<1e-10)throw Error('Degenerate eyelid frame');return a.map(v=>v/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const LID_SCHEMA='kaopu/periocular-geometry@1';
export const LID_DEFAULTS=Object.freeze({enabled:true,upperRollMM:.32,lowerRollMM:.44,marginBlendMM:1.65,cornerRegularity:.8,arcWrap:1,leftBlink:0,rightBlink:0});
export function validateLids(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid periocular parameters');
 const s={...LID_DEFAULTS,...input},ranges={upperRollMM:[.1,.7],lowerRollMM:[.1,.8],marginBlendMM:[.8,2.4],cornerRegularity:[0,1],arcWrap:[0,1],leftBlink:[0,1],rightBlink:[0,1]};
 for(const k of Object.keys(s)){if(!(k in LID_DEFAULTS))throw Error('Unknown eyelid control '+k);if(k==='enabled'){if(typeof s[k]!=='boolean')throw Error('Invalid eyelid switch');}else if(!Number.isFinite(s[k])||s[k]<ranges[k][0]||s[k]>ranges[k][1])throw Error('Invalid eyelid range '+k);}
 return s;
}
function eyeFrame(model,P,side){
 const L=i=>model.faceSurface.fields.landmark(P,i),ids=side==='right'?[39,38,37,36,40,41]:[42,43,44,45,47,46];
 const O=L(ids[0]),X=unit(sub(L(ids[3]),O)),width=Math.hypot(...sub(L(ids[3]),O));let Y=sub(L(27),L(8));Y=unit(Y.map((v,k)=>v-X[k]*dot(Y,X)));let Z=unit(cross(X,Y));if(dot(Z,sub(L(30),O))<0)Z=Z.map(v=>-v);
 const project=p=>{const q=sub(p,O);return[dot(q,X),dot(q,Y),dot(q,Z)];},unproject=q=>O.map((v,k)=>v+q[0]*X[k]+q[1]*Y[k]+q[2]*Z[k]);
 const curve=ids=>{const pts=ids.map(i=>project(L(i)));return makeSpline([[0,pts[0][1]],[clamp(pts[1][0]/width,.10,.48),pts[1][1]],[clamp(pts[2][0]/width,.52,.90),pts[2][1]],[1,pts[3][1]]]);};
 return{O,X,Y,Z,width,project,unproject,upper:curve([ids[0],ids[1],ids[2],ids[3]]),lower:curve([ids[0],ids[4],ids[5],ids[3]])};
}
function supportField(vertices,triangles){
 const pts=[...vertices.values()],lo=[0,1].map(k=>Math.min(...pts.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...pts.map(p=>p[k]))),N=24,dx=(hi[0]-lo[0])/N,dy=(hi[1]-lo[1])/N;
 const cells=Array.from({length:N*N},()=>[]),cell=(x,y)=>[clamp(Math.floor((x-lo[0])/dx),0,N-1),clamp(Math.floor((y-lo[1])/dy),0,N-1)];
 for(const ids of triangles){const t=ids.map(i=>vertices.get(i)),a=cell(Math.min(...t.map(p=>p[0])),Math.min(...t.map(p=>p[1]))),b=cell(Math.max(...t.map(p=>p[0])),Math.max(...t.map(p=>p[1])));for(let j=a[1];j<=b[1];j++)for(let i=a[0];i<=b[0];i++)cells[j*N+i].push(t);}
 return (x,y)=>{if(x<lo[0]||x>hi[0]||y<lo[1]||y>hi[1])return null;const c=cell(x,y);let z=-Infinity;for(const[a,b,c0]of cells[c[1]*N+c[0]]){const d=(b[1]-c0[1])*(a[0]-c0[0])+(c0[0]-b[0])*(a[1]-c0[1]);if(Math.abs(d)<1e-14)continue;const u=((b[1]-c0[1])*(x-c0[0])+(c0[0]-b[0])*(y-c0[1]))/d,v=((c0[1]-a[1])*(x-c0[0])+(a[0]-c0[0])*(y-c0[1]))/d,w=1-u-v;if(Math.min(u,v,w)>=-1e-7)z=Math.max(z,u*a[2]+v*b[2]+w*c0[2]);}return Number.isFinite(z)?z:null;};
}
function fitCenter(points){
 const A=Array.from({length:4},()=>Array(5).fill(0));
 for(const p of points){const a=[2*p[0],2*p[1],2*p[2],1],b=dot(p,p);for(let i=0;i<4;i++){for(let j=0;j<4;j++)A[i][j]+=a[i]*a[j];A[i][4]+=a[i]*b;}}
 for(let i=0;i<4;i++){let j=i;for(let k=i+1;k<4;k++)if(Math.abs(A[k][i])>Math.abs(A[j][i]))j=k;[A[i],A[j]]=[A[j],A[i]];const d=A[i][i];if(Math.abs(d)<1e-16)throw Error('Eye center fit is singular');for(let k=i;k<5;k++)A[i][k]/=d;for(let j=0;j<4;j++)if(j!==i){const d=A[j][i];for(let k=i;k<5;k++)A[j][k]-=d*A[i][k];}}
 return[A[0][4],A[1][4],A[2][4]];
}
function measuredMargins(frame,local,eye,skinFaces,support){
 const delta=new Map(),segments=[];
 for(const[i,q]of local){const h=support(q[0],q[1]);if(h!==null&&Math.abs(q[2]-h)<.015)delta.set(i,q[2]-h);}
 for(const ids of skinFaces){if(!ids.every(i=>delta.has(i)))continue;const cuts=[];for(let k=0;k<3;k++){const j=(k+1)%3,a=ids[k],b=ids[j],d=delta.get(a),e=delta.get(b);if((d>=0)===(e>=0))continue;const t=d/(d-e);cuts.push(local.get(a).map((v,k)=>v*(1-t)+local.get(b)[k]*t));}if(cuts.length===2)segments.push(cuts);}
 const knots=[0,.07,.16,.28,.40,.53,.66,.78,.90,.96,1],U=[],D=[];
 for(const s of knots){const x=s*frame.width,ys=[];for(const[a,b]of segments){if((a[0]<=x&&b[0]>=x)||(b[0]<=x&&a[0]>=x)){const d=b[0]-a[0];if(Math.abs(d)>1e-10){const t=(x-a[0])/d;ys.push(a[1]*(1-t)+b[1]*t);}}}let upper=frame.upper(s),lower=frame.lower(s);const near=ys.filter(y=>y<upper+.004&&y>lower-.004);if(near.length>=2){upper=Math.max(...near);lower=Math.min(...near);}if(s===0||s===1)upper=lower=(frame.upper(s)+frame.lower(s))*.5;U.push([s,upper]);D.push([s,lower]);}
 return{upper:makeSpline(U),lower:makeSpline(D),segments:segments.length,knots:{upper:U,lower:D}};
}
/** Correct the same native skin. No second head, hidden eye or scaled globe.
 * A closed-contour guide is derived from the existing person's native pose;
 * the path and rim section are then corrected against the actual ocular mesh.
 * This is an engineering approximation, not captured tissue biomechanics.
 */
export function installPeriocularGeometry(model){
 if(model.periocular)return model.periocular;
 const previous=model.compute.bind(model),archive=model.archive.bind(model),restore=model.restore.bind(model),P=model.positions,B=model.bodyCount,skin=model.eyeSurface.skin;
 const skinFaces=[];for(let k=0;k<model.faces.length;k+=3){const t=Array.from(model.faces.slice(k,k+3));if(t.every(i=>skin[i]))skinFaces.push(t);}
 const binding=model.eyeSurface.eyes.map(e=>{const F=eyeFrame(model,model.eyeSurface.rest,e.side),nodes=[];for(let i=B;i<model.vertexCount;i++){if(!skin[i])continue;const q=F.project(at(model.eyeSurface.rest,i)),s=q[0]/F.width;if(s>-.15&&s<1.15&&q[1]>-.016&&q[1]<.024&&Math.abs(q[2])<.020)nodes.push(i);}return{eye:e,nodes};});
 const api={schema:LID_SCHEMA,settings:{...LID_DEFAULTS},before:P.slice(),open:null,openSignature:'',builds:0,report:null};
 function neutralState(s){const q=structuredClone(s);if(q.owners.expression==='anny'){q.anny.facialActions.eyeBlinkLeft=0;q.anny.facialActions.eyeBlinkRight=0;}return q;}
 function buildOpen(input){
  const s=neutralState(input),signature=JSON.stringify([s,model.eyeSurface.settings,model.faceSurface.settings,model.identityLab?.shape]);if(signature===api.openSignature)return;
  previous(s);const open=P.slice();const shut=structuredClone(s);shut.owners.expression='anny';shut.anny.facialActions.eyeBlinkLeft=shut.anny.facialActions.eyeBlinkRight=1;previous(shut);const closed=P.slice();
  const profiles=binding.map(({eye,nodes})=>{
   const frame=eyeFrame(model,open,eye.side),local=new Map(nodes.map(i=>[i,frame.project(at(open,i))])),ocular=new Map(eye.vertices.map(i=>[i,frame.project(at(open,i))])),support=supportField(ocular,eye.triangles),sclera=eye.vertices.filter(i=>model.faceSurface.fields.legacy.types[i]===4).map(i=>ocular.get(i)),center=fitCenter(sclera),margin=measuredMargins(frame,local,eye,skinFaces,support);
   const ids=eye.side==='right'?[39,38,37,36,40,41]:[42,43,44,45,47,46],L=i=>frame.project(model.faceSurface.fields.landmark(closed,i));
   const curve=ids=>{const p=ids.map(L);return makeSpline([[0,p[0][1]],[clamp(p[1][0]/frame.width,.10,.48),p[1][1]],[clamp(p[2][0]/frame.width,.52,.90),p[2][1]],[1,p[3][1]]]);};
   const closedUpper=curve([ids[0],ids[1],ids[2],ids[3]]),closedLower=curve([ids[0],ids[4],ids[5],ids[3]]),seal=u=>(closedUpper(u)+closedLower(u))*.5;
   return{eye,nodes,frame,local,support,center,margin,seal};
  });api.open={positions:open,profiles};api.openSignature=signature;api.builds++;
 }
 function apply(input){
  const s=api.settings;api.before.set(P);if(!s.enabled){api.report={version:'ET17-P1',enabled:false,changedVertices:0};return P;}
  let changed=0,maxMM=0;const rows=[];
  for(const pr of api.open.profiles){const{eye,nodes,frame:F,local,support,center:C,margin}=pr,scale=clamp(F.width/.026,.45,1.8),automatic=input.owners.expression==='anny'?(input.anny.facialActions[eye.side==='left'?'eyeBlinkLeft':'eyeBlinkRight']||0):0,blink=clamp(Math.max(automatic,s[eye.side+'Blink']),0,1)*s.arcWrap;
   let edited=0,contact=0,radialError=0;
   for(const i of nodes){const q=local.get(i),u=q[0]/F.width;if(u<0||u>1)continue;const top=margin.upper(u),bottom=margin.lower(u),mid=(top+bottom)*.5,upper=q[1]>=mid,edge=upper?top:bottom,d=upper?q[1]-edge:edge-q[1];if(d<-.0025*scale||d>.016*scale)continue;
    const h=support(q[0],q[1]);if(h===null||q[2]<h-.0032*scale)continue;let out=q.slice();
    const roll=(upper?s.upperRollMM:s.lowerRollMM)*.001*scale,band=s.marginBlendMM*.001*scale,corner=1+(.25*s.cornerRegularity)*(1-smooth(.02,.20,u)),influence=Math.exp(-Math.pow(Math.abs(d)/band,4))*s.cornerRegularity;
    const target=h+roll*Math.tanh(d/(.00040*scale))*corner;out[2]+=clamp(target-out[2],-.0012*scale,.0013*scale)*influence;
    if(blink>.00001){const seal=pr.seal(u),eh=support(q[0],edge),sh=support(q[0],seal);if(eh!==null&&sh!==null){const alpha0=Math.atan2(edge-C[1],eh-C[2]),alpha1=Math.atan2(seal-C[1],sh-C[2]),w=1-smooth(.0018*scale,.012*scale,Math.max(d,0)),angle=(alpha1-alpha0)*blink*w,dy=out[1]-C[1],dz=out[2]-C[2],radius=Math.hypot(dy,dz);out[1]=C[1]+Math.sin(angle)*dz+Math.cos(angle)*dy;out[2]=C[2]+Math.cos(angle)*dz-Math.sin(angle)*dy;radialError=Math.max(radialError,Math.abs(Math.hypot(out[1]-C[1],out[2]-C[2])-radius));}}
    const hs=support(out[0],out[1]);if(hs!==null&&blink>.72&&d>-.00045*scale&&d<.0013*scale)out[2]+=Math.max(0,hs+.00020*scale-out[2])*smooth(.72,1,blink);
    if(hs!==null&&d>.00013*scale&&d<.010*scale&&q[2]>h-.00025*scale){out[2]=Math.max(out[2],hs+.00004*scale);contact++;}
    const gate=smooth(.015,.22,u)*(1-smooth(.78,.985,u))*(1-smooth(.010*scale,.016*scale,Math.max(d,0))),base=F.project(at(api.before,i));out=out.map((v,k)=>base[k]+(v-base[k])*gate);
    const envelope=support(out[0],out[1]);if(envelope!==null&&blink>.8&&d>-.0007*scale&&d<.0016*scale)out[2]+=Math.max(0,envelope+.00020*scale-out[2])*smooth(.8,1,blink)*gate;
    const v=F.unproject(out),delta=Math.hypot(...sub(v,at(api.before,i)));if(delta>1e-9){P.set(v,i*3);edited++;}
   }
   // Compact depth fairing, anchored to the same native canthus tissue.
   // Exterior vertices cannot be pushed back through the measured globe.
   const cornerNodes=[],Z=new Map(),Z0=new Map();
   for(const i of nodes){const q=F.project(at(P,i)),orig=local.get(i),nasal=Math.hypot(orig[0],orig[1]),temporal=Math.hypot(orig[0]-F.width,orig[1]),r=Math.min(nasal,temporal),w=(1-smooth(.0006*scale,.0032*scale,r))*s.cornerRegularity;
    if(w<.001||Math.abs(q[2])>.025)continue;const ns=[...model.faceSurface.fields.adjacency[i]].filter(j=>skin[j]);if(!ns.length)continue;const h=support(q[0],q[1]);cornerNodes.push({i,ns,w,floor:h===null?q[2]-.00030*scale:Math.min(q[2],h+.000045*scale)});Z0.set(i,q[2]);Z.set(i,q[2]);
   }
   for(let iteration=0;iteration<6;iteration++){const next=new Map(Z);for(const n of cornerNodes){let sum=0,den=0;const q=at(P,n.i);for(const j of n.ns){const p=at(P,j),w=1/Math.max(.00025*scale,Math.hypot(...sub(p,q)));sum+=(Z.has(j)?Z.get(j):F.project(p)[2])*w;den+=w;}next.set(n.i,clamp(Z.get(n.i)+.35*n.w*(sum/den-Z.get(n.i)),Math.max(n.floor,Z0.get(n.i)-.00030*scale),Z0.get(n.i)+.00035*scale));}for(const[i,z]of next)Z.set(i,z);}
   for(const n of cornerNodes){const q=F.project(at(P,n.i));q[2]=Z.get(n.i);P.set(F.unproject(q),n.i*3);}
   rows.push({side:eye.side,blink,cornerVertices:cornerNodes.length,affectedVerticesBeforeCornerFairing:edited,fittedEyeCenter:C,contourSegments:margin.segments,exteriorContactConstraints:contact,arcRadialErrorMM:radialError*1000,openWidthMM:F.width*1000,closureGuide:'same native person closed-pose landmark midcurve'});
  }
  for(let i=B;i<model.vertexCount;i++)if(skin[i]){const d=Math.hypot(...sub(at(P,i),at(api.before,i)));if(d>1e-9){changed++;maxMM=Math.max(maxMM,d*1000);}}
  if(!P.every(Number.isFinite))throw Error('Nonfinite periocular correction');
  api.report={version:'ET17-P1',enabled:true,changedVertices:changed,maxDisplacementMM:maxMM,openFits:api.builds,eyes:rows,nativeTopologyChanged:false,bodyVerticesChanged:0,eyeballVerticesChanged:0,method:'signed rim sections + measured-globe arc wrapping + native-person seal contour + bounded canthus depth fairing; engineering approximation, not captured dynamics'};return P;
 }
 model.compute=input=>{const old=P.slice(),oldState=model.state;try{const s=input||model.state;if(api.settings.enabled)buildOpen(s);previous(s);return apply(s);}catch(e){P.set(old);model.state=oldState;throw e;}};
 model.archive=()=>({...archive(),periocular:{schema:LID_SCHEMA,topology:model.canonical.topologySha256,settings:{...api.settings}}});
 model.restore=o=>{const extra=o?.periocular;if(extra&&(extra.schema!==LID_SCHEMA||extra.topology!==model.canonical.topologySha256))throw Error('Incompatible periocular archive');const next=validateLids(extra?.settings||{}),old=api.settings;try{api.settings=next;return restore(o);}catch(e){api.settings=old;throw e;}};
 api.set=patch=>{const s=validateLids({...api.settings,...patch}),old=api.settings;try{api.settings=s;return model.compute(model.state);}catch(e){api.settings=old;throw e;}};
 api.dispose=()=>{api.open=null;api.before=null;};model.periocular=api;model.compute(model.state);return api;
}
