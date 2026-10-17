/** Parsed-input exact LXZ1 math; contains no source arrays. */
export function generateLoft({coeff,stations,normalization,y,corrections,sourceRows,tags,targetRows},{widthScale=1,zShift=0}={}){
 const [center,scale]=normalization,ns=stations.length,nc=coeff.length,n=ns*nc;if(!(scale>0)||y.length!==n||corrections.length!==n*2||sourceRows.some(i=>i>=targetRows)||new Set(sourceRows).size!==sourceRows.length||tags.some(t=>(t&0x7fff)>=n))throw Error('invalid parsed loft input');
 const base=new Float32Array(n*3),bits=new Uint32Array(base.buffer),apply={x:widthScale===1,z:zShift===0};
 for(let i=0;i<ns;i++){const z=stations[i],v=(z-center)/scale;for(let j=0;j<nc;j++){const k=i*nc+j,x=coeff[j][0]+coeff[j][1]*v;base[k*3]=x*widthScale;base[k*3+1]=y[k];base[k*3+2]=z+zShift;if(apply.x)bits[k*3]=(bits[k*3]+corrections[k*2])>>>0;if(apply.z)bits[k*3+2]=(bits[k*3+2]+corrections[k*2+1])>>>0;}}
 const positions=new Float32Array(sourceRows.length*3),ob=new Uint32Array(positions.buffer);for(let i=0;i<tags.length;i++){const k=(tags[i]&0x7fff)*3;ob.set(bits.subarray(k,k+3),i*3);ob[i*3]^=(tags[i]>>>15)<<31;}return {sourceRows,positions,targetSourceRows:targetRows,correctionsApplied:apply};
}
