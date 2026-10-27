/* Own KAOPU V6 consumer, narrow A4 joint family. This is a generator, not a mesh.
 * Exact original Number operations expand shared Mother/parameters + placement
 * into the retained analytic AST. Expanded AST/GLSL are rebuildable caches.
 * No new historical dimensions, noise, material system, or independent clock.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KAOPU_SHAPE_LANGUAGE=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='KAOPU-A4-joint-consumer-01',MOTHER='a4/finite-steam-joint@1',GROUP='a4/shared-steam-joint-dimensions@1';
const cyl=(a,b,r)=>({op:'cylinder',a,b,r}),uni=(...nodes)=>({op:'union',nodes}),diff=(a,b)=>({op:'subtract',a,b});
function createJointMother(input){
 const ownedInstances=new WeakSet();
 const B={lensHalf:input.lensHalf,flangeRadius:input.flangeRadius,flangeThickness:input.flangeThickness,outer:input.pipeOuter},J={...input.fastener};
 for(const n of [...Object.values(B),...['count','pitchRadius','angleOffset','rodRadius','holeRadius','washerRadius','washerThickness','nutApothem','nutThickness','endReserve'].map(k=>J[k])])if(!Number.isFinite(n))throw Error('Finite joint dimensions required');
 for(const n of [...Object.values(B),...['pitchRadius','rodRadius','holeRadius','washerRadius','washerThickness','nutApothem','nutThickness','endReserve'].map(k=>J[k])])if(n<=0)throw Error('Positive joint dimensions required');
 if(J.count!==4)throw Error('This evidenced candidate contract is the retained four-stud joint');
 const parameters=Object.freeze({id:GROUP,values:Object.freeze({...B,fastener:Object.freeze(J)}),units:'m except count and angleOffset(rad)',numberContract:'JavaScript Number, retained operation order; unchanged GLSL literals retain original GPU rounding',dimensions:'inferred retained GAME candidate; not measured A4'});
 const mother=Object.freeze({id:MOTHER,version:1,contract:'analytic negative-inside CSG boundary fields; not all primitives exact SDF',shape:'two finite annular flanges, four nominal studs, eight hex nuts and eight annular washers',generatorOrigin:'joint axis at lens interface; not mass centre',axes:Object.freeze(['model transverse x','model vertical y','model longitudinal z']),units:'m',parameterGroup:GROUP,fieldSlots:Object.freeze(['steelFlange','castFlange','studs','nuts','washers']),threadResolved:false,preloadVerified:false,noise:false,materialChange:false});
 function instantiate({id,origin,parent,timeReference,port,memberIDs}){
  if(typeof id!=='string'||!id||typeof parent!=='string'||!parent||typeof timeReference!=='string'||!timeReference)throw Error('Explicit instance/parent/shared Time references required');
  if(!Array.isArray(origin)||origin.length!==3||!Array.from(origin).every(Number.isFinite))throw Error('Explicit finite model-local generation origin required');
  if(typeof port!=='string'||!port)throw Error('Existing interface reference required');
  if(!memberIDs||mother.fieldSlots.some(k=>typeof memberIDs[k]!=='string'||!memberIDs[k]))throw Error('Existing member identities required');
  const instance=Object.freeze({id,mother:MOTHER,parameterGroup:GROUP,Time:Object.freeze({kind:'mechanical phase reference',reference:timeReference,unit:'rad',evolution:'static relative to assembly; no second clock',creationDate:null,historicalDate:null}),Location:Object.freeze({parent,origin:Object.freeze(origin.slice()),units:'m',axes:mother.axes,worldPlacement:null,region:null}),Object:Object.freeze({members:Object.freeze({...memberIDs}),interface:port,relation:'shared lens-joint clamp; preserves existing steel/lens/cast connection',dimensionEvidence:'inferred candidate',sameTime:true})});ownedInstances.add(instance);return instance;
 }
 function expand(instance){
  if(!ownedInstances.has(instance)||instance?.mother!==MOTHER||instance.parameterGroup!==GROUP)throw Error('Wrong joint Mother or parameter group');
  const [x,jointY,z]=instance.Location.origin;
  // Preserve original arithmetic and node ordering. Do not rebase p or round data.
  const centers=Array.from({length:J.count},(_,k)=>[x+J.pitchRadius*Math.cos(J.angleOffset+k*2*Math.PI/J.count),0,z+J.pitchRadius*Math.sin(J.angleOffset+k*2*Math.PI/J.count)]),lower=jointY-B.lensHalf-B.flangeThickness,upper=jointY+B.lensHalf+B.flangeThickness;
  const flanges=[];
  for(const[label,y0,y1,mat]of [['steel',jointY+B.lensHalf,upper,'steel'],['cast',lower,jointY-B.lensHalf,'neutral']]){
   const holes=centers.map(q=>cyl([q[0],y0-.001,q[2]],[q[0],y1+.001,q[2]],J.holeRadius));
   flanges.push({label,mat,ast:diff(cyl([x,y0,z],[x,y1,z],B.flangeRadius),uni(cyl([x,y0-.001,z],[x,y1+.001,z],B.outer),...holes))});
  }
  const studs=[],nuts=[],washers=[],studWitnesses=[],nutWitnesses=[],washerWitnesses=[];
  for(const q of centers){const lo=lower-J.washerThickness-J.nutThickness-J.endReserve,hi=upper+J.washerThickness+J.nutThickness+J.endReserve;
   studs.push(cyl([q[0],lo,q[2]],[q[0],hi,q[2]],J.rodRadius));studWitnesses.push([q[0],jointY,q[2]]);
   for(const[wlo,whi,nlo,nhi]of [[lower-J.washerThickness,lower,lower-J.washerThickness-J.nutThickness,lower-J.washerThickness],[upper,upper+J.washerThickness,upper+J.washerThickness,upper+J.washerThickness+J.nutThickness]]){
    washers.push(diff(cyl([q[0],wlo,q[2]],[q[0],whi,q[2]],J.washerRadius),cyl([q[0],wlo-.001,q[2]],[q[0],whi+.001,q[2]],J.holeRadius)));
    nuts.push(diff({op:'hexY',c:q,apothem:J.nutApothem,lo:nlo,hi:nhi},cyl([q[0],nlo-.001,q[2]],[q[0],nhi+.001,q[2]],J.rodRadius)));
    washerWitnesses.push([q[0]+.5*(J.holeRadius+J.washerRadius),.5*(wlo+whi),q[2]]);nutWitnesses.push([q[0]+.5*(J.rodRadius+J.nutApothem),.5*(nlo+nhi),q[2]]);
   }
  }
  return{flanges,centers,studs:uni(...studs),nuts:uni(...nuts),washers:uni(...washers),studWitnesses,nutWitnesses,washerWitnesses};
 }
 return Object.freeze({mother,parameters,instantiate,expand});
}
return Object.freeze({version:VERSION,createJointMother});
});
