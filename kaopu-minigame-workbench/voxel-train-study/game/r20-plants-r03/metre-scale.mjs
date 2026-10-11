// R17 single-unit boundary. One world unit is one metre; time remains Session seconds.
// Exact references and provisional authoring dimensions are deliberately separate.
export const SCALE_SOURCES=Object.freeze({wd:'https://advanced-steam.org/wp-content/uploads/2017/10/AST-presentation-Tom-Kay-v2.pdf',coach:'https://stock.swanagerailway.co.uk/getfile.php?id=140',kcr:'https://www.news.gov.hk/eng/2020/10/20201030/20201030_123705_698.html'});
export const TRACK=Object.freeze({gauge:1.435,railHead:.3485,headWidth:.15,centerOffset:(1.435+.15)/2,wheelAxisZ:.7825});
export const WD_VERIFIED=Object.freeze({driverDiameter:1.4351,leadingDiameter:.9652,axleIntervalsFrontToRear:Object.freeze([2.6162,1.6002,1.6002,1.7526]),totalAxleBase:7.5692,driverAxleBase:4.953,cabRearFromLastDriver:2.2606,cabSideWidth:2.5908,boilerCenterAboveRail:2.7432,chimneyTopAboveRail:3.8354,overallLength:null,overallWidth:null,highestPoint:null});
// Existing front guide anchor is retained in world space; only measured separations change.
const guide=3.84;
export const WD_AXLES=Object.freeze({guide:Object.freeze([guide]),drivers:Object.freeze([guide-7.5692,guide-5.8166,guide-4.2164,guide-2.6162])});
// This is an original passenger vehicle referenced to full-size British stock,
// not a claim that the fictional coaches reproduce KCR No.313 or a specific Mk1 diagram.
export const COACH_DIMENSIONS=Object.freeze({underframeLength:19.3294,bodyLength:19.6596,overBuffers:20.447,width:2.8194,bodyAndStepsWidth:2.7432,gutterWidth:2.667,
  // Until an exact matching diagram is selected these are physical authoring parameters.
  floorAboveRail:1.25,doorWidth:.86,doorHeight:2.16,interiorHeight:2.18,roofAboveRail:3.7719,overallAboveRail:3.8989,
  wheelRadius:.5335,bogieCenters:14.1732,bogieWheelbase:2.5908,seatHeight:.46,
  status:Object.freeze({lengthWidth:'Original BR116 Mk1 FK AA101 dimensions; body and overbuffers kept separate',roofWheelBogie:'BR116 roof/overall/bogie; WOSS612 new Commonwealth/BR1 wheel diameter verified',floorDoorSeat:'provisional ergonomic authoring dimensions; not prototype-certified'})});
export const COACH_FLOOR=TRACK.railHead+COACH_DIMENSIONS.floorAboveRail;
export const CONSIST=Object.freeze({frontX:5,coachCount:2,couplingGap:.34,tenderRearX:-12.25,
  tenderRearStatus:'provisional packaging boundary pending complete WD tender drawing; not verified overall length'});
export const COACH_LAYOUT=Object.freeze(Array.from({length:2},(_,i)=>{const x=CONSIST.tenderRearX-CONSIST.couplingGap-COACH_DIMENSIONS.overBuffers/2-i*(COACH_DIMENSIONS.overBuffers+CONSIST.couplingGap);return Object.freeze({id:'coach-'+(i+1),x,length:COACH_DIMENSIONS.underframeLength,overBuffers:COACH_DIMENSIONS.overBuffers,frontDoor:x+8.2,rearDoor:x-8.2});}));
export const PLATFORM_LAYOUT=Object.freeze({minX:COACH_LAYOUT.at(-1).x-COACH_DIMENSIONS.overBuffers/2-2.5,maxX:4.6,top:1.10,minZ:COACH_DIMENSIONS.width/2+.18,maxZ:6.15});
export const CONSIST_BOUNDS=Object.freeze({min:Object.freeze([PLATFORM_LAYOUT.minX+1.7,TRACK.railHead-.05,-1.75]),max:Object.freeze([5.5,4.65,1.75])});
