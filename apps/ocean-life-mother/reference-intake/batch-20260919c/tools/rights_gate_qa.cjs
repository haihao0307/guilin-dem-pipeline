'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const R=path.resolve(__dirname,'..'),G=require(R+'/src/rights-gate.cjs');
const rows=[],H='a'.repeat(64),B='b'.repeat(64),C='c'.repeat(64);
const source=(id='s',license='CC-BY-4.0',extra={})=>({id,sha256:H,license,...extra});
const art=(id='fit',inputs=[{kind:'source',id:'s'}],extra={})=>({id,inputs,...extra});
const review=(extra={})=>({id:'permission-1',sourceId:'s',sourceSha256:H,license:'CC-BY-4.0',status:'checked',authorityEvidence:'synthetic authority receipt',permissionEvidence:'synthetic permission receipt',attribution:{author:'test author',source:'test source',licenseUrl:'test licence',changes:'test fitting'},...extra});
function test(name,fn){try{const result=fn();rows.push({name,pass:true,result:result??null})}catch(e){rows.push({name,pass:false,error:e.message})}}
function run(s=source(),a=[art()],r=[]){return G.evaluate(a.at(-1).id,a,[s],r)}
test('embedded BY is pending, not clearance',()=>assert.equal(run().status,'pending'));
test('embedded CC0 still requires source review',()=>assert.equal(run(source('s','CC0-1.0')).status,'pending'));
test('NC source blocked for commercial adapted candidates',()=>assert.equal(run(source('s','CC-BY-NC-4.0')).status,'blocked'));
test('ND source blocked even if converted to coefficients',()=>assert.equal(run(source('s','CC-BY-ND-4.0'),[art('coefficients')]).status,'blocked'));
test('NC-ND source blocked',()=>assert.equal(run(source('s','CC-BY-NC-ND-4.0')).status,'blocked'));
test('unknown licence held',()=>assert.equal(run(source('s','UNKNOWN')).status,'blocked'));
test('BY with unresolved source link blocked',()=>assert.equal(run(source('s','CC-BY-4.0',{provenanceIssues:['shared material, inconsistent source licence']})).status,'blocked'));
test('child CC0 label cannot erase inherited NC',()=>assert.equal(run(source('s','CC-BY-NC-4.0'),[art('fit',undefined,{license:'CC0-1.0'})]).status,'blocked'));
test('nested fit/recolour/reparameterisation keeps source restriction',()=>{
 const a=[art(),art('recolour',[{kind:'artifact',id:'fit'}]),art('new-kaopu',[{kind:'artifact',id:'recolour'}],{license:'CC0-1.0'})];assert.equal(run(source('s','CC-BY-NC-4.0'),a).status,'blocked');
});
test('missing parent held',()=>assert.equal(run(source(),[art('fit',[{kind:'artifact',id:'missing'}])]).status,'blocked'));
test('dependency cycle held',()=>assert.equal(run(source(),[art('x',[{kind:'artifact',id:'y'}]),art('y',[{kind:'artifact',id:'x'}])]).status,'blocked'));
test('checked permission without attribution pending',()=>assert.equal(run(source(),[art()],[review({attribution:null})]).status,'pending'));
test('checked BY with complete attribution reaches candidate check, not final acceptance',()=>{
 const r=run(source(),[art()],[review()]);assert.equal(r.status,'candidate-check-passed');assert.equal(r.attribution.length,1);assert.equal(r.legalClearance,false);assert.equal(r.productionAcceptance,false);
});
test('permission review for different bytes cannot be reused',()=>assert.equal(run(source(),[art()],[review({sourceSha256:B})]).status,'pending'));
test('permission review cannot silently substitute licence',()=>assert.equal(run(source(),[art()],[review({license:'CC0-1.0'})]).status,'pending'));
test('mixed clean and restricted dependencies remain blocked',()=>{
 const a=art('mix',[{kind:'source',id:'s'},{kind:'source',id:'restricted'}]);assert.equal(G.evaluate('mix',[a],[source(),source('restricted','CC-BY-NC-4.0')],[review()]).status,'blocked');
});
test('self-authored flag does not detach declared source',()=>assert.equal(run(source('s','CC-BY-ND-4.0'),[art('fit',undefined,{origin:'self-authored'})]).status,'blocked'));
test('numbers-only or facts-only label is not independent creation evidence',()=>assert.equal(run(source(),[art('facts',[],{origin:'self-authored',contentSha256:C})]).status,'pending'));
test('hash-bound independent creation record passes only candidate check',()=>{
 const a=art('own',[],{origin:'self-authored',contentSha256:C,creationReviewId:'own-evidence'}),r={id:'own-evidence',status:'checked',artifactId:'own',contentSha256:C,creationEvidence:'synthetic source-control log',independenceEvidence:'synthetic separately measured input log'};
 assert.equal(G.evaluate('own',[a],[],[r]).status,'candidate-check-passed');
});
test('duplicate artifact IDs rejected',()=>assert.throws(()=>run(source(),[art(),art()])));
test('unknown dependency kind rejected',()=>assert.equal(run(source(),[art('fit',[{kind:'fact',id:'s'}])]).status,'blocked'));
test('malformed source hash rejected',()=>assert.equal(run(source('s','CC-BY-4.0',{sha256:'bad'})).status,'blocked'));
test('input objects are not mutated',()=>{const s=source(),a=[art()],r=[review()],b=JSON.stringify([s,a,r]);run(s,a,r);assert.equal(JSON.stringify([s,a,r]),b)});
test('actual 19 unique uploaded inputs match register; none automatically cleared',()=>{
 const reg=JSON.parse(fs.readFileSync(R+'/REFERENCE_REGISTER.json'));
 const counts={};for(const s of reg.entries){const route=G.sourceRoute(s);assert.equal(route,s.route);counts[route]=(counts[route]||0)+1;assert.notEqual(run(s,[art('fit',[{kind:'source',id:s.id}])]).status,'candidate-check-passed')}
 assert.deepEqual(counts,{'permissive-review':14,'restricted-replace':2,'hold-provenance':3});return counts;
});
const receipt={tests:rows,passed:rows.filter(x=>x.pass).length,failed:rows.filter(x=>!x.pass).length,scope:'declared-lineage admission checks, actual source metadata and synthetic reviewed-permission fixtures; no authentic ownership determination'};
fs.writeFileSync(R+'/qa/RIGHTS_GATE_TESTS.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));assert.equal(receipt.failed,0);
