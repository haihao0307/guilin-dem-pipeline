'use strict';
const A=require('./shoreline_gpu_adapter.cjs');
const F=require('./legacy_v0230_fixture.cjs');
const S=A.authoritative;
const samples=[];
function add(label,theta,s){const R=F.islandRadius(theta),r=R+s,x=Math.cos(theta)*r,z=Math.sin(theta)*r,frame=A.cpuFrameAt(x,z,F.islandRadius);samples.push({label,x,z,signedDistance:frame.s,weight:frame.weight,legacy:F.legacyBed(x,z),expected:A.cpuBedAt(x,z,F.legacyBed,F.islandRadius)});}
const t=S.BAY.center;
for(const s of [-18,-17.5,-16,-15,-9,-3,0,S.waterlineSignedDistance(.18),1.610220004485,9,24,38,40,42,43,44])add(`center_s_${s}`,t,s);
for(const off of [-S.BAY.fullHalfAngle-S.BAY.fadeAngle-.02,-S.BAY.fullHalfAngle-S.BAY.fadeAngle,-S.BAY.fullHalfAngle,-.1,0,.1,S.BAY.fullHalfAngle,S.BAY.fullHalfAngle+S.BAY.fadeAngle,S.BAY.fullHalfAngle+S.BAY.fadeAngle+.02])add(`angle_${off}`,t+off,8);
process.stdout.write(JSON.stringify({version:A.VERSION,profileId:A.PROFILE_ID,glsl:F.glslLegacySource+'\n'+A.glslSource(),samples,waterLevel:.18},null,2));
