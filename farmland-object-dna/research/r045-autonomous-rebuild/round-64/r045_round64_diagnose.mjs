import fs from 'node:fs';
import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R63 from '../round-63/r045_round63_kernel.mjs';
import * as R64 from './r045_round64_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const C=(x,a,b)=>Math.max(a,Math.min(b,x));const S=(a,b,x)=>{const t=C((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function foregroundClearance(x,z){const gap=Math.abs(z-R30.riverZ(x));return S(R30.riverW(x)+18,R30.riverW(x)+44,gap)}
function safetyAt(x,z){const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12)return 0;const broad=R35.broadTerraceEligibility(x,z),group=R35.terraceGroupEnvelope(x,z),drain=R35.terraceDrainageClearance(x,z),river=foregroundClearance(x,z);if(broad<.03||group<.035||drain<=.035||river<=.035)return 0;return Math.min(.52+.48*C((broad-.03)/.24,0,1),.52+.48*C((group-.035)/.30,0,1),.46+.54*C((drain-.035)/.58,0,1),.46+.54*C((river-.035)/.58,0,1))}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.22,.30*step)&&Math.abs(a.index-b.index)<=4}
const grid=[];for(let z=-132;z<=12;z+=6)for(let x=-222;x<=120;x+=6){const s=R58.terraceStateAt(x,z);grid.push({x,z,s})}
const active=grid.filter(q=>q.s.mask>.12),eligible=grid.filter(q=>q.s.mask<=.12&&safetyAt(q.x,q.z)>.10);
const rows=[];for(const q of eligible){const same=active.filter(a=>compatible(q.s,a.s)).map(a=>({...a,d:Math.hypot(a.x-q.x,a.z-q.z)})).sort((a,b)=>a.d-b.d);const adjacent=same.filter(a=>Math.max(Math.abs(a.x-q.x),Math.abs(a.z-q.z))<=6.000001);const peers=eligible.filter(e=>e!==q&&compatible(q.s,e.s)&&Math.max(Math.abs(e.x-q.x),Math.abs(e.z-q.z))<=6.000001).map(e=>({x:e.x,z:e.z,mask:e.s.mask}));const s63=R63.frozenRailSupportAt(q.x,q.z),s64=R64.frontierSupportAt(q.x,q.z);rows.push({x:q.x,z:q.z,mask:q.s.mask,group:q.s.groupIndex,index:q.s.index,step:q.s.step,safety:safetyAt(q.x,q.z),dd:R30.nearestExtendedDrainageDistance(q.x,q.z),r63:Boolean(s63),r64:Boolean(s64),nearestSameFamily:same.slice(0,5).map(a=>({x:a.x,z:a.z,d:a.d,mask:a.s.mask,index:a.s.index})),adjacentActive:adjacent.map(a=>({x:a.x,z:a.z,d:a.d,mask:a.s.mask,index:a.s.index})),eligiblePeers:peers});}
const result={eligibleCount:eligible.length,activeCount:active.length,r63Supported:rows.filter(r=>r.r63).length,r64Supported:rows.filter(r=>r.r64).length,rows};fs.writeFileSync(new URL('./r045_round64_diagnostic_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
