// Reject stale visual evidence even when static source checks pass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p)),load=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),manifest=load('BUILD_MANIFEST.json');
for(const p of ['evidence/hair-visibility-checks.json','evidence/scalp-boundary-visual-checks.json','evidence/temple-region-review.json']){const r=load(p);assert.equal(r.runtimeSHA256,manifest.htmlSHA256,'Stale visual review: '+p);if('pass'in r)assert.equal(r.pass,true);}
const approved=load('evidence/approved-scalp-checks.json');assert.equal(approved.pass,true);assert.equal(approved.checks.length,5);assert.equal(approved.negative.length,3);assert.ok(approved.negative.every(n=>n.rejected));
for(const p of ['src/HairStyleProfile.mjs','src/StructureLab.mjs','tools/check-approved-scalp.mjs','locks/scalp-f02-1.json','assets/structure.json.gz'])assert.equal(sha(read(p)),manifest.files[p],'Changed after reviewed build: '+p);
const visibility=load('evidence/hair-visibility-checks.json');assert.equal(visibility.checks.length,185);assert.ok(visibility.checks.filter(c=>c.negative).every(c=>c.rejected));
const boundary=load('evidence/scalp-boundary-visual-checks.json');assert.ok(boundary.bounds.beforeRearMinY-boundary.bounds.afterRearMinY>.03);
for(const p of ['scalp04-after-left.png','scalp04-after-back.png','scalp04-temple-zones-left.png','scalp04-temple-zones-right.png','scalp04-temple-active-left.png','scalp04-temple-active-right.png'])assert.ok(read('evidence/'+p).length>10000,'Missing actual review capture: '+p);
console.log(JSON.stringify({pass:true,runtimeSHA256:manifest.htmlSHA256,appliedScalpCases:5,visibilityChecks:185,negativeDomainChecks:3}));
