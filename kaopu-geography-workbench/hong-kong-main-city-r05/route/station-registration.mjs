// Shared station/track anchor. No source station mesh, scale, or A6 code is edited.
const oldPlacement='let x=1477.171-(p[2]-4),z=9824.015+(p[0]-24),y=3.90+p[1];';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function createKowloonRegistration(anchor){
 check(anchor.schema==='hk.game.kowloon-shared-registration/1','Unsupported Kowloon registration');
 const c=anchor.clockAnchorSceneXYZ;
 const toScene=([x,y,z])=>[c[0]-(z-4),c[1]+y,c[2]+(x-24)];
 const fromScene=([x,y,z])=>[z-c[2]+24,y-c[1],c[0]-x+4];
 const trackAtNativeZ=z=>toScene([anchor.track.nativeCentreX,anchor.track.nativeRailTopY,z]);
 return {anchor,toScene,fromScene,trackAtNativeZ,platformCenterS:anchor.platform.platformCenterS,clockAnchorSceneXYZ:[...c]};
}
export function patchKowloonStationHost(html,registration){
 check(html.split(oldPlacement).length===2,'Kowloon station placement anchor must occur exactly once');
 const c=registration.anchor.clockAnchorSceneXYZ;
 html=html.replace(oldPlacement,`let x=${c[0]}-(p[2]-4),z=${c[2]}+(p[0]-24),y=${c[1]}+p[1];`);
 const oldCamera='"kowloon":{"target":[1477.170999999973,18,9794.015000000014]';
 check(html.split(oldCamera).length===2,'Kowloon camera anchor must occur exactly once');
 html=html.replace(oldCamera,`"kowloon":{"target":[${c[0]},18,${c[2]-30}]`);
 return html;
}
export async function installKowloonRegistration({target=globalThis,anchorURL=new URL('./station-anchor.json',import.meta.url)}={}){
 if(target.HKKowloonRegistration?.anchor?.schema==='hk.game.kowloon-shared-registration/1')return target.HKKowloonRegistration;
 const response=await fetch(anchorURL);check(response.ok,'Kowloon shared anchor unavailable: '+response.status);
 return target.HKKowloonRegistration=createKowloonRegistration(await response.json());
}
export function assessPlatformStop(route,stop,consist,{hardTrackEndMarginM=.5,desiredPlatformMarginM=0}={}){
 const center=stop.platformCenterS??stop.d,front=consist.frontOffsetM,rear=consist.rearOffsetM;
 check([center,front,rear,hardTrackEndMarginM,desiredPlatformMarginM].every(Number.isFinite)&&front>rear&&hardTrackEndMarginM>=0,'Invalid consist or track-end policy');
 const locomotiveOriginS=center-(front+rear)/2,frontS=locomotiveOriginS+front,rearS=locomotiveOriginS+rear;
 const platformLengthM=stop.platformLengthM??null,platformStartS=stop.platformStartS??(platformLengthM===null?null:center-platformLengthM/2),platformEndS=stop.platformEndS??(platformLengthM===null?null:center+platformLengthM/2);
 const rearPlatformMarginM=platformStartS===null?null:rearS-platformStartS,frontPlatformMarginM=platformEndS===null?null:platformEndS-frontS;
 return {platformCenterS:center,locomotiveOriginS,consistCenterS:(frontS+rearS)/2,frontS,rearS,lengthM:front-rear,platformLengthM,rearPlatformMarginM,frontPlatformMarginM,platformFit:platformLengthM===null?null:rearPlatformMarginM>=desiredPlatformMarginM&&frontPlatformMarginM>=desiredPlatformMarginM,trackEndSafe:rearS>=hardTrackEndMarginM&&frontS<=route.length-hardTrackEndMarginM,hardTrackEndMarginM,desiredPlatformMarginM,policy:'Exact complete-consist centring. No implicit clamp, source-platform resizing, or silent route extension.'};
}
