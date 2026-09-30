import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const parent=fs.readFileSync(path.join(root,'../local-r05/data/MUSKELLUNGE_RESOLVED_WEIGHTED_EYE_SCORE_R05.kfc5'));
const oldSize=parent.readUInt32LE(8),meta=JSON.parse(parent.subarray(16,16+oldSize));
meta.schema='kaopu.fish.spine-fin.resolved/6';meta.version='R06';
meta.instrument={id:'kaopu.fish.central-spine-fin-eye',version:'6.0.0',abi:'KFC6'};
meta.continuum.type='CENTRAL_SPINE_FIN_WEIGHT_V6';
meta.continuum.adjustableFinChannels=meta.continuum.weightChannels.slice(5);
meta.motionPolicy={body:'Full orthonormal central-spine transport at immutable rest material X; no body/head weight blend',fins:'Seven independently weighted root-to-tip chains carried by the same spine',jawGill:'Preserved local anatomical attachment masks, independent of fin gains',eyes:'Preserved KFE1 independent eyes carried by central spine',modeTransition:'Preserve all chain state and velocities; reset only mode forcing clock',parentR05Sha256:sha(parent)};
for(const p of Object.values(meta.motion.modes)){p.jaw=(p.jaw||0)*p.response[2];p.gill=(p.gill||0)*p.response[3];for(let i=0;i<5;i++)p.response[i]=0;p.label=p.label.replace('全权重','脊椎');}
// The isolated fin demonstration must not excite body or gill motion.
meta.motion.modes.FIN_FAN.amplitude=0;meta.motion.modes.FIN_FAN.gill=0;
const json=Buffer.from(JSON.stringify(meta)),header=Buffer.alloc(16);header.write('KFS6PKG1');header.writeUInt32LE(json.length,8);header.writeUInt32LE(parent.readUInt32LE(12),12);
const payload=parent.subarray(16+oldSize),score=Buffer.concat([header,json,payload]);
fs.writeFileSync(path.join(root,'data/MUSKELLUNGE_RESOLVED_SPINE_FIN_SCORE_R06.kfc6'),score);
fs.writeFileSync(path.join(root,'data/score-metadata.json'),JSON.stringify(meta,null,2)+'\n');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const app=read('src/app.js').replace('__KFC6_SCORE_BASE64__',score.toString('base64'));
const html=read('src/workbench.template.html').replace('__KFC6_INSTRUMENT__',()=>read('src/instrument.js')).replace('__KFC6_APP__',()=>app);
if(/__KFC\d_/.test(html))throw Error('Unresolved build marker');
const output=path.join(root,'dist/KAOPU_FISH_SPINE_FIN_R06_WORKBENCH.html');fs.writeFileSync(output,html);
const receipt={builtAt:new Date().toISOString(),output,sha256:sha(Buffer.from(html)),scoreSha256:sha(score),parentR05ScoreSha256:sha(parent),sourceDelta:true,singleFileHtml:true,geometryAndAtlasPayloadByteIdentical:score.subarray(16+json.length).equals(payload),bodyMotion:meta.motionPolicy.body,finChannels:7,visualAcceptance:false,motionAcceptance:false,productionReady:false};
fs.writeFileSync(path.join(root,'evidence/BUILD_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
