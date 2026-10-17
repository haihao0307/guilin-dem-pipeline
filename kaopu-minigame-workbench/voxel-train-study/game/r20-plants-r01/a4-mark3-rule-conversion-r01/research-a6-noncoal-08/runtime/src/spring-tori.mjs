/**
 * Source Mark 3 Springs are 48 disconnected tilted torus rings, not a continuous
 * helix. This rule reproduces source geometry; it invents no spring mechanics.
 * 48 major × 12 tube samples, a rigid rotation, and 6-layer mirrored placement.
 * Source seam order and non-derivable Float32 deviations are separate payloads.
 * All intermediate ops use binary64 in written order; one Float32 output cast.
 */
const Q = Object.freeze([0,0.13052619222005157,0.25881904510252074,0.3826834323650898,
  0.49999999999999994,0.6087614290087207,0.7071067811865475,0.7933533402912352,
  0.8660254037844386,0.9238795325112867,0.9659258262890683,0.9914448613738104,1]);
export function sinPi24(i) {
  i=((i%48)+48)%48;
  if(i<=12)return Q[i]; if(i<=24)return Q[24-i];
  if(i<=36)return -Q[i-24]; return -Q[48-i];
}
export function cosPi24(i){return sinPi24(i+12);}
export function parseSpringTorusRule(input){
  const bytes=input instanceof Uint8Array ? input : new Uint8Array(input);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(new TextDecoder().decode(bytes.subarray(0,8))!=='M3TRSP01')throw Error('Bad torus magic');
  const parameters=Array.from({length:16},(_,i)=>view.getFloat64(8+8*i,true));
  const [majorSegments,minorSegments,rows,columns,locations,ends,samples,corrections]=
    Array.from({length:8},(_,i)=>view.getUint32(136+4*i,true));
  if(majorSegments!==48||minorSegments!==12||rows!==6||columns!==2||locations!==2||ends!==2||samples!==931)
    throw Error('Unsupported torus sampling');
  const scalarCount=rows*columns*locations*ends*samples*3;
  const maskBytes=Math.ceil(scalarCount/8),packedResidualBytes=Math.ceil(corrections/2);
  const labels=Array.from({length:samples},(_,i)=>view.getUint16(168+2*i,true));
  const maskOffset=168+2*samples;
  if(bytes.length!==maskOffset+maskBytes+packedResidualBytes)throw Error('Torus length mismatch');
  return {parameters,rows,columns,locations,ends,samples,corrections,scalarCount,labels,
    mask:bytes.subarray(maskOffset,maskOffset+maskBytes),residuals:bytes.subarray(maskOffset+maskBytes)};
}
export function generateSpringTorusPositions(rule){
  const {parameters:p,rows,columns,locations,ends,samples,scalarCount,labels}=rule;
  const output=new Float32Array(scalarCount);
  let out=0;
  for(let end=0;end<ends;end++)for(let column=0;column<columns;column++)
    for(let location=0;location<locations;location++)for(let row=0;row<rows;row++){
      const centerY=p[12]+row*p[15];
      const xSign=column===0?1:-1,zSign=end===0?1:-1;
      for(let vertex=0;vertex<samples;vertex++){
        const theta=Math.floor(labels[vertex]/12),phi=(labels[vertex]%12)*4;
        if(theta>=48)throw Error('Torus sample out of range');
        const tubeRadial=p[1]*cosPi24(phi);
        const radius=p[0]+tubeRadial;
        const x=radius*cosPi24(theta),y=p[1]*sinPi24(phi),z=radius*sinPi24(theta);
        const rx=(x*p[2]+y*p[5])+z*p[8];
        const ry=(x*p[3]+y*p[6])+z*p[9];
        const rz=(x*p[4]+y*p[7])+z*p[10];
        output[out++]=Math.fround(xSign*(p[11]+rx));
        output[out++]=Math.fround(centerY+ry);
        output[out++]=Math.fround(zSign*(p[13+location]+rz));
      }
    }
  return output;
}
export function decodeSpringTorusPositions(input,{applyCorrections=true}={}){
  const rule=parseSpringTorusRule(input),positions=generateSpringTorusPositions(rule);
  if(!applyCorrections)return positions;
  const bits=new Uint32Array(positions.buffer);
  let residualIndex=0;
  for(let scalar=0;scalar<rule.scalarCount;scalar++)if((rule.mask[scalar>>>3]>>>(scalar&7))&1){
    let delta=(rule.residuals[residualIndex>>>1]>>>((residualIndex&1)*4))&15;
    if(delta>=8)delta-=16;
    if(delta===0||Math.abs(delta)>5)throw Error('Unsupported torus ULP correction');
    bits[scalar]=bits[scalar]+delta;
    residualIndex++;
  }
  if(residualIndex!==rule.corrections)throw Error('Torus mask count mismatch');
  return positions;
}
