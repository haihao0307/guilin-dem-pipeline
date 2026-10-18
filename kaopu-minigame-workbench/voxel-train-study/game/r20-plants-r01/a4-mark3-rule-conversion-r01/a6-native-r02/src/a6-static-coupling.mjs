/** Independent A6 static layout adapter. Not part of the frozen original mechanics.
 * This visibly connects two known native attachment regions only. It is not a
 * compatible certified coupler, load-path solution or articulated mechanism.
 */
import {A6Mesh,range,boundsOf} from './a6-shell-geometry.mjs';
const META=Object.freeze({purpose:'design static connecting adapter/drawbar',provisional:true,originalMechanicalComponent:false,sourceGeometryUsed:false,loadOrKinematicsValidated:false,visibleWhenShellHidden:true});
function plate(name,center,size,material){const m=new A6Mesh(name,material,'design-static-coupling',META),q=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>v.map((x,i)=>center[i]+x*size[i]/2));for(const [ids,n]of [[ [0,3,2,1],[0,0,-1]],[[4,5,6,7],[0,0,1]],[[0,4,7,3],[-1,0,0]],[[1,2,6,5],[1,0,0]],[[0,1,5,4],[0,-1,0]],[[3,7,6,2],[0,1,0]]])m.quad(ids.map((i,k)=>({point:q[i],normal:n,uv:[[0,0],[1,0],[1,1],[0,1]][k]})));return m.finish();}
function eye(name,c,outer=.075,inner=.029,thickness=.060){
  const m=new A6Mesh(name,'brushedMetal','design-static-coupling',META),angles=range(0,2*Math.PI,32),P=(r,y,a)=>[c[0]+r*Math.cos(a),c[1]+y,c[2]+r*Math.sin(a)];
  for(let i=0;i<32;i++){const a=angles[i],b=angles[i+1];for(const sign of [-1,1]){const y=sign*thickness/2,n=[0,sign,0];m.quad([[inner,a],[outer,a],[outer,b],[inner,b]].map(([r,t])=>({point:P(r,y,t),normal:n,uv:[r,t]})));}for(const [r,sign]of [[outer,1],[inner,-1]])m.quad([[a,-thickness/2],[b,-thickness/2],[b,thickness/2],[a,thickness/2]].map(([t,y])=>({point:P(r,y,t),normal:[sign*Math.cos(t),0,sign*Math.sin(t)],uv:[t*r,y]})));}return m.finish();
}
function pin(name,c,r=.024,length=.15){
  const m=new A6Mesh(name,'brushedMetal','design-static-coupling',META),angles=range(0,2*Math.PI,24),P=(a,y)=>[c[0]+r*Math.cos(a),c[1]+y,c[2]+r*Math.sin(a)];
  for(let i=0;i<24;i++){const a=angles[i],b=angles[i+1];m.quad([[a,-length/2],[b,-length/2],[b,length/2],[a,length/2]].map(([t,y])=>({point:P(t,y),normal:[Math.cos(t),0,Math.sin(t)],uv:[t*r,y]})));for(const sign of [-1,1]){const y=sign*length/2,n=[0,sign,0];m.triangle([[c[0],c[1]+y,c[2]],P(a,y),P(b,y)],[n,n,n],[[0,0],[r,a],[r,b]]);}}return m.finish();
}
export function buildA6StaticCoupling(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected static coupling parameters');
  for(const k of Object.keys(input))if(k!=='coachOffsetZ')throw new RangeError(`Unknown static coupling parameter: ${k}`);
  const coachOffsetZ=input.coachOffsetZ??32.34;if(!Number.isFinite(coachOffsetZ)||coachOffsetZ<32.0||coachOffsetZ>33.0)throw new RangeError('coachOffsetZ outside supported provisional static layout');
  // Explicit construction centres in the unchanged native generators, not bbox guesses.
  const tenderAnchor=[0,1.30,19.977875],coachHead=[0,.82,coachOffsetZ-11.43],dropPin=[0,.82,20.16];
  const barStart=dropPin[2]+.045,barEnd=coachHead[2]-.045;if(barEnd<=barStart)throw new RangeError('No positive drawbar span');
  const parts=[
    plate('a6-design-static-tender-drop-adapter',[0,1.06,20.11],[.22,.56,.10],'blackPaint'),
    plate('a6-design-static-drawbar',[0,.82,(barStart+barEnd)/2],[.10,.065,barEnd-barStart],'brushedMetal'),
    eye('a6-design-static-tender-eye',dropPin),eye('a6-design-static-coach-eye',coachHead),
    pin('a6-design-static-tender-pin',dropPin),pin('a6-design-static-coach-pin',coachHead)
  ];
  return {schema:'kaopu.a6-design-static-coupling/1.0',parts,parameters:{coachOffsetZ},bounds:boundsOf(parts),purpose:META.purpose,provisional:true,
    evidence:{tender:{part:'tender-end-dragbox-1',nativeConstructionCentre:tenderAnchor,mainBeamRearFaceZ:20.077875,wholePartBounds:{min:[-1.18,1.03,19.827875],max:[1.18,1.465,20.127875]},source:'student-native-r01/src/locomotive-mechanics.mjs: tenderFrameEnd and tender-end-dragbox construction'},
      coach:{part:'end-services--1-coupling-head',nativeConstructionCentre:[0,.82,-11.43],assembledConstructionCentre:coachHead,source:'student-native-r01/src/coach-mechanics.mjs: addEndServices P(0,Y,.145), sign=-1'},
      heightDifferenceM:.48,newAdapterLowerPin:dropPin,newDrawbarPinCentres:[dropPin,coachHead],
      attachmentInterpretation:'New drop plate overlaps the actual tender rear main-beam face; a horizontal concept link and independent eye/pin terminate at the existing coach-head construction centre. The native coach coupling type itself is unresolved.',
      correction:'The rear-most tender cross-stretcher point20.186767 is not a coupler and is not used as an attachment datum.'},
    interfaces:{visibleWhenShellHidden:true,coordinateSystem:'locomotive/world rest frame; x lateral, y rail-up, z rearward, design m',noOriginalPartsChanged:true},
    limitations:['New authored static layout structure, separate from preserved mechanical parts.','Exact coupling compatibility, force transfer, strength, articulation, slack, collisions and safety are not verified.','Do not describe this display connection as a completed mechanical or operating train.']};
}
