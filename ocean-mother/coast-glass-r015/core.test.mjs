import assert from 'node:assert/strict';
import {rockGeometry,compileRockHeight} from './geometry.mjs';
import {COAST_ROCKS,FIRE_RING,bedHeight,waveAt,VERSION} from './core.mjs';
const checks={};function check(k,fn){fn();checks[k]=true;}
let geo=rockGeometry(COAST_ROCKS),idx=geo.indices,d=geo.data;
check('version',()=>assert.equal(VERSION,'0.2.5-coast-r015'));
check('finite_geometry',()=>assert.ok([...d].every(Number.isFinite)));
check('no_degenerate_triangles',()=>assert.equal(geo.degenerate,0));
const edges=new Map();for(let i=0;i<idx.length;i+=3){for(const [a,b] of [[idx[i],idx[i+1]],[idx[i+1],idx[i+2]],[idx[i+2],idx[i]]]){const k=a<b?`${a},${b}`:`${b},${a}`;edges.set(k,(edges.get(k)||0)+1)}}
check('sealed_rock_edges',()=>assert.ok([...edges.values()].every(n=>n===2)));
check('unit_vertex_normals',()=>{for(let i=0;i<d.length;i+=7)assert.ok(Math.abs(Math.hypot(d[i+3],d[i+4],d[i+5])-1)<1e-5)});
check('outward_winding',()=>{const vpr=762;for(let n=0;n<idx.length;n+=3){const def=COAST_ROCKS[Math.floor(idx[n]/vpr)],cy=bedHeight(def[0],def[1])+def[3]*.30;const P=[0,1,2].map(k=>Array.from(d.slice(idx[n+k]*7,idx[n+k]*7+3)));const u=P[1].map((v,k)=>v-P[0][k]),v=P[2].map((v,k)=>v-P[0][k]),N=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],r=[(P[0][0]+P[1][0]+P[2][0])/3-def[0],(P[0][1]+P[1][1]+P[2][1])/3-cy,(P[0][2]+P[1][2]+P[2][2])/3-def[1]];assert.ok(N[0]*r[0]+N[1]*r[1]+N[2]*r[2]>0)}});
const field=compileRockHeight(geo);
check('rock_height_from_same_mesh',()=>{for(const r of COAST_ROCKS)assert.ok(field.sample(r[0],r[1])>bedHeight(r[0],r[1]))});
check('outside_rock_field_empty',()=>assert.equal(field.sample(1000,1000),-64));
check('finite_fire_ring',()=>assert.ok([...rockGeometry(FIRE_RING).data].every(Number.isFinite)));
const config={tide:.14,swell:.57,period:8,wind:6.4};
check('finite_long_term_wave_state',()=>{for(const t of [0,30,3600,86400])for(let z=-20;z<45;z+=1)for(let x=-40;x<40;x+=4){const w=waveAt(x,z,t,config);assert.ok([w.eta,w.depth,w.breaker,...w.normal].every(Number.isFinite));assert.ok(w.breaker>=0&&w.breaker<=1)}});
check('long_term_phase_slope_bounded',()=>{for(const t of [0,30,3600,86400])for(let z=-8;z<40;z+=.3){const a=waveAt(0,z,t,config).eta,b=waveAt(0,z+.02,t,config).eta;assert.ok(Math.abs(a-b)/.02<1.5)}});
console.log(JSON.stringify({status:'PASS',checks,checkCount:Object.keys(checks).length,vertices:d.length/7,triangles:idx.length/3},null,2));
