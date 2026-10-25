/* Candidate-only subtractive host adapter. Original sources, part metadata and
 * scene.hostCuts stay unchanged. The pressure/motion/installation shaders get
 * the same finite cut helpers in D.glsl. No geometry clock / material rewrite. */
(function(root){'use strict';
function installSteamPath(scene,D,api,topology){
 if(D.steamPathCandidate)throw Error('Steam candidate already installed');if(!D.visible||!D.pose)throw Error('Load whole-train adapters first');
 const C=(api||root.STEAM_PATH).create({dynamic:D,topology:topology||root.TOPOLOGY_PARAMETERS}),ids=new Set(scene.parts.map(p=>p.id));if(C.parts.some(p=>ids.has(p.id)))throw Error('Duplicate steam ID');

 // Numerically equivalent candidate beta evaluation, not new geometry or dimensions.
 // Baseline builtin branches and generic time-angle dynRotate stay unchanged.
 const betaReplacements=[["vec2 dynSmallAt(float t,int side,float inclination){float inc=side==1?inclination:0.;vec2 u=vec2(sin(inc),cos(inc)),b=dynBig(t,side)-vec2(1.016,0);float h=dot(b,u),perp=b.x*u.y-b.y*u.x;return vec2(1.016,0)+u*(h+sqrt(3.5*3.5-perp*perp));}", "vec2 dynSmallAt(float t,int side,float inclination){float inc=side==1?inclination:0.;vec2 u=installationCandidate==1?dynCandidateBetaSinCos(inc):vec2(sin(inc),cos(inc)),b=dynBig(t,side)-vec2(1.016,0);float h=dot(b,u),perp=b.x*u.y-b.y*u.x;return vec2(1.016,0)+u*(h+sqrt(3.5*3.5-perp*perp));}"], ["vec3 dynInstallation(vec3 p,int side){if(installationCandidate==0)return p;p.yz=vec2(1.016,0)+dynRotate(p.yz-vec2(1.016,0),middleInclination-.11);return p;}", "vec3 dynInstallation(vec3 p,int side){if(installationCandidate==0)return p;p.yz=vec2(1.016,0)+dynCandidateBetaRotate(p.yz-vec2(1.016,0),middleInclination-.11);return p;}"], ["vec3 dynSlider(vec3 p,int side){if(side!=1||middleInclination==.11){p.yz+=dynSmallAt(.4,side,.11)-dynSmall(timeTheta,side);return p;}float angle=side==1?middleInclination-.11:0.;p.yz=dynSmallAt(.4,side,.11)+dynRotate(p.yz-dynSmall(timeTheta,side),angle);return p;}", "vec3 dynSlider(vec3 p,int side){if(side!=1||middleInclination==.11){p.yz+=dynSmallAt(.4,side,.11)-dynSmall(timeTheta,side);return p;}float angle=side==1?middleInclination-.11:0.;vec2 relative=p.yz-dynSmall(timeTheta,side);p.yz=dynSmallAt(.4,side,.11)+(installationCandidate==1?dynCandidateBetaRotate(relative,angle):dynRotate(relative,angle));return p;}"]];
 for(const [before,after] of betaReplacements){if(D.glsl.split(before).length!==2)throw Error('Expected retained beta helper not unique');D.glsl=D.glsl.replace(before,after);}
 D.glsl=D.glsl.replace('vec2 dynRotate(',"vec2 dynCandidateBetaSinCos(float a){float a2=a*a;return vec2(a*(1.+a2*(-1./6.+a2*(1./120.-a2/5040.))),1.+a2*(-.5+a2*(1./24.-a2/720.)));}\nvec2 dynCandidateBetaRotate(vec2 v,float a){vec2 sc=dynCandidateBetaSinCos(a);return vec2(sc.y*v.x-sc.x*v.y,sc.x*v.x+sc.y*v.y);}\n"+ 'vec2 dynRotate(');
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
