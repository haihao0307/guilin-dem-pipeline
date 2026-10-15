export {COUNT,SEGMENTS,hashFloats,MATERIALS,halton} from '../references/fiber-r02/kernel.mjs';

import {seedRandom,COUNT} from '../references/fiber-r02/kernel.mjs';

export const GUIDE_COUNT=85,NODES=33,NODE_POWER=1.3;

export const STYLES={medium:{name:'男士中长发',length:.14,rootY:.095,distance:.36,target:[0,.028,.008],roughness:.31,frizz:.12},long:{name:'柔顺长发',length:.34,rootY:.175,distance:.72,target:[0,.018,.008],roughness:.29,frizz:.075}};

export function rootPosition(x,z,style='medium'){return [x,STYLES[style].rootY+.0045*Math.cos(x/.032*Math.PI*.5)+z*.1,z];}

export function guideRoot(i){return [((i%17)/16-.5)*.064,(Math.floor(i/17)/4-.5)*.034];}

export function sampleWeights(x,z){const vx=Math.max(0,Math.min(16,(x+.032)/.064*16)),vz=Math.max(0,Math.min(4,(z+.017)/.034*4)),ix=Math.min(15,Math.floor(vx)),iz=Math.min(3,Math.floor(vz)),a=vx-ix,b=vz-iz;return {ids:[iz*17+ix,iz*17+ix+1,(iz+1)*17+ix,(iz+1)*17+ix+1],weights:[(1-a)*(1-b),a*(1-b),(1-a)*b,a*b]};}

export function strandLength(x,z,style){return STYLES[style].length*(.94+.045*Math.sin(x*93+z*147)+.025*Math.cos(x*173-z*61));}

export function guideRest(index,style='medium',wave=1){

 const [x,z]=guideRoot(index),out=new Float64Array(NODES*3),length=strandLength(x,z,style),phase=x*53+z*29;out.set(rootPosition(x,z,style));

 for(let n=1;n<NODES;n++){const t0=((n-1)/(NODES-1))**NODE_POWER,t1=(n/(NODES-1))**NODE_POWER,t=(t0+t1)*.5;let dx,dy,dz;

 if(style==='medium'){dx=.32*Math.exp(-1.5*t)+wave*.14*Math.sin(3.5*t+phase);dy=.10*Math.exp(-5*t)-.88*(1-Math.exp(-4*t));dz=.82*Math.exp(-2.5*t)+.15+wave*.045*Math.sin(5*t+phase);}

 else {dx=.1*Math.exp(-4*t)+wave*.36*Math.sin(4.5*t+phase)*Math.sin(Math.PI*t);dy=-1;dz=.20*Math.exp(-5*t)+wave*.20*Math.sin(5*t+phase)*Math.sin(Math.PI*t);}

 const inv=length*(t1-t0)/Math.hypot(dx,dy,dz),a=n*3,b=a-3;out[a]=out[b]+dx*inv;out[a+1]=out[b+1]+dy*inv;out[a+2]=out[b+2]+dz*inv;

 }return out;

}

export function makeClumps(){const data=new Float32Array(24*4);for(let i=0;i<24;i++){const a=i*2.39996323,r=Math.sqrt((i+.5)/24)*.94;data.set([Math.cos(a)*.027*r,Math.sin(a)*.014*r,.58+.20*(.5+.5*Math.sin(i*3.1)),a],i*4);}return data;}

export function makeRoots(count=COUNT,seed=270314){const random=seedRandom(seed),roots=new Float32Array(count*4),traits=new Float32Array(count*4),clumps=makeClumps();

 for(let i=0;i<count;i++){const angle=(i*.61803398875+random()/Math.sqrt(count))*Math.PI*2,r=Math.sqrt((i+random())/count),x=Math.cos(angle)*r*.027,z=Math.sin(angle)*r*.014;let nearest=0,best=1e9;

 for(let g=0;g<24;g++){const d=((x-clumps[g*4])/.027)**2+((z-clumps[g*4+1])/.014)**2;if(d<best){best=d;nearest=g;}}

 roots.set([x,z,nearest,random()],i*4);traits.set([.83+.17*random()**.38,.82+.34*random(),random()*Math.PI*2,random()<.018?1:0],i*4);

 }return {roots,traits,clumps,count,seed};

}

