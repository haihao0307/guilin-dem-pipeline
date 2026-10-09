const mul=(a,b)=>Array.from({length:16},(_,i)=>{const r=Math.floor(i/4),c=i%4;return a[r*4]*b[c]+a[r*4+1]*b[4+c]+a[r*4+2]*b[8+c]+a[r*4+3]*b[12+c];});
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rotationAt(axis,angle,p){const n=Math.hypot(...axis);if(n<1e-12||Math.abs(angle)<1e-12)return identity();const [x,y,z]=axis.map(v=>v/n),c=Math.cos(angle),s=Math.sin(angle),t=1-c,m=[t*x*x+c,t*x*y-s*z,t*x*z+s*y,0,t*x*y+s*z,t*y*y+c,t*y*z-s*x,0,t*x*z-s*y,t*y*z+s*x,t*z*z+c,0,0,0,0,1];for(let k=0;k<3;k++)m[k*4+3]=p[k]-m[k*4]*p[0]-m[k*4+1]*p[1]-m[k*4+2]*p[2];return m;}
function worldDirectionToNative(group,d){const e=group.matrixWorld.elements;const view=[e[0]*d[0]+e[1]*d[1]+e[2]*d[2],e[4]*d[0]+e[5]*d[1]+e[6]*d[2],e[8]*d[0]+e[9]*d[1]+e[10]*d[2]];return [view[0],-view[2],view[1]];}

/** Local upper-body pose composition. Feet and lower-body animation targets
 * are unchanged. Rotate a complete skeletal subtree around its pivot so no
 * limb is independently displaced. Not a physical balance/ragdoll solver.
 */
export function composeContactPose(actor,target,response){
 if(!response)return target;
 const posedMatrices=target.posedMatrices.map(m=>Array.from(m)),skinMatrices=target.skinMatrices.map(m=>Array.from(m));
 const names=actor.human.names,parents=actor.human.rig.parents;
 const apply=(bone,axis,angle)=>{const root=names.indexOf(bone);if(root<0)return;const m=posedMatrices[root],D=rotationAt(axis,angle,[m[3],m[7],m[11]]);for(let i=0;i<names.length;i++){let j=i;while(j>=0&&j!==root)j=parents[j];if(j===root){posedMatrices[i]=mul(D,posedMatrices[i]);skinMatrices[i]=mul(D,skinMatrices[i]);}}};
 const offset=worldDirectionToNative(actor.group,response.offset),horizontal=[offset[0],offset[1],0],lean=Math.min(.13,Math.hypot(...horizontal)/Math.max(.4,actor.human.height*.4));
 apply('spine03',cross([0,0,1],horizontal),lean);
 const headAxis=worldDirectionToNative(actor.group,response.head),headAngle=Math.min(.2,Math.hypot(...response.head));apply('head',headAxis,headAngle);
 return {...target,posedMatrices,skinMatrices,contactResponse:{solver:'bounded spring + skeletal subtree composition',ragdoll:false,feetPreserved:true,leanRadians:lean,headRadians:headAngle}};
}
