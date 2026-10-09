import * as THREE from '../vendor/three.module.js';
import {attachCommonPerson} from '../integration/CommonPersonSceneAdapter.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
// Synthetic three-vertex fixture checks adapter arithmetic only, not a new person.
const scene=new THREE.Scene(),positions=new Float32Array([0,1,2,1,1,2,0,2,2]),faces=new Uint32Array([0,1,2]);
const model={positions,faces,state:{offset:0},compute(s){this.state=s;this.positions[0]=s.offset;},restore(a){this.compute(a.state);}};
class TestSkin{constructor(v,s){this.v=v;this.settings=s;this.count=0;this.v.geometry.setAttribute('csRest',new THREE.BufferAttribute(new Float32Array(9),3));}update(){this.count++;}set(v){Object.assign(this.settings,v);return this.settings;}report(){return{fixtureOnly:true,updates:this.count};}dispose(){this.v.geometry.deleteAttribute('csRest');}}
const a=attachCommonPerson({THREE,scene,model,SkinLayer:TestSkin});
assert.deepEqual(Array.from(a.geometry.attributes.position.array),[0,2,-1,1,2,-1,0,2,-2]);
assert.equal(a.geometry.index.array,faces);assert.equal(model.positions,positions);const field=a.geometry.attributes.csRest;
assert.equal(a.report().worldMinY,0);assert.equal(a.root.position.y,-2);
a.compute({offset:.4});assert(Math.abs(a.geometry.attributes.position.array[0]-.4)<1e-7);assert.equal(a.geometry.attributes.csRest,field);assert.equal(a.report().newRendererCreated,false);
assert.throws(()=>attachCommonPerson({THREE,scene,model}),/CommonSkinLayer/);a.dispose();assert.equal(scene.children.length,0);
const result={passed:true,scope:'Synthetic adapter contract only. Existing CommonPerson/skin runtime and assets not executed or visually verified.',checks:['Exact existing coordinate conversion','Immutable source position/index identity','Index buffer reused without remesh','Skin fields preserved on geometry sync','Required original skin layer enforced','Host scene used without another renderer','Floor placement uses Group offset without altering source vertices','Dispose detaches local integration']};
writeFileSync(new URL('./adapter-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
