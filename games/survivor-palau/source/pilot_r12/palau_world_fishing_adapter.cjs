'use strict';

const VERSION='palau-world-fishing-adapter/0.1';
const finiteVec=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clone=v=>JSON.parse(JSON.stringify(v));

function createPalauWorldFishingAdapter(options={}){
  if(typeof options.sampleWorld!=='function') throw new TypeError('sampleWorld(pointRequest) is required');
  const sampleWorld=options.sampleWorld;
  const strict=!!options.strict;
  const gaps=new Set();
  const counters={samples:0,surface:0,current:0,snag:0};

  function markGap(name){gaps.add(name);if(strict) throw new Error(`PalauWorld fishing port missing ${name}`);}
  function request(x,y,z,worldSeconds,purpose){
    if(![x,y,z,worldSeconds].every(Number.isFinite)) throw new TypeError('finite world point and time required');
    const value=sampleWorld({x,y,z,worldSeconds,purpose});
    counters.samples++;
    if(!value||typeof value!=='object') throw new TypeError('sampleWorld must return an object');
    return value;
  }
  function waterFrom(sample){return sample.water||sample.ocean||sample.surface||{};}
  function habitatFrom(sample){return sample.habitat||sample.reef||sample.substrate||{};}

  function surfaceAt(x,z,worldSeconds){
    const sample=request(x,0,z,worldSeconds,'fishing.surface');
    const water=waterFrom(sample);
    const eta=Number.isFinite(water.eta)?water.eta:(Number.isFinite(water.surfaceY)?water.surfaceY:null);
    if(!Number.isFinite(eta)) throw new Error('PalauWorld sample must expose water.eta or water.surfaceY');
    let normal=water.normal;
    if(!finiteVec(normal)){markGap('water.normal');normal=[0,1,0];}
    let surfaceVelocity=water.surfaceVelocity;
    if(!finiteVec(surfaceVelocity)){markGap('water.surfaceVelocity');surfaceVelocity=[0,0,0];}
    if(!Number.isFinite(water.breaker)) markGap('water.breaker');
    if(!Number.isFinite(water.clarity)) markGap('water.clarity');
    counters.surface++;
    return {
      eta,
      normal:[...normal],
      surfaceVelocity:[...surfaceVelocity],
      breaker:clamp(Number.isFinite(water.breaker)?water.breaker:0,0,1),
      clarity:clamp(Number.isFinite(water.clarity)?water.clarity:0.7,0,1),
      bed:Number.isFinite(water.bed)?water.bed:null,
      depth:Number.isFinite(water.depth)?water.depth:null,
      evidenceStatus:water.evidenceStatus||sample.evidenceStatus||'unknown'
    };
  }
  function currentAt(x,y,z,worldSeconds){
    const sample=request(x,y,z,worldSeconds,'fishing.current');
    const water=waterFrom(sample);
    const current=water.current||water.currentVelocity;
    if(!finiteVec(current)){markGap('water.current');counters.current++;return [0,0,0];}
    counters.current++;return [...current];
  }
  function snagAt(fishPosition,anchor,worldSeconds){
    if(!finiteVec(fishPosition)||!finiteVec(anchor)) throw new TypeError('finite fishPosition and anchor required');
    const sample=request(fishPosition[0],fishPosition[1],fishPosition[2],worldSeconds,'fishing.snag');
    const habitat=habitatFrom(sample);
    if(!Number.isFinite(habitat.snagRisk)) markGap('habitat.snagRisk');
    if(!Number.isFinite(habitat.abrasionRate)) markGap('habitat.abrasionRate');
    const contact=habitat.snagContact===true||(Number.isFinite(habitat.snagRisk)&&habitat.snagRisk>=0.7&&habitat.contact===true);
    counters.snag++;
    return {
      contact,
      abrasionRate:Math.max(0,Number.isFinite(habitat.abrasionRate)?habitat.abrasionRate:0),
      substrate:habitat.substrate||'unknown',
      evidenceStatus:habitat.evidenceStatus||sample.evidenceStatus||'unknown'
    };
  }
  function capabilities(){
    const missing=[...gaps].sort();
    return {
      version:VERSION,
      worldConductor:'PalauWorld.sample()',
      traditionalLOD:false,
      missing,
      degraded:missing.length>0,
      productionCompatible:missing.length===0,
      counters:clone(counters),
      fallbackPolicy:missing.length?'zero-vector or conservative scalar fallback is logic-test-only; production acceptance remains false':'no fallback used'
    };
  }
  return Object.freeze({VERSION,surfaceAt,currentAt,snagAt,capabilities});
}

module.exports=Object.freeze({VERSION,createPalauWorldFishingAdapter});
