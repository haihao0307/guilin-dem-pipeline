// Mirrors Session's existing brake demand only; never changes its physics.
// Cosmetic friction feedback is intentionally exaggerated for the game.
export function brakeDemand(view={}) {
  if(view.started===false||view.phase==='summary'||(view.phase&&view.phase!=='running'))return 0;
  if(view.brake||view.finishing)return view.station?.wet?2.4:3.1;
  const throttle=Number.isFinite(view.throttle)?view.throttle:0;
  return view.reverse?0:Math.max(0,Math.min(2,-throttle))*.6;
}
export function brakeEffort(view={}) {
  const speed=Math.abs(Number(view.velocity)||0),deceleration=brakeDemand(view);
  const active=view.started!==false&&!view.paused&&speed>.05&&deceleration>0;
  return {speed,deceleration,active,strength:active?Math.min(1,deceleration/3.1):0};
}
