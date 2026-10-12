// NOT INTEGRATED OR GPU-VALIDATED. Reuses the existing binding4 arena.
// No new storage binding is proposed: the present layout already binds8 storage buffers.
// All production geometryCandidates[i] sites would become geometryScratch.candidates[i].
struct CachedGeometryScratch {
 candidates:array<GeoHit,7168>,
 bounds:array<f32,27648>,
 keys:array<vec4<u32>,1024>
}
@group(0) @binding(4) var<storage,read_write> geometryScratch:CachedGeometryScratch;
fn originalStoreyBound(p:vec3<f32>,s:u32)->f32{
 let a=rec(s,0u);let b=rec(s,1u);let halfW=a.z*.5;let middleZ=(b.x+b.y)*.5;let depth=(b.y-b.x)*.5;
 let center=vec3<f32>(a.x,a.y+a.w*.5,middleZ);
 return boxD(p-center,vec3<f32>(halfW+.9,a.w*.5+.18,depth+1.));
}
fn prepareStoreyBounds(contextId:u32,p:vec3<f32>,worldGeneration:u32)->bool{
 let n=arrayLength(&worldRules)/4u;
 if(n!=27u||contextId>=1024u||worldGeneration==0u){return false;}
 let key=vec4<u32>(bitcast<vec3<u32>>(p),worldGeneration);
 if(all(geometryScratch.keys[contextId]==key)){return true;}
 for(var s=0u;s<n;s++){geometryScratch.bounds[contextId*27u+s]=originalStoreyBound(p,s);}
 geometryScratch.keys[contextId]=key;return true;
}
// Only after geo0's prepare has finished for this active context may groups1..5
// read. All six still execute their original 27-layer ordered scan and h.d gate.
fn readStoreyBound(contextId:u32,p:vec3<f32>,s:u32,cacheReady:bool)->f32{
 if(!cacheReady){return originalStoreyBound(p,s);}
 return geometryScratch.bounds[contextId*27u+s];
}
