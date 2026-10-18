// All lengths are metres in the inherited head-aligned frame. These are authored
// controls for this P01 model, not measurements inferred from the photograph.
export const ZONES=[
 ['hairline','前额发际区','#d79a65'],['fringe','刘海区','#c68686'],
 ['top','顶部区','#beae62'],['crown','头冠旋涡区','#8999bd'],
 ['left-side','左侧发区','#71a99d'],['right-side','右侧发区','#739bc4'],
 ['left-temple','左鬓角 / 耳前','#ad85b6'],['right-temple','右鬓角 / 耳前','#ca8ca6'],
 ['occipital','后枕区','#9ca56c'],['nape','后颈区','#b39371']
];
const regional={hairline:{hem:.312,layer:.008},fringe:{hem:.305,layer:.010},top:{hem:.132,layer:.012},crown:{hem:.122,layer:.010},'left-side':{hem:.139,layer:.010},'right-side':{hem:.144,layer:.011},'left-temple':{hem:.220,layer:.012},'right-temple':{hem:.224,layer:.010},occipital:{hem:.120,layer:.008},nape:{hem:.135,layer:.012}};
const regionalLengths=Object.fromEntries(ZONES.map(([id])=>[id,{minArc:.020,maxArc:({hairline:.22,fringe:.24,top:.44,crown:.44,'left-side':.36,'right-side':.36,'left-temple':.22,'right-temple':.22,occipital:.38,nape:.24})[id]}]));
export const PROFILE={
 schema:'kaopu/hair-style-profile@1',id:'p01-current-structure-r01',name:'当前长度 · 侧分直发结构',revision:'continuous-flow-06',seed:4729,
 ScalpDomain:{source:'approved F02.1 boundary mapped by native triangle and barycentric binding',sourceLock:'F02.1@ee3c7fac9f187dd9e5dc81d1363c4814b9a015a3',policy:'approved-source-only',exclude:['face','forehead','ear','neck'],postProjectionClip:false,boundaryStatus:'restore accepted domain; no extra native-height trim'},
 AnatomicalZoneField:{zones:ZONES.map(([id,label])=>({id,label})),status:'authored segmentation; requires visual review'},
 CandidateRootField:{source:'shared F02 candidate bank',resample:false},
 ActiveRootMask:{mode:'R04 style selection retained during controlled flow edits; density preview never deletes roots',source:'inputs/rest-grooms-r04.json.gz'},
 FollicleDensityField:{interior:.94,hairlineFade:.009,partMinimum:.68},
 RootDirectionField:{mode:'screened tangent graph-Laplacian with comb / dividing / whorl / ear constraints',minimumVectorMagnitude:.25,controls:{partOffset:0,fringeSweep:0,earBias:0}},
 RootLiftField:{interior:.12,hairline:.08},
 PartingCurves:[{id:'side-part',points:[[-.010,.420,.094],[-.008,.432,.050],[.003,.427,.010],[.014,.405,-.025]],width:.009}],
 WhorlField:[{id:'crown-whorl',center:[.014,.405,-.025],clockwise:true,radius:.047,strength:.72,centerDensity:.70,coreRadius:.003}],
 HairlineProfile:{edgeFade:.009,irregularity:.0012,irregularityStatus:'deferred stage two; does not perturb approved boundary',babyHair:{stage:2,enabled:false}},
 RegionalLengthField:{parameter:'physical arc length in metres, separate from spatial cut height',regions:regionalLengths},
 CutField:{mode:'regional hem + authored side sweep + regional layer; no global length multiplier',regions:regional},
 GuideGroom:{samples:97,minPerZone:12,maxPerZone:40,selection:'165 stable R04 root identities; parameter-driven upper-curve editing',editArc:.085,fringeEditArc:.050,highFrequency:false,lowerWidth:.087,lowerDepth:.096},
 ClumpGraph:{levels:['macro','mid','micro'],crossPart:false,crossZone:false,partMembership:'fixed reference material groups during bounded upper comb edits',midDiameter:.045,microDiameter:.026},
 ChildStrandProfile:{stage:2,enabled:false,interpolation:'transported local-frame offsets, never world-position lerp'},
 StrandMaterialField:{stage:2,enabled:false,rootRadius:null,tipRadius:null,lengthVariation:null,melaninVariation:null,roughnessVariation:null,curlRadius:null,curlPitch:null,clumpStrength:null,flyawayProbability:null},
 RestShape:{source:'explicit R04 rest references; continuous upper comb edits, fixed lower outlets and cuts',gravitySolver:false,acceptance:'pending multi-view structure review'},
 PhysicsProfile:{stage:2,enabled:false,requires:'phase-one accepted',arcLengthDriftLimit:.01}
};
export const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),add=(a,b)=>a.map((x,k)=>x+b[k]),sub=(a,b)=>a.map((x,k)=>x-b[k]),mul=(a,s)=>a.map(x=>x*s),mix=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t),unit=a=>mul(a,1/(Math.hypot(...a)||1));
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const project=(v,n)=>sub(v,mul(n,dot(v,n)));
export function zoneAt(p,edge=1){const[x,y,z]=p,a=Math.abs(x);if(z>.084&&edge<.008)return 0;if(z>.078&&y<.390)return 1;if(a>.064&&y<.335&&z>.028)return x<0?6:7;if(z<-.022&&y<.285)return 9;if(y>.386&&z<.012)return 3;if(y>.360&&a<.065)return 2;if(z<-.024)return 8;return x<0?4:5;}
export function partX(z){const c=PROFILE.PartingCurves[0].points;let j=0;while(j<c.length-2&&z<c[j+1][2])j++;const a=c[j],b=c[j+1];return (a[0]+(b[0]-a[0])*clamp((z-a[2])/(b[2]-a[2])))*smooth((z+.060)/.030);}
export function partTangent(z,normal){const c=PROFILE.PartingCurves[0].points;let j=0;while(j<c.length-2&&z<c[j+1][2])j++;return unit(project(sub(c[j+1],c[j]),normal));}
export function partSide(p){const half=PROFILE.PartingCurves[0].width*.5;return 2*smooth((p[0]-partX(p[2])+half)/(2*half))-1;}
export function rootLiftAt(edge){return PROFILE.RootLiftField.hairline+(PROFILE.RootLiftField.interior-PROFILE.RootLiftField.hairline)*smooth(Math.max(0,edge)/PROFILE.HairlineProfile.edgeFade);}
export function liftedDirection(vector,normal,edge){return unit(add(mul(vector,1/Math.max(PROFILE.RootDirectionField.minimumVectorMagnitude,Math.hypot(...vector))),mul(normal,rootLiftAt(edge))));}
export function flowAt(p,n,zone,{whorl=true,ear=true}={}){
 const[x,y,z]=p,side=partSide(p),width=PROFILE.PartingCurves[0].width,front=smooth((z-.020)/.070),isFringe=zone===0||zone===1;
 let comb=isFringe?[-.65+(PROFILE.RootDirectionField.controls?.fringeSweep||0),-.55,.30]:[side*(.30+.65*front),-.28-(1-front)*.20,-.55*(1-front)-.08];
 // Separate direction boundary: neither the roots nor their support move.
 const part=smooth((y-.365)/.035)*smooth((z+.045)/.030)*(1-smooth((Math.abs(x-partX(z))-width*.9)/(width*3.333333333333)));
 if(!isFringe){const along=partTangent(z,n);let lateral=unit(cross(n,along));if(lateral[0]<0)lateral=mul(lateral,-1);comb=mix(comb,add(mul(lateral,side),mul(along,.45)),part*.85);}
 if(whorl){const w=PROFILE.WhorlField[0],dx=x-w.center[0],dz=z-w.center[2],r=Math.hypot(dx,dz),weight=(1-smooth(r/w.radius))*smooth((y-.36)/.030)*w.strength;
 // Radial escape keeps the rotational singularity confined to its tiny core.
 const spin=unit([dx*.8+dz*(w.clockwise?1:-1),-.08,dz*.8-dx*(w.clockwise?1:-1)]);comb=mix(unit(comb),spin,weight);}
 if(ear){const a=Math.abs(x),envelope=smooth((a-.050)/.022)*(1-smooth((y-.332)/.028))*(1-smooth(Math.abs(z-.025)/.052));if(envelope>0){const behind=(PROFILE.RootDirectionField.controls?.earBias||0)>0&&zone>1&&zone!==6&&zone!==7;const route=!behind&&(zone===6||zone===7||z>.040)?[side*.35,-.85,.55]:[side*.25,-.8,-.65];comb=mix(unit(comb),unit(route),envelope*.85);}}
 let tangent=unit(project(comb,n));if(Math.hypot(...tangent)<.1)tangent=unit(project([side,0,-.3],n));return tangent;
}
export function densityAt(p,edge){const f=PROFILE.FollicleDensityField,part=(1-smooth(Math.abs(p[0]-partX(p[2]))/(PROFILE.PartingCurves[0].width*.777777777778)))*smooth((p[1]-.365)/.030)*smooth((p[2]+.04)/.03),w=PROFILE.WhorlField[0],r=Math.hypot(p[0]-w.center[0],p[2]-w.center[2]);return f.interior*smooth((edge+.0005)/f.hairlineFade)*(1-part*(1-f.partMinimum))*(1-(1-w.centerDensity)*(1-smooth(r/w.coreRadius)));}
export function cutAt(root,zone,seed){const field=PROFILE.CutField.regions[ZONES[zone][0]],asym=(zone===0||zone===1)?.020*Math.max(-1,Math.min(1,root[0]/.07)):0;return Math.min(root[1]-.022,field.hem+field.layer*(smooth((root[1]-.29)/.13)-.5)+.0008*(seed-.5)+asym);}
