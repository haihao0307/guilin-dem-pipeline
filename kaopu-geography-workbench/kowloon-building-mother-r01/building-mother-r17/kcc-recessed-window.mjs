import {deriveAperture} from './kowloon-building-mother-r01/r07/apertures.mjs';

/** Authored fixed-window construction candidates. None is a measured KCC detail.
 * The source is a zero-thickness shell. This local reveal collar is NOT evidence
 * that the entire source wall has this thickness or construction. */
export const KCC_RECESSED_WINDOW_DEFAULTS=Object.freeze({
 wallThickness:.26,frameCenterRecess:.08,frameDepth:.12,frameWidth:.045,
 leafThickness:.035,sashWidth:.035,glassThickness:.006,mountGap:.004,
 revealRimWidth:.035,sillThickness:.06,sillProjection:.08,maskInset:.012,
});
const clone=x=>structuredClone(x),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const boundsOf=parts=>({min:[0,1,2].map(i=>Math.min(...parts.map(p=>p.bounds.min[i]))),max:[0,1,2].map(i=>Math.max(...parts.map(p=>p.bounds.max[i])))});

export function kccRecessedWindowParameters(input={}){
 const p={...KCC_RECESSED_WINDOW_DEFAULTS,...input};
 for(const k of Object.keys(KCC_RECESSED_WINDOW_DEFAULTS))if(!Number.isFinite(p[k])||p[k]<=0)throw Error('Positive finite KCC design parameter required: '+k);
 if(p.wallThickness>.6||p.frameCenterRecess>.3||p.sillProjection>.3||p.sillThickness>.2)throw Error('KCC recess dimensions exceed the audited design domain');
 if(p.frameCenterRecess<=p.frameDepth/2)throw Error('Fixed frame must be wholly recessed behind the source plane');
 const inwardLeafBack=p.frameCenterRecess+Math.max(p.wallThickness,p.frameDepth)/2+p.mountGap+p.leafThickness;
 if(inwardLeafBack>p.wallThickness+1e-9||p.frameCenterRecess+p.frameDepth/2>p.wallThickness+1e-9)throw Error('Frame and fixed sash must fit within the candidate wall thickness');
 if(p.revealRimWidth>p.frameWidth||p.maskInset/2>=p.revealRimWidth)throw Error('Reveal may not narrow the clear frame opening; source mask must overlap the reveal');
 if(p.glassThickness>p.leafThickness)throw Error('Glass must fit the fixed sash');
 return p;
}

/** Reuse R07 analytic rounded-rectangle extrusions only, with no mesh or new
 * renderer primitive. R07 puts the fixed sash on host.w. Orient this assembly
 * inward so both sash and glass sit behind the outer frame, inside the opening.
 * A second R07 frame supplies a hollow four-sided reveal. A door-leaf recipe
 * supplies the solid sill below the opening; unused recipe parts are discarded. */
