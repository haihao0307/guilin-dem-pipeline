// Self-owned 88 reconstruction contract. Source observations are evidence,
// never runtime geometry/normal/index/UV buffers or sampled source animation.
export const REBUILD_STATUS=Object.freeze({revision:'FH88_NATIVE_STRUCTURE_REBUILD_R02',approved:false,complete:false,reason:'Generic steam_train shape rejected. Dedicated source-structure coverage remains under construction.',representation:'Mother functions produce temporary render geometry; not a claim of mesh-free or fully implicit runtime.'});
export const FRAME=Object.freeze({lengthUnit:'m',axes:'X forward, Y left, Z up',origin:'first coupled axle centre projected to rail top',wheelRadiusM:1.016,firstDriverX:0});
export const ENVELOPE=Object.freeze({frontBufferX:4.826,cabRearX:-8.59155,tenderRearX:-16.595725,maximumWidthM:2.7432,maximumHeightM:3.9878,overBuffersM:21.421725,source:'Existing adopted 88 dimension contract, retained; not a scale copied from the reference model.'});
export const RUNNING_GEAR=Object.freeze({driverDiameterM:2.032,bogieDiameterM:.9652,trailingDiameterM:1.1176,tenderDiameterM:1.27,driverStationsM:[0,-2.2098,-4.4196],bogieStationsM:[1.6764,3.5814],trailingStationM:-7.3152,tenderStationsM:[-14.976475,-13.376275,-11.699875,-10.099675],cylinders:3,cylinderBoreM:.4699,strokeM:.6604,mainRodPinCentresM:3.35,mainRodLengthStatus:'Existing drawing-scaled estimate, not original annotated manufacturing dimension.',phaseRad:[0,4*Math.PI/3,2*Math.PI/3],preserveExistingStateContract:true});
// Every family requires its own form, attachment and material/service domain.
// A visually present generic object is not counted as completed coverage.
export const REQUIRED_FAMILIES=Object.freeze([
 {id:'streamlined-smokebox-boiler',scope:'nose, smokebox, curved shell, inspection panels, boiler bands, seams and access boundaries'},
 {id:'twin-exhaust-fairing',scope:'two open passages, variable-height streamlined outer fairing, rolled lip, flange and mounting boundary'},
 {id:'boiler-service-plumbing',scope:'whistle, safety fittings, valve bodies, copper/steel pipes, supports and junctions'},
 {id:'footplate-frame',scope:'continuous frame plates, openings, brackets, running boards, front bogie support and rear support'},
 {id:'new88-running-gear',scope:'retained approved 88 wheel/rod/cylinder hardpoints, motion and contact/profile contracts; shape refinement separately reviewed'},
 {id:'brake-rigging',scope:'shoe/tread match, hangers, cross shafts, pull rods, equalizers and actuation interface; no fabricated force certification'},
 {id:'cab-shell-glazing',scope:'curved roof, window apertures/frames/seals, sliding/opening paths, floor, doors, steps and handrails'},
 {id:'cab-backhead-controls',scope:'firehole door, gauges, handwheels, regulator/control supports, routed pipe branches, taps and mounting hardware'},
 {id:'crew-cab-installation',scope:'human-scale rigid cab attachment, floor support, head/hand/window/roof clearances across poses'},
 {id:'tender-tank-bunker',scope:'shaped tank sidewalls, top deck, coal bunker coaming, coal volume and fill/service openings'},
 {id:'tender-corridor-access',scope:'rear arched passage door, portholes, cover/canopy, steps, handrails and hinges'},
 {id:'tender-underframe',scope:'four axle assemblies with declared 88 dimensions, axleboxes, springs, brake rigging, beams and support continuity'},
 {id:'buffers-couplers-hoses',scope:'front/rear buffer beams, sprung buffer bodies/faces, drawhook/link, hose connectors and supports'},
 {id:'retained-88-branding',scope:'approved self-owned 88 lettering/angels/company badge mapped to actual new shell and tender surfaces'},
 {id:'steam-state-interfaces',scope:'preserve fixed-step drive and ledgers; explicit new outlet sockets, phase contracts and unresolved valve/fluid states'}
]);
export function validateCoverage(records){
 const known=new Set(REQUIRED_FAMILIES.map(f=>f.id));
 for(const r of records){if(!known.has(r.id))throw Error('UNKNOWN_STRUCTURE_FAMILY:'+r.id);if(r.status==='verified'&&(!r.structureTest||!r.materialDomainTest||!r.closeViewEvidence||!r.attachmentTest))throw Error('INCOMPLETE_VERIFICATION:'+r.id);}
 const missing=REQUIRED_FAMILIES.filter(f=>!records.some(r=>r.id===f.id&&r.status==='verified')).map(f=>f.id);
 return {complete:missing.length===0,missing,approved:false};
}
