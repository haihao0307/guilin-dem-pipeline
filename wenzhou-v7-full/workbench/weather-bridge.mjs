/** Weather 1.1 is sampled read-only; controls remain owned by its actual UI.
 * Native state is not a restorable history. No deprecated Clean 1.0 APIs.
 */
export const BRIDGE_VERSION='wenzhou-weather-1.1-adapter-0.1.0';
export function snapshot(source,previous=null){
  const {api,loading}=source||{},q=api?.qa;
  if(!q?.ready||!(q.frames>0)||q.errors?.length||typeof api.getState!=='function')throw Error('WEATHER_NOT_READY');
  if(q.version!=='1.1.0-hq')throw Error('WEATHER_RUNTIME_VERSION_MISMATCH');
  const s=api.getState();
  if(loading||s.blend<.999||s.seed!==q.seed||s.weather!==q.weatherCase)throw Error('WEATHER_TRANSITION');
  for(const k of ['wind','direction','cloudSpeed','hour','haze','sunlight','skylight','fog','rain','humidity'])if(!Number.isFinite(s[k]))throw Error('WEATHER_NONFINITE_'+k);
  const t=q.simulationTimeS;if(!Number.isFinite(t)||t<0)throw Error('WEATHER_CLOCK_INVALID');
  if(!Array.isArray(s.windOffset)||s.windOffset.length!==3||s.windOffset.some(x=>!Number.isFinite(x)))throw Error('WEATHER_OFFSET_INVALID');
  if(s.wind<0||s.wind>80||s.cloudSpeed<0||s.cloudSpeed>120||s.direction<0||s.direction>360)throw Error('WEATHER_RANGE_INVALID');
  const a=s.direction*Math.PI/180,dir=[-Math.sin(a),0,Math.cos(a)];
  const discontinuity=!previous||t<previous.clock.simulationSeconds;
  // Exact analytic solar convention from pinned engine.js, with fixed 30 degree latitude.
  // A derived renderer exchange, not location/date-calibrated astronomical truth.
  const h=(s.hour-12)/12*Math.PI,lat=Math.PI/6;
  const sun=[-Math.sin(h),Math.cos(lat)*Math.cos(h),Math.sin(lat)*Math.cos(h)];
  const x=Math.max(0,Math.min(1,(sun[1]+.13)/.25)),day=x*x*(3-2*x),mass=1/(Math.max(sun[1],0)+.07);
  const sunColor=[1.30*Math.exp(-(.012+.018*s.haze)*mass),1.27*Math.exp(-(.056+.021*s.haze)*mass),1.22*Math.exp(-(.145+.025*s.haze)*mass)];
  const frame={schema:'wenzhou-weather-frame-1',adapterVersion:BRIDGE_VERSION,sourceRuntimeVersion:q.version,
    clock:{simulationSeconds:t,deltaSeconds:discontinuity?0:t-previous.clock.simulationSeconds,discontinuity,playing:!!s.playing,meaning:'upstream illustrative renderer clock; not physical history replay'},
    wind:{speedMps:s.wind,fromDegrees:s.direction,directionENU:dir,velocityMps:dir.map(v=>v*s.wind),gustAlreadyApplied:false},
    cloud:{speedMps:q.motionLinked?s.wind:s.cloudSpeed,offsetMetres:s.windOffset.map(v=>v*1000),linked:!!q.motionLinked},
    solar:{directionENU:sun,colorLinear:sunColor,day,directMultiplier:s.sunlight,skyMultiplier:s.skylight,calibrated:false,source:'derived verbatim fixed-latitude renderer convention'},
    atmosphere:{fog:s.fog,rain:s.rain,humidityPercent:s.humidity,precipitationUnits:'dimensionless visual coefficient; no mm/h conversion'},
    identity:{weather:s.weather,kind:s.kind,seed:s.seed},capabilities:{sharedDepth:false,terrainCloudShadows:false,bathymetry:false,currentWeather:false,fullReplay:false},
    sourceFrame:q.frames,sourceRenderSize:[...q.renderSize],visualApproved:false,productionApproved:false};
  function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}return freeze(frame);
}
export class WeatherBridge{
  constructor(frame){this.frame=frame;this.previous=null;this.sampleCount=0;}
  sample(){const w=this.frame.contentWindow;const api=w?.WeatherMother;
    const loading=w?.document?.getElementById('loading');
    const busy=loading&&w.getComputedStyle(loading).display!=='none';
    try{const value=snapshot({api,loading:busy},this.previous);this.previous=value;this.sampleCount++;return value;}
    catch(e){this.previous=null;throw e;}
  }
  control(id,value){const w=this.frame.contentWindow,el=w?.document?.getElementById(id);
    if(!el)throw Error('WEATHER_CONTROL_MISSING_'+id);
    if(el.type==='range'){if(!Number.isFinite(value)||value<+el.min||value>+el.max)throw RangeError('WEATHER_CONTROL_RANGE');el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));}
    else if(el.type==='checkbox'){if(typeof value!=='boolean')throw TypeError('WEATHER_CHECKBOX_TYPE');el.checked=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
    else if(el.tagName==='SELECT'){if(![...el.options].some(o=>o.value===value))throw RangeError('WEATHER_SELECT_VALUE');el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
    else throw Error('WEATHER_CONTROL_UNSUPPORTED');
    this.previous=null;
  }
  pause(){const api=this.frame.contentWindow?.WeatherMother;if(!api?.pause)throw Error('WEATHER_NOT_READY');api.pause();}
  play(){const api=this.frame.contentWindow?.WeatherMother;if(!api?.play)throw Error('WEATHER_NOT_READY');api.play();}
}
