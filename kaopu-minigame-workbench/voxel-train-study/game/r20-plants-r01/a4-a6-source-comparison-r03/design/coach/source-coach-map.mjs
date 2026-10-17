/** Mark3 source-specific, audited primitive substitutions. Source records never change. */
export const COACH_EXTERIOR_SUBSTITUTIONS=Object.freeze([
 {node:15,name:'Object_15',mesh:7,primitive:0,role:'roof exterior',evidence:'Roof_Black surface only; world Y3.740812–4.227700, Z±11.262654; no running gear.',replacement:'independent finite continuous rounded green roof/shoulder'},
 {node:17,name:'Object_17',mesh:9,primitive:0,role:'external decorative line',evidence:'Two long connected Orange trim strips only; world Y3.590464–3.620482.',replacement:'fine continuous inherited brass waistline'},
 {node:18,name:'Object_18',mesh:10,primitive:0,role:'perforated outer side and shoulder panels',evidence:'Four connected outer side/shoulder components; twenty true pane-boundary holes. All chassis and window glass are separate primitives.',replacement:'finite new smooth side silhouette, actual retained window holes and raised full-bogie relief'},
 {node:130,name:'Object_130',mesh:80,primitive:0,role:'positive-end exterior door skin',evidence:'Grey material exterior door surface only, X±1.443875, Y1.429206–3.389770, Z10.296895–11.268315. Glazing128 and silver detail129 are separate primitives; no chassis.',replacement:'exact shared-source geometry display copy with independent inherited green paint'},
 {node:134,name:'Object_134',mesh:83,primitive:0,role:'negative-end exterior door skin',evidence:'Grey material exterior door surface only, X±1.443875, Y1.431830–3.389770, Z−11.268315…−10.296895. Glazing133 and handles114 are separate primitives; no chassis.',replacement:'exact shared-source geometry display copy with independent inherited green paint'}
].map(Object.freeze));
export const PROTECTED_COACH_MECHANICAL_PRIMITIVES=Object.freeze([14,24,25,27,28,30,32,33,34,36,38,40,42,43,44,46,48,50,52,54,58,62,63,64,65,67,74,75,100,102,140,142]);
export const RETAINED_COACH_GLASS_PRIMITIVES=Object.freeze([16,20,128,133]);
export const COACH_SOURCE_ENVELOPES=Object.freeze({
 units:'UNCHANGED_SOURCE_UNITS_UNCALIBRATED',axes:'X transverse; Y up; Z longitudinal',
 bodyEndZ:11.262654304504395,sourceGangwayEndZ:11.742700576782227,
 bogieZ:[[ -10.34846305847168,-5.981114387512207],[5.981114387512207,10.34846305847168]],
 bogieMaximumY:1.4754681587219238,upperBolsterMaximumY:1.5195531845092773,
 wheelAxleStations:[-9.493887424468994,-6.800450801849365,6.800450801849365,9.493887424468994],
 wheelRingMinimumY:.20714354515075684,wheelRingMaximumY:1.3093953132629395,
 sourceBodyCrownY:4.227700233459473,newBodyCrownY:4.227700233459473,
 bogieHemY:1.60,centralHemY:1.47,interfaceMinimumY:2.04
});
export function validateCoachSource(source){
 if(source?.key!=='mark3'||!source?.g?.nodes||source.g.nodes.length!==145||source.primitives?.length!==89)throw Error('COACH_REQUIRES_COMPLETE_MARK3_SOURCE_145_89');
 for(const e of COACH_EXTERIOR_SUBSTITUTIONS){const n=source.g.nodes[e.node];if(n.name!==e.name||n.mesh!==e.mesh)throw Error('COACH_EXTERIOR_SOURCE_IDENTITY_MISMATCH_'+e.node);const p=source.primitives.find(p=>p.sourceNode===e.node&&p.primitive===e.primitive);if(!p||p.object.userData.originalPrimitive.source!=='mark3')throw Error('COACH_SOURCE_PRIMITIVE_MISSING_'+e.node);}
 for(const i of [...PROTECTED_COACH_MECHANICAL_PRIMITIVES,...RETAINED_COACH_GLASS_PRIMITIVES])if(!source.primitives.some(p=>p.sourceNode===i))throw Error('COACH_PROTECTED_PRIMITIVE_MISSING_'+i);
}
