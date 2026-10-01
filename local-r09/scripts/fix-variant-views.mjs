import fs from 'node:fs';const p='local-r09/src/app.js';let s=fs.readFileSync(p,'utf8');function edit(a,b){if(!s.includes(a))throw Error('Missing source anchor '+a.slice(0,60));s=s.replace(a,b);}
edit('drawPaths(m){const gl=this.gl;','drawPaths(m){m={...m,mvp:mat4Multiply(m.mvp,School.model(this.school.fish[this.state.selected],false))};const gl=this.gl;');
edit('this.camera.distance=on?12:1.55;this.camera.zoom=1;','this.camera.distance=on?12:1.55;this.camera.zoom=1;if(on){this.camera.yaw=-.55;this.camera.pitch=.68;this.camera.upMode=\'Y\';}');
edit('else renderer.camera.setView(v);});','else renderer.camera.setView(v);transformVariantView(renderer);});');
edit('renderer.camera.zoom=11.5;};by(\'eyeTrack\')','renderer.camera.zoom=11.5;transformVariantView(renderer);};by(\'eyeTrack\')');
edit('renderer.camera.zoom=11.5;};by(\'resetWeights\')','renderer.camera.zoom=11.5;transformVariantView(renderer);};by(\'resetWeights\')');
edit('function updateVariantUI(r){',`function transformVariantView(r){const m=School.model(r.school.fish[r.state.selected],false),p=r.camera.target;r.camera.target=[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];r.camera.zoom/=r.school.fish[r.state.selected].variant.size;}
function updateVariantUI(r){`);
edit('frame(now){const dt=this.last?Math.min(.08,(now-this.last)/1000):0;','frame(now){const elapsed=this.last?(now-this.last)/1000:0,dt=Math.min(.08,elapsed);');
edit('(dt?Math.round(1/dt):0)','(elapsed?Math.round(1/elapsed):0)');
edit('A.dispose(this.h);','for(const h of this.actors)A.dispose(h);');
edit('if(this.state.school)School.update(this.school,dt,this.state.speed);',`if(this.state.school&&!['REST','IDLE','FIN_FAN','JAW','EYE_TRACK'].includes(this.state.mode))School.update(this.school,dt,this.state.speed*clamp(this.h.state.driveStrength,0,1.6));`);
fs.writeFileSync(p,s);
