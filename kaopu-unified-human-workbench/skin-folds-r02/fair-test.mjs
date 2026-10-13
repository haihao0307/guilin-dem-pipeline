import {FairSkin} from './FairSkin.mjs';
import assert from 'node:assert/strict';
const N=25,P=new Float32Array(N*N*3),norm=new Float32Array(P.length),mask=new Float32Array(N*N),faces=[];
for(let j=0;j<N;j++)for(let i=0;i<N;i++){let k=j*N+i;P[k*3]=i*.001;P[k*3+1]=j*.001;P[k*3+2]=.00008*((i+j)%2?1:-1);norm[k*3+2]=1;mask[k]=i>1&&j>1&&i<N-2&&j<N-2?1:0;if(i<N-1&&j<N-1)faces.push(k,k+1,k+N,k+1,k+N+1,k+N);}
const old=P.slice(),fair=new FairSkin(faces,mask),stats=fair.apply(P,norm);
assert(stats.normalLaplacianAfterMM<stats.normalLaplacianBeforeMM*.5);assert(stats.maxCorrectionMM<=.221);
for(let i=0;i<mask.length;i++){assert.equal(P[i*3],old[i*3]);assert.equal(P[i*3+1],old[i*3+1]);if(mask[i]===0)assert.equal(P[i*3+2],old[i*3+2]);}
console.log('PASS bounded normal fairing protected coordinates unchanged, checkerboard reduced',stats);
