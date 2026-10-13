// Native station lettering: exact licensed Bézier programs, bounded metric queries.
// This module owns no renderer, mesh, image, font loader or material mother.
import {STATION_SERIF_GLYPHS,STATION_SERIF_UNITS} from './native-station-lettering-source.mjs';
export {STATION_SERIF_GLYPHS,STATION_SERIF_UNITS};
export const LETTERING_LIMITS=Object.freeze({toleranceM:.00002,queryMarginM:.06,minToleranceM:.000001,maxToleranceM:.0001,maxStepsPerArc:128,maxArcsPerGlyph:256,maxStepsPerGlyph:8192,maxGlyphs:16,windingIterations:28,maxHeightM:1,maxCoordinateM:256});
export const LETTERING_SOURCE_LAYOUT=Object.freeze({platform:[{text:'PLATFORM',height:.12,dy:.075},{text:'No. {1..4}',height:.17,dy:-.16}],board:{width:1.12,height:.52,thickness:.045},hall:{text:'九龍  KOWLOON',height:.47,sourceExtrusion:.020,sourceFaceClearance:.040},nativePaint:{id:7,seed:188},pixelAA:'not tested; geometric error is not pixel coverage'});
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),mul=(a,n)=>a.map(x=>x*n),dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),len=a=>Math.hypot(...a),mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const finite=(n,name)=>{if(!Number.isFinite(n))throw RangeError('Nonfinite '+name);return n;};
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export function bezierAt(points,t){let a=points.map(p=>p.slice());for(let n=a.length-1;n>0;n--)for(let i=0;i<n;i++)a[i]=mix(a[i],a[i+1],t);return a[0];}
export function splitBezier(points,t){const left=[points[0]],right=[points.at(-1)];let a=points;for(let n=a.length-1;n>0;n--){a=a.slice(0,n).map((p,i)=>mix(p,a[i+1],t));left.push(a[0]);right.push(a.at(-1));}return[left,right.reverse()];}
function roots2(a,b,c){if(Math.abs(a)<1e-18)return Math.abs(b)<1e-18?[]:[-c/b];const d=b*b-4*a*c;if(d<0)return[];if(d===0)return[-b/(2*a)];const q=-.5*(b+Math.sign(b||1)*Math.sqrt(d));return[q/a,c/q];}
export function bezierExtrema(points,axis){const v=points.map(p=>p[axis]),n=v.length-1;let roots=[];if(n===2)roots=[(v[0]-v[1])/(v[0]-2*v[1]+v[2])];else if(n===3)roots=roots2(-v[0]+3*v[1]-3*v[2]+v[3],2*(v[0]-2*v[1]+v[2]),v[1]-v[0]);return roots.filter(t=>Number.isFinite(t)&&t>0&&t<1).sort((a,b)=>a-b).filter((t,i,a)=>i===0||Math.abs(t-a[i-1])>1e-12);}
export function bezierBounds(points){const samples=[points[0],points.at(-1),...bezierExtrema(points,0).map(t=>bezierAt(points,t)),...bezierExtrema(points,1).map(t=>bezierAt(points,t))];return{min:[0,1].map(k=>Math.min(...samples.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...samples.map(p=>p[k])))};}
function hullBounds(points){return{min:[0,1].map(k=>Math.min(...points.map(p=>p[k]))),max:[0,1].map(k=>Math.max(...points.map(p=>p[k])))};}
export function nativeGlyphContours(character){const g=STATION_SERIF_GLYPHS[character];if(!g)throw RangeError('Unsupported native glyph '+character);const contours=[];let contour=null,current=null,start=null;
 const emit=points=>{if(!current)throw Error('Curve before move');contour.push({degree:points.length-1,points});current=points.at(-1);};
 g.draw({m:(x,y)=>{if(contour)throw Error('Unclosed native contour');start=current=[x,y];contour=[];},l:(x,y)=>emit([current,[x,y]]),q:(x,y,u,v)=>emit([current,[x,y],[u,v]]),c:(x,y,u,v,a,b)=>emit([current,[x,y],[u,v],[a,b]]),z:()=>{if(!contour)throw Error('Close without move');if(len(sub(current,start))>0)emit([current,start]);if(contour.length)contours.push(contour);contour=current=start=null;}});
 if(contour)throw Error('Unclosed native contour');return contours;
}
function mergeBounds(a,b){return{min:a.min.map((x,k)=>Math.min(x,b.min[k])),max:a.max.map((x,k)=>Math.max(x,b.max[k]))};}
const emptyBounds=()=>({min:[Infinity,Infinity],max:[-Infinity,-Infinity]});
export function measureNativeWord(text,{height=.47}={}){finite(height,'height');if(height<=0||height>LETTERING_LIMITS.maxHeightM)throw RangeError('Unsupported letter height');if(typeof text!=='string'||!text.length||[...text].length>LETTERING_LIMITS.maxGlyphs)throw RangeError('Invalid native text');let pen=0,bounds=emptyBounds();const glyphs=[];
 for(const character of text){const g=STATION_SERIF_GLYPHS[character];if(!g)throw RangeError('Unsupported native glyph '+character);const contours=nativeGlyphContours(character);if(contours.length){const b=contours.flat().reduce((a,c)=>mergeBounds(a,bezierBounds(c.points)),emptyBounds());bounds=mergeBounds(bounds,{min:[b.min[0]+pen,b.min[1]],max:[b.max[0]+pen,b.max[1]]});glyphs.push({character,pen,contours,sourceBounds:b,solids:g.solids,counters:g.counters});}pen+=g.advance;}
 if(!glyphs.length)throw RangeError('Word has no visible glyphs');const scale=height/(bounds.max[1]-bounds.min[1]),centerX=(bounds.min[0]+bounds.max[0])/2;
 return{text,height,width:(bounds.max[0]-bounds.min[0])*scale,scale,centerX,minY:bounds.min[1],sourceBounds:bounds,glyphs,layout:'R02 centered ink bounds, baseline at minY; true curve extrema replace sampled mesh bounds'};
}
function monotoneY(points){const roots=bezierExtrema(points,1);let tail=points,last=0;const out=[];for(const t of roots){const [a,b]=splitBezier(tail,(t-last)/(1-last));out.push(a);tail=b;last=t;}out.push(tail);return out;}
function secondDerivativeBound(points){const n=points.length-1;if(n===1)return 0;return Math.max(...points.slice(0,-2).map((p,i)=>n*(n-1)*len(add(sub(p,mul(points[i+1],2)),points[i+2]))));}
function firstDerivativeBound(points){const n=points.length-1;return Math.max(...points.slice(0,-1).map((p,i)=>n*len(sub(points[i+1],p))));}
export function compileBezierArc(points,toleranceM=LETTERING_LIMITS.toleranceM){if(!Number.isFinite(toleranceM)||toleranceM<LETTERING_LIMITS.minToleranceM||toleranceM>LETTERING_LIMITS.maxToleranceM)throw RangeError('Unsupported distance tolerance');if(![2,3,4].includes(points.length)||points.some(p=>p.length!==2||!p.every(Number.isFinite)))throw Error('Invalid native Bézier');const curvature=secondDerivativeBound(points),steps=Math.max(1,Math.ceil(Math.sqrt(curvature/(8*toleranceM))));if(steps>LETTERING_LIMITS.maxStepsPerArc)throw RangeError('Letter curve distance budget exceeded');return{degree:points.length-1,points,steps,error:curvature/(8*steps*steps),rootError:firstDerivativeBound(points)*2**(-LETTERING_LIMITS.windingIterations),bounds:hullBounds(points)};}
function validateFrame(right,up,normal){for(const v of[right,up,normal])if(v.length!==3||!v.every(Number.isFinite)||Math.abs(len(v)-1)>1e-10)throw Error('Letter frame must be orthonormal');if(Math.abs(dot(right,up))>1e-10||Math.abs(dot(right,normal))>1e-10||Math.abs(dot(up,normal))>1e-10||dot(cross(right,up),normal)<1-1e-10)throw Error('Letter frame must be right handed; reflection forbidden');}
export function createStationLetteringWord(text,{height=.47,origin=[0,0,0],right=[1,0,0],up=[0,1,0],normal=[0,0,1],depth=.020,embed=.0005,mode='raised',toleranceM=LETTERING_LIMITS.toleranceM,queryMarginM=LETTERING_LIMITS.queryMarginM,id=7,seed=188}={}){
 validateFrame(right,up,normal);for(const [k,n]of Object.entries({depth,embed,toleranceM,queryMarginM,seed}))finite(n,k);if(origin.length!==3||!origin.every(Number.isFinite)||origin.some(x=>Math.abs(x)>LETTERING_LIMITS.maxCoordinateM))throw RangeError('Letter origin outside tested finite domain');if(!['raised','engraved'].includes(mode)||depth<=0||depth>.1||embed<0||embed>.1||toleranceM<LETTERING_LIMITS.minToleranceM||toleranceM>LETTERING_LIMITS.maxToleranceM||queryMarginM<.01||queryMarginM>.25||!Number.isInteger(id)||id<=0)throw RangeError('Invalid letter construction');
 const layout=measureNativeWord(text,{height}),glyphs=layout.glyphs.map(g=>{const transform=p=>[(p[0]+g.pen-layout.centerX)*layout.scale,(p[1]-layout.minY)*layout.scale];const arcs=g.contours.flatMap(c=>c.flatMap(curve=>monotoneY(curve.points.map(transform)).map(p=>compileBezierArc(p,toleranceM))));if(arcs.length>LETTERING_LIMITS.maxArcsPerGlyph||arcs.reduce((n,c)=>n+c.steps,0)>LETTERING_LIMITS.maxStepsPerGlyph)throw RangeError('Letter glyph query budget exceeded');return{character:g.character,solids:g.solids,counters:g.counters,arcs,bounds:arcs.reduce((a,c)=>mergeBounds(a,bezierBounds(c.points)),emptyBounds())};});
 const zRange=mode==='raised'?[-embed,depth]:[-depth,embed];const bounds={min:[-layout.width/2,0,zRange[0]],max:[layout.width/2,height,zRange[1]]};const error=Math.max(...glyphs.flatMap(g=>g.arcs.map(a=>a.error))),rootError=Math.max(...glyphs.flatMap(g=>g.arcs.map(a=>a.rootError)));
 // This is an explicit design allowance, not a completed GPU precision test.
 const localFloatAllowance=64*2**-23*Math.max(1,layout.width,height),worldFloatAllowance=4*2**-23*LETTERING_LIMITS.maxCoordinateM;
 return freeze({text,height,width:layout.width,origin:[...origin],right:[...right],up:[...up],normal:[...normal],depth,embed,mode,id,seed,zRange,bounds,glyphs,toleranceM,queryMarginM,error,rootError,localFloatAllowance,worldFloatAllowance,worldError:error+2*rootError+localFloatAllowance+worldFloatAllowance,stepBudget:glyphs.reduce((n,g)=>n+g.arcs.reduce((s,a)=>s+a.steps,0),0),pixelAA:false,layout:layout.layout});
}
function boxDistance(p,b){const q=p.map((x,k)=>Math.max(b.min[k]-x,x-b.max[k]));return len(q.map(x=>Math.max(x,0)))+Math.min(Math.max(...q),0);}
function segmentDistance(p,a,b){const v=sub(b,a),t=Math.max(0,Math.min(1,dot(sub(p,a),v)/Math.max(dot(v,v),1e-30)));return len(sub(p,add(a,mul(v,t))));}
export function nativeArcWinding(arc,p){const a=arc.points[0],b=arc.points.at(-1);if((a[1]>p[1])===(b[1]>p[1]))return 0;let lo=0,hi=1;const up=b[1]>a[1];for(let i=0;i<LETTERING_LIMITS.windingIterations;i++){const t=(lo+hi)/2,y=bezierAt(arc.points,t)[1];if((y<=p[1])===up)lo=t;else hi=t;}return bezierAt(arc.points,(lo+hi)/2)[0]>p[0]?(up?1:-1):0;}
export function nativeArcDistance(arc,p){let d=Infinity,previous=arc.points[0];for(let i=1;i<=arc.steps;i++){const next=bezierAt(arc.points,i/arc.steps);d=Math.min(d,segmentDistance(p,previous,next));previous=next;}return d;}
export function sampleNativeGlyph(glyph,p){let distance=Infinity,winding=0,steps=0;for(const a of glyph.arcs){winding+=nativeArcWinding(a,p);if(boxDistance(p,a.bounds)>distance+a.error)continue;distance=Math.min(distance,nativeArcDistance(a,p));steps+=a.steps;}return{d:winding===0?distance:-distance,winding,steps};}
const extrusion=(a,b)=>Math.hypot(Math.max(a,0),Math.max(b,0))+Math.min(Math.max(a,b),0);
export function stationLetteringPoint(word,q){return word.origin.map((x,k)=>x+word.right[k]*q[0]+word.up[k]*q[1]+word.normal[k]*q[2]);}
export function stationLetteringSample(word,p){const delta=sub(p,word.origin),q=[dot(delta,word.right),dot(delta,word.up),dot(delta,word.normal)],lowerBound=Math.max(0,boxDistance(q,word.bounds)-1e-12);
 // A bound is scheduling information ONLY. No hit, ID, or finite face distance.
 if(lowerBound>word.queryMarginM)return{valid:false,d:Infinity,lowerBound,error:word.error,q,steps:0};
 let d=Infinity,steps=0,nearest=null;const dz=Math.max(word.zRange[0]-q[2],q[2]-word.zRange[1]);
 for(const g of word.glyphs){const gb={min:[...g.bounds.min,word.zRange[0]],max:[...g.bounds.max,word.zRange[1]]};const b=boxDistance(q,gb);if(b>d+2*word.error)continue;const r=sampleNativeGlyph(g,q.slice(0,2)),candidate=extrusion(r.d,dz);steps+=r.steps;if(candidate<d){d=candidate;nearest=g.character;}}
 if(!Number.isFinite(d))throw Error('Native word has no actual curve candidate');
 const error=word.error+2*word.rootError+1e-12;return{valid:true,d,lowerBound,stepDistance:Math.max(0,Math.abs(d)-error),error,interval:[d-error,d+error],q,steps,nearest,id:word.id,seed:word.seed,mode:word.mode,ambiguous:Math.abs(d)<=error};
}
export function stationPlatformLettering({origin=[0,0,0],deck=.85,signHeight=2.6,row=0,...options}={}){if(!Number.isInteger(row)||row<0||row>3)throw RangeError('Platform row must be 0..3');const center=add(origin,[.03,deck+signHeight,-.72]),words=[];for(const side of[-1,1])for(const[text,height,dy]of[['PLATFORM',.12,.075],['No. '+(row+1),.17,-.16]])words.push(createStationLetteringWord(text,{...options,height,origin:add(center,[side*.0225,dy,0]),right:[0,0,-side],up:[0,1,0],normal:[side,0,0],depth:options.depth??.0045,embed:options.embed??.0005}));return words;}
// Caller supplies native-terminal-hall's exact station-local anchor. Its normal
// is −X, so viewer-right is +Z. The source anchor's 40 mm setback is NOT hidden.
export function stationHallLettering({anchor,...options}={}){if(!anchor?.at)throw Error('Hall title requires the actual terminal hall anchor');if(anchor.text!=='九龍  KOWLOON'||anchor.normal?.join(',')!=='-1,0,0')throw Error('Unsupported hall title/face');return createStationLetteringWord(anchor.text,{...options,height:anchor.height,origin:anchor.at,right:[0,0,1],up:[0,1,0],normal:[-1,0,0],depth:options.depth??.020,embed:options.embed??.0005});}
const f=n=>{if(!Number.isFinite(n))throw Error('Nonfinite WGSL literal');return Number.isInteger(n)?n+'.':String(n);};
const v2=p=>'vec2<f32>('+p.map(f).join(',')+')',v3=p=>'vec3<f32>('+p.map(f).join(',')+')';
export function stationLetteringTemplates({hallEmbed=.0005,hallDepth=.020,...options}={}){return[createStationLetteringWord('PLATFORM',{...options,height:.12,depth:.0045,embed:.0005}),...[1,2,3,4].map(n=>createStationLetteringWord('No. '+n,{...options,height:.17,depth:.0045,embed:.0005})),createStationLetteringWord('九龍  KOWLOON',{...options,height:.47,depth:hallDepth,embed:hallEmbed})];}
export function stationLetteringWGSL({deck=.85,signHeight=2.6,...options}={}){
 const words=stationLetteringTemplates(options);finite(deck,'deck');finite(signHeight,'signHeight');
 let code=`
// Distance is native Bézier evaluation with bounded chord-query error, not
// imported polygon geometry. No material, light, or hidden atlas dependency.
// valid==0 is a scheduler-only bound. NEVER record that result as a HitField.
// GPU compilation, pixel AA, and on-device f32 error remain unverified.
struct StationLetteringHit{valid:u32,d:f32,error:f32,lowerBound:f32,stepDistance:f32,q:vec3<f32>,id:u32,seed:f32,mode:u32,}
struct StationLetteringArc{a:vec2<f32>,b:vec2<f32>,c:vec2<f32>,d:vec2<f32>,lo:vec2<f32>,hi:vec2<f32>,degree:u32,steps:u32,}
fn stationLetteringMiss(q:vec3<f32>,bound:f32,error:f32)->StationLetteringHit{let safeBound=max(0.,bound-error);return StationLetteringHit(0u,1e5,error,safeBound,safeBound,q,0u,0.,0u);}
fn stationLetteringBox2(p:vec2<f32>,lo:vec2<f32>,hi:vec2<f32>)->f32{let a=max(lo-p,p-hi);return length(max(a,vec2<f32>(0.)))+min(max(a.x,a.y),0.);}
fn stationLetteringBox3(p:vec3<f32>,lo:vec3<f32>,hi:vec3<f32>)->f32{let a=max(lo-p,p-hi);return length(max(a,vec3<f32>(0.)))+min(max(a.x,max(a.y,a.z)),0.);}
fn stationLetteringExtrude(a:f32,b:f32)->f32{return length(max(vec2<f32>(a,b),vec2<f32>(0.)))+min(max(a,b),0.);}
fn stationLetteringBezier(a:StationLetteringArc,t:f32)->vec2<f32>{let ab=mix(a.a,a.b,t);if(a.degree==1u){return ab;}let bc=mix(a.b,a.c,t);let abc=mix(ab,bc,t);if(a.degree==2u){return abc;}return mix(abc,mix(bc,mix(a.c,a.d,t),t),t);}
fn stationLetteringEnd(a:StationLetteringArc)->vec2<f32>{if(a.degree==1u){return a.b;}if(a.degree==2u){return a.c;}return a.d;}
fn stationLetteringWinding(a:StationLetteringArc,p:vec2<f32>)->i32{let e=stationLetteringEnd(a);if((a.a.y>p.y)==(e.y>p.y)){return 0;}let up=e.y>a.a.y;var x=0.;if(a.degree==1u){x=mix(a.a.x,e.x,(p.y-a.a.y)/(e.y-a.a.y));}else{var lo=0.;var hi=1.;for(var k=0u;k<${LETTERING_LIMITS.windingIterations}u;k++){let t=(lo+hi)*.5;if((stationLetteringBezier(a,t).y<=p.y)==up){lo=t;}else{hi=t;}}x=stationLetteringBezier(a,(lo+hi)*.5).x;}if(x>p.x){return select(-1,1,up);}return 0;}
fn stationLetteringSegment(p:vec2<f32>,a:vec2<f32>,b:vec2<f32>)->f32{let v=b-a;let t=clamp(dot(p-a,v)/max(dot(v,v),1e-30),0.,1.);return length(p-a-v*t);}
fn stationLetteringArcDistance(a:StationLetteringArc,p:vec2<f32>)->f32{var distance=1e5;var previous=a.a;for(var j=1u;j<=a.steps;j++){let next=stationLetteringBezier(a,f32(j)/f32(a.steps));distance=min(distance,stationLetteringSegment(p,previous,next));previous=next;}return distance;}
`;
 words.forEach((word,index)=>{
  const arcs=word.glyphs.flatMap(g=>g.arcs),name='stationLetteringCurves'+index;
  code+=`\n// Template ${index}: ${word.text}; ${arcs.length} native monotone arcs; at most ${word.stepBudget} distance steps.\nconst ${name}=array<StationLetteringArc,${arcs.length}>(\n`;
  code+=arcs.map(a=>{const p=a.points;return`StationLetteringArc(${v2(p[0])},${v2(p[1])},${v2(p[2]??p[1])},${v2(p[3]??p.at(-1))},${v2(a.bounds.min)},${v2(a.bounds.max)},${a.degree}u,${a.steps}u)`;}).join(',\n')+');\n';
  code+=`fn stationLetteringWord${index}(q:vec3<f32>)->StationLetteringHit{let bound=max(0.,stationLetteringBox3(q,${v3(word.bounds.min)},${v3(word.bounds.max)}));let error=${f(word.worldError)};if(bound>${f(word.queryMarginM)}){return stationLetteringMiss(q,bound,error);}let dz=max(${f(word.zRange[0])}-q.z,q.z-${f(word.zRange[1])});var distance=1e5;\n`;
  let start=0;for(const g of word.glyphs){const end=start+g.arcs.length;
   code+=`// ${g.character}: ${g.solids} source ink contours, ${g.counters} source counters.\nif(stationLetteringBox3(q,${v3([...g.bounds.min,word.zRange[0]])},${v3([...g.bounds.max,word.zRange[1]])})<=distance+error*2.){var inkDistance=1e5;var winding=0;for(var i=${start}u;i<${end}u;i++){let arc=${name}[i];winding+=stationLetteringWinding(arc,q.xy);if(stationLetteringBox2(q.xy,arc.lo,arc.hi)<=inkDistance+error){inkDistance=min(inkDistance,stationLetteringArcDistance(arc,q.xy));}}let signedInk=select(-inkDistance,inkDistance,winding==0);distance=min(distance,stationLetteringExtrude(signedInk,dz));}\n`;
   start=end;
  }
  code+=`return StationLetteringHit(1u,distance,error,max(0.,bound-error),max(0.,abs(distance)-error),q,${word.id}u,${f(word.seed)},${word.mode==='engraved'?1:0}u);}\n`;
 });
 code+=`// Local XYZ = viewer-right, up, outward. index 0=PLATFORM, 1..4=No. row, 5=hall.\nfn stationLetteringTemplate(q:vec3<f32>,index:u32)->StationLetteringHit{\n`;
 words.forEach((_,i)=>{code+=`if(index==${i}u){return stationLetteringWord${i}(q);}\n`;});
 code+=`return stationLetteringMiss(q,1e5,0.);}\n// origin is the relocated lamp/column attachment, not a repeated world-grid guess.\nfn stationLetteringPlatform(p:vec3<f32>,origin:vec3<f32>,row:u32,side:i32,line:u32)->StationLetteringHit{if(row>3u||line>1u||(side!=1&&side!=-1)){return stationLetteringMiss(p,1e5,0.);}let sidef=f32(side);let center=origin+vec3<f32>(.03+sidef*.0225,${f(deck+signHeight)},-.72);let offset=p-center;let dy=select(.075,-.16,line==1u);let q=vec3<f32>(-sidef*offset.z,offset.y-dy,sidef*offset.x);return stationLetteringTemplate(q,select(0u,row+1u,line==1u));}\n// Anchor is native-terminal-hall's −X short-end title anchor. No reflection.\nfn stationLetteringHall(p:vec3<f32>,anchor:vec3<f32>)->StationLetteringHit{let offset=p-anchor;return stationLetteringTemplate(vec3<f32>(offset.z,offset.y,-offset.x),5u);}\n`;
 return code;
}

