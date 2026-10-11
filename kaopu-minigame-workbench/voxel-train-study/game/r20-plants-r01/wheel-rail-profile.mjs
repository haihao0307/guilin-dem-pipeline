/** Original FH88 renderer geometry in metres. No historical wheel-section claim.
 * THREE is injected so the actual game's existing engine remains authoritative.
 * Rail: 56E1 dimensional reference, simplified compound crown, not a mill drawing.
 * Wheel: retained GAME steam-model Lathe tyre section, not a torus substitute.
 */
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export const PROFILE_SOURCES=freeze({
 railTable:'https://www.britishsteel.co.uk/wp-content/uploads/2026/02/british-steel-rail-profiles-and-grades-datasheet.pdf',
 railManufacturer:'https://rails.arcelormittal.com/profiles/transport-rails/european-standards/rail-56e1/',
 railDrawing:'https://rails.arcelormittal.com/wp-content/uploads/2022/10/content_56e1.jpg',
 wheel:'Existing r20-plants-r01/steam-model.mjs makeWheelGeometry(), lines 33–45',
 coach:'Existing r20-plants-r01/coach-model.mjs coachWheelGeometry(), lines 16–24'
});
export const RAIL_56E1=freeze({id:'56E1-dimensioned-render-section',heightM:.15875,headWidthM:.06985,webWidthM:.020,footWidthM:.140,
 headReferenceDepthM:.01453,headLowerApexDepthM:.04921,footEdgeHeightM:.0112,footCrownHeightM:.03016,
 crownRadiusM:.305,headEdgeRadiusM:.0127,headUnderCornerRadiusM:.003,webUpperFilletM:.008,webLowerFilletM:.015,
 footSlopeTransitionRadiusM:.020,footUpperCornerRadiusM:.0015,footBottomCornerRadiusM:.003,
 headSideSlope:1/20,headUndersideSlope:1/2.75,footInnerSlope:1/2.75,footOuterSlope:1/10,
 historicalCertification:false,manufacturingProfileCertified:false,
 limitations:'Manufacturer envelope, labelled slopes and principal fillets; R305/R80 compound head transition is simplified to an R305 crown tangential to the R12.7 edge. Head width is defined at the drawing reference depth, not the maximum flared width. No wear, cant, gauge tolerance, Hertz/contact dynamics or historical track claim.'});
export const RETAINED_WHEEL=freeze({id:'existing-GAME-lathe-tyre',treadInnerOffsetM:-.065,treadOuterOffsetM:.085,
 backOffsetM:-.105,flangeTipOuterOffsetM:-.090,flangeHeightM:.028,outerFaceOffsetM:.10,
 sourceSectionVerified:true,historicalProfileCertified:false,backToBackHistoricalCertified:false});
export const RETAINED_COACH=freeze({id:'existing-GAME-coach-section',treadInnerOffsetM:-.065,treadOuterOffsetM:.075,
 innerEnvelopeOffsetM:-.115,backOffsetM:-.100,tyreInnerShoulderOffsetM:-.105,flangeBackOffsetM:-.100,flangeTipOuterOffsetM:-.078,flangeHeightM:.026,outerFaceOffsetM:.12,
 historicalProfileCertified:false,backToBackHistoricalCertified:false});
