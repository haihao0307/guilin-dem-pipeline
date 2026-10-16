// Applied only after the frozen train source SHA and R02 rail/projection anchors.
const escaped=s=>JSON.stringify(s).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
export function patchRouteMetadata(text){
 const patches=[
  [escaped('接近本版線路邊界，已自動制動；本階段終點為沙田。'),'(\"接近暂行线路终点，已自动制动：\"+w.stops.at(-1).name+\"。\")'],
  ['routeTier:"Kowloon to Sha Tin; tunnel corridor shown with local terrain cutaway; no tunnel lining or engineering certification"','routeTier:w.metadata.routeTier'],
  ['build:"HK-TRAIN88-R01",state:I','build:"HK-TRAIN88-R04",state:I'],
  ['candidates:Q};async function te()', 'candidates:Q,attachRouteScene:factory=>factory({THREE:fs,scene:d,route:w,track:A,makeTrack:ev,requestFrame:a})};async function te()']
 ];
 for(const [a,b]of patches){if(text.split(a).length!==2)throw Error('R04 route metadata anchor not unique: '+a.slice(0,60));text=text.replace(a,b);}
 return {text,applied:['terminus_from_actual_route','route_tier_from_actual_route','new_runtime_identity','shared_scene_yard_attachment']};
}
