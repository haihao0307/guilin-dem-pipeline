// Public inspectable cameras use the same route/portal geometry as the renderer.
export function poseFromEyeTarget(eye,target){
 if(![...eye,...target].every(Number.isFinite))throw Error('Review camera requires finite positions');
 const d=target.map((v,i)=>v-eye[i]),distance=Math.hypot(...d);if(!(distance>0))throw Error('Review eye and target must differ');
 return{target:[...target],distance,yaw:Math.atan2(d[0],-d[2]),pitch:Math.asin(d[1]/distance)};
}
export function portalCameraPose(route,portals,side='south'){
 const i=side==='north'?1:0,s=portals.mainCoveredInterval[i],open=(portals.openCuttingIntervals||[]).find(r=>Math.abs(r[i===0?1:0]-s)<1e-5);
 if(!open)throw Error('No verified open approach next to main portal');
 const offset=Math.min(30,(open[1]-open[0])*.5),eyeS=s+(i===0?-offset:offset),q=route.sample(s),e=route.sample(eyeS);
 return{...poseFromEyeTarget([e.p[0],e.p[1]+2.2,e.p[2]],[q.p[0],q.p[1]+3.6,q.p[2]]),eyeS,portalS:s,approachInterval:open.slice()};
}
export function installR06Views(host,game,{overview}){
 const {mapState,requestFrame}=host,route=game.route;
 const set=(target,distance,yaw,pitch)=>{overview?.cancel();game.setMode('map');Object.assign(mapState,{target,distance,yaw,pitch,labels:true,story:true});requestFrame();};
 const tunnelState=()=>{const t=window.HKLionRockTunnelScene;if(!t?.ready)throw Error('Tunnel is not ready');return t.stats();};
 function focusPortal(side='south'){
  const p=portalCameraPose(route,tunnelState().portals,side);set(p.target,p.distance,p.yaw,p.pitch);return p;
 }
 function focusTunnelInterior(){
  const t=tunnelState(),ranges=t.portals.coveredIntervals||t.coveredIntervals||[t.portals.portalChainages],r=ranges.reduce((a,b)=>b[1]-b[0]>a[1]-a[0]?b:a),s=(r[0]+r[1])/2,eye=route.sample(s),look=route.sample(s+12),dx=look.p[0]-eye.p[0],dz=look.p[2]-eye.p[2],dy=look.p[1]-eye.p[1],distance=Math.hypot(dx,dy,dz);
  set([look.p[0],look.p[1]+2.2,look.p[2]],distance,Math.atan2(dx,-dz),Math.asin(dy/distance));
 }
 const api={setReviewCamera(c){if(!c?.cam||!c?.fw||!Number.isFinite(c.distance)||c.distance<=0)throw Error('Invalid fixed review camera');const p=poseFromEyeTarget(c.cam,c.cam.map((v,i)=>v+c.fw[i]*c.distance));set(p.target,p.distance,p.yaw,p.pitch);return p;},focusCoast:()=>set([4400,25,6420],3000,-.48,-1.03),focusPortal,focusTunnelInterior,stats:()=>({mapCamera:{...mapState},tunnel:window.HKLionRockTunnelScene?.stats(),diagnostics:window.HKMapDiagnostics?.stats(),coast:window.HKCoastClosure.stats()})};
 const bar=document.getElementById('routeR04Toolbar');for(const [label,fn]of[['隧道南口',()=>focusPortal('south')],['洞内',focusTunnelInterior],['隧道北口',()=>focusPortal('north')]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.disabled=!window.HKLionRockTunnelScene?.ready;bar.insertBefore(b,bar.querySelector('#r04RouteSummary'));}
 window.HKMapR06=api;return api;
}
