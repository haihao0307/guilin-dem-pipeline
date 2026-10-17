/** Sparse browser-compatible ABI. No fs, source fetch, point pool, or XYZ tail. */
const PARAMETERS=['coreHalfWidth','flangeOverhang','bottomY','webHeight','flangeThickness','joinZ','length','frontSeamFraction','joinSeamFraction'];
export function parseRaw(raw){
  const u=raw instanceof Uint8Array?raw:new Uint8Array(raw);const d=new DataView(u.buffer,u.byteOffset,u.byteLength);
  if(u.length<104||String.fromCharCode(...u.slice(0,8))!=='A4UF64R1')throw Error('Bad magic/header');
  const header=[8,12,16,20].map(at=>d.getUint32(at,true));if(header.join(',')!=='64,163,103,9')throw Error('Unexpected source layout');
  const base=Object.fromEntries(PARAMETERS.map((k,i)=>[k,d.getFloat64(24+8*i,true)]));let at=96;const program=[];
  for(let i=0;i<103;i++){const row=d.getUint16(at,true),tag=d.getUint8(at+2);at+=3;if(row>=163||tag>=64||(tag&3)===3)throw Error('Bad source address/tag');program.push([row,tag]);}
  if(new Set(program.map(r=>r[0])).size!==103)throw Error('Duplicate source row');
  if(u.length<at+8)throw Error('Truncated correction header');const n=d.getUint32(at,true),sharedBits=d.getUint32(at+4,true);at+=8;
  if(n!==19||u.length!==at+2*n)throw Error('Bad correction layout or trailing data');
  const correctionRows=Array.from({length:n},(_,i)=>d.getUint16(at+2*i,true));const centers=program.filter(([r,t])=>(t&3)===1).map(([r])=>r);
  if(new Set(correctionRows).size!==19||correctionRows.some(r=>!centers.includes(r))||centers.length!==19)throw Error('Correction rows are not the source center seam');
  if(Object.values(base).some(v=>!Number.isFinite(v)))throw Error('Nonfinite base parameters');
  return {base,program,correctionRows,sharedBits};
}
export function shapeVertex(p,side,radius,level,station){
  const width=p.coreHalfWidth+(radius?p.flangeOverhang:0),heights=[0,p.webHeight,p.webHeight+p.flangeThickness,p.webHeight*(station?p.frontSeamFraction:p.joinSeamFraction)];
  return [Math.fround(side*width),Math.fround(p.bottomY+heights[level]),Math.fround(p.joinZ+station*p.length)];
}
export function decodeRaw(raw,{parameters={}}={}){
  const d=parseRaw(raw),base=d.base;
  if(Object.keys(parameters).some(k=>!(k in base)))throw Error('Unknown parameter');
  const changed=Object.entries(parameters).filter(([k,v])=>v!==base[k]).length;
  if(changed>1)throw Error('Only one parameter may vary in this bounded experiment');
  const p={...base,...parameters};
  for(const[k,b]of Object.entries(base)){const delta=.01*(k==='bottomY'?base.webHeight:k==='joinZ'?base.length:k.includes('Seam')?1:Math.abs(b));if(!Number.isFinite(p[k])||p[k]<b-delta||p[k]>b+delta)throw Error('Out of tested bound: '+k);}
  const vertexIndices=Uint32Array.from(d.program,r=>r[0]);const positions=new Float32Array(309);
  d.program.forEach(([row,tag],i)=>positions.set(shapeVertex(p,(tag&3)-1,(tag>>2)&1,(tag>>3)&3,(tag>>5)&1),3*i));
  if(!changed){const bits=new Uint32Array(positions.buffer),slots=new Map(Array.from(vertexIndices,(row,i)=>[row,i]));for(const row of d.correctionRows)bits[3*slots.get(row)]^=d.sharedBits;}
  return {field:64,sourceVertexCount:163,vertexIndices,positions,numericCorrectionsApplied:!changed};
}
