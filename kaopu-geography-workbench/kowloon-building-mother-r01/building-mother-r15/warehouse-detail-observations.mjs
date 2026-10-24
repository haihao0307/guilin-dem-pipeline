/** Manually traced from the existing official p012 atlas crop, 1012×734.
 * Crop x/y are image pixels, never asserted to be measured building coordinates.
 * 3 grid groups and 12 partial external-unit fronts are visibly distinguishable.
 * Image lower boundary clips units; never extrapolate a full unseen appliance.
 */
export const GRID_TRACES=[
 {id:'grid-01',bbox:[164,685,244,732],vertical:[182,201,220],horizontal:[696,708,720]},
 {id:'grid-02',bbox:[472,685,553,732],vertical:[491,510,530],horizontal:[696,708,720]},
 {id:'grid-03',bbox:[778,685,859,732],vertical:[797,816,836],horizontal:[696,708,720]}
];
export const UNIT_TRACES=[
 [247,710,273,734],[285,710,311,734],[324,710,350,734],[363,710,389,734],[402,710,428,734],[441,710,467,734],
 [558,710,584,734],[597,710,623,734],[636,710,662,734],[675,710,701,734],[714,710,740,734],[753,710,779,734]
].map((bbox,i)=>({id:'external-unit-'+String(i+1).padStart(2,'0'),bbox,fanCenter:[(bbox[0]+bbox[2])/2,bbox[1]+20],fanRadiusPixels:8,bottomClipped:true}));
export const DETAIL_EVIDENCE={source:'existing official atlas B369121858401063A0_001.jpg p012',crop:[2060,4,3072,738],pixelTraceUncertainty:3,gridLineCountStatus:'visible approximate trace; blurred line intersections',actualUnitModel:null,actualDepth:null,sourceUVToXYZ:'unresolved horizontal affine candidate',wallCut:false,glass:false};
