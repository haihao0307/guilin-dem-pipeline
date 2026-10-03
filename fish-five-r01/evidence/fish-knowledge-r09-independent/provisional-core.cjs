const fs=require('node:fs'),K=require('G:/Three.js/Human/Fish-Workbench/fish-five-r01/src/production-knowledge-r09.js');
const c=K.createTemplate('test-unknown-fish');c.source={title:'Unknown',entrySha256:'a'.repeat(64),payloadSha256:'b'.repeat(64),metadata:'qa-missing-source.json',license:'unknown',attribution:'qa'};
for(const k of ['surface','axis','fins','envelope','gait'])c.measurements[k]={status:'CONFIRMED_ABSENT',reference:'qa-no-evidence.json'};
c.behavior={status:'ENGINEERING_CANDIDATE',profileRef:'qa-profile.js',groupingEvidence:'UNKNOWN'};
const result={checkedAt:new Date().toISOString(),formalApproval:false,validation:K.validateCard(c),spine:K.resolve(c,'spine'),behavior:K.resolve(c,'behavior')};
fs.writeFileSync(__dirname+'/PROVISIONAL_BAD_ABSENCE_CARD.json',JSON.stringify(result,null,2));console.log(JSON.stringify({valid:result.validation.valid,spineReady:result.spine.readyToBuild,behaviorReady:result.behavior.readyToBuild}));
