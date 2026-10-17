// Measured mesh-envelope baselines for reversible display registration only.
// A lowest wheel/flange vertex is NOT an authenticated tread contact or rail-crown datum.
export const DISPLAY_WHEEL_REFERENCES=Object.freeze({
 a4:{node:90,expectedMinY:.42276012988096534,label:'front main wheel mesh lower envelope'},
 mark3:{node:64,expectedMinY:.20714354515075684,label:'eight silver wheel-ring meshes lower envelope'}
});
export function registerWheelEnvelopeDisplay(T,source,designRoot=null){
 const ref=DISPLAY_WHEEL_REFERENCES[source.key];source.root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(source.nodes[ref.node],true),baseline=bounds.min.y;
 if(!Number.isFinite(baseline)||Math.abs(baseline-ref.expectedMinY)>1e-5)throw Error('SOURCE_WHEEL_DATUM_CHANGED '+source.key);
 const rootLocalMatrix=source.root.matrix.elements.slice();
 const display=new T.Group();display.name=source.key+' reversible wheel-envelope display registration';
 display.position.y=-baseline;display.add(source.root);if(designRoot)display.add(designRoot);
 display.userData={source:source.key,sourceNode:ref.node,measurement:ref.label,baselineSourceY:baseline,displayTranslation:[0,-baseline,0],originalRootLocalMatrix:rootLocalMatrix,sourceGeometryChanged:false,physicalRailDatumCertified:false,metricScaleCertified:false};
 return display;
}
