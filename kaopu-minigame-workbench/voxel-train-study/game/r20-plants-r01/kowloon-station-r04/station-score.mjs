// Authored architectural proportions, not a measured reconstruction. One recipe
// defines built domains, camera coverage and explicitly unbuilt reservations.
const shed={centers:[-20,0,20],span:20,length:135,bays:18,bay:7.5,front:-10,radius:12.8,eave:9.2};
const goods={centerX:41.5,halfWidth:3,length:84,front:-16,deckTop:.85,eave:5.2,ridge:6.3,bay:7};
export const STATION_SCORE=Object.freeze({schema:'kaopu.kowloon.function-station/4',units:'metres',authoredNotSurveyed:true,hall:{width:60,depth:16,eave:12,bay:7.5},tower:{center:[24,4],height:44},shed,tracks:{centers:[-25,-15,-5,5,15,25],gauge:1.435,assumedVehicleHalfWidth:1.5},platforms:{centers:[-30,-10,10,30],halfWidth:3.4,designedBoardingGap:.1},site:{shoreX:60,quayFront:26,quayBack:-175,goods,siding:{x:50,front:-12,back:-170},forecourt:{center:[0,11.8],halfExtent:[31.2,3],top:.85},passengerWalk:{startX:31,endX:67,z:13,halfWidth:1.8,clearHeight:3.7},road:{leftX:-58,rightX:-43,front:26,back:-175},hotelReservation:{center:[-84,-46],halfExtent:[23,42],built:false},berthReservation:{shoreX:60,zRange:[-150,20],boatsBuilt:false},purpose:'authored passenger/parcel/quay circulation; freight functions are design interpretation, not proven history'},materials:{benchTimber:{textureScale:4,grainContrast:.36,meaning:'same source timber at 49mm coarse and 6.1mm fine transverse periods; within source contrast range'}},fabric:{age:.58,wetness:.12,repair:.08},sourcePhotosPrivate:true});
export const VIEWS=Object.freeze({exterior:{eye:[96,48,55],target:[4,10,-47]},hall:{eye:[-20,2.5,4.2],target:[8,4.2,-1]},platform:{eye:[9,2.5,-126],target:[10,5,-4]},tower:{eye:[42,28,40],target:[24,28,4]},timberLit:{eye:[8.1,1.95,-34.8],target:[9.68,1.85,-36.]},timber:{eye:[11.1,1.95,-34.8],target:[9.68,1.85,-36.]},bench:{eye:[12,2.15,-33.25],target:[10,1.5,-36.25]},quay:{eye:[57,4,-127],target:[40,3,-20]}});
const f=x=>Number.isInteger(x)?x+'.':String(x);
export const SITE_WGSL=String.raw`
const SHED_FRONT:f32=${f(shed.front)};const SHED_LENGTH:f32=${f(shed.length)};const SHED_HALF:f32=${f(shed.length/2)};const SHED_CENTER:f32=${f(shed.front-shed.length/2)};const SHED_BACK:f32=${f(shed.front-shed.length)};const SHED_BAYS:f32=${f(shed.bays)};
const BENCH_WOOD_SCALE:f32=${f(STATION_SCORE.materials.benchTimber.textureScale)};const BENCH_WOOD_CONTRAST:f32=${f(STATION_SCORE.materials.benchTimber.grainContrast)};
const SHORE_X:f32=${f(STATION_SCORE.site.shoreX)};
const GOODS_X:f32=${f(goods.centerX)};const GOODS_HALF:f32=${f(goods.length/2)};const GOODS_CENTER:f32=${f(goods.front-goods.length/2)};
`;
