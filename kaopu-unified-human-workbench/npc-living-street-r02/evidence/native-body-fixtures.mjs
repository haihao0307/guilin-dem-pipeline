/** Read-only canonical body diagnostics from the exact R07/R06 source inputs.
 * This supplies the full 9,253 canonical body points and all CSR influences.
 * It is not the final 266,098-point displayed person or a GNM lip/skin proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {unpack} from './native-fixture-source/DataPack.mjs';
import {AnnyModel} from './native-fixture-source/AnnyModel.mjs';
import {CommonBodyDriver} from './native-fixture-source/CommonBodyDriver.mjs';
import {PRESETS} from './native-fixture-source/PresetCatalogueR2.mjs';
import {ACTOR_PROFILES} from '../src/ActorProfiles.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const copyBuffer=a=>a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);
let shared;
function inputs(){
  if(shared)return shared;
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/StreamingManifest.json')));
  const read=id=>{
    const row=manifest.files.find(x=>x.id===id);if(!row)throw Error('Missing original packet '+id);
    const compressed=Buffer.concat(row.chunks.map(c=>{
      const b=fs.readFileSync(path.join(root,'vendor',c.url));
      if(b.length!==c.bytes||sha(b)!==c.sha256)throw Error('Chunk mismatch '+c.url);return b;
    }));
    if(compressed.length!==row.bytes||sha(compressed)!==row.sha256)throw Error('Packet mismatch '+id);
    const raw=zlib.gunzipSync(compressed);
    if(raw.length!==row.rawBytes||sha(raw)!==row.rawSHA256)throw Error('Native raw mismatch '+id);
    return unpack(copyBuffer(raw));
  };
  const {meta:m,arrays:a}=read('hot');
  const anny=new AnnyModel(m.am,copyBuffer(a.annyCore),m.fm,copyBuffer(a.faceBytes));
  anny.arrays.__rows=new Map();
  anny.__restCache=new Map(m.restKeys.map((k,i)=>[k,{v:a['restV'+i],h:a['restH'+i],o:a['restO'+i]}]));
  for(const i of m.hotRows)anny.arrays.__rows.set(i,{indices:a['ai'+i],values:a['av'+i]});
  // All original sparse rows are loaded. No coefficient/range reduction.
  for(const row of manifest.files.filter(x=>x.id.startsWith('anny-'))){
    const {arrays}=read(row.id);for(const[k,v]of Object.entries(arrays))if(k.startsWith('ai'))
      anny.arrays.__rows.set(+k.slice(2),{indices:v,values:arrays['av'+k.slice(2)]});
  }
  const canonical=m.canonical,bodyCount=canonical.annyRecipes.length;
  const bodyFaces=[];for(let k=0;k<canonical.faces.length;k+=3){const t=canonical.faces.slice(k,k+3);if(t.every(i=>i<bodyCount))bodyFaces.push(...t);}
  const faces=Uint32Array.from(bodyFaces);
  // The original class needs the alternate-driver descriptor at construction.
  // Only its native Anny entry and packet methods are called by this fixture.
  const donor={anny,canonical,bodyCount,names:['c_neck'],parents:[-1]};
  const driver=new CommonBodyDriver({anny,mhrAdapter:donor,canonical});
  return shared={anny,canonical,bodyCount,faces,driver};
}

export function loadNativeBodyFixture(id){
  const s=inputs(),profile=ACTOR_PROFILES.find(p=>p.id===id);
  if(!profile)throw Error('Unknown native diagnostic actor '+id);
  const preset=PRESETS.find(p=>p.id===profile.presetId);if(!preset)throw Error('Missing exact native preset');
  const shape={phenotypes:{...s.canonical.referenceAnnyPhenotypes,...preset.phenotypes},localChanges:{...preset.localChanges}};
  const zero=s.anny.forward(shape),positions=s.driver.sampleAnny(zero.vertices);
  const packet=s.driver.annyRestPacket(zero,new Float32Array(positions.length));
  const names=s.anny.boneLabels.slice(),parents=Array.from(s.anny.boneParents);
  const restMatrices=Array.from({length:names.length},(_,i)=>Array.from(zero.bonePoses.slice(i*16,i*16+16)));
  const rig={source:'anny',names,parents,restMatrices};
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i++) {const k=i%3;min[k]=Math.min(min[k],positions[i]);max[k]=Math.max(max[k],positions[i]);}
  return {id,profile,preset,shape,positions,bodyCount:s.bodyCount,faces:s.faces.slice(),rig,packet,
    vertexCount:s.bodyCount,canonical:s.canonical,state:{owners:{rig:'anny'}},lastBodyDriver:{rig,packet},
    bounds:{min,max,heightM:max[2]-min[2],floorOffset:-min[2]},
    source:{bodyEngine:'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe',paging:'R06 original lossless adapter',
      coefficientsTruncated:false,weightsTruncated:false,headIncluded:false,visualAcceptance:false,
      scope:'original complete canonical body geometry and all joint-conditioned influences; excludes GNM head and display refinement'}};
}
export function loadAllNativeBodyFixtures(){return ACTOR_PROFILES.map(p=>loadNativeBodyFixture(p.id));}