export function deriveKccRecessedWindow({instanceId,width,height,sourceFrame,nodeId,revealId=nodeId+':reveal',sillId=nodeId+':sill',parameters={}}={}){
 const p=kccRecessedWindowParameters(parameters),f=clone(sourceFrame);
 if(!f||!f.origin||!f.u||!f.v||!f.w)throw Error('Explicit outer source-wall frame required');
 if(p.revealRimWidth*2>=Math.min(width,height)||p.maskInset>=Math.min(width,height))throw Error('Reveal or mask consumes the opening');
 const inwardHost={...f,origin:add(f.origin,mul(f.w,-p.frameCenterRecess)),u:mul(f.u,-1),w:mul(f.w,-1),nodeId,emitWall:false};
 const aperture=deriveAperture({instanceId,kind:'window',width,height,frameWidth:p.frameWidth,frameDepth:p.frameDepth,wallThickness:p.wallThickness,leafThickness:p.leafThickness,sashWidth:p.sashWidth,glassThickness:p.glassThickness,mountGap:p.mountGap,hingeOrSlider:'fixed',openT:0,host:inwardHost});
 const revealRecipe={instanceId,kind:'window',width,height,frameWidth:p.revealRimWidth,frameDepth:p.wallThickness,wallThickness:p.wallThickness,leafEnabled:false,hingeOrSlider:'fixed',host:{...f,origin:add(f.origin,mul(f.w,-p.wallThickness/2)),nodeId:revealId,emitWall:false}};
 const reveal=clone(deriveAperture(revealRecipe).primitives.find(x=>x.part==='frame'));
 Object.assign(reveal,{part:'host',materialRole:2,nodeId:revealId,partRole:'window_opening_reveal',semanticClass:'wall',geometryEvidence:'design_hollow_reveal_not_measured_wall_thickness'});
 // The sill top is exactly the opening bottom. Its width never extends past
 // the registered interval, including the intervals clipped to a source edge.
 const sillDepth=p.wallThickness+p.sillProjection,sillCenter=add(add(f.origin,mul(f.v,-height/2-p.sillThickness/2)),mul(f.w,(p.sillProjection-p.wallThickness)/2));
 const recipeFrameWidth=.02,recipeClearance=.004,leafY=-recipeFrameWidth/2,leafZ=sillDepth+.004;
 const sillRecipe={instanceId,kind:'door',width:width+2*recipeFrameWidth+2*recipeClearance,height:p.sillThickness+recipeFrameWidth+2*recipeClearance,frameWidth:recipeFrameWidth,clearance:recipeClearance,frameDepth:sillDepth,wallThickness:sillDepth,leafThickness:sillDepth,mountGap:.004,hingeOrSlider:'fixed',host:{...f,origin:add(add(sillCenter,mul(f.v,-leafY)),mul(f.w,-leafZ)),nodeId:sillId,emitWall:false}};
 const sill=clone(deriveAperture(sillRecipe).primitives.find(x=>x.part==='leaf'));
 Object.assign(sill,{part:'host',materialRole:2,nodeId:sillId,partRole:'window_sill',semanticClass:'wall',geometryEvidence:'design_sill_not_observed_construction'});
 aperture.primitives.forEach(x=>{x.partRole='recessed_window_'+x.part;});
 aperture.primitives.push(reveal,sill);
 aperture.primitives.forEach((part,index)=>{part.objectId=700000+instanceId*16+index;});
 aperture.bounds=boundsOf(aperture.primitives);aperture.counts.primitives=aperture.primitives.length;
 aperture.rederiveFunction='deriveKccRecessedWindow';aperture.adapterRecipe={instanceId,width,height,sourceFrame:clone(f),nodeId,revealId,sillId,parameters:clone(p)};
 aperture.sourceFrame=f;aperture.focusNormal=clone(f.w);aperture.recessedConstruction={schema:'kaopu.kcc-recessed-window/1',parameters:p,sourcePlaneSignedDepthM:0,inwardIsNegative:true,wallDepthRangeM:[-p.wallThickness,0],sillDepthRangeM:[-p.wallThickness,p.sillProjection],frameCenterDepthM:-p.frameCenterRecess,revealId,sillId,actualWallThicknessM:null,actualRecessM:null,actualSillThicknessM:null,actualMaterial:null,actualMechanism:null,evidence:'design_candidate_not_surveyed_or_as_built',thicknessScope:'local_opening_reveal_only_not_whole_source_wall',recipes:{reveal:revealRecipe,sill:sillRecipe}};
 aperture.clearanceContract={kind:'fixed_recessed_assembly',domain:'fixed only; no movement or operability claim',minimumSourcePlaneFrameRecessM:p.frameCenterRecess-p.frameDepth/2,doesNotCertifySurroundingObjects:true};
 aperture.hardware={...aperture.hardware,kind:'fixed_infill_design_candidate',actualMechanism:null};
 // Public scalar depths are useful to inspect without mistaking world axes for
 // façade sides. Source masks keep the original outward source frame instead.
 aperture.recessedConstruction.partDepthRangesM=aperture.primitives.map(part=>{const center=dot(sub(part.origin,f.origin),f.w),span=Math.abs(dot(part.u,f.w))*part.outer.half[0]+Math.abs(dot(part.v,f.w))*part.outer.half[1]+Math.abs(dot(part.w,f.w))*part.halfDepth;return{partRole:part.partRole,min:center-span,max:center+span};});
 return aperture;
}