const positive=(v,name)=>{if(!Number.isFinite(v)||v<=0)throw Error('Positive finite '+name+' required');return v;};
export function wheelRailDatums({gaugeM=1.435,railTopM=.3485,rail=RAIL_56E1,wheel=RETAINED_WHEEL}={}){
 positive(gaugeM,'gauge');if(!Number.isFinite(railTopM))throw Error('Finite rail top required');
 const railCentreAbsM=(gaugeM+rail.headWidthM)/2,wheelReferenceAbsM=gaugeM/2-wheel.treadInnerOffsetM;
 return {gaugeM,railTopM,railCentreAbsM,wheelReferenceAbsM,railInnerReferenceAbsM:gaugeM/2,
  contactOffsetOutwardM:railCentreAbsM-wheelReferenceAbsM,
  wheelBackToBackM:2*(wheelReferenceAbsM+wheel.backOffsetM),
  innerWheelEnvelopeSpacingM:2*(wheelReferenceAbsM+(wheel.innerEnvelopeOffsetM??wheel.backOffsetM)),
  flangeBackToBackM:2*(wheelReferenceAbsM+(wheel.flangeBackOffsetM??wheel.backOffsetM)),
  outerTyreFaceAbsM:wheelReferenceAbsM+wheel.outerFaceOffsetM,
  meaning:'Reference gauge at drawing head-width level; radial axle height=railTop+runningRadius. Rolling reference and rail centre are intentionally distinct.',
  historicalCertification:false};
}
export function wheelTyreSection(radiusM){
 const r=positive(radiusM,'running radius');if(r<=.065)throw Error('Running radius too small for retained tyre section');
 return [[r-.065,-.105],[r+.028,-.105],[r+.028,-.090],[r,-.065],[r,.085],[r-.035,.10],[r-.065,.085],[r-.065,-.105]];
}
export function coachWheelSection(radiusM){
 const r=positive(radiusM,'running radius');if(r<=.18)throw Error('Coach radius too small');
 return [[0,-.115],[.15,-.115],[r-.065,-.105],[r+.026,-.100],[r+.026,-.078],[r,-.065],[r,.075],[r-.045,.090],[.18,.11],[.10,.12],[0,.12]];
}
export function createTyreGeometry(T,{radiusM,side=1,axis='native-y',segments=128}={}){
 if(![-1,1].includes(side)||!['native-y','game-z'].includes(axis)||!Number.isInteger(segments)||segments<48)throw Error('Invalid tyre orientation/resolution');
 const geometry=new T.LatheGeometry(wheelTyreSection(radiusM).map(([r,a])=>new T.Vector2(r,a)),segments);
 // Mirror the asymmetric flange with a proper rotation, not a negative scale.
 if(axis==='native-y'){if(side<0)geometry.rotateX(Math.PI);}
 else{geometry.rotateX(Math.PI/2);if(side<0)geometry.rotateY(Math.PI);}
 geometry.userData={profile:RETAINED_WHEEL.id,runningRadiusM:radiusM,side,axis,segments,
  source:PROFILE_SOURCES.wheel,profileCertified:false,radialChordErrorBoundM:radiusM*(1-Math.cos(Math.PI/segments))};
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
const norm=v=>{const d=Math.hypot(...v);return v.map(x=>x/d);};
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function roundedCorner(a,b,c,r,n=6){
 if(!r)return[b];const incoming=norm([b[0]-a[0],b[1]-a[1]]),outgoing=norm([c[0]-b[0],c[1]-b[1]]),angle=Math.acos(Math.max(-1,Math.min(1,incoming[0]*outgoing[0]+incoming[1]*outgoing[1]))),d=r*Math.tan(angle/2);
 if(d>=Math.hypot(b[0]-a[0],b[1]-a[1])||d>=Math.hypot(c[0]-b[0],c[1]-b[1]))throw Error('Rail fillet exceeds segment');
 const start=[b[0]-incoming[0]*d,b[1]-incoming[1]*d],end=[b[0]+outgoing[0]*d,b[1]+outgoing[1]*d],sign=Math.sign(cross(incoming,outgoing));
 const centre=[start[0]-incoming[1]*sign*r,start[1]+incoming[0]*sign*r],theta=Math.atan2(start[1]-centre[1],start[0]-centre[0]);
 return Array.from({length:n+1},(_,i)=>i===n?end:[centre[0]+r*Math.cos(theta+sign*angle*i/n),centre[1]+r*Math.sin(theta+sign*angle*i/n)]);
}
/** [transverse offset, height relative to running crown], clockwise perimeter. */
export function railSection(rail=RAIL_56E1){
 const p=rail,H=p.heightM,h=p.headWidthM/2,w=p.webWidthM/2,f=p.footWidthM/2,s=p.headSideSlope,
  line=h-s*p.headReferenceDepthM,R=p.crownRadiusM,r=p.headEdgeRadiusM;
 // Circle internally tangent to the R305 crown and tangent to the 1:20 side.
 const k=line-r*Math.hypot(1,s)+s*R,A=1+s*s;
 const u=(s*k+Math.sqrt((s*k)**2-A*(k*k-(R-r)**2)))/A;
 const centre=[k-s*u,u-R],normal=norm(centre.map((v,i)=>v-(i===1?-R:0))),join=[normal[0]*R,normal[1]*R-R],edge=[centre[0]+r/Math.hypot(1,s),centre[1]+r*s/Math.hypot(1,s)];
 const right=[],joinAngle=Math.asin(join[0]/R);
 for(let i=0;i<=10;i++){const t=joinAngle*i/10;right.push([R*Math.sin(t),R*Math.cos(t)-R]);}
 const theta=Math.atan2(normal[1],normal[0]),endTheta=Math.atan2(s,1);
 for(let i=1;i<=10;i++){const t=theta+(endTheta-theta)*i/10;right.push([centre[0]+r*Math.cos(t),centre[1]+r*Math.sin(t)]);}
 const headCornerY=(-p.headLowerApexDepthM+p.headUndersideSlope*line)/(1+p.headUndersideSlope*s),headCorner=[line-s*headCornerY,headCornerY];
 const webTop=[w,-p.headLowerApexDepthM+w*p.headUndersideSlope],webBottom=[w,-H+p.footCrownHeightM-w*p.footInnerSlope];
 const footOuterIntercept=-H+p.footEdgeHeightM+f*p.footOuterSlope,
  breakZ=(-H+p.footCrownHeightM-footOuterIntercept)/(p.footInnerSlope-p.footOuterSlope),footBreak=[breakZ,footOuterIntercept-breakZ*p.footOuterSlope],footEdge=[f,-H+p.footEdgeHeightM],footBottom=[f,-H],bottomCenter=[0,-H];
 const nodes=[edge,headCorner,webTop,webBottom,footBreak,footEdge,footBottom,bottomCenter],radii=[0,p.headUnderCornerRadiusM,p.webUpperFilletM,p.webLowerFilletM,p.footSlopeTransitionRadiusM,p.footUpperCornerRadiusM,p.footBottomCornerRadiusM,0];
 for(let i=1;i<nodes.length-1;i++)right.push(...roundedCorner(nodes[i-1],nodes[i],nodes[i+1],radii[i]));
 right.push(bottomCenter);
 return [...right,...right.slice(1,-1).reverse().map(([z,y])=>[-z,y])];
}
export function createRailGeometry(T,{lengthM,centerXM=0,centerZM=0,railTopM=.3485,rail=RAIL_56E1,capEnds=true}={}){
 positive(lengthM,'rail length');if(![centerXM,centerZM,railTopM].every(Number.isFinite))throw Error('Finite rail placement required');
 const section=railSection(rail),positions=[],indices=[],colors=[],x0=centerXM-lengthM/2,x1=centerXM+lengthM/2;
 const add=(x,[z,y])=>{positions.push(x,railTopM+y,centerZM+z);const c=new T.Color(y>-.02?0x9d9a88:0x625e53);colors.push(c.r,c.g,c.b);return positions.length/3-1;};
 for(let i=0;i<section.length;i++){const j=(i+1)%section.length,a=add(x0,section[i]),b=add(x0,section[j]),c=add(x1,section[j]),d=add(x1,section[i]);indices.push(a,b,c,a,c,d);}
 if(capEnds){const faces=T.ShapeUtils.triangulateShape(section.map(([z,y])=>new T.Vector2(z,y)),[]);
  for(const [x,sign] of [[x0,-1],[x1,1]])for(const tri of faces){const v=tri.map(i=>section[i]);let ids=v.map(p=>add(x,p));const normalX=(v[1][1]-v[0][1])*(v[2][0]-v[0][0])-(v[1][0]-v[0][0])*(v[2][1]-v[0][1]);if(normalX*sign<0)ids.reverse();indices.push(...ids);}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 g.userData={profile:rail.id,source:PROFILE_SOURCES.railDrawing,railTopM,lengthM,headWidthReferenceDepthM:rail.headReferenceDepthM,manufacturingProfileCertified:false};return g;
}
/** Append real extruded profile vertices into the existing heritage Blocks batch. */
export function appendRailSection(T,builder,options){
 const g=createRailGeometry(T,options),base=builder.p.length/3;
 for(const [target,attribute] of [['p','position'],['n','normal'],['c','color']])for(const v of g.attributes[attribute].array)builder[target].push(v);
 for(const i of g.index.array)builder.i.push(base+i);if(Number.isFinite(builder.count))builder.count++;g.dispose();
}
function intersectionsAt(poly,a,axis){
 const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],da=q[axis]-p[axis];
  if(Math.abs(da)<1e-14){if(Math.abs(a-p[axis])<1e-12)out.push(p[1-axis],q[1-axis]);continue;}
  const t=(a-p[axis])/da;if(t>=-1e-12&&t<=1+1e-12)out.push(p[1-axis]+t*(q[1-axis]-p[1-axis]));
 }return out;
}
/** Whole nominal section, independent of tessellation phase; symmetric sides are checked separately. */
export function sectionContactReport({radiusM,side=1,wheelSection=wheelTyreSection(radiusM),datums=wheelRailDatums(),rail=RAIL_56E1,samples=2048}={}){
 if(![-1,1].includes(side)||!Number.isInteger(samples)||samples<100)throw Error('Invalid contact sampling');
 const rp=railSection(rail),origin=side*datums.wheelReferenceAbsM,railCentre=side*datums.railCentreAbsM;
 const toWorld=a=>origin+side*a,range=wheelSection.map(p=>toWorld(p[1])),lo=Math.min(...range),hi=Math.max(...range),points=new Set([railCentre,...range,...rp.map(p=>railCentre+p[0])]);
 for(let i=0;i<=samples;i++)points.add(lo+(hi-lo)*i/samples);
 let minGapM=Infinity,overlapSamples=0;const penetrations=[];
 for(const z of points){const radii=intersectionsAt(wheelSection,(z-origin)*side,1),railY=intersectionsAt(rp,z-railCentre,0);if(!radii.length||!railY.length)continue;
  const gap=radiusM-Math.max(...radii)-Math.max(...railY);minGapM=Math.min(minGapM,gap);overlapSamples++;if(gap < -1e-9&&penetrations.length<12)penetrations.push({z,gapM:gap});
 }
 const contactRadii=intersectionsAt(wheelSection,datums.contactOffsetOutwardM,1),contactRadiusM=Math.max(...contactRadii);
 return {side,referenceAxisM:origin,railCentreM:railCentre,contactPointM:[0,datums.railTopM,railCentre],contactRadiusM,minimumSurfaceGapM:minGapM,overlapSamples,penetrations,
  wheelBackToBackM:datums.wheelBackToBackM,flangeBackToBackM:datums.flangeBackToBackM,nominalGeometryOnly:true,dynamicContactValidated:false};
}

/** Existing authored support thicknesses, positioned from the rail foot.
 * These are landscape design choices, not additional 56E1 dimensions. */
export function railSupportDatums({railTopM=.3485,rail=RAIL_56E1,sleeperThicknessM=.16,plateThicknessM=.03,ballastThicknessM=.10,ballastBelowSleeperTopM=.02}={}){
 for(const [k,v] of Object.entries({sleeperThicknessM,plateThicknessM,ballastThicknessM,ballastBelowSleeperTopM}))positive(v,k);
 const railFootM=railTopM-rail.heightM,plateCenterM=railFootM-plateThicknessM/2,sleeperTopM=railFootM-plateThicknessM,sleeperCenterM=sleeperTopM-sleeperThicknessM/2,ballastTopM=sleeperTopM-ballastBelowSleeperTopM;
 return {railFootM,plateCenterM,plateThicknessM,sleeperTopM,sleeperCenterM,sleeperThicknessM,ballastTopM,ballastCenterM:ballastTopM-ballastThicknessM/2,ballastThicknessM,historicalCertification:false};
}
