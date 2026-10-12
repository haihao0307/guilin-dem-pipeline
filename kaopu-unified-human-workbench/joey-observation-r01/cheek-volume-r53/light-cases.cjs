'use strict';
function lightCases(original){
 if(!original||!Number.isFinite(original.key)||!Number.isFinite(original.fill)||original.key<0||original.fill<0)throw Error('Invalid original illumination');
 return [
  {id:'original',options:structuredClone(original),castShadows:true},
  {id:'increased-fill',options:{...structuredClone(original),key:original.key*.5,fill:original.fill+original.key*.5},castShadows:true},
  {id:'no-cast-shadow',options:structuredClone(original),castShadows:false}
 ];
}
module.exports={lightCases};
