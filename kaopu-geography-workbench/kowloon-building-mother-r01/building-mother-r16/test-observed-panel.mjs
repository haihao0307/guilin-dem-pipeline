import assert from'node:assert/strict';
import{createObservedPanel}from'./kcc-observed-panel.mjs';
import{attachObservedLayouts,KCC_ID}from'./kcc-observed-layout.mjs';
// Minimal DOM contract test, NOT browser/visual rendering proof.
class Element{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.style={};this.hidden=false;}append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}setAttribute(k,v){this.attributes[k]=v;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v;}querySelectorAll(q){const name=q.slice(1,-1).slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return this.children.flatMap(c=>[...(name in c.dataset?[c]:[]),...c.querySelectorAll(q)]);}querySelector(q){return this.querySelectorAll(q)[0];}}
globalThis.document={createElement:t=>new Element(t),createElementNS:(ns,t)=>new Element(t)};
const host=new Element('section'),building={buildingId:KCC_ID,localModel:attachObservedLayouts({sourceModelId:KCC_ID})},events=[];
const panel=createObservedPanel({element:host,getBuilding:id=>id==='kcc'?building:null,onInspect:e=>events.push(e)});
panel.selectCase('lowrise');assert(host.hidden);panel.selectCase('kcc');assert(!host.hidden);assert.equal(panel.snapshot().selectedFloor,5);
const selection=()=>host.querySelector('[data-observed-floor]');
selection().value='6';selection().onchange();assert.equal(panel.snapshot().selectedFloor,6);assert(host.querySelectorAll('[data-observed-node]').some(n=>n.dataset.observedNode.endsWith('platform-0')));
selection().value='7';selection().onchange();assert(!host.querySelectorAll('[data-observed-node]').some(n=>n.dataset.observedNode.endsWith('platform-0')));
const door=host.querySelectorAll('[data-observed-node]').find(n=>n.dataset.observedNode.endsWith('door-A'));door.onclick();assert.equal(events.at(-1).node.type,'entry_door');assert(events.at(-1).relations.some(e=>e.type==='fills'));
selection().value='18';selection().onchange();assert.equal(panel.snapshot().selectedId,null);const lift=host.querySelectorAll('[data-observed-node]').find(n=>n.dataset.observedNode.endsWith('lift-1'));lift.onkeydown({key:'Enter',preventDefault(){}});assert.equal(events.at(-1).node.floorLabel,18);
selection().value='4';selection().onchange();assert(!host.querySelectorAll('[data-observed-node]').length);
panel.selectCase('warehouse');assert(host.hidden);assert(!host.children.length);panel.selectCase('kcc');assert(!host.hidden);assert.equal(panel.snapshot().selectedFloor,4);
console.log('12 DOM contract checks passed; browser visual QA not run');
