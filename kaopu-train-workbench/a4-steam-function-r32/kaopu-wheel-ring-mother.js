/* Native annulus/capped-cylinder wheel bundles. The one frozen AxleSpec is
 * shared by these fields and DYNAMIC rolling Time. Retained inferred geometry,
 * not historical measurements. No mesh, sampled geometry or shader table. */
(function(root){'use strict';
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const copy=o=>Array.isArray(o)?Array.from(o,copy):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[k,copy(v)])):o;
const keys=(o,ks)=>{if(!o||Object.keys(o).sort().join(',')!==ks.split(',').sort().join(','))throw Error('Unsupported or missing contract parameter');};
const number=v=>{if(typeof v!=='string'||! /^(?:\(-?(?:\d*\.)?\d+(?:e[+-]?\d+)?\)|-?(?:\d*\.)?\d+(?:e[+-]?\d+)?)$/i.test(v))throw Error('Exact decimal token required');const n=Number(v.replace(/[()]/g,''));if(!Number.isFinite(n)||!Number.isFinite(Math.fround(n)))throw Error('Finite represented number required');return n;};
const classNames=['bogie','driving','trailing'],trustedSpecs=new WeakSet();
function createAxleSpec(input){
 const m=copy(input);keys(m,'common,classes,axles,enclosures');keys(m.common,'halfGauge,flangeHalfGauge,referenceTheta,travelScale');keys(m.classes,'bogie,driving,trailing');
 const commonLock={halfGauge:.7175,flangeHalfGauge:.6595,referenceTheta:.4,travelScale:1.016};for(const k of Object.keys(commonLock))if(number(m.common[k])!==commonLock[k])throw Error('Retained axle/phase contract locked: '+k);
 const ck=['rollingRadius','flangeRadius','hubRadius','innerRadiusMin','spokeLower','spokeEnd'],locked=[ [.4826,.50759999999999994,.082042,.41759999999999997,.0656336,.45009999999999994], [1.016,1.0409999999999999,.17272,.95100000000000007,.13817600000000002,.98350000000000004], [.5588,.5838,.094996,.49379999999999996,.0759968,.5263] ];
 classNames.forEach((name,k)=>{const c=m.classes[name];keys(c,ck.join(',')+',basisZero');ck.forEach((key,j)=>{if(number(c[key])!==locked[k][j])throw Error('Retained '+name+'/'+key+' locked; old spokes/axle are not regenerated');});if(c.basisZero!==(k===0?'(-0.0)':'0.0'))throw Error('Retained signed-zero basis locked');});
 if(!Array.isArray(m.axles)||m.axles.length!==6)throw Error('Six explicit retained axes required');
 const axles=m.axles.map((a,k)=>{keys(a,'axle,classRef,centerZ');const cls=k<2?'bogie':k<5?'driving':'trailing';if(a.axle!==k||a.classRef!==cls||number(a.centerZ)!==[5.7912,3.8862,2.2098,0,-2.2098,-5.1054][k])throw Error('Unique ordered parent axes/class locked');return{...a,class:m.classes[cls],centerY:m.classes[cls].rollingRadius,shaftInterface:k===3?'existingSideJournals':'retainedStraightAxle'};});
 if(!Array.isArray(m.enclosures)||m.enclosures.length!==2)throw Error('Retained radial roundoff certificates required');
 m.enclosures.forEach((e,k)=>{keys(e,'axle,role,axis,min');const expected=k===0?[1,2,3.3785979999999998]:[5,1,-.02500199999999991];if(e.axle!==expected[0]||e.role!=='flange'||e.axis!==expected[1]||number(e.min)!==expected[2])throw Error('Locked radial certificate changed');const a=axles[e.axle],raw=number(e.axis===1?a.centerY:a.centerZ)-number(a.class.flangeRadius),pad=raw-number(e.min);if(pad<.000001||Math.abs(pad-.000002)>1e-12)throw Error('Radial certificate fails actual unpadded support');});
 const spec=freeze({id:'a4/retained-axle-spec@1',provenance:'retained inferred model geometry, not historical measurement',parameters:m,common:m.common,classes:m.classes,axles,enclosures:m.enclosures,radii:axles.map(a=>number(a.class.rollingRadius))});trustedSpecs.add(spec);return spec;
}
function create(spec,input){
 if(!trustedSpecs.has(spec))throw Error('Validated shared AxleSpec required');
 const m=copy(input);keys(m,'classes,instances');keys(m.classes,'bogie,driving,trailing');const p=spec.common;
 if(!Array.isArray(m.instances)||m.instances.length!==12)throw Error('Twelve ordered wheel-side bundles required');
 const margin=.000001,F=Math.fround,x=number(p.halfGauge),fx=number(p.flangeHalfGauge),overlap=(a,b,c,d)=>Math.min(a+b,c+d)-Math.max(a-b,c-d),overlap32=(a,b,c,d)=>Math.min(F(F(a)+F(b)),F(F(c)+F(d)))-Math.max(F(F(a)-F(b)),F(F(c)-F(d)));
 const dimensions={};classNames.forEach(name=>{const u=m.classes[name],c=spec.classes[name];keys(u,'innerRadius,halfThickness');keys(u.halfThickness,'tyre,flange,hub');const h=u.halfThickness,ri=number(u.innerRadius),wt=number(h.tyre),wf=number(h.flange),wh=number(h.hub),end=number(c.spokeEnd);
  if(ri<number(c.innerRadiusMin)||end-ri<margin||F(end)-F(ri)<margin||!(wt>0&&wt<=.070000000000000007&&wf>0&&wf<=.012&&wh>0&&wh<=.085))throw Error('Only bounded noncollapsed subsets of retained wheel solids supported');
  if(overlap(x,wt,fx,wf)<margin||overlap32(x,wt,fx,wf)<margin)throw Error('Tyre/flange contact collapses');
  for(const [center,half]of [[x,wt],[fx,wf],[x,wh]])if(2*half<margin||F(F(center)+F(half))-F(F(center)-F(half))<margin)throw Error('Axial domain collapses');dimensions[name]={ri};
 });
 const mother={id:'a4/wheel-ring-bundle@2',parent:'A4/model_local_frame',units:'m',boundary:'tyre/flange: class-shared inner boundary and role outer circle, finite X extrusion; hub: capped cylinder',dimensions:spec.provenance,editDomain:'subset-only class inner-radius/thickness; parent axes/R/phase locked because spokes/shafts remain legacy',bounds:'X from current thickness; radial dimensions locked; two retained rounding certificates validated against actual unpadded support',numericMargin:margin,numericMarginMeaning:'metres of representable positive contact, not historical engineering clearance',Time:'DYNAMIC.wheelTheta(sharedTheta,axle) from the same AxleSpec.radii; same phase for both sides and material advection',worldPlacement:null,historicalDate:null};
 const parts={},instances=[],fragments={},rows={};
 m.instances.forEach((i,k)=>{keys(i,'axle,side');if(i.axle!==Math.floor(k/2)||i.side!==(k%2?'right':'left'))throw Error('Unique ordered retained axle/side identities required');
  const a=spec.axles[i.axle],c=a.class,u=m.classes[a.classRef],h=u.halfThickness,id=`wheel/axle${i.axle}_${i.side}`,negative=i.side==='left',signed=t=>negative?'(-'+t+')':t,cx=signed(p.halfGauge),flx=signed(p.flangeHalfGauge),cy=a.centerY,cz=a.centerZ,center=[number(cx),number(cy),number(cz)],members={},lines=[];
  for(const role of ['tyre','flange','hub']){const field=id+'_'+role,name='support_'+field.replace('/','_'),outer=role==='tyre'?c.rollingRadius:role==='flange'?c.flangeRadius:c.hubRadius,axis=role==='flange'?flx:cx;
   const prefix=`vec3 q=vec3(dot(p-vec3(0.0,0.0,0.0),vec3(1.0,0.0,${c.basisZero})),dot(p-vec3(0.0,0.0,0.0),vec3(0.0,1.0,0.0)),dot(p-vec3(0.0,0.0,0.0),vec3(0.0,0.0,1.0)));float yy=q.y-${cy},zz=q.z-${cz},rho=length(vec2(yy,zz));float depth=abs(q.x-${cx});`;
   const radial=role==='hub'?`rho-${outer}`:`max(rho-${outer},${u.innerRadius}-rho)`,depth=role==='flange'?`abs(q.x-${axis})`:'depth';
   lines.push(`float ${name}_parameterized(vec3 p,float theta){${prefix}return max(${radial},${depth}-${h[role]});}`,`float ${name}(vec3 p){return ${name}_parameterized(p,${p.referenceTheta});}`);
   const axisCenter=[number(axis),center[1],center[2]],r=number(outer),half=number(h[role]),ext=[half,r,r],pad=.000002,min=axisCenter.map((v,j)=>v-ext[j]-pad);
   for(const e of spec.enclosures)if(e.axle===i.axle&&e.role===role)min[e.axis]=number(e.min);
   const max=axisCenter.map((v,j)=>v+ext[j]+pad);if(min.some((v,j)=>F(F(axisCenter[j])-F(ext[j]))-v<margin||max[j]-F(F(axisCenter[j])+F(ext[j]))<margin))throw Error('Float32 support enclosure margin lost');
   parts[field]={id:field,group:'wheel',glsl_function:name,aabb_min:min,aabb_max:max,lipschitz:1.000002,status:'exact_articulated_wheel_REPLACEMENT_not_overlay',source:'support'};
   members[role]=field;rows[field]={c:axisCenter,r,half,ring:role!=='hub',ri:dimensions[a.classRef].ri};
  }
  fragments[id]=lines.join('\n');instances.push({id,mother:mother.id,Time:{reference:mother.Time,axle:i.axle,referenceTheta:number(p.referenceTheta),rollingRadius:spec.radii[i.axle],travelScale:number(p.travelScale),glslRatio:(number(p.travelScale)/spec.radii[i.axle]).toPrecision(17),historicalDate:null},Location:{parent:mother.parent,origin:center,axes:['transverse X','vertical Y','longitudinal Z'],worldPlacement:null},Object:{members,classRef:a.classRef,innerBoundary:'shared class innerRadius for tyre/flange',flange:'fixed mirrored centre toward model midplane, not moved with width',interfaces:{spokes:'retained same-axle fields',axle:a.shaftInterface,scope:'fixed-parent subsets, not arbitrary reconnection or strength'}}});
 });
 function scalar(id,q){const r=rows[id];if(!r||!Array.isArray(q)||q.length!==3||!Array.from(q).every(Number.isFinite))throw Error('Known field and finite point required');const rho=Math.hypot(q[1]-r.c[1],q[2]-r.c[2]),radial=r.ring?Math.max(rho-r.r,r.ri-rho):rho-r.r;return Math.max(radial,Math.abs(q[0]-r.c[0])-r.half);}
 function fragment(id){if(!Object.hasOwn(fragments,id))throw Error('Unknown wheel bundle');return fragments[id];}
 return freeze({mother,axleSpec:spec,parameters:m,instances,parts,source:Object.values(fragments).join('\n'),fragment,scalar});
}
root.KAOPU_WHEEL_RING_MOTHER=Object.freeze({createAxleSpec,create});
})(typeof window==='object'?window:globalThis);
