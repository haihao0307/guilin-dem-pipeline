(function(){
const UTF8 = new TextDecoder();
const VERSION = 'KFS2.0.0';
const ABI = 'KFS2';
const MAGIC = 'KFSR02V2';
const PACKAGE_MAGIC = 'KFS2PKG2';

function copyTyped(buffer, byteOffset, length, Type) {
  const bytes = length * Type.BYTES_PER_ELEMENT;
  if (byteOffset + bytes > buffer.byteLength) throw new Error('Surface score truncated.');
  return new Type(buffer.slice(byteOffset, byteOffset + bytes));
}

function parseSurfaceScore(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError('Surface score must be an ArrayBuffer.');
  if (buffer.byteLength < 16) throw new Error('Surface score is too small.');
  const magic = UTF8.decode(new Uint8Array(buffer, 0, 8));
  if (magic === PACKAGE_MAGIC) {
    const view = new DataView(buffer);
    const metadataBytes = view.getUint32(8, true);
    const payloadBytes = view.getUint32(12, true);
    if (16 + metadataBytes + payloadBytes !== buffer.byteLength) throw new Error('Resolved surface package byte length mismatch.');
    const metadataText = UTF8.decode(new Uint8Array(buffer, 16, metadataBytes));
    const packageMetadata = JSON.parse(metadataText);
    const payload = buffer.slice(16 + metadataBytes);
    const parsed = parseSurfaceScore(payload);
    parsed.packageMagic = PACKAGE_MAGIC;
    parsed.packageMetadata = packageMetadata;
    parsed.chartMetadata = packageMetadata.chartMetadata;
    if (!parsed.chartMetadata) throw new Error('Resolved surface package lacks chart metadata.');
    validateChartMetadata(parsed, parsed.chartMetadata);
    return parsed;
  }
  if (magic !== MAGIC) throw new Error(`Unsupported surface score magic: ${magic}`);
  if (buffer.byteLength < 24) throw new Error('Surface score payload is too small.');
  const view = new DataView(buffer);
  const chartCount = view.getUint32(8, true);
  const coefficientCount = view.getUint32(12, true);
  const vertexCount = view.getUint32(16, true);
  const triangleCount = view.getUint32(20, true);
  let offset = 24;
  const coefficients = copyTyped(buffer, offset, coefficientCount * 3, Float32Array); offset += coefficientCount * 12;
  const chartLabels = copyTyped(buffer, offset, vertexCount, Uint16Array); offset += vertexCount * 2;
  const parameterUv16 = copyTyped(buffer, offset, vertexCount * 2, Uint16Array); offset += vertexCount * 4;
  const indices = copyTyped(buffer, offset, triangleCount * 3, Uint32Array); offset += triangleCount * 12;
  if (offset !== buffer.byteLength) throw new Error(`Surface score byte length mismatch: parsed ${offset}, file ${buffer.byteLength}.`);
  return { magic, chartCount, coefficientCount, vertexCount, triangleCount, coefficients, chartLabels, parameterUv16, indices };
}

function openUniformKnots(controlCount, degree) {
  if (controlCount < degree + 1) throw new Error('Control count is smaller than spline degree + 1.');
  const knotCount = controlCount + degree + 1;
  const knots = new Float64Array(knotCount);
  const internal = controlCount - degree - 1;
  for (let i = 0; i <= degree; i += 1) knots[i] = 0;
  for (let i = 1; i <= internal; i += 1) knots[degree + i] = i / (internal + 1);
  for (let i = controlCount; i < knotCount; i += 1) knots[i] = 1;
  return knots;
}

function findSpan(controlCount, degree, value, knots) {
  const n = controlCount - 1;
  if (value >= knots[n + 1]) return n;
  if (value <= knots[degree]) return degree;
  let low = degree;
  let high = n + 1;
  let mid = Math.floor((low + high) / 2);
  while (value < knots[mid] || value >= knots[mid + 1]) {
    if (value < knots[mid]) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

function basisFuns(span, value, degree, knots, out, left, right) {
  out[0] = 1;
  for (let j = 1; j <= degree; j += 1) {
    left[j] = value - knots[span + 1 - j];
    right[j] = knots[span + j] - value;
    let saved = 0;
    for (let r = 0; r < j; r += 1) {
      const denominator = right[r + 1] + left[j - r];
      const temp = denominator === 0 ? 0 : out[r] / denominator;
      out[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    out[j] = saved;
  }
}

function buildChartOrder(labels, chartCount) {
  const counts = new Uint32Array(chartCount);
  for (let i = 0; i < labels.length; i += 1) {
    const chart = labels[i];
    if (chart >= chartCount) throw new Error(`Vertex ${i} refers to invalid chart ${chart}.`);
    counts[chart] += 1;
  }
  const offsets = new Uint32Array(chartCount + 1);
  for (let chart = 0; chart < chartCount; chart += 1) offsets[chart + 1] = offsets[chart] + counts[chart];
  const cursor = offsets.slice(0, chartCount);
  const order = new Uint32Array(labels.length);
  for (let i = 0; i < labels.length; i += 1) order[cursor[labels[i]]++] = i;
  return { counts, offsets, order };
}

function validateChartMetadata(score, metadata) {
  const charts = metadata?.charts;
  if (!Array.isArray(charts) || charts.length !== score.chartCount) {
    throw new Error(`Expected ${score.chartCount} chart records, received ${charts?.length ?? 0}.`);
  }
  let expectedOffset = 0;
  for (let i = 0; i < charts.length; i += 1) {
    const chart = charts[i];
    if (chart.chart !== i) throw new Error(`Chart metadata is not ordered at ${i}.`);
    if (chart.coefficientOffset !== expectedOffset) throw new Error(`Chart ${i} coefficient offset is not contiguous.`);
    if (chart.coefficientCount <= 0) throw new Error(`Chart ${i} has no coefficients.`);
    expectedOffset += chart.coefficientCount;
    if (chart.basis === 'CUBIC_TENSOR_BSPLINE') {
      if (!Array.isArray(chart.controlGrid) || chart.controlGrid.length !== 2) throw new Error(`Chart ${i} lacks a control grid.`);
      if (chart.controlGrid[0] * chart.controlGrid[1] !== chart.coefficientCount) throw new Error(`Chart ${i} control grid does not match coefficient count.`);
    } else if (chart.basis !== 'POLYNOMIAL_2D') {
      throw new Error(`Chart ${i} uses unsupported basis ${chart.basis}.`);
    }
  }
  if (expectedOffset !== score.coefficientCount) throw new Error('Chart coefficient coverage is incomplete.');
  return true;
}

function buildSurface(score, metadata = score.chartMetadata, progress = null) {
  validateChartMetadata(score, metadata);
  const positions = new Float32Array(score.vertexCount * 3);
  const { offsets, order } = buildChartOrder(score.chartLabels, score.chartCount);
  const charts = metadata.charts;
  const degree = 3;
  const inv16 = 1 / 65535;
  const bu = new Float64Array(4);
  const bv = new Float64Array(4);
  const leftU = new Float64Array(4);
  const rightU = new Float64Array(4);
  const leftV = new Float64Array(4);
  const rightV = new Float64Array(4);

  for (let chartIndex = 0; chartIndex < charts.length; chartIndex += 1) {
    const chart = charts[chartIndex];
    const coefficientBase = chart.coefficientOffset * 3;
    const begin = offsets[chartIndex];
    const end = offsets[chartIndex + 1];
    if (chart.basis === 'CUBIC_TENSOR_BSPLINE') {
      const ncu = chart.controlGrid[0];
      const ncv = chart.controlGrid[1];
      const knotsU = openUniformKnots(ncu, degree);
      const knotsV = openUniformKnots(ncv, degree);
      for (let cursor = begin; cursor < end; cursor += 1) {
        const vertex = order[cursor];
        const u = score.parameterUv16[vertex * 2] * inv16;
        const v = score.parameterUv16[vertex * 2 + 1] * inv16;
        const spanU = findSpan(ncu, degree, u, knotsU);
        const spanV = findSpan(ncv, degree, v, knotsV);
        basisFuns(spanU, u, degree, knotsU, bu, leftU, rightU);
        basisFuns(spanV, v, degree, knotsV, bv, leftV, rightV);
        let x = 0; let y = 0; let z = 0;
        for (let a = 0; a <= degree; a += 1) {
          const iu = spanU - degree + a;
          for (let b = 0; b <= degree; b += 1) {
            const iv = spanV - degree + b;
            const weight = bu[a] * bv[b];
            const coefficient = coefficientBase + (iu * ncv + iv) * 3;
            x += weight * score.coefficients[coefficient];
            y += weight * score.coefficients[coefficient + 1];
            z += weight * score.coefficients[coefficient + 2];
          }
        }
        const p = vertex * 3;
        positions[p] = x; positions[p + 1] = y; positions[p + 2] = z;
      }
    } else {
      const degreeP = chart.degree;
      for (let cursor = begin; cursor < end; cursor += 1) {
        const vertex = order[cursor];
        const u = score.parameterUv16[vertex * 2] * inv16;
        const v = score.parameterUv16[vertex * 2 + 1] * inv16;
        let x = 0; let y = 0; let z = 0; let term = 0;
        for (let total = 0; total <= degreeP; total += 1) {
          for (let powerU = total; powerU >= 0; powerU -= 1) {
            const powerV = total - powerU;
            const weight = (powerU === 0 ? 1 : u ** powerU) * (powerV === 0 ? 1 : v ** powerV);
            const coefficient = coefficientBase + term * 3;
            x += weight * score.coefficients[coefficient];
            y += weight * score.coefficients[coefficient + 1];
            z += weight * score.coefficients[coefficient + 2];
            term += 1;
          }
        }
        const p = vertex * 3;
        positions[p] = x; positions[p + 1] = y; positions[p + 2] = z;
      }
    }
    if (progress && (chartIndex % 8 === 0 || chartIndex === charts.length - 1)) progress((chartIndex + 1) / charts.length, chartIndex + 1, charts.length);
  }
  return { positions, indices: score.indices, chartLabels: score.chartLabels, parameterUv16: score.parameterUv16 };
}

function measureSurface(surface) {
  const p = surface.positions;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3) {
    if (!Number.isFinite(p[i]) || !Number.isFinite(p[i + 1]) || !Number.isFinite(p[i + 2])) throw new Error(`Non-finite surface position at vertex ${i / 3}.`);
    min[0] = Math.min(min[0], p[i]); min[1] = Math.min(min[1], p[i + 1]); min[2] = Math.min(min[2], p[i + 2]);
    max[0] = Math.max(max[0], p[i]); max[1] = Math.max(max[1], p[i + 1]); max[2] = Math.max(max[2], p[i + 2]);
  }
  return { vertices: p.length / 3, triangles: surface.indices.length / 3, bounds: { min, max, size: max.map((value, i) => value - min[i]) } };
}

function fingerprintSurface(surface) {
  let hash = 0x811c9dc5;
  const bytes = new Uint8Array(surface.positions.buffer, surface.positions.byteOffset, surface.positions.byteLength);
  for (let i = 0; i < bytes.length; i += 1) { hash ^= bytes[i]; hash = Math.imul(hash, 0x01000193); }
  const indexBytes = new Uint8Array(surface.indices.buffer, surface.indices.byteOffset, surface.indices.byteLength);
  for (let i = 0; i < indexBytes.length; i += 1) { hash ^= indexBytes[i]; hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// Clamped cubic interpolation is a single C2 function on its complete domain.
// Positions are observations. End derivatives are explicit boundary conditions.
function cubicCoefficients(x,y,leftSlope,rightSlope) {
  const n=x.length,a=Array.from({length:n},()=>Array(n+1).fill(0));
  const h=x.map((v,i)=>i<n-1?x[i+1]-v:0);
  a[0][0]=2*h[0];a[0][1]=h[0];a[0][n]=6*((y[1]-y[0])/h[0]-leftSlope);
  for(let i=1;i<n-1;i++){
    a[i][i-1]=h[i-1];a[i][i]=2*(h[i-1]+h[i]);a[i][i+1]=h[i];
    a[i][n]=6*((y[i+1]-y[i])/h[i]-(y[i]-y[i-1])/h[i-1]);
  }
  a[n-1][n-2]=h[n-2];a[n-1][n-1]=2*h[n-2];a[n-1][n]=6*(rightSlope-(y[n-1]-y[n-2])/h[n-2]);
  for(let i=0;i<n;i++){
    const d=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=d;
    for(let j=i+1;j<n;j++){const q=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=q*a[i][k];}
  }
  const m=Array(n);for(let i=n-1;i>=0;i--)m[i]=a[i][n]-a[i].slice(i+1,n).reduce((s,v,j)=>s+v*m[i+1+j],0);
  return x.slice(0,-1).map((v,i)=>[y[i],(y[i+1]-y[i])/h[i]-h[i]*(2*m[i]+m[i+1])/6,m[i]/2,(m[i+1]-m[i])/(6*h[i])]);
}
function cubicValue(s,knots,segments) {
  let i=knots.findIndex(v=>v>s)-1;if(i<0)i=s>=knots.at(-1)?knots.length-2:0;
  const u=s-knots[i],c=segments[i];let value=0;for(let j=c.length-1;j>=0;j--)value=value*u+c[j];return value;
}
function curveDerivative(s,knots,segments,order=1) {
  let i=knots.findIndex(v=>v>s)-1;if(i<0)i=s>=knots.at(-1)?knots.length-2:0;
  const u=s-knots[i],c=segments[i];let value=0;
  for(let k=c.length-1;k>=order;k--){let factor=1;for(let j=0;j<order;j++)factor*=k-j;value=value*u+c[k]*factor;}
  return value;
}
function motionCoefficients(x,y,rightSlope){
  const segments=cubicCoefficients(x,y,0,rightSlope),h=x[1]-x[0],c=segments[0];
  const endSlope=c[1]+2*c[2]*h+3*c[3]*h*h,endCurvature=2*c[2]+6*c[3]*h,delta=y[1]-y[0];
  // Match value, slope and curvature at the first moving station; all three
  // start at zero deformation, so the rigid guide joins with C2 continuity.
  segments[0]=[y[0],0,0,(10*delta-4*endSlope*h+endCurvature*h*h/2)/h**3,(-15*delta+7*endSlope*h-endCurvature*h*h)/h**4,(6*delta-3*endSlope*h+endCurvature*h*h/2)/h**5];
  return segments;
}

/* KFC6 central-spine transport, fin-only response and layered-eye interpreter.
 * Object-specific structure and all response ratios come from the resolved score.
 * The instrument contains no species-name lookup, UI, camera or hidden mesh. */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const TAU=2*Math.PI;
const lerp=(a,b,t)=>a+(b-a)*t;
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
function rotateAxis(v,axis,a){const c=Math.cos(a),s=Math.sin(a),d=dot(axis,v);return [v[0]*c+cross(axis,v)[0]*s+axis[0]*d*(1-c),v[1]*c+cross(axis,v)[1]*s+axis[1]*d*(1-c),v[2]*c+cross(axis,v)[2]*s+axis[2]*d*(1-c)];}
function makeChain(n){return {q:new Float64Array(n),v:new Float64Array(n)}}
function chainStep(c,target,p,dt){
 const n=c.q.length,acc=new Float64Array(n),source=p.sourceIndex??1,boundary=p.boundaryStiffness??0;
 for(let i=0;i<n;i++){
  const l=c.q[Math.max(0,i-1)],r=c.q[Math.min(n-1,i+1)];
  acc[i]=p.coupling*(l+r-2*c.q[i])-p.stiffness*c.q[i]-p.damping*c.v[i];
  if(i===0||i===n-1)acc[i]-=boundary*c.q[i];
  if(i===source)acc[i]+=p.sourceStiffness*(target-c.q[i]);
 }
 for(let i=0;i<n;i++){c.v[i]+=dt*acc[i];c.q[i]+=dt*c.v[i];if(!Number.isFinite(c.q[i])||Math.abs(c.q[i])>1.35)throw Error('Weighted continuum stability guard');}
}
function springStep(s,key,target,k,d,dt){const vk=key+'V';s[vk]+=dt*(k*(target-s[key])-d*s[vk]);s[key]+=dt*s[vk];}
function interpCenters(centers,x){let i=0;while(i<centers.length-2&&centers[i+1][0]<x)i++;const t=clamp((x-centers[i][0])/(centers[i+1][0]-centers[i][0]));return [x,lerp(centers[i][1],centers[i+1][1],t),lerp(centers[i][2],centers[i+1][2],t)];}
function responseTarget(meta,mode,options={}){
 const r=new Float32Array(12),ratios=meta.motion.modes[mode].response;
 for(let i=0;i<7;i++){const gain=options.finGains?.[i]??1;r[i+5]=ratios[i+5]*clamp(Number.isFinite(gain)?gain:1,0,1.8);}
 return r;
}
function newState(meta,mode='REST',options={}){
 const r=meta.continuum,parts={};for(const part of r.parts)parts[part.id]=makeChain(part.dynamics.nodes);
 return {time:0,modeTime:0,accumulator:0,mode,body:makeChain(r.body.nodes),pitch:makeChain(r.body.nodes),parts,jaw:0,jawV:0,gill:0,gillV:0,eyeYaw:0,eyeYawV:0,eyePitch:0,eyePitchV:0,pupil:0,pupilV:0,drive:0,response:responseTarget(meta,mode,options),field:new Float32Array(r.body.samples*4*9),worldCenters:new Float32Array(r.body.samples*3)};
}
function reset(h,mode='REST',options={}){if(!h.metadata.motion.modes[mode])throw Error('Unknown motion '+mode);h.state=newState(h.metadata,mode,options);sampleFields(h);return h.state;}
function setMode(h,mode,options={}){if(!h.metadata.motion.modes[mode])throw Error('Unknown motion '+mode);if(h.state.mode!==mode){h.state.mode=mode;h.state.modeTime=0;}return h.state;}
function forcing(mode,p,t){
 let envelope=1;if(p.envelope==='pulse')envelope=t<p.duration?Math.sin(Math.PI*t/p.duration)**2:0;if(p.envelope==='coast')envelope=clamp(1-t/p.duration);if(p.envelope==='brake')envelope=Math.exp(-t/p.duration);
 const carrier=p.frequency?Math.sin(TAU*p.frequency*t):1;
 let ey=p.eyeYaw||0,ep=p.eyePitch||0;if(mode==='EYE_TRACK'){ey*=Math.sin(TAU*.18*t);ep*=Math.sin(TAU*.13*t+.7);}else if(mode!=='REST'){ey+=.018*Math.sin(TAU*.21*t);ep+=.010*Math.sin(TAU*.17*t+.4);}
 return {body:envelope*(p.amplitude*carrier+(p.bias||0)),fin:envelope*(p.fin*carrier+(p.finBias||0)),jaw:envelope*(p.jaw||0)*(.5+.5*Math.sin(TAU*(p.jawFrequency||.5)*t)),pitch:envelope*(p.pitch||0),gill:envelope*(p.gill||0)*(.55+.45*Math.sin(TAU*.72*t+.3)),eyeYaw:ey,eyePitch:ep,pupil:clamp(p.pupil||0),envelope};
}
function update(h,delta,options={}){
 if(h.disposed)throw Error('Disposed handle');if(!Number.isFinite(delta)||delta<0)throw Error('Finite positive delta required');
 const mode=options.mode||h.state.mode;if(mode!==h.state.mode)setMode(h,mode,options);
 const s=h.state,r=h.metadata.continuum,p=h.metadata.motion.modes[mode],dt=r.body.dt,amp=clamp(options.amplitude??1,0,1.6),speed=clamp(options.speed??1,.05,3),targetResponse=responseTarget(h.metadata,mode,options);
 s.accumulator+=Math.min(delta,.12)*speed;
 while(s.accumulator+1e-12>=dt){
  s.accumulator-=dt;s.time+=dt;s.modeTime+=dt;const f=forcing(mode,p,s.modeTime);s.drive=f.body*amp;
  for(let i=0;i<s.response.length;i++)s.response[i]+=Math.min(1,dt*7)*(targetResponse[i]-s.response[i]);
  chainStep(s.body,f.body*amp,r.body,dt);chainStep(s.pitch,f.pitch*amp,r.body,dt);
  for(const part of r.parts){let base;if(part.id<=2)base=f.fin+(part.id===1?1:-1)*(p.differential||0);else if(part.id===7)base=mode==='FIN_FAN'?f.fin:f.body*.88;else base=f.fin*.56+f.body*.18;const channel=part.id===1?5:part.id===2?6:part.id===3?7:part.id===4?8:part.id===5?9:part.id===6?10:11;chainStep(s.parts[part.id],base*amp*s.response[channel],part.dynamics,dt);}
  const j=clamp(f.jaw,0,r.jaw.rangeRad);springStep(s,'jaw',j,r.jaw.stiffness,r.jaw.damping,dt);
  springStep(s,'gill',f.gill,r.gill.stiffness,r.gill.damping,dt);
  const eyeGain=clamp(options.eyeGain??1,0,2.2),yawOffset=Number(options.eyeYawOffset)||0,pitchOffset=Number(options.eyePitchOffset)||0,pupilBias=Number(options.pupilBias)||0;springStep(s,'eyeYaw',clamp(f.eyeYaw*eyeGain+yawOffset,-r.eyes.gazeLimitYawRad,r.eyes.gazeLimitYawRad),r.eyes.gazeStiffness,r.eyes.gazeDamping,dt);springStep(s,'eyePitch',clamp(f.eyePitch*eyeGain+pitchOffset,-r.eyes.gazeLimitPitchRad,r.eyes.gazeLimitPitchRad),r.eyes.gazeStiffness,r.eyes.gazeDamping,dt);springStep(s,'pupil',clamp(f.pupil*eyeGain+pupilBias,0,1),r.eyes.pupilStiffness,r.eyes.pupilDamping,dt);
 }
 sampleFields(h);return s;
}
function continuous(c){const knots=Array.from(c.q,(_,i)=>i/(c.q.length-1));return {knots,spans:motionCoefficients(knots,Array.from(c.q),0)}}
function writeChainRow(field,M,row,c){const f=continuous(c);let ic=0,is=0,previous=0;for(let i=0;i<M;i++){const u=i/(M-1),a=cubicValue(u,f.knots,f.spans);if(i){const mid=(a+previous)/2;ic+=Math.cos(mid)/(M-1);is+=Math.sin(mid)/(M-1);}previous=a;field.set([u?ic/u:1,u?is/u:0,a,0],row*M*4+i*4);}}
function sampleFields(h){
 const s=h.state,r=h.metadata.continuum,M=r.body.samples,body=continuous(s.body),pitch=continuous(s.pitch);let dx=0,dy=0,dz=0;const length=r.body.endXM-r.body.sourceXM,ds=length/(M-1);let lastY=0,lastP=0;
 for(let i=0;i<M;i++){const u=i/(M-1),a=cubicValue(u,body.knots,body.spans),b=cubicValue(u,pitch.knots,pitch.spans),x=r.body.sourceXM+u*length;if(i){const ya=(a+lastY)/2,pi=(b+lastP)/2;dx+=ds*(Math.cos(ya)*Math.cos(pi)-1);dy+=ds*Math.sin(pi);dz+=ds*Math.sin(ya)*Math.cos(pi);}lastY=a;lastP=b;const rc=interpCenters(r.body.centersM,x),o=i*4;s.field.set([dx,dy,dz,a],o);s.field.set([b,rc[1],rc[2],0],M*4+o);s.worldCenters.set([x+dx,rc[1]+dy,rc[2]+dz],i*3);}
 for(const part of r.parts)writeChainRow(s.field,M,part.fieldRow,s.parts[part.id]);
}
function readField(h,row,u){const M=h.metadata.continuum.body.samples,x=clamp(u)*(M-1),i=Math.floor(x),j=Math.min(M-1,i+1),t=x-i,o=row*M*4;return [0,1,2,3].map(k=>lerp(h.state.field[o+i*4+k],h.state.field[o+j*4+k],t));}
function decodeNormal(e){let x=e[0],y=e[1],z=1-Math.abs(x)-Math.abs(y);if(z<0){const ox=x,oy=y;x=(1-Math.abs(oy))*Math.sign(ox+1e-8);y=(1-Math.abs(ox))*Math.sign(oy+1e-8);}return norm([x,y,z]);}
function weightAt(weights,i){return weights?weights[i]/255:0}
function partRecord(h,id){return h.metadata.continuum.parts.find(p=>p.id===id)}
function spineFrame(h,referenceX){
 const br=h.metadata.continuum.body,x=clamp(referenceX,br.sourceXM,br.endXM),u=(x-br.sourceXM)/(br.endXM-br.sourceXM),f=readField(h,0,u),g=readField(h,1,u),a=f[3],b=g[0],ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 return {restCenter:[x,g[1],g[2]],center:[x+f[0],g[1]+f[1],g[2]+f[2]],T:[ca*cb,sb,sa*cb],U:[-ca*sb,cb,-sa*sb],N:[-sa,0,ca]};
}
function transportSpine(h,position,normal,referenceX){
 const f=spineFrame(h,referenceX),q=vsub(position,f.restCenter),transform=v=>[0,1,2].map(k=>f.T[k]*v[0]+f.U[k]*v[1]+f.N[k]*v[2]);
 return {position:vadd(f.center,transform(q)),normal:norm(transform(normal))};
}
function deformMaterial(h,position,normal,binding,weights,partInfo,root,animated=true){
 let p=Array.from(position),n=normal?Array.from(normal):[0,0,1];const r=h.metadata.continuum;
 const eyeSocket=weightAt(weights,4);if(eyeSocket>0){p=vsub(p,vmul(n,r.eyes.socketRecessM*eyeSocket));}
 if(!animated)return {position:p,normal:n};
 const jawW=weightAt(weights,2);const ja=h.state.jaw*jawW;if(ja){const q=vsub(p,r.jaw.pivotM);p=vadd(r.jaw.pivotM,[Math.cos(ja)*q[0]-Math.sin(ja)*q[1],Math.sin(ja)*q[0]+Math.cos(ja)*q[1],q[2]]);n=rotateAxis(n,[0,0,1],ja);}
 const gillW=weightAt(weights,3);if(gillW){p[2]+=Math.sign(p[2]||1)*h.state.gill*gillW;}
 const pid=partInfo?partInfo[0]:0,t=partInfo?partInfo[1]/65535:0;if(pid){const part=partRecord(h,pid),f=readField(h,part.fieldRow,t),ray=vsub(p,root),L=Math.hypot(...ray),T=norm(ray),U=part.bendDirection,channel=pid===1?5:pid===2?6:pid===3?7:pid===4?8:pid===5?9:pid===6?10:11,w=weightAt(weights,channel);const pd=vadd(root,vadd(vmul(ray,f[0]),vmul(U,L*f[1])));p=p.map((x,k)=>lerp(x,pd[k],w));const axis=norm(cross(T,U));n=rotateAxis(n,axis,f[2]*w);}
 // The rest material address is immutable even when jaw/fin deformation moves X.
 // One full orthonormal spine transform carries every complete section.
 return transportSpine(h,p,n,position[0]);
}
function deformPoint(h,vertex,animated=true){const o=vertex*3,w=vertex*12,pi=vertex*2,b=vertex*6;return deformMaterial(h,h.positions.subarray(o,o+3),decodeNormal([h.normalOct[vertex*2]/32767,h.normalOct[vertex*2+1]/32767]),h.binding.subarray(b,b+6),h.weights.subarray(w,w+12),h.partInfo.subarray(pi,pi+2),h.partRoot.subarray(o,o+3),animated).position;}
function syntheticWeights(x){const t=clamp((x+.38)/.24);const s=t*t*(3-2*t),a=new Uint8Array(12);a[0]=Math.round(s*255);a[1]=255-a[0];return a;}
function eyeFrame(h,side,animated=true){const e=h.metadata.continuum.eyes.eyes.find(x=>x.side===side);if(!e)throw Error('Missing eye side '+side);const eps=.01,w=syntheticWeights(e.globeCenterM[0]),z=new Uint16Array(2),r=new Float32Array(3);const deform=q=>deformMaterial(h,q,null,null,w,z,r,animated).position,C0=deform(e.globeCenterM),T=norm(vsub(deform(vadd(e.globeCenterM,vmul(e.tangent,eps))),C0)),U=norm(vsub(deform(vadd(e.globeCenterM,vmul(e.up,eps))),C0)),O=norm(cross(T,U));if(dot(O,e.outwardNormal)<0)O=vmul(O,-1);const C=vsub(C0,vmul(O,e.embedM||0));return {center:C,tangent:T,up:U,outward:O,gazeYaw:animated?h.state.eyeYaw:0,gazePitch:animated?h.state.eyePitch:0,pupil:animated?h.state.pupil:0,parameters:e};}
function pushVertex(a,p,n,c,uv){a.positions.push(...p);a.normals.push(...n);a.components.push(c);a.uv.push(...uv);return a.positions.length/3-1;}
function buildEyeGeometry(eye){const a={positions:[],normals:[],components:[],uv:[],indices:[],ranges:{}};const r=eye.globeRadiusM;
 function sphere(component,radius,thetaMax=Math.PI,segments=48,rings=24){const start=a.indices.length,base=a.positions.length/3;for(let j=0;j<=rings;j++){const th=thetaMax*j/rings;for(let i=0;i<=segments;i++){const ph=TAU*i/segments,nn=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];pushVertex(a,vmul(nn,radius),nn,component,[i/segments,j/rings]);}}for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const q=base+j*(segments+1)+i;a.indices.push(q,q+segments+1,q+1,q+1,q+segments+1,q+segments+2);}a.ranges[component]={offset:start,count:a.indices.length-start};}
 sphere(0,r,Math.PI,48,24);
 // socket annulus at the visible globe equator
 {const start=a.indices.length,seg=64,z=r*.28,ri=eye.socketRadiusM*.91,ro=eye.socketRadiusM;for(let i=0;i<=seg;i++){const q=TAU*i/seg,c=Math.cos(q),s=Math.sin(q);pushVertex(a,[c*ri,s*ri,z],[0,0,1],1,[0,i/seg]);pushVertex(a,[c*ro,s*ro,z],[0,0,1],1,[1,i/seg]);}const base=a.positions.length/3-(seg+1)*2;for(let i=0;i<seg;i++){const q=base+i*2;a.indices.push(q,q+2,q+1,q+1,q+2,q+3);}a.ranges[1]={offset:start,count:a.indices.length-start};}
 function disc(component,radius,z,seg=64){const start=a.indices.length,base=a.positions.length/3;pushVertex(a,[0,0,z],[0,0,1],component,[.5,.5]);for(let i=0;i<=seg;i++){const q=TAU*i/seg;pushVertex(a,[Math.cos(q)*radius,Math.sin(q)*radius,z],[0,0,1],component,[.5+.5*Math.cos(q),.5+.5*Math.sin(q)]);}for(let i=0;i<seg;i++)a.indices.push(base,base+i+1,base+i+2);a.ranges[component]={offset:start,count:a.indices.length-start};}
 disc(2,eye.irisRadiusM,r*.935);disc(3,eye.pupilRadiusM,r*.948);
 sphere(4,eye.corneaRadiusM,Math.PI*.30,48,10);
 return {positions:new Float32Array(a.positions),normals:new Float32Array(a.normals),components:new Uint8Array(a.components),uv:new Float32Array(a.uv),indices:new Uint32Array(a.indices),ranges:a.ranges};}
async function inflate(b){return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())}
function parseScore(bytes){if(bytes instanceof ArrayBuffer)bytes=new Uint8Array(bytes);if(!(bytes instanceof Uint8Array)||bytes.length<16)throw Error('Invalid score bytes');if(new TextDecoder().decode(bytes.slice(0,8))!=='KFS6PKG1')throw Error('Score ABI mismatch');const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=v.getUint32(8,true),meta=JSON.parse(new TextDecoder().decode(bytes.slice(16,16+size))),chunks=new Map();if(meta.instrument.abi!=='KFC6'||!meta.continuum||!meta.motion)throw Error('Incomplete resolved score');for(const c of meta.package.chunks){const begin=16+size+c.offset;if(begin+c.bytes>bytes.length)throw Error('Truncated chunk '+c.name);chunks.set(c.name,bytes.slice(begin,begin+c.bytes));}return {metadata:meta,chunks}}
async function build(bytes,progress=()=>{}){const pkg=bytes.chunks?bytes:parseScore(bytes),meta=pkg.metadata;progress(.04);const raw=await inflate(pkg.chunks.get('baseKfs2Gzip')),core=parseSurfaceScore(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),surface=buildSurface(core,core.chartMetadata);progress(.34);const keys=['residualGzip','normalOctGzip','textureUvGzip','bindingGzip','weightsGzip','partInfoGzip','partRootGzip'],decoded=await Promise.all(keys.map(k=>inflate(pkg.chunks.get(k))));const residual=new Int16Array(decoded[0].buffer),normalOct=new Int16Array(decoded[1].buffer),uv=new Uint16Array(decoded[2].buffer),binding=new Float32Array(decoded[3].buffer),weights=new Uint8Array(decoded[4].buffer),partInfo=new Uint16Array(decoded[5].buffer),partRoot=new Float32Array(decoded[6].buffer),positions=new Float32Array(surface.positions.length),N=meta.counts.vertices;if(residual.length!==positions.length||weights.length!==N*12||partInfo.length!==N*2||partRoot.length!==N*3)throw Error('Weighted surface field count mismatch');for(let i=0;i<positions.length;i++)positions[i]=surface.positions[i]+residual[i]*meta.surface.residualScaleM;const h={metadata:meta,positions,indices:surface.indices,normalOct,uv,binding,weights,partInfo,partRoot,textures:{base:pkg.chunks.get('baseColorJpeg'),normal:pkg.chunks.get('normalPng'),rm:pkg.chunks.get('roughMetalJpeg')},disposed:false};reset(h);progress(1);return h}
function measure(h){return {vertices:h.positions.length/3,triangles:h.indices.length/3,weightChannels:h.metadata.continuum.weightChannels.length,adjustableFinChannels:7,bodyTransport:"FULL_CENTRAL_SPINE",weightedAddresses:h.weights.length/12,appendageAddresses:Array.from(h.partInfo.filter((_,i)=>i%2===0)).filter(Boolean).length,eyeOperator:h.metadata.continuum.eyes.operator,staticGeometryBytes:h.positions.byteLength+h.indices.byteLength+h.normalOct.byteLength+h.uv.byteLength+h.binding.byteLength+h.weights.byteLength+h.partInfo.byteLength+h.partRoot.byteLength}}
function snapshot(h){const q=[];for(const v of h.state.body.q)q.push(+v.toFixed(8));for(const id of Object.keys(h.state.parts).map(Number).sort((a,b)=>a-b))for(const v of h.state.parts[id].q)q.push(+v.toFixed(8));return {mode:h.state.mode,time:+h.state.time.toFixed(8),response:Array.from(h.state.response,x=>+x.toFixed(6)),q,jaw:+h.state.jaw.toFixed(8),gill:+h.state.gill.toFixed(8),eye:[+h.state.eyeYaw.toFixed(8),+h.state.eyePitch.toFixed(8),+h.state.pupil.toFixed(8)]}}
function dispose(h){for(const k of ['positions','indices','normalOct','uv','binding','weights','partInfo','partRoot','textures','state'])h[k]=null;h.disposed=true}
globalThis.KaopuFishSpineFin=Object.freeze({VERSION:'6.0.0',ABI:'KFC6',parseScore,build,reset,setMode,update,deformPoint,deformMaterial,measure,snapshot,dispose,readField,spineFrame,transportSpine,eyeFrame,buildEyeGeometry});

})();
