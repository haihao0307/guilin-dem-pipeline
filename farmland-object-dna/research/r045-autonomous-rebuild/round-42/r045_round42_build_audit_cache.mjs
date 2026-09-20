import fs from 'node:fs';
import * as K from './r045_round42_kernel.mjs';
import * as B from '../round-41/r045_round41_kernel.mjs';
const x0=-230,x1=230,z0=-315,z1=205,nx=14,nz=16,dx=(x1-x0)/nx,dz=(z1-z0)/nz;
const before=[],after=[];
for(let j=0;j<=nz;j++){const zb=z0+j*dz,rb=[],ra=[];for(let i=0;i<=nx;i++){const x=x0+i*dx;rb.push(B.height(x,zb));ra.push(K.height(x,zb))}before.push(rb);after.push(ra)}
const rivers=[];for(let x=-230;x<=230;x+=28){const z=K.riverZ(x);rivers.push([x,z,B.height(x,z)+.34,K.height(x,z)+.34])}
const px0=-222,px1=120,pz0=-132,pz1=12,pnx=38,pnz=16,plan=[];
for(let j=0;j<pnz;j++)for(let i=0;i<pnx;i++){const x=px0+(i+.5)*(px1-px0)/pnx,z=pz0+(j+.5)*(pz1-pz0)/pnz,n=K.terraceStateAt(x,z),o=B.terraceStateAt(x,z);plan.push({i,j,mask:n.mask,oldMask:o.mask,groupIndex:n.groupIndex,frac:n.frac,dd:K.nearestExtendedDrainageDistance(x,z),delta:n.delta,gain:n.mask-o.mask,support:n.gapSupport})}
let dmax=0,active=0,gains=0,closures=0,gc=[0,0,0];for(let x=-210;x<=110;x+=16)for(let z=-128;z<=2;z+=12){const st=K.terraceStateAt(x,z),old=B.terraceStateAt(x,z);dmax=Math.max(dmax,Math.abs(st.delta));if(st.mask>.12){active++;if(st.groupIndex>=0&&st.groupIndex<3)gc[st.groupIndex]++}if(st.mask-old.mask>.004){gains++;if(st.gapSupport)closures++}}
const data={version:K.VERSION,terrain:{x0,x1,z0,z1,nx,nz,before,after},rivers,planSpec:{x0:px0,x1:px1,z0:pz0,z1:pz1,nx:pnx,nz:pnz},plan,state:{dmax,active,gains,closures,groups:gc},generatedAt:new Date().toISOString(),source:'R045.42 kernel/R045.41 baseline; fixed camera/world extent, same lightweight audit sampling'};
fs.writeFileSync(new URL('./r045_round42_audit_cache.mjs',import.meta.url),`export const AUDIT=${JSON.stringify(data)};\n`);console.log(JSON.stringify({version:data.version,terrainVertices:(nx+1)*(nz+1),planCells:plan.length,state:data.state},null,2));
