import test from 'node:test';import assert from 'node:assert/strict';
import{makeMeasuredParts,measuredPart,MEASURED_CATALOG}from'../measured-parts.mjs';
import{field}from'../train-field.mjs';
test('five independently sourced nominal dimensions convert inches to metres',()=>{const expected=[[.1651,.2286],[.2413,.2794],[.1524,.2794],[.1397,.1524],[.20955,.1524]];makeMeasuredParts().forEach((p,i)=>{assert.ok(Math.abs(p.size[0]*2-expected[i][0])<1e-12);assert.ok(Math.abs(p.size[1]*2-expected[i][1])<1e-12);assert.ok(p.source.endsWith('#page=3'))})});
test('measurement cylinder has exact radial and end surfaces, not polygonized geometry',()=>{for(const p of makeMeasuredParts()){const r=p.size[0],h=p.size[1];for(let i=0;i<360;i++){const a=i*Math.PI/180;assert.ok(Math.abs(field(p,[r*Math.cos(a),0,r*Math.sin(a)]))<1e-12)}assert.ok(Math.abs(field(p,[0,h,0]))<1e-12);assert.ok(Math.abs(field(p,[0,-h,0]))<1e-12);assert.ok(field(p,[0,0,0])<0);assert.ok(field(p,[r+.01,h+.01,0])>0)}});
test('nominal measurement segment cannot claim assembled or finished part',()=>{for(const p of makeMeasuredParts())for(const k of ['assemblyTransform','shoulderGeometry','fitTolerance','cornerRadius'])assert.equal(p[k],null);assert.ok(makeMeasuredParts().every(p=>!p.fullPart))});
test('unknown catalogue key rejected',()=>{assert.throws(()=>measuredPart('made-up'));assert.equal(MEASURED_CATALOG.length,5)});
