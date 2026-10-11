// Original metre-unit construction recipes. Defaults are authoring fixtures,
// not historical dimensions, housing allocations, or building-code claims.
export const WALL_SCHEMA = 'kaopu.street.wall-unit/1';
export const WALL_OPERATOR = 'kaopu.street.wall-unit';
export const WALL_KINDS = Object.freeze(['plaster-window', 'tile-door', 'cage-window']);
const fields = {
  object:['id','seed'], dimensions:['width','height','thickness'],
  opening:['x','width','height','bottom'],
  material:['ageYears','repairAgeYears','repair','rainExposure','drainage','wetness','saltExposure','groundContact','tint'],
  tile:['width','height','joint'], cage:['depth','barSpacing','barRadius'],
  pipe:['enabled','role','radius'], door:['enabled','open'], placement:['position','yaw']
};
const clone = v => JSON.parse(JSON.stringify(v));
function object(v, name) {
  if(!v || typeof v !== 'object' || Array.isArray(v) || ![Object.prototype,null].includes(Object.getPrototypeOf(v))) throw Error(name+' must be a plain data object');
  for(const d of Object.values(Object.getOwnPropertyDescriptors(v)))if(!Object.hasOwn(d,'value'))throw Error(name+' cannot contain accessors');
}
function keys(v, allowed, name) { object(v,name); for(const k of Object.keys(v)) if(!allowed.includes(k)) throw Error('Unknown '+name+'.'+k); }
function num(v, lo, hi, name) { if(!Number.isFinite(v)||v<lo||v>hi) throw Error(name+' out of range'); return v; }
function bool(v,name) { if(typeof v!=='boolean') throw Error(name+' must be boolean'); }
export function normalizeWallScore(input={}) {
  keys(input,['schema','kind',...Object.keys(fields)],'score');
  const kind=input.kind??'plaster-window';
  if(!WALL_KINDS.includes(kind)) throw Error('Unknown wall kind');
  if(input.schema!=null&&input.schema!==WALL_SCHEMA) throw Error('Wrong wall schema');
  for(const [k,allowed] of Object.entries(fields)) if(input[k]!=null) keys(input[k],allowed,k);
  const door=kind==='tile-door';
  const s={schema:WALL_SCHEMA,kind,
    object:{id:'wall-'+kind,seed:1980,...input.object},
    dimensions:{width:2.6,height:2.8,thickness:.20,...input.dimensions},
    opening:{x:0,width:door?.96:1.18,height:door?2.08:1.28,bottom:door?0:.92,...input.opening},
    material:{ageYears:32,repairAgeYears:Math.min(4,input.material?.ageYears??32),repair:.26,rainExposure:.78,drainage:.55,wetness:.25,saltExposure:.35,groundContact:true,tint:door?'#b5b8a4':'#b7ae92',...input.material},
    tile:{width:.10,height:.10,joint:.004,...input.tile},
    cage:{depth:.52,barSpacing:.15,barRadius:.011,...input.cage},
    pipe:{enabled:door,role:'rainwater',radius:.032,...input.pipe},
    door:{enabled:door,open:true,...input.door},
    placement:{position:[0,0,0],yaw:0,...input.placement}};
  if(typeof s.object.id!=='string'||!s.object.id.length||s.object.id.length>100) throw Error('Invalid wall identity');
  if(!Number.isInteger(s.object.seed)||s.object.seed<0||s.object.seed>0xffffffff) throw Error('Invalid seed');
  const d=s.dimensions,o=s.opening;
  num(d.width,.8,8,'width');num(d.height,1.8,5,'height');num(d.thickness,.08,.6,'thickness');
  num(o.width,.3,d.width-.16,'opening width');num(o.height,.3,d.height-.08,'opening height');
  num(o.bottom,0,d.height-o.height-.08,'opening bottom');num(o.x,-d.width/2,d.width/2,'opening x');
  if(Math.abs(o.x)+o.width/2>d.width/2-.08) throw Error('Opening leaves no wall pier');
  if(door&&o.bottom!==0) throw Error('Walk-through door must start at floor; stairs are a separate connection');
  if(!door&&s.door.enabled) throw Error('Door leaf is only supported on tile-door');
  const m=s.material;num(m.ageYears,0,150,'ageYears');num(m.repairAgeYears,0,m.ageYears,'repairAgeYears');
  for(const k of ['repair','rainExposure','drainage','wetness','saltExposure'])num(m[k],0,1,k);
  bool(m.groundContact,'groundContact');if(!/^#[0-9a-f]{6}$/i.test(m.tint))throw Error('tint must be a six-digit hex colour');
  num(s.tile.width,.04,.4,'tile width');num(s.tile.height,.04,.4,'tile height');num(s.tile.joint,.001,Math.min(s.tile.width,s.tile.height)*.2,'tile joint');
  num(s.cage.depth,.20,1.0,'cage depth');num(s.cage.barSpacing,.07,.3,'bar spacing');num(s.cage.barRadius,.006,.025,'bar radius');
  bool(s.pipe.enabled,'pipe.enabled');if(!['rainwater','water-supply','steam-reserved'].includes(s.pipe.role))throw Error('Unknown pipe role');num(s.pipe.radius,.015,.07,'pipe radius');
  bool(s.door.enabled,'door.enabled');bool(s.door.open,'door.open');
  if(!Array.isArray(s.placement.position)||s.placement.position.length!==3)throw Error('placement.position must have three values');
  s.placement.position.forEach((v,i)=>num(v,-1e7,1e7,'position '+i));num(s.placement.yaw,-Math.PI*2,Math.PI*2,'yaw');
  return clone(s);
}
export function canonicalWallScore(input) { return JSON.stringify(normalizeWallScore(input)); }
export function wallSeed(seed) { let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export function subtractOpening(rect, opening) {
  const [x0,y0,x1,y1]=rect,[a,b,c,d]=opening,ix0=Math.max(x0,a),iy0=Math.max(y0,b),ix1=Math.min(x1,c),iy1=Math.min(y1,d);
  if(ix0>=ix1||iy0>=iy1)return[rect.slice()];
  return[[x0,y0,x1,iy0],[x0,iy1,x1,y1],[x0,iy0,ix0,iy1],[ix1,iy0,x1,iy1]].filter(r=>r[2]-r[0]>1e-7&&r[3]-r[1]>1e-7);
}

