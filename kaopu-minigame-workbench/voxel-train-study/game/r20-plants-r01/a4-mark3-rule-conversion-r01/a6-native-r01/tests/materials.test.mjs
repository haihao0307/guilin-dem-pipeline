import assert from 'node:assert/strict';
import * as T from '../../../a4-a6-source-comparison-r03/vendor/three.module.js';
import {createA6MaterialLibrary,A6_INSTANCE_RECIPES} from '../src/a6-materials.mjs';
import {createNativeMaterialLibrary} from '../../student-native-r01/src/native-materials.mjs';
const a=createA6MaterialLibrary(T),b=createNativeMaterialLibrary(T),o={restMatrix:new T.Matrix4().toArray(),units:'m'};
for(const role of ['paint','blackPaint','brushedMetal','rubber','dark-iron']){const x=a.create(role,o),y=b.create(role,o);for(const k of ['metalness','roughness','envMapIntensity','opacity','transmission'])assert.equal(x[k],y[k]);assert.equal(x.color.getHex(),y.color.getHex());}
for(const role of Object.keys(A6_INSTANCE_RECIPES)){const m=a.create(role,o);assert(m.userData.nativeMaster);assert(m.userData.a6Instance.shaderFactoryPreserved);assert.equal(m.opacity,1);if(role==='gold'){const u=m.userData.uniforms;assert.equal(u.uTrainSourceMetallic.value,1);assert.equal(u.uTrainSourceRoughness.value,.32);assert.deepEqual(u.uTrainSourceColor.value.toArray(),[m.color.r,m.color.g,m.color.b]);}if(role==='glass'){assert.equal(m.envMapIntensity,.12);assert.equal(m.transmission,.96);assert.equal(m.transparent,false);}}
a.dispose();b.dispose();console.log('A6 materials: existing mechanical recipes unchanged; explicit master instances and metal shader values consistent. GPU shader appearance still requires browser.');
