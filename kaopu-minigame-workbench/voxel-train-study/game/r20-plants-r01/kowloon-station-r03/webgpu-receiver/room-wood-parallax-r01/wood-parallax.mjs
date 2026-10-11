/** Receiver-only restoration of timber v3 applyParallax (original lines 501–533).
 * Mother algebra and metre-domain geometry stay frozen. No appearance textures.
 * This translates the original 12-layer view march, retaining its 0.30 grazing
 * clamp and normalized tangent convention, including its limitations.
 */
export const WOOD_PARALLAX_WGSL=String.raw`
fn woodWorldToGrain(v:vec3<f32>,variant:i32)->vec3<f32>{return select(v.zyx,v.yxz,variant==1);}
fn woodParallaxSource(baseSourceM:vec3<f32>,localNormal:vec3<f32>,surfaceClass:f32,viewGrain:vec3<f32>,wp:KpWoodParams,physicalFootprintM:f32)->vec3<f32>{
 if(u.woodParallax==0u||wp.reliefQuality<=1.5||wp.parallaxM<=0.||wp.parallaxSteps<=.5){return baseSourceM;}
 let textureScale=max(wp.textureScale,.001);let baseGrain=baseSourceM*textureScale;
 let fp=kpWoodCoordinateFootprint(physicalFootprintM,wp);
 let stepCount=clamp(floor(wp.parallaxSteps+.5),1.,12.);
 let facing=max(abs(dot(viewGrain,localNormal)),.30);
 var tangentView=viewGrain-localNormal*dot(viewGrain,localNormal);
 let tangentLength=length(tangentView);if(tangentLength<.00001){return baseSourceM;}
 tangentView/=tangentLength;
 let layerStep=1./stepCount;
 let delta=tangentView*(wp.parallaxM*textureScale*wp.reliefScale/facing)/stepCount;
 var currentGrain=baseGrain;var previousGrain=currentGrain;
 var currentLayer=0.;var previousLayer=0.;
 var currentDepth=1.-kwCoarseRelief(currentGrain,localNormal,surfaceClass,wp,fp);var previousDepth=currentDepth;
 for(var i=0;i<12;i++){
  if(f32(i)>=stepCount||currentLayer>=currentDepth){break;}
  previousGrain=currentGrain;previousLayer=currentLayer;previousDepth=currentDepth;
  currentGrain-=delta;currentLayer+=layerStep;
  currentDepth=1.-kwCoarseRelief(currentGrain,localNormal,surfaceClass,wp,fp);
 }
 let after=currentDepth-currentLayer;let before=previousDepth-previousLayer;
 let denominator=after-before;var weight=0.;if(abs(denominator)>.00001){weight=clamp(after/denominator,0.,1.);}
 return mix(currentGrain,previousGrain,weight)/textureScale;
}
fn woodReceiverSample(f:RoomField,p:vec3<f32>,rd:vec3<f32>)->KpWoodSample{
 let n=woodLocalNormal(f);let surfaceClass=select(0.,1.,abs(n.x)>.72);
 let wp=kpWoodDefaultParams();let footprint=receiverFootprint(p);
 let q=woodParallaxSource(f.q,n,surfaceClass,woodWorldToGrain(-rd,f.variant),wp,footprint);
 return kpWoodOriginalSample(q,n,surfaceClass,wp,footprint,length(p-u.ro));
}
`;
