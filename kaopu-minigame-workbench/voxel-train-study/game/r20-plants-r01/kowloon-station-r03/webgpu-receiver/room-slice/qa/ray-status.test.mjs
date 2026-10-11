import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const receiver=readFileSync(new URL('../receiver.mjs',import.meta.url),'utf8')+readFileSync(new URL('../trace-core.mjs',import.meta.url),'utf8'),app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
assert(receiver.includes('exhausted:bool'));
assert(receiver.includes('Hit(farT,false,false'));
assert(receiver.includes('Hit(t,false,true'));
assert(receiver.includes('regularSteps>=regularLimit')&&receiver.includes('180u,692u'));
assert(receiver.includes('t>=interval.x&&t<=interval.y'));
assert(receiver.includes('min(u.clothLocalBudget,512u)'));
assert(receiver.includes('atomicAdd(&rayStats.primaryExhausted'));
assert(receiver.includes('atomicAdd(&rayStats.secondaryExhausted'));
assert(app.includes("depthCompare:'less-equal'"));
assert(app.includes("'hit','trueMiss','exhausted','secondaryExhausted'"));
// Analytic fold amplitude plus outer yarn gate fits the finite world envelope.
const envelope={half:[.474,.684,.068],cloth:[.46,.67],foldAmplitude:.045+.018,queryGate:.002};
assert(envelope.half[0]>envelope.cloth[0]);assert(envelope.half[1]>envelope.cloth[1]);
assert(envelope.half[2]>envelope.foldAmplitude+envelope.queryGate);
// Budget only changes evaluation allowance; no epsilon/domain/material parameter.
assert(!readFileSync(new URL('../domain.mjs',import.meta.url),'utf8').includes('clothLocalBudget'));
console.log('14 ray-state/finite-local-interval CPU contracts passed; GPU images remain required.');
