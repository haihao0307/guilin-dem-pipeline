export const ET14_LESION_VERSION='ET14-LESION-1';

export const LESION_PROFILES={
 clean:{freckles:0,acne:0,scar:0,pigment:0},
 teenAcne:{freckles:.2,acne:.75,scar:.25,pigment:.3},
 sunFreckles:{freckles:.8,acne:.05,scar:.05,pigment:.55},
 oldMarks:{freckles:.15,acne:.2,scar:.4,pigment:.8},
 outdoor:{freckles:.45,acne:.1,scar:.2,pigment:.7},
 roughWorker:{freckles:.2,acne:.15,scar:.55,pigment:.65}
};

export const LESION_DETAIL_AXES={
 freckles:['density','cluster','size','tone','asymmetry'],
 acne:['active','closed','redness','oiliness','marks','pits','healing'],
 scar:['count','width','depth','height','age','color','direction'],
 pigment:['sun','age','patchiness','contrast']
};

export function composeLesionIdentity(base,profile,seed){
 return {
  version:ET14_LESION_VERSION,
  seed,
  ...base,
  ...profile,
  distribution:'deterministic regional identity field'
 };
}
