// Presentation parameters only. No flight or weapons performance model.
export const SAMPLES = 6;
export const TIRE_IDS = Object.freeze([598,613,1189,1200,681,689,698]);
const finite = x => { if (!Number.isFinite(x)) throw new TypeError('Expected finite number'); return x; };
export const clamp01 = x => Math.min(1,Math.max(0,finite(x)));
export function blurWeight(rpm) { const x=clamp01((Math.abs(finite(rpm))-300)/800); return x*x*(3-2*x); }
export function shutterOffsets(rpm) { const sweep=finite(rpm)*Math.PI/30/48; return Array.from({length:SAMPLES},(_,i)=>-sweep*(i+.5)/SAMPLES); }
export function rollAngle(time,birth) { return Math.max(0,finite(time)-finite(birth))*.8 % (2*Math.PI); }
export function impactShot(time,lastImpact,manual) { const age=finite(time)-finite(lastImpact); return !manual && age>=0 && age<6; }
export function surfaceKind(id,isSkin,metalness,path='') {
 if(TIRE_IDS.includes(id)) return 'tire';
 if(isSkin && metalness>.9 && !/fabric|rudder|elevator|aileron/i.test(path)) return 'skin';
 return null;
}
