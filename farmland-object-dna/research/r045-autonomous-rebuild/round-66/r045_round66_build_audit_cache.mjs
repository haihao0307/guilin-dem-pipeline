import fs from 'node:fs';
import * as K from './r045_round66_kernel.mjs';
import * as B from '../round-58/r045_round58_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import {AUDIT as A58} from '../round-58/r045_round58_audit_cache.mjs';

const src=A58.terrain,dx=(src.x1-src.x0)/src.nx,dz=(src.z1-src.z0)/src.nz;
const {x0,x1,z0,z1,nx,nz}=src,before=src.after,after=[];
for(let j=0;j<=nz;j++){const z=z0+j*dz,row=[];for(let i=0;i<=nx;i++){const x=x0+i*dx;row.push(K.height(x,z))}after.push(row)}
const rivers=[];for(let x=x0;x<=x1+.01;x+=24){const z=K.riverZ(x);rivers.push([x,z,B.height(x,z)+.28,K.height(x,z)+.28])}
const plan=[];for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+(i+.5)*dx,z=z0+(j+.5)*dz,n=K.terraceStateAt(x,z),p=B.terraceStateAt(x,z),r=R47.terraceStateAt(x,z);plan.push({i,j,mask:n.mask,groupIndex:n.groupIndex,frac:n.frac,dd:K.nearestExtendedDrainageDistance(x,z),change:n.delta-p.delta,coverageGain:n.profileCoverageGain||0,priorMask:r.mask})}
let qr={metrics:{changedPoints:[]}};try{qr=JSON.parse(fs.readFileSync(new URL('./r045_round66_qa_result.json',import.meta.url),'utf8'))}catch{}
const exactChanges=(qr.metrics?.changedPoints||[]).filter(p=>Math.abs(p.change)>1e-6);
function qAt(x,z){const s=R47.terraceStateAt(x,z);return s.base+s.phase}function normalAt(x,z){const e=.75,gx=(qAt(x+e,z)-qAt(x-e,z))/(2*e),gz=(qAt(x,z+e)-qAt(x,z-e))/(2*e),m=Math.hypot(gx,gz)||1;return[gx/m,gz/m]}
const centers=[...exactChanges].sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,2).map(p=>[p.x,p.z]);const profiles=centers.map(([x,z])=>{const[nx_,nz_]=normalAt(x,z),samples=[];for(let d=-3;d<=3.0001;d+=.60){const xx=x+d*nx_,zz=z+d*nz_;samples.push([d,B.height(xx,zz),K.height(xx,zz),B.terraceDelta(xx,zz),K.terraceDelta(xx,zz)])}return{x,z,nx:nx_,nz:nz_,samples}});
let changeMax=0,coarseChanged=0,active=0;for(const c of plan){changeMax=Math.max(changeMax,Math.abs(c.change));if(Math.abs(c.change)>.002)coarseChanged++;if(c.mask>.12)active++}
const data={version:K.VERSION,terrain:{x0,x1,z0,z1,nx,nz,before,after},rivers,planSpec:{x0,x1,z0,z1,nx,nz},plan,exactChanges,profiles,state:{changeMax,coarseChanged,exactChanged:exactChanges.length,active,qaPassed:qr.passed===true},generatedAt:new Date().toISOString(),source:'R045.66 fixed view: A reuses persisted accepted R58 surface; B evaluates stronger existing-active weak/low-medium profile coverage; orange markers come from authoritative 6m R66 QA and do not denote new footprint.'};
fs.writeFileSync(new URL('./r045_round66_audit_cache.mjs',import.meta.url),`export const AUDIT=${JSON.stringify(data)};\n`);console.log(JSON.stringify({version:data.version,vertices:(nx+1)*(nz+1),planCells:plan.length,profiles:profiles.length,state:data.state},null,2));
