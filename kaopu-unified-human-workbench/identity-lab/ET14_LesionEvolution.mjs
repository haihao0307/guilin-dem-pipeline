export const ET14_LESION_VERSION='ET14-LESION-1';

export const LESION_PROFILES={
 clear:{freckles:0,acne:0,scar:0,pigment:0},
 frecklesYouth:{freckles:.75,acne:.05,scar:0,pigment:.1},
 acneYouth:{freckles:.1,acne:.8,scar:.35,pigment:.25},
 sunExposure:{freckles:.35,acne:.1,scar:.1,pigment:.8},
 oldScar:{freckles:.05,acne:.05,scar:.75,pigment:.45}
};

export const LESION_REGIONS={
 tzone:{name:'T区',weight:{acne:1.0,pore:1.0}},
 cheek:{name:'颧颊',weight:{freckles:1.0,sun:1.0}},
 jaw:{name:'下颌',weight:{acne:.8,scar:.8}},
 eye:{name:'眼周',weight:{wrinkle:1.0,dark:.8}}
};

export function lesionBlend(base,detail){
 return {
  freckles:Math.min(1,base.freckles+detail.freckles),
  acne:Math.min(1,base.acne+detail.acne),
  scar:Math.min(1,base.scar+detail.scar),
  pigment:Math.min(1,base.pigment+detail.pigment)
 };
}

export function scarProfile(type='old'){
 return {
  new:{redness:.9,relief:.2,colorAge:.1},
  old:{redness:.2,relief:.4,colorAge:.8},
  depressed:{redness:.3,relief:-.6,colorAge:.7}
 }[type];
}
