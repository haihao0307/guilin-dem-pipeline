/** Neutral body API for the isolated original full-cloth fitting experiment.
 * The donor worker morphs actual vertex positions directly while fitting.
 * This bridge adds no body pose, cloth force, constraint, collider or geometry.
 * Inject this API only into the diagnostic CoupledCloth NativeMotion import.
 */
export function sourceFitArguments(input,sdf,{startAtOrigin=true}={}){
  if(input.schema!=='r02-original-full-cloth-fit-inputs/1')throw Error('SOURCE_FIT_INPUT_SCHEMA');
  const body=input.body;
  const bridge={
    native:Float64Array.from(startAtOrigin?body.originNativeZupM:body.targetNativeZupM),
    positions:Float64Array.from(startAtOrigin?body.originYupM:body.targetYupM),
    pose:{},skin:body.skinMatrices.map(m=>Array.from(m)),
    evaluate(pose={},skin=null){this.pose=pose;if(skin)this.skin=skin.map(m=>Array.from(m));},
    audit(){return {phase:'original source neutral body fitting',sourceBodyVertices:body.count,fullCSRBody:true,completeGNMHeadInCollider:false};},
  };
  return {
    rows:input.rows.map(r=>({packet:structuredClone(r.packet),positions:Float64Array.from(r.positionsYupM),info:structuredClone(r.info)})),
    options:{sdf,actor:{faces:Int32Array.from(body.faces),sourceRevision:input.sourceRevision,bridge,fittingOrigin:Float32Array.from(body.originYupM)},settings:{...input.settings},motion:'idle'},
    bridge,
    origin:Float32Array.from(body.originYupM),
    target:Float32Array.from(body.targetYupM),
  };
}
