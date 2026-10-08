from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'catalogue/workbench-worker.bundle.mjs';s=p.read_text()
assert hashlib.sha256(p.read_bytes()).hexdigest() == '4582bbf9791ad73fdc76553193ffb0b4ed14109c92a2678b365b6bf2296a392d', 'Baseline worker changed; rebase and review'
def replace(old,new):
 global s
 count=s.count(old)
 if count!=1:raise RuntimeError(f'Patch requires one occurrence, got {count}: {old[:100]}')
 s=s.replace(old,new)
# Only the additive R06 worker is written; the accepted baseline bundle remains unchanged.
replace('if (Math.abs(s.easeMm) / la > 0.15) fail2("EASE_LIMIT", "demo supports up to 15% declared ease");','''const sparse = spec2.source?.experimentalSparseSewing === true && s.numericalStitchPlan;
    if (sparse) {
      const pairs = s.stitchVertexPairs;
      if (!Array.isArray(pairs) || pairs.length < 2) fail2("SPARSE_STITCHES", s.id);
      let ai=-1, bi=-1;
      for (const pair of pairs) {
        if (!Array.isArray(pair)||pair.length!==2) fail2("SPARSE_PAIR",s.id);
        const ia=a.ids.indexOf(pair[0]),ib=b.ids.indexOf(pair[1]);
        if(ia<0||ib<0||ia<=ai||ib<=bi) fail2("SPARSE_DIRECTION",s.id);
        ai=ia;bi=ib;
      }
      if(pairs[0][0]!==a.ids[0]||pairs[0][1]!==b.ids[0]||pairs.at(-1)[0]!==a.ids.at(-1)||pairs.at(-1)[1]!==b.ids.at(-1))fail2("SPARSE_ENDPOINTS",s.id);
      if(!s.sourceSeam?.gathering||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientA)||!Number.isFinite(s.sourceSeam.gathering.ruffleCoefficientB))fail2("ORIGINAL_GATHERING_REQUIRED",s.id);
    }
    if (Math.abs(s.easeMm) / la > 0.15 && !sparse) fail2("EASE_LIMIT", "demo supports up to 15% declared ease; R06 requires validated sparse stitch sites");''')
replace('''for (let i = 0; i < a.ids.length; i++) {
        const ia = this.offsets.get(a.panel.id) + a.ids[i], ib = this.offsets.get(b.panel.id) + b.ids[i];''','''const pairs=this.spec.source?.experimentalSparseSewing?seam.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      for (const pair of pairs) {
        const ia = this.offsets.get(a.panel.id) + pair[0], ib = this.offsets.get(b.panel.id) + pair[1];''')
replace('''const distances = a.ids.map((v, i) => Math.hypot(...this.positions[o1 + v].map((x, k) => x - this.positions[o2 + b.ids[i]][k])) * 1e3);
      return { id: s.id, active: this.active.has(s.id), maxGapMm: Math.max(...distances) };''','''const pairs=this.spec.source?.experimentalSparseSewing?s.stitchVertexPairs:a.ids.map((v,i)=>[v,b.ids[i]]);
      const distances = pairs.map(([v,w]) => Math.hypot(...this.positions[o1 + v].map((x, k) => x - this.positions[o2 + w][k])) * 1e3);
      return { id: s.id, active: this.active.has(s.id), maxGapMm: Math.max(...distances), measurement: this.spec.source?.experimentalSparseSewing ? "numerical stitch sites, not every free gathering vertex" : "all paired edge vertices", stitchCount:pairs.length };''')
# Ordinary seams keep every original curve sample; only gathered seams need free intervening material.
replace('if (numericalStitchSpacingMm !== null) {', 'if (numericalStitchSpacingMm !== null && Math.abs(s.lengthAMm-s.lengthBMm)/Math.min(s.lengthAMm,s.lengthBMm)>0.15) {')
replace('kind: "GarmentCode MIT live analytic pattern", commit:', 'kind: "GarmentCode MIT live analytic pattern", experimentalSparseSewing: numericalStitchSpacingMm !== null, commit:')
replace('''const meshStart = performance.now(), paper = compileAnalytic(sourcePattern, { allowUnsupportedSeams: true });''','''const meshStart = performance.now(), paper = compileAnalytic(sourcePattern, { allowUnsupportedSeams: true, numericalStitchSpacingMm: 12, measurementSnapshot: {bodyId:"anny-adult-neutral-r01"} });
  paper.source.bodyId="anny-adult-neutral-r01";
  paper.source.trialBoundary="Original paper, original body, sparse numerical stitching; not calibrated cloth or fit certification. No continuous collision or runtime self-contact response.";
  validate2(paper);''')
replace('''if (config.kind !== "legacy") throw Error("This newly generated style has not passed physical fit validation; export its real paper for authoring, not a cached garment");
  const start = performance.now(), bodyPath = "garments-r04/assets/body-anny-adult.json", metaPath = config.directory + "/assets/body-sdf-grid.json";''','''if (config.kind !== "legacy" && !spec.source.experimentalSparseSewing) throw Error("Generate the R06 sparse-stitch material before a new-style trial");
  const directory=config.kind === "legacy"?config.directory:"r06";
  const start = performance.now(), bodyPath = "garments-r04/assets/body-anny-adult.json", metaPath = directory + "/assets/body-sdf-grid.json";''')
