// Dedicated two-passage streamlined exhaust mother, rebuilt from structural
// observations with scalar design inputs. No teacher vertices or textures.
// SI native frame: X forward, Y left, Z up. Shape and appearance share these
// same passage, lip, thickness and heat/soot domains.
export const EXHAUST_DESIGN=Object.freeze({
 lengthM:1.27,widthM:.64,passageCentreSpacingM:.50,passageRadiusM:.225,
 wallM:.016,ductBottomZM:-.69,ductTopRearZM:.18,ductTopFrontZM:.23,
 fairingBottomRearZM:.02,fairingBottomFrontZM:-.44,lipM:.018,
 mountingFlangeM:.025,sideRibCount:14,
 status:'Observed two-passage topology and approximately 2:1 fairing ratio; authored 88 SI fit. Flow, temperature and structural strength not certified.'
});
export function validateExhaust(p){
 for(const[k,v]of Object.entries(p))if(typeof v==='number'&&!Number.isFinite(v))throw Error('NONFINITE_EXHAUST_PARAMETER:'+k);
 if(p.lengthM<=p.widthM||p.widthM<=2*(p.passageRadiusM+p.wallM)||p.passageCentreSpacingM<=2*p.passageRadiusM||p.passageCentreSpacingM+2*(p.passageRadiusM+p.wallM)>=p.lengthM)throw Error('EXHAUST_PASSAGES_OR_OUTER_WALL_OVERLAP');
 if(p.wallM<=0||p.lipM<=0||p.ductBottomZM>=Math.min(p.fairingBottomRearZM,p.fairingBottomFrontZM)||p.fairingBottomRearZM>=p.ductTopRearZM||p.fairingBottomFrontZM>=p.ductTopFrontZM)throw Error('INVALID_EXHAUST_VERTICAL_DOMAINS');
 if(!Number.isInteger(p.sideRibCount)||p.sideRibCount<0||p.sideRibCount>64)throw Error('INVALID_EXHAUST_RIB_COUNT');return true;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function exhaustDomain(p,x,y,z,role=null){
 const centres=[-p.passageCentreSpacingM/2,p.passageCentreSpacingM/2],radial=centres.map(c=>Math.hypot(x-c,y)),wallDistance=Math.min(...radial.map(r=>Math.abs(r-p.passageRadiusM))),atMouth=smooth(-.08,.15,z),inside=Math.min(...radial)<p.passageRadiusM+p.wallM;
 const soot=Math.max((role==='inner'||(role===null&&inside))?.84:0,Math.exp(-wallDistance/.065)*atMouth*.85),heatBand=Math.exp(-wallDistance/.12)*smooth(-.35,.1,z),lipHeight=p.ductTopRearZM+(p.ductTopFrontZM-p.ductTopRearZM)*Math.max(0,Math.min(1,x/p.lengthM+.5));
 return {passage:radial[0]<radial[1]?0:1,wallDistanceM:wallDistance,soot,heatBand,oxideCoverage:.30+heatBand*.30,lipWear:Math.exp(-Math.abs(z-lipHeight)/.012)*(1-soot*.65)};
}
// Independent smooth value noise, never baked into sparse mesh vertices.
const MICROFINISH_GLSL=`
float finishHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float finishNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(finishHash(i),finishHash(i+vec3(1,0,0)),f.x),mix(finishHash(i+vec3(0,1,0)),finishHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(finishHash(i+vec3(0,0,1)),finishHash(i+vec3(1,0,1)),f.x),mix(finishHash(i+vec3(0,1,1)),finishHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float filteredFinish(vec3 nativeM){vec3 q=nativeM*165.;float footprint=max(length(dFdx(q)),length(dFdy(q)));return(finishNoise(q)-.5)*(1.-smoothstep(.35,1.2,footprint));}
`;
function material(T,p,role){
 // Conductive metal remains only where the oxide/soot layer is absent or worn.
 const steel=new T.MeshStandardMaterial({color:new T.Color(...(role==='inner'?[.027,.030,.030]:[.055,.063,.062])),metalness:.82,roughness:.43,side:T.DoubleSide});steel.name='exhaust mother / '+role+' / metal-oxide-soot-domain';
 steel.userData={mother:'twin-exhaust-fairing',role,shapeAndMaterialShareDomain:true,heatAndSootAreAuthoredAppearanceNotSolvedTemperature:true,domainParameters:p,appearanceRevision:'native-coating-r04',parameterStatus:'Authored candidates; not calibrated measurements',fineFinish:'fragment footprint filtered; no vertex micrograin'};
 steel.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vExhaustDomain;').replace('#include <begin_vertex>','#include <begin_vertex>\nvExhaustDomain=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vExhaustDomain;\n'+MICROFINISH_GLSL);
  const code=`vec3 ep=vExhaustDomain;float er0=length(ep.xy-vec2(${-p.passageCentreSpacingM/2},0.));float er1=length(ep.xy-vec2(${p.passageCentreSpacingM/2},0.));float ew=min(abs(er0-${p.passageRadiusM}),abs(er1-${p.passageRadiusM}));float soot=max(${role==='inner'?'.84':'.0'},exp(-ew/.065)*smoothstep(-.08,.15,ep.z)*.85);float heat=exp(-ew/.12)*smoothstep(-.35,.1,ep.z);float lipHeight=mix(${p.ductTopRearZM},${p.ductTopFrontZM},clamp(ep.x/${p.lengthM}+.5,0.,1.));float lipWear=exp(-abs(ep.z-lipHeight)/.012)*(1.-soot*.65);float grain=filteredFinish(ep);float oxide=.30+heat*.30;`;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code+'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.046,.037,.028),oxide*.38);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.010,.012,.013),soot*.89);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.20,.22,.21),lipWear*.22);');
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+soot*.39+oxide*.12-lipWear*.10+grain*.026,.20,.96);');
  s.fragmentShader=s.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=clamp(metalnessFactor*(1.-soot*.97)*(1.-oxide*.70)+lipWear*.12,0.,.90);');
 };
 steel.customProgramCacheKey=()=>JSON.stringify(['fh88-exhaust-coating-r04',role,p]);return steel;
}
function capsulePath(T,length,width,offset=0){const r=width/2+offset,h=(length-width)/2;const s=new T.Shape();s.moveTo(-h,-r);s.lineTo(h,-r);s.absarc(h,0,r,-Math.PI/2,Math.PI/2,false);s.lineTo(-h,r);s.absarc(-h,0,r,Math.PI/2,3*Math.PI/2,false);s.closePath();return s;}
function hole(T,c,r){const h=new T.Path();h.absarc(c,0,r,0,Math.PI*2,true);return h;}
function finishGeometry(T,positions,indices){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();return g;}
export function createExhaustMother(T,overrides={}){
 const p={...EXHAUST_DESIGN,...overrides};validateExhaust(p);const root=new T.Group();root.name='88 双通道流线排汽母函数';const parts=[],outer=material(T,p,'fairing'),inner=material(T,p,'inner');
 const top=x=>p.ductTopRearZM+(p.ductTopFrontZM-p.ductTopRearZM)*Math.max(0,Math.min(1,x/p.lengthM+.5));
 const bottom=(x,y=0)=>typeof overrides.mountSurfaceZM==='function'?overrides.mountSurfaceZM(x,y):p.fairingBottomRearZM+(p.fairingBottomFrontZM-p.fairingBottomRearZM)*smooth(-p.lengthM*.30,p.lengthM*.30,x);
 function add(g,mat,name,meaning){const a=g.attributes.position,oldIndex=g.index,keep=[],A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();let removed=0;for(let i=0;i<(oldIndex?oldIndex.count:a.count);i+=3){const ids=[0,1,2].map(j=>oldIndex?oldIndex.getX(i+j):i+j);A.fromBufferAttribute(a,ids[0]);B.fromBufferAttribute(a,ids[1]).sub(A);C.fromBufferAttribute(a,ids[2]).sub(A);if(B.cross(C).lengthSq()>1e-20)keep.push(...ids);else removed++;}g.setIndex(keep);g.computeVertexNormals();g.userData.removedZeroAreaFaces=removed;const m=new T.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;m.userData={mother:'twin-exhaust-fairing',functionRole:meaning,materialDomain:'same-native-xyz'};root.add(m);parts.push(m);return m}
 const outline=capsulePath(T,p.lengthM,p.widthM).getPoints(48);if(outline[0].distanceTo(outline.at(-1))<1e-9)outline.pop();const n=outline.length,pos=[],idx=[];
 for(let layer=0;layer<2;layer++)for(const v of outline)pos.push(v.x,v.y,layer?top(v.x):bottom(v.x,v.y));
 for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(i,j,n+j,i,n+j,n+i)}add(finishGeometry(T,pos,idx),outer,'variable-height streamlined outer fairing','streamlined outer shell with independently controlled fore/aft underside');
 // Top plate has two real holes; passages are not capped cylinders.
 const topShape=capsulePath(T,p.lengthM,p.widthM);for(const c of[-p.passageCentreSpacingM/2,p.passageCentreSpacingM/2])topShape.holes.push(hole(T,c,p.passageRadiusM));
 const cap=new T.ShapeGeometry(topShape,48);for(let i=0;i<cap.attributes.position.count;i++)cap.attributes.position.setZ(i,top(cap.attributes.position.getX(i)));cap.computeVertexNormals();add(cap,outer,'two-aperture sloping mouth deck','perforated top deck, two open flow ports');
 const N=96;
 for(const[cIndex,c]of[-p.passageCentreSpacingM/2,p.passageCentreSpacingM/2].entries()){
  for(const[side,r]of[['inner',p.passageRadiusM],['outer',p.passageRadiusM+p.wallM]]){const pp=[],ii=[];for(let level=0;level<2;level++)for(let i=0;i<N;i++){const a=i/N*Math.PI*2,x=c+r*Math.cos(a),y=r*Math.sin(a);pp.push(x,y,level?top(x):p.ductBottomZM)}for(let i=0;i<N;i++){const j=(i+1)%N;if(side==='inner')ii.push(i,N+j,j,i,N+i,N+j);else ii.push(i,j,N+j,i,N+j,N+i)}add(finishGeometry(T,pp,ii),side==='inner'?inner:outer,`passage ${cIndex+1} ${side} wall`,'continuous duct wall, open at both ends');}
  for(const[which,z]of[['bottom',p.ductBottomZM],['mouth',null]]){const ring=new T.Shape();ring.absarc(c,0,p.passageRadiusM+p.wallM,0,Math.PI*2,false);ring.holes.push(hole(T,c,p.passageRadiusM));const g=new T.ShapeGeometry(ring,48);for(let i=0;i<g.attributes.position.count;i++)g.attributes.position.setZ(i,z??top(g.attributes.position.getX(i)));g.computeVertexNormals();add(g,outer,`passage ${cIndex+1} ${which} wall return`,'annular return keeps inner port open');}
 }
 // Rolled lower perimeter lip follows the same lower boundary as the shell.
 const lp=[],li=[];for(let band=0;band<4;band++)for(const v of outline){const d=band===1||band===2?p.mountingFlangeM:0,h=(p.lengthM-p.widthM)/2,cx=Math.max(-h,Math.min(h,v.x)),nx=v.x-cx,ny=v.y,q=Math.hypot(nx,ny);lp.push(v.x+d*nx/q,v.y+d*ny/q,bottom(v.x+d*nx/q,v.y+d*ny/q)+(band>=2?p.lipM:0));}for(let band=0;band<4;band++)for(let i=0;i<n;i++){const j=(i+1)%n,a=band*n+i,b=band*n+j,c=((band+1)%4)*n+i,d=((band+1)%4)*n+j;li.push(a,b,d,a,d,c)}add(finishGeometry(T,lp,li),outer,'rolled lower fairing seam and mounting lip','continuous mounting boundary, not a painted seam');
 // Narrow rear cheek ribs are physical bands, following the tapered underside.
 for(const side of[-1,1])for(let i=0;i<p.sideRibCount;i++){const x=-p.lengthM*.36+i/(Math.max(1,p.sideRibCount-1))*p.lengthM*.28;const h=(p.lengthM-p.widthM)/2,dx=x-Math.max(-h,Math.min(h,x)),yb=Math.sqrt((p.widthM/2)**2-dx*dx),slope=dx?side*(-dx/yb):0,z0=bottom(x,side*yb)+p.lipM,z1=top(x)-p.lipM;if(z1-z0<.035)continue;const g=new T.BoxGeometry(.008,.009,z1-z0);g.rotateZ(Math.atan(slope));g.translate(x,side*(yb+.002),(z0+z1)/2);add(g,outer,'rear cheek formed rib '+side+'/'+i,'physical fairing stiffening/beading observation, spacing authored');}
 root.userData={mother:'twin-exhaust-fairing',parameters:p,sourceBuffersUsed:false,sourceTexturesUsed:false,sourceSampledAnimationUsed:false,openPassageCount:2,flowCertified:false,temperatureSolved:false,meshIsTransientRenderOutput:true,ports:[-p.passageCentreSpacingM/2,p.passageCentreSpacingM/2].map((x,i)=>({id:'exhaust-'+i,positionM:[x,0,top(x)],direction:[0,0,1],radiusM:p.passageRadiusM}))};
 return {root,parts,parameters:p,ports:root.userData.ports,domain:(x,y,z)=>exhaustDomain(p,x,y,z),coverageStatus:'isolated-native-candidate-not-approved'};
}
