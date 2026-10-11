// ET14 material response layer.
// This keeps ET13 texture identity fields and adds perceptual skin response.
export const ET14_SHADER_LAYER='ET14-SKIN-SHADER-1';

export const SKIN_RESPONSE_FIELDS={
  roughness:{min:.15,max:.95},
  poreContrast:{min:0,max:1},
  microNormal:{min:0,max:1},
  oilResponse:{min:0,max:1},
  translucency:{min:0,max:1},
  colorVariation:{min:0,max:1}
};

export function buildSkinResponse(profile){
 const type=profile?.skinType||'natural';
 const table={
  porcelain:{roughness:.28,poreContrast:.25,microNormal:.3,oilResponse:.45,translucency:.8,colorVariation:.2},
  natural:{roughness:.5,poreContrast:.5,microNormal:.55,oilResponse:.5,translucency:.55,colorVariation:.45},
  dry:{roughness:.82,poreContrast:.7,microNormal:.8,oilResponse:.18,translucency:.35,colorVariation:.7},
  oily:{roughness:.4,poreContrast:.75,microNormal:.5,oilResponse:.9,translucency:.6,colorVariation:.5},
  weathered:{roughness:.86,poreContrast:.9,microNormal:.9,oilResponse:.15,translucency:.25,colorVariation:.85},
  youthful:{roughness:.24,poreContrast:.3,microNormal:.35,oilResponse:.55,translucency:.85,colorVariation:.25},
  mature:{roughness:.72,poreContrast:.78,microNormal:.75,oilResponse:.3,translucency:.4,colorVariation:.75}
 };
 return {...table.natural,...table[type],version:ET14_SHADER_LAYER};
}

export function wrinkleMaterialBlend(wrinkle,skin){
 return {
  normalDepth:Math.min(1,wrinkle.depth*(.65+skin.microNormal*.35)),
  roughnessChange:Math.min(1,wrinkle.age*.35+skin.roughness*.25),
  colorFold:wrinkle.age*.18
 };
}