replace('''bytes(config.directory + "/assets/" + meta.transport.file)''','''bytes(directory + "/assets/" + meta.transport.file)''')
replace('''canSew: config.kind === "legacy", physicalStatus: config.kind === "legacy" ? "accepted baseline family; current parameters require actual solve" : "new style: analytic paper and material mesh validated; physical fit not accepted"''','''canSew: config.kind === "legacy" || spec.source.experimentalSparseSewing === true, physicalStatus: config.kind === "legacy" ? "accepted baseline family; current parameters require actual solve" : "R06 live sparse-stitch trial available; no fit certificate"''')
replace('''emit("done", { record, regions, intersections, profile, activeWallMs: wallMs + profile.auditMs });''','''if(config.kind!=="legacy"){
            record.trial={version:"R06.3",style:config.recipe.design.style,sourceRecipeHash:spec.source.recipeHash,physicalFitAccepted:false,solver:"existing small-step XPBD / f64 WASM; full original-body SDF; sparse numerical stitching",runtimeSelfContact:false,continuousCollision:false,materialCalibrated:false,seamAllowanceAndThickness:false};
          }
          emit("done", { record, regions, intersections, profile, activeWallMs: wallMs + profile.auditMs });''')
replace('  lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 6 });', '  if(config.kind!=="legacy") prepareShoulderFixtures(spec,sdf);\n  lab = new GarmentLab2(spec, sdf, { substeps: 12, iterations: 6 });')
# A pause arriving during body/SDF/WASM loading is an intent, not cancellation.
# Do not invalidate the asynchronous init epoch and strand the UI in loading-solver.
replace('var kernelReady = false;', 'var kernelReady = false;\nvar pendingPause = false;')
replace('''  running = true;
  runStarted = performance.now();
  packet("started");''','''  if (pendingPause) { running=false; packet("paused"); return; }
  running = true;
  runStarted = performance.now();
  packet("started");''')
replace('''      stop();
      await startLegacySolve(epoch);''','''      stop();
      pendingPause=false;
      await startLegacySolve(epoch);''')
replace('''    } else if (data.type === "pause") {
      stop();
      if (lab) packet("paused");''','''    } else if (data.type === "pause") {
      pendingPause=true;
      if (lab) { stop(); packet("paused"); }''')
replace('''    } else if (data.type === "resume") {
      if (!lab''','''    } else if (data.type === "resume") {
      pendingPause=false;
      if (!lab''')
# R06 contact path retains the original ordered f64 constraint kernel.
replace('if (this.orientationGuides || this.selfCollisionEnabled) return super.step(dt);', 'if (this.orientationGuides || (this.selfCollisionEnabled && !this.r06Contact)) return super.step(dt);')
replace('      k.distances(baseCount, this.count);\n      P.distanceMs += performance.now() - now;\n      if (this.collisions && sub3 % 3 === 2) {', '      if (!this.r06Contact) k.distances(baseCount, this.count);\n      P.distanceMs += performance.now() - now;\n      if (this.r06Contact) {\n        this.selfContacts.rebuild();\n        this.selfContacts.project();\n        // Contact/sewing must not be the final operation that stretches rest material.\n        for(let guard=0;guard<3;guard++) { k.strains(); k.vertices(this.clearance); }\n      }\n      if (this.collisions && sub3 % 3 === 2) {')
replace('      this.bodyContacts += k.contacts.value;', '      if (this.r06Contact && sub3 % 6 === 5) { this.selfContacts.bodySweep(); this.selfContacts.rebuild(); this.selfContacts.project(); }\n      this.bodyContacts += k.contacts.value;')
replace('  profile.bodyMs = performance.now() - start;', '  if(config.kind!=="legacy") configureContactWasm(await bytes("r06/contact/contact-kernel.wasm"));\n  if(token!==epoch)return;\n  profile.bodyMs = performance.now() - start;')
replace('  lab.selfCollisionEnabled = false;', '  lab.selfCollisionEnabled = config.kind!=="legacy";\n  lab.r06Contact = config.kind!=="legacy";\n  if(lab.r06Contact) { lab.selfContacts=new FastSweptContact(lab); lab.selfContacts.capture(); }')
replace('runtimeSelfContact:false,continuousCollision:false', 'runtimeSelfContact:true,continuousCollision:false,linearSweptContact:lab.selfContacts.report()')
replace('No continuous collision or runtime self-contact response.', 'Runtime collision-only f64 WASM, swept linear vertex-face and edge-edge conservative advancement; nonlinear CCD remains uncertified.')
s=(ROOT/'r06/contact/fast-contact.mjs').read_text().replace("import {SweptContact} from './swept-contact.mjs';",'').replace('export function','function').replace('export class','class')+'\n'+s
s=(ROOT/'r06/contact/swept-contact.mjs').read_text().replace('export class','class')+'\n'+s
s=(ROOT/'r06/fixtures.mjs').read_text().replace('export function','function')+'\n'+s
(ROOT/'catalogue/r06-contact-worker.bundle.mjs').write_text('// R06.3 contact repair, original R06.2 retained. Original catalogue/workbench-worker.bundle.mjs remains intact.\n'+s)
print('worker',len(s))
