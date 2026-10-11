export const TRAIT_SCHEMA='kaopu/facial-identity@1';
export const SHAPE_DEFAULTS=Object.freeze({bridgeMM:0,crease:0,creaseHeightMM:3.4,creaseWidthMM:.8});
export const SHAPE_FIELDS=[['bridgeMM','鼻梁局部高度',-3,3,.1,'mm'],['crease','睑褶显著度（单／双倾向）',-1,1,.05,''],['creaseHeightMM','睑褶距睑缘',2.2,5.5,.1,'mm'],['creaseWidthMM','睑褶过渡宽度',.45,1.6,.05,'mm']];
export const TRAIT_DEFAULTS=Object.freeze({enabled:true,seed:1729,freckles:0,freckleSize:.65,freckleContrast:.55,freckleSpread:.65,acne:0,acneSize:1.25,acneRedness:.65,acneRelief:.28,acneWhiteheads:.35,acneMarks:0,pittedScars:0,forehead:0,frown:0,crowsFeet:0,underEye:0,nasolabial:0,lipLines:0,wrinkleDepth:.22,wrinkleWidth:.55,wrinkleIrregularity:.65,darkCircles:0,ageSpots:0,ageSpotSize:2.1,scar:0,scarX:33,scarY:275,scarLength:22,scarAngle:-25,scarWidth:1.3,scarRelief:-.18,scarAge:.75,scarJagged:.45,moles:0,moleX:-35,moleY:256,moleSize:1.0,redPatches:0});
export const TRAIT_FIELDS=[
 ['freckles','雀斑密度',0,1,.02,'','色斑'],['freckleSize','雀斑半径',.2,1.8,.05,'mm','色斑'],['freckleContrast','雀斑深浅',0,1,.05,'','色斑'],['freckleSpread','雀斑分布宽度',.2,1,.05,'','色斑'],['ageSpots','不规则色斑密度',0,1,.05,'','色斑'],['ageSpotSize','色斑半径',.8,4,.1,'mm','色斑'],['darkCircles','眼下暗沉',0,1,.05,'','色斑'],['redPatches','局部泛红',0,1,.05,'','色斑'],
 ['acne','痘痘密度',0,1,.025,'','痘痘'],['acneSize','痘痘半径',.5,2.5,.1,'mm','痘痘'],['acneRedness','痘痘红度',0,1,.05,'','痘痘'],['acneRelief','痘痘微表面隆起',0,.6,.02,'mm','痘痘'],['acneWhiteheads','浅色痘头比例',0,1,.05,'','痘痘'],['acneMarks','平面痘印',0,1,.05,'','痘痘'],['pittedScars','凹陷痘印',0,1,.05,'','痘痘'],
 ['forehead','额头横纹',0,1,.05,'','皱纹'],['frown','眉间纵纹',0,1,.05,'','皱纹'],['crowsFeet','外眼角鱼尾纹',0,1,.05,'','皱纹'],['underEye','眼下细纹',0,1,.05,'','皱纹'],['nasolabial','鼻唇纹理',0,1,.05,'','皱纹'],['lipLines','唇周纵纹',0,1,.05,'','皱纹'],['wrinkleDepth','纹路深度',.04,.5,.02,'mm','皱纹'],['wrinkleWidth','纹路宽度',.2,1.2,.05,'mm','皱纹'],['wrinkleIrregularity','纹路不规则度',0,1,.05,'','皱纹'],
 ['scar','疤痕显著度',0,1,.05,'','疤痕'],['scarX','疤痕左右位置',-58,58,1,'mm','疤痕'],['scarY','疤痕上下位置',205,377,1,'mm','疤痕'],['scarLength','疤痕长度',3,45,1,'mm','疤痕'],['scarAngle','疤痕角度',-180,180,5,'°','疤痕'],['scarWidth','疤痕宽度',.4,4,.1,'mm','疤痕'],['scarRelief','凹陷 ← 疤痕高度 → 凸起',-.6,.6,.025,'mm','疤痕'],['scarAge','新红 ← 疤痕颜色 → 淡旧',0,1,.05,'','疤痕'],['scarJagged','疤痕曲折程度',0,1,.05,'','疤痕'],
 ['moles','痣显著度',0,1,.05,'','痣'],['moleX','痣左右位置',-60,60,1,'mm','痣'],['moleY','痣上下位置',205,377,1,'mm','痣'],['moleSize','痣半径',.3,2.5,.1,'mm','痣']
];
export function validateTraits(input){
 if(!input||Array.isArray(input)||typeof input!=='object')throw Error('无效皮肤身份档案');const s={...TRAIT_DEFAULTS,...input};
 for(const k of Object.keys(s))if(!(k in TRAIT_DEFAULTS))throw Error('未知皮肤特征 '+k);
 if(typeof s.enabled!=='boolean'||!Number.isInteger(s.seed)||s.seed<0||s.seed>2147483647)throw Error('无效特征开关或随机种子');
 for(const[k,,lo,hi]of TRAIT_FIELDS)if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('皮肤参数越界 '+k);return s;
}
export function validateShape(input){if(!input||Array.isArray(input)||typeof input!=='object')throw Error('无效形态扩展');const s={...SHAPE_DEFAULTS,...input};for(const k of Object.keys(s))if(!(k in SHAPE_DEFAULTS))throw Error('未知形态扩展 '+k);for(const[k,,lo,hi]of SHAPE_FIELDS)if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)throw Error('形态参数越界 '+k);return s;}
export const SKIN_RECIPES={
 clean:{label:'无附加特征',traits:{}},
 freckles:{label:'鼻颊雀斑',traits:{freckles:.62,freckleSize:.75,freckleContrast:.68}},
 acne:{label:'痘痘与痘印',traits:{acne:.60,acneMarks:.35,acneRedness:.80,acneRelief:.35,acneWhiteheads:.4}},
 mature:{label:'熟龄纹路',traits:{forehead:.7,frown:.6,crowsFeet:.8,underEye:.45,nasolabial:.5,lipLines:.35,wrinkleDepth:.27,darkCircles:.35,ageSpots:.3}},
 weathered:{label:'风化色斑',traits:{forehead:.65,crowsFeet:.85,ageSpots:.65,freckles:.15,freckleContrast:.75,darkCircles:.3}},
 scar:{label:'淡旧凹疤',traits:{scar:1,scarLength:28,scarWidth:1.6,scarRelief:-.28,scarAge:.85}},
 raised:{label:'隆起疤痕',traits:{scar:1,scarLength:24,scarWidth:2.3,scarRelief:.36,scarAge:.38,scarAngle:30}},
 marks:{label:'痘坑与痣',traits:{pittedScars:.5,acneMarks:.35,moles:.8,moleX:-35,moleY:258,moleSize:1.2}}
};
