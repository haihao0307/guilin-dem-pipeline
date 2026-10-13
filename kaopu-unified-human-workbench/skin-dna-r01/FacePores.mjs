import * as THREE from '../full/source/registration-vendor/three.module.js';
import {seedPores,updateSamples,packSamples} from './specialists/ear-tissue-r05/SurfaceSamples.mjs';
import {S,clamp,zones} from './Anatomy.mjs';
function texture(a){const t=new THREE.DataTexture(a,512,a.length/2048,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
export function faceCoverage(g,i){const R=g.attributes.fRest.array,A=g.attributes.fA.array,T=g.attributes.csType.array,E=g.attributes.eOwned?.array;if(T[i]>=.5||E?.[i]>.001)return 0;const y=R[i*3+1],z=R[i*3+2];return clamp(A[i*4])*(1-clamp(A[i*4+1]*5))*S(.203,.218,y)*S(-.015,.025,z);}
/** R05 area/barycentric/3D sampling reused for a separately owned face domain. */
export class FacePores{
 constructor(g){this.geometry=g;const w=Float32Array.from({length:g.attributes.position.count},(_,i)=>faceCoverage(g,i));const sampleView={attributes:{...g.attributes,eWeight:new THREE.BufferAttribute(w,1)},index:g.index};this.binding=seedPores(sampleView,903701);const R=g.attributes.fRest.array;
 for(const s of this.binding.samples){const p=[0,1,2].map(k=>s.ids.reduce((v,id,j)=>v+R[id*3+k]*s.b[j],0)),r=zones(...p),cheek=Math.max(r[0],r[1],r[2]),nose=Math.exp(-((p[0]/.019)**2+((p[1]-.281)/.027)**2));s.radiusMM*=1.05+cheek*.70+nose*.85;s.depthMM*=.8+cheek*.35+nose*.50;}
 this.builds=0;this.last=null;this.update();}
 update(){const g=this.geometry,P=g.attributes.position.array;if(this.last&&P.every((v,i)=>v===this.last[i]))return;this.last=P.slice();const records=updateSamples(this.binding,g),p=packSamples(records);this.indexTexture?.dispose();this.poreTexture?.dispose();this.indexTexture=texture(p.ids);this.poreTexture=texture(p.data);this.hashSize=p.size;this.builds++;this.report={version:'REGIONAL-PORES-R03',count:records.length,gpuBytes:p.bytes,maxBucket:p.maxBucket,builds:this.builds,barycentric:true,paintedAlbedoDots:false,metric:'current authored surface; idle samples carry the fixed material coordinates',minRadiusMM:Math.min(...records.map(v=>v.r)),maxRadiusMM:Math.max(...records.map(v=>v.r)),measuredHumanPores:false};}
 dispose(){this.indexTexture?.dispose();this.poreTexture?.dispose();this.last=null;}
}
