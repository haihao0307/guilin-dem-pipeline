// Exposes the existing host clock, not a second timer or kinematic animation.
export function patchGameClockHost(html){
 const from='createIntegration({gl,canvas,HK,mapState,hkHeight,hkHeights,hkMask,requestFrame:';
 const to='createIntegration({gl,canvas,HK,mapState,hkHeight,hkHeights,hkMask,simulationClock:{get paused(){return paused},setPaused(value){paused=!!value;if(paused)W.pause();else W.play();last=performance.now();frameTimes=[];completeAt=0;needFrame=true;return paused}},requestFrame:';
 if(html.split(from).length!==2)throw Error('R07 host simulation clock anchor is not unique');
 return html.replace(from,to);
}
// Keep the original closure state/UI and DrivingPhysics snapshot synchronized.
export function patchGameStateRuntime(text){
 const pairs=[
  ['y.pause(!1),B=!1,k="follow"','I=y.pause(!1),B=!1,k="follow"'],
  ['B=!B,y.pause(B),Y(),a()','B=!B,I=y.pause(B),Y(),a()'],
  ['pause(G=!0){B=G,y.pause(G),a()}','pause(G=!0){B=!!G,I=y.pause(B),Y(),a()}']
 ];
 for(const[a,b]of pairs){if(text.split(a).length!==2)throw Error('R07 game state anchor is not unique: '+a);text=text.replace(a,b);}
 return{text,applied:['snapshot_after_start','snapshot_after_pause','original_ui_refresh']};
}
