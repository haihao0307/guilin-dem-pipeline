import fs from 'node:fs';
import * as W from '../source/world.mjs';
const errors=[];const validation=W.validateWorld();if(!validation.ok)errors.push(...validation.errors);
const scenarios=[];for(const scenario of ['normal','dry','backwater','blocked','breach','flood']){const s=W.makeState(scenario);let error=null;try{for(let i=0;i<120;i++)W.step(s,1);}catch(e){error=e.message;errors.push(`scenario:${scenario}:${error}`);}scenarios.push({scenario,error,time:s.time,rain:s.rain,balance:W.balance(s),activeEdges:Object.values(s.lastFlows).filter(v=>Math.abs(v)>1e-9).length});}
let minClearance=Infinity,maxClearance=-Infinity,below=0,worst=null;const base=W.makeState();
for(const e of W.connections)for(let i=0;i<=500;i++){const t=i/500,p=W.waterSurfaceOnEdge(e,base,t),g=W.ground(p[0],p[2]),c=p[1]-g;if(c<minClearance){minClearance=c;worst={edge:e.id,t,x:p[0],z:p[2],waterY:p[1],groundY:g,clearance:c};}maxClearance=Math.max(maxClearance,c);if(c<-1e-8)below++;}
if(below)errors.push(`channel_below_ground:${below}`);
const actorCounts={person:W.fieldActors.filter(a=>a.kind==='person').length,water_buffalo:W.fieldActors.filter(a=>a.kind==='water_buffalo').length};if(actorCounts.person<4)errors.push('too_few_people');if(actorCounts.water_buffalo<1)errors.push('no_buffalo');
const portSeparation={};for(const f of W.fields){const p=W.portsByField[f.id],a=p.inlets[0].position,b=p.outlets[0].position,d=Math.hypot(a[0]-b[0],a[2]-b[2]);portSeparation[f.id]=d;if(d<3)errors.push(`port_short_circuit:${f.id}:${d}`);}
const report={version:W.VERSION,ok:errors.length===0,errors,validation,scenarios,channelClearance:{min:minClearance,max:maxClearance,below,worst},actorCounts,portSeparation,grammar:W.terraceSystemRules,claims:{visualAcceptance:false,productionReady:false,regionalSurveyTruth:false}};
fs.writeFileSync(new URL('./domain-r035.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(errors.length)process.exit(1);
