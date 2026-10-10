// Explicit adult placeholder dimensions: design constraints, not historical
// population statistics or an anatomically validated finished character.
export const ADULT_REFERENCE_HEIGHT_M=1.72;
export const ADULT_HEIGHTS_M=Object.freeze([1.72,1.64,1.80,1.68,1.76,1.60,1.84,1.70,1.74,1.66,1.78,1.72]);
// Retained as source-audit evidence only. R17 no longer stretches this entire
// short/wide source mesh uniformly; every body part below is authored in metres.
export const ACTOR_SOURCE=Object.freeze({standingFeetY:.01,hairTopY:1.075,standingHeight:1.065,seatedFeetY:.105,seatedContactY:.325});
export const SEAT_HEIGHT_M=.46;
const validHeight=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
export function actorHeight(actor={}){
  if(validHeight(actor.heightM))return{eligible:true,heightM:actor.heightM,source:'explicit-height'};
  if(actor.ageGroup==='child')return{eligible:false,reason:'child-requires-explicit-height',heightM:null};
  const appearance=Number.isFinite(actor.appearance)?Math.trunc(actor.appearance):0,index=((appearance%ADULT_HEIGHTS_M.length)+ADULT_HEIGHTS_M.length)%ADULT_HEIGHTS_M.length;
  return{eligible:true,heightM:ADULT_HEIGHTS_M[index],source:'adult-design-distribution'};
}
export function actorBodyDimensions(heightM){
  // Across this adult design range: shoulders .51–.55, head .24–.26,
  // foot length .246–.264 and hat brim .637–.683 metres. Explicit small
  // children retain their specified stature and a smaller independent width.
  const q=Math.sqrt(heightM/ADULT_REFERENCE_HEIGHT_M),headHeight=.25*q,shoeHeight=.06*q,footLength=.255*q,hipJointY=.49*heightM,hipBottomY=.48*heightM,hipHeight=.11*heightM;
  const headBottomY=heightM-headHeight,torsoTopY=headBottomY+.010*q,torsoBottomY=.555*heightM;
  return{heightM,widthBasis:'Independent metre-valued part dimensions, not uniform source enlargement',shoulderWidth:.53*q,bodyWidthScale:(.53*q)/.518,headHeight,headDepth:.20*q,headWidth:.17*q,hairHeight:.03*q,headBottomY,hairTopY:heightM,torsoDepth:.26*q,torsoWidth:.34*q,torsoTopY,torsoBottomY,hipJointY,hipBottomY,hipHeight,hipDepth:.235*q,hipWidth:.30*q,shoulderY:torsoTopY-.065*q,armWidth:.10*q,coatArmLength:.43*q,handHeight:.09*q,handWidth:.085*q,legZ:.095*q,legWidth:.105*q,shoeHeight,footLength,footWidth:.11*q,footForward:footLength*.18,thighLength:.40*q,thighThickness:.13*q,hatDiameter:.66*q,hatScale:q,hatTopAboveHair:.1245*q,accessoryScale:q};
}
function standingFootMinimum(s,stride=0){let min=Infinity;for(const angle of [-stride,stride]){const sin=Math.sin(angle),cos=Math.cos(angle),y=s.hipJointY+sin*s.footForward+cos*(-s.hipJointY+s.shoeHeight/2)-Math.abs(sin)*s.footLength/2-Math.abs(cos)*s.shoeHeight/2;min=Math.min(min,y);}return min;}
export function actorPoseDimensions(actor={},options={}){
  const height=actorHeight(actor);if(!height.eligible)return height;
  const shape=actorBodyDimensions(height.heightM),floorY=Number.isFinite(options.floorY)?options.floorY:Number.isFinite(actor.floorY)?actor.floorY:Number(actor.position?.[1])||0,seated=actor.pose==='seated';
  if(!(shape.torsoTopY>shape.torsoBottomY&&shape.hipJointY>shape.shoeHeight))return{...height,eligible:false,reason:'explicit-height-outside-placeholder-fit'};
  const renderScale=Number.isFinite(options.fadeScale)?Math.max(0,options.fadeScale):1;if(!(renderScale>0))return{...height,eligible:false,reason:'zero-render-scale'};
  const seatSurfaceY=Number.isFinite(options.seatSurfaceY)?options.seatSurfaceY:Number.isFinite(actor.seatSurfaceY)?actor.seatSurfaceY:floorY+SEAT_HEIGHT_M,ceilingY=Number.isFinite(options.ceilingY)?options.ceilingY:Number.isFinite(actor.ceilingY)?actor.ceilingY:Infinity;
  const seatRise=(seatSurfaceY-floorY)/renderScale,bodyShiftY=seated?seatRise-shape.hipBottomY:0,bodyTopLocal=height.heightM+bodyShiftY;
  const kneeY=seatRise+shape.thighThickness/2,shinHeight=kneeY-shape.shoeHeight;
  const seatedLeg=seated?{kneeY,kneeX:shape.thighLength-.07*shape.accessoryScale,shinCenterY:(kneeY+shape.shoeHeight)/2,shinHeight,shoeCenterY:shape.shoeHeight/2,thighCenterY:seatRise+shape.thighThickness/2}:null;
  const stride=Number.isFinite(options.stride)?options.stride:0,bob=Number.isFinite(options.bob)?options.bob:0,sourceFeet=seated?0:standingFootMinimum(shape,stride),rootOffsetY=-sourceFeet*renderScale+(seated?0:bob),rootY=floorY+rootOffsetY;
  const result={...height,shape,seated,renderScale,floorY,seatSurfaceY:seated?seatSurfaceY:null,ceilingY,rootY,rootOffsetY,feetY:rootY+sourceFeet*renderScale,bodyTopY:rootY+bodyTopLocal*renderScale,seatContactY:seated?rootY+(shape.hipBottomY+bodyShiftY)*renderScale:null,bodyShiftY,bodyTopLocal,feetClearance:rootOffsetY+sourceFeet*renderScale,seatedLeg};
  if(seated&&(!(shinHeight>0)||seatRise<=shape.shoeHeight))return{...result,eligible:false,reason:'seated-seat-too-low-for-foot'};
  if(result.bodyTopY>ceilingY+1e-6)return{...result,eligible:false,reason:'body-exceeds-explicit-ceiling'};
  return result;
}
