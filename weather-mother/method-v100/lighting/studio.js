/* Lighting-only profiles. Relative directional radiance; RGB display approximation.
   Angular cone softening is not an area emitter or a calibrated spectral source. */
(function(root){'use strict';
const presets={
 daylight:{name:'日光体积',exposure:1,lights:[{enabled:true,power:2.25,azimuth:-38,elevation:48,color:'#fff2e3',size:3},{enabled:true,power:.52,azimuth:62,elevation:22,color:'#ccdeff',size:7},{enabled:true,power:2.25,azimuth:168,elevation:25,color:'#f2f6ff',size:2}]},
 dawn:{name:'清晨暖光',exposure:1,lights:[{enabled:true,power:2.05,azimuth:-70,elevation:12,color:'#ffd7b1',size:2},{enabled:true,power:.43,azimuth:62,elevation:28,color:'#a8c6ff',size:8},{enabled:true,power:1.7,azimuth:172,elevation:22,color:'#ffe8c9',size:2}]},
 sunset:{name:'黄昏透光',exposure:1,lights:[{enabled:true,power:1.85,azimuth:-72,elevation:16,color:'#ffc383',size:2},{enabled:true,power:.28,azimuth:65,elevation:22,color:'#80acf7',size:8},{enabled:true,power:2.55,azimuth:153,elevation:9,color:'#ffb771',size:2}]},
 silver:{name:'逆光银边',exposure:1,lights:[{enabled:true,power:.62,azimuth:-32,elevation:40,color:'#f0f4ff',size:4},{enabled:true,power:.18,azimuth:65,elevation:24,color:'#a5caff',size:8},{enabled:true,power:3,azimuth:176,elevation:9,color:'#fff1d9',size:1}]},
 moon:{name:'冷色月光',exposure:1,lights:[{enabled:true,power:.85,azimuth:-45,elevation:38,color:'#b3c7ee',size:2},{enabled:true,power:.20,azimuth:72,elevation:22,color:'#7794bf',size:7},{enabled:true,power:1.4,azimuth:168,elevation:28,color:'#dceaff',size:2}]}
};
function light(changes){if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('Light object required');for(const[k,v]of Object.entries(changes)){if(!['enabled','power','azimuth','elevation','color','size'].includes(k))throw Error('Unknown presentation key '+k);if(k==='enabled'&&typeof v!=='boolean')throw Error('Light boolean');if(k==='color'&&(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))throw Error('Light colour');const ranges={power:[0,3],azimuth:[-180,180],elevation:[5,85],size:[0,12]};if(ranges[k]&&(!Number.isFinite(v)||v<ranges[k][0]||v>ranges[k][1]))throw Error('Light range '+k);}return true;}
function preset(id){if(!Object.hasOwn(presets,id))throw Error('Unknown lighting preset');return JSON.parse(JSON.stringify(presets[id]));}
function wrapAngle(v){if(!Number.isFinite(v))throw Error('Finite rotation required');return ((v+180)%360+360)%360-180;}
for(const p of Object.values(presets)){p.lights.forEach(light);Object.freeze(p);}
const api={version:'wm-studio-0.1.1',presets,preset,validateLight:light,wrapAngle};root.WeatherStudio=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
