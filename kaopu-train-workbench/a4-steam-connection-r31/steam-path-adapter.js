/* Candidate-only subtractive host adapter. Original sources, part metadata and
 * scene.hostCuts stay unchanged. The pressure/motion/installation shaders get
 * the same finite cut helpers in D.glsl. No geometry clock / material rewrite. */
(function(root){'use strict';
function installSteamPath(scene,D,api,topology){
 if(D.steamPathCandidate)throw Error('Steam candidate already installed');if(!D.visible||!D.pose)throw Error('Load whole-train adapters first');
 const C=(api||root.STEAM_PATH).create({dynamic:D,topology:topology||root.TOPOLOGY_PARAMETERS}),ids=new Set(scene.parts.map(p=>p.id));if(C.parts.some(p=>ids.has(p.id)))throw Error('Duplicate steam ID');
 const old={visible:D.visible,scalar:D.scalar,argument:D.argument,bounds:D.bounds,interval:D.interval};
 scene.sources.steamPath=C.source;scene.parts.push(...C.parts);D.glsl+='\n'+C.commonSource;
 D.visible=(part,installation)=>part.source==='steamPath'?installation.mode==='candidate':old.visible(part,installation);
 D.argument=(part,p='p')=>part.source==='steamPath'?p:old.argument(part,p);
 D.bounds=(part,theta,installation=D.snapshot())=>part.source==='steamPath'?[part.aabb_min.slice(),part.aabb_max.slice()]:old.bounds(part,theta,installation);
 D.scalar=function(part){if(part.source==='steamPath')return`${part.glsl_function}(p)`;const previous=old.scalar(part),cut=C.hostCuts[part.id];return cut?`(installationCandidate==1?max(${previous},-${cut.glsl_function}(p)):${previous})`:previous;};
 D.interval=part=>C.hostCuts[part.id]?'return vec2(-1e20,1e20);':old.interval(part);D.steamPathCandidate=C;return C;
}
if(typeof module==='object'&&module.exports)module.exports=installSteamPath;else{root.installSteamPath=installSteamPath;if(root.SCENE&&root.DYNAMIC&&root.STEAM_PATH)installSteamPath(root.SCENE,root.DYNAMIC,root.STEAM_PATH,root.TOPOLOGY_PARAMETERS);}
})(typeof globalThis!=='undefined'?globalThis:this);
