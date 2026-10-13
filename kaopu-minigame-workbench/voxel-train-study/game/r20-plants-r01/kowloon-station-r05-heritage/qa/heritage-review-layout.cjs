// Native pixel layout only; no geometry, material or camera substitution.
const shapes={towerWhole:{x:250,y:35,w:140,h:340},towerWindow:{x:200,y:20,w:224,h:360},towerLantern:{x:220,y:50,w:200,h:310},heritageHall:{x:120,y:125,w:360,h:180}};
const smokes={towerWhole:{x:312,y:208,w:18,h:18},towerWindow:{x:366,y:214,w:18,h:18},towerLantern:{x:342,y:208,w:18,h:18},heritageHall:{x:305,y:208,w:18,h:18}};
function layout(view,{smoke=false,scale=1,tileIndex=null}={}){
 scale=smoke?1:Number(scale);if(![.5,1].includes(scale))throw Error('Only native half/full scales');
 const source=smoke?smokes[view]:shapes[view];if(!source)throw Error('Unknown view');
 const assemblyCrop=Object.fromEntries(Object.entries(source).map(([k,v])=>[k,Math.floor(v*scale)]));
 let crop=assemblyCrop,tile=null;
 if(tileIndex!==null){
  if(smoke||view!=='heritageHall'||scale!==.5||!Number.isInteger(tileIndex)||tileIndex<0||tileIndex>2)throw Error('Hall tiling requires small review, tile 0..2');
  const core={x:assemblyCrop.x+tileIndex*60,y:assemblyCrop.y,w:60,h:assemblyCrop.h};
  crop={x:core.x-2,y:core.y-2,w:core.w+4,h:core.h+4};tile={index:tileIndex,count:3,core,halo:2,assemblyCrop};
 }
 return {width:640*scale,height:426*scale,scale,crop,tile,suffix:smoke?'-smoke':tile?'-tile'+tileIndex:scale===.5?'-small':''};
}
module.exports={layout};
