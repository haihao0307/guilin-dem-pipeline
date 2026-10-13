const assert=require('node:assert/strict');
exports.adapt=(s,rel,records)=>{const edit=(a,b,n=1)=>{assert.equal(s.split(a).length,n+1,'R05 exact source anchor '+rel+' '+a.slice(0,80));s=s.split(a).join(b);records.push({path:rel,kind:'lossless-demand-paging',anchor:a.slice(0,150)});};
 if(rel.endsWith('/NaturalEyeUI.mjs'))edit("open();Promise.all([viewer.skin.naturalEyesReady,viewer.skin.faceReady].filter(Boolean)).then(()=>{if(!disposed){view('eyes');syncStatus();}});","open();Promise.all([viewer.skin.naturalEyesReady,viewer.skin.faceReady].filter(Boolean)).then(()=>{if(!disposed)syncStatus();});");
 if(rel.endsWith('/IdleRuntime.mjs'))edit('this.skin=installIdleSkin(viewer,this.settings);','this.skin=viewer.r05IdleSkin||installIdleSkin(viewer,this.settings);');
 if(rel.endsWith('/AnnyModel.js')){
 edit('const restVertices = new Float64Array(a.template_vertices);',"const cached=this.__restCache?.get(Array.from(baseCoefficients).join(','));\n    const restVertices = new Float64Array(cached?.v || a.template_vertices);");
 edit('const restBoneHeads = new Float64Array(a.template_bone_heads);','const restBoneHeads = new Float64Array(cached?.h || a.template_bone_heads);');
 edit('const covariances = new Float64Array(a.bone_template_orientation_matrices);','const covariances = new Float64Array(cached?.o || a.bone_template_orientation_matrices);');
 edit('for (const shape of active) {','for (const shape of (cached ? [] : active)) {');
 edit('if (offsets) {\n        for (let k = offsets[shape]; k < offsets[shape + 1]; k++) restVertices[indices[k]] += c * values[k];',`if (a.__rows) {
 const row=a.__rows.get(shape);if(!row)throw Error('Native Anny page not prepared: '+shape);
 for(let k=0;k<row.indices.length;k++)restVertices[row.indices[k]]+=c*row.values[k];
 } else if (offsets) {
 for (let k = offsets[shape]; k < offsets[shape + 1]; k++) restVertices[indices[k]] += c * values[k];`);
 }
 if(rel.endsWith('/GNMModel.js')){edit('const offset = index * sum.length;','const offset = index * sum.length;\n    if(offset+sum.length>basis.length)throw Error("Native GNM coefficient page not prepared: "+index);');edit('setIdentityVector(values) {','setIdentityVector(values) {\n    if(!this._idBlend&&values.length===this.identity.length&&Array.prototype.every.call(values,(x,i)=>Math.fround(x)===this.identity[i]))return;');edit('setExpressionVector(values) {','setExpressionVector(values) {\n    if(!this._exprBlend&&values.length===this.expression.length&&Array.prototype.every.call(values,(x,i)=>Math.fround(x)===this.expression[i]))return;');}
 if(rel.endsWith('/MHRDetailedEngine.mjs'))edit('if(state.correctives){','if(state.correctives && state.pose.some(x=>x!==0)){');
 if(rel.endsWith('/ui/Controller.mjs')){edit('commit(next){this.model.compute(next);return this.changed();}',`commit(next){const ticket=this.streamTicket=(this.streamTicket||0)+1;const run=()=>{if(ticket!==this.streamTicket)return this.state();this.model.compute(next);return this.changed();};const stream=this.model.r05Stream;if(stream?.needs(next))return stream.prepare(next).then(run);return run();}`);edit('restore(archive){if(archive.surface',`restore(archive){const stream=this.model.r05Stream;if(archive?.state&&stream?.needs(archive.state))return stream.prepare(archive.state).then(()=>this.restore(archive));if(archive.surface`);}
 return s;
};
