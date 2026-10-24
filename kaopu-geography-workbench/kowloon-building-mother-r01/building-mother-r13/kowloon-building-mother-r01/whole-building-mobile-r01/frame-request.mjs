/** Scheduling identity only: never changes fields, rays, material or pixel grid. */
export function sameFrameRequest(a,b){
 if(!a||!b)return false;
 return a.width===b.width&&a.view===b.view&&JSON.stringify(a.visible)===JSON.stringify(b.visible)&&JSON.stringify(a.camera)===JSON.stringify(b.camera);
}
export function shouldPreemptOnRelease(active,pending){return !!active&&!!pending&&!sameFrameRequest(active,pending);}
