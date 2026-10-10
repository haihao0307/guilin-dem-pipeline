// ET14 layered skin evolution kernel.
// Adds semantic layers above ET13 without replacing native face parameters.
export const ET14_VERSION='ET14-SKIN-WRINKLE-1';

export const WRINKLE_LAYERS=[
 {id:'structural',name:'结构皱纹',regions:['forehead','glabella','nasolabial','marionette'],depth:1,width:1},
 {id:'compression',name:'压缩折叠',regions:['eye','mouth'],depth:.7,width:.8},
 {id:'micro',name:'微细皮沟',regions:['whole_face'],depth:.18,width:.35}
];

export const SKIN_TYPES={
 porcelain:{name:'细腻薄皮',roughness:.28,pore:.25,oil:.32,variation:.18},
 natural:{name:'自然平衡',roughness:.5,pore:.55,oil:.5,variation:.4},
 dry:{name:'干燥粗糙',roughness:.78,pore:.62,oil:.2,variation:.65},
 oily:{name:'油性皮肤',roughness:.48,pore:.82,oil:.88,variation:.55},
 weathered:{name:'风化皮肤',roughness:.82,pore:.9,oil:.18,variation:.9},
 youthful:{name:'年轻紧致',roughness:.25,pore:.3,oil:.45,variation:.2},
 mature:{name:'熟龄松弛',roughness:.7,pore:.72,oil:.35,variation:.75}
};

export const LESION_TYPES={
 freckles:{density:[0,1],cluster:[0,1],tone:[0,1],radius:[.2,2]},
 acne:{active:[0,1],closed:[0,1],redness:[0,1],marks:[0,1],pits:[0,1]},
 scar:{count:[0,8],raised:[0,1],depressed:[0,1],age:[0,1],irregularity:[0,1]},
 pigment:{sun:[0,1],age:[0,1],patch:[0,1]}
};

export function wrinkleResponse(stress,base){
 // approximation of skin reservoir behavior:
 // compression => deeper/narrower; stretch => shallower/wider
 const compression=Math.max(0,-stress);
 const stretch=Math.max(0,stress);
 return {
  depth:base.depth*(1+compression*.75-stretch*.45),
  width:base.width*(1+stretch*.55-compression*.3),
  activation:Math.min(1,Math.abs(stress))
 };
}

export function createIdentitySkinProfile(seed,bodyLogic={}){
 const presets=['porcelain','natural','dry','oily','weathered','youthful','mature'];
 const index=Math.abs(seed)%presets.length;
 return {
  version:ET14_VERSION,
  skinType:presets[index],
  wrinkles:{age:Math.min(1,(seed%100)/100),expression:.35},
  lesions:{freckles:.2,acne:.1,scar:.05,pigment:.15},
  bodyLogic,
  generated:true
 };
}
