const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=__dirname,old=path.resolve(dir,'../skin-r01');
let src=fs.readFileSync(old+'/SkinLayer.mjs','utf8');
const hash=crypto.createHash('sha256').update(src).digest('hex');if(hash!=='372081965924a65852cc499382a60a6e152acf0dba833f6f70dfe64362228fdb')throw Error('Previous verified skin source changed.');
function swap(a,b){if(!src.includes(a))throw Error('Missing exact bridge: '+a);src=src.replaceAll(a,()=>b);}
src="import {UHLayer,mountUHControls} from './UHLayer.mjs';\n"+src;
swap("SKIN_VERSION='unified-human-skin/r01.1'","SKIN_VERSION='unified-human-skin/r02-uh-study'");
swap("new URL('./assets/',import.meta.url)","new URL('../skin-r01/assets/',import.meta.url)");
swap('this.ready=true;this.apply();', 'this.ready=true;this.uh=new UHLayer(this);this.apply();');
swap('this.disposed=true;this.abort.abort();','this.disposed=true;this.uh?.dispose();this.abort.abort();');
swap('this.__skinLayer.depthDirty=true;this.render();','this.__skinLayer.depthDirty=true;this.__skinLayer.uh?.geometryChanged();this.render();');
swap('controls();window.commonSkin=', 'controls();mountUHControls();window.commonSkin=');
fs.writeFileSync(dir+'/SkinLayer.mjs',src);
let build=fs.readFileSync(old+'/build.cjs','utf8').replaceAll('skin-r01/','skin-r02/').replaceAll("version:'unified-human-skin/r01.1'","version:'unified-human-skin/r02-uh-study'").replaceAll('R02 皮肤材质接入 R01','UH 关系融合皮肤 R02').replaceAll('共同人物 · 皮肤接入 R01.1','共同人物 · UH 皮肤融合 R02');
const css='.uh-controls{padding:4px 0 7px;border-bottom:1px solid #4b5050;margin-bottom:7px}.uh-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}.uh-row strong{font-size:12px;color:#e2cba9}.uh-row button,.uh-row summary{font-size:12px;min-height:32px;padding:5px 9px}.uh-row button[aria-pressed=true]{background:#5a4b39;color:#f3dfc3;border:1px solid #bf9b72}.uh-details>summary{cursor:pointer;list-style:none;border:1px solid #52606a;border-radius:4px}.uh-body{position:absolute;bottom:calc(100% + 5px);left:10px;width:350px;max-height:72vh;overflow-y:auto;z-index:50;border:1px solid #7c7366;border-radius:8px;padding:16px;background:#15232cf5;box-shadow:0 6px 30px #0008;display:grid;gap:10px}.uh-body label{display:grid;grid-template-columns:1fr auto;gap:5px;font-size:12px;color:#c8d3d5}.uh-body input[type=range]{grid-column:1/-1;width:100%;accent-color:#d4b488}.uh-body input[type=color]{width:60px;height:25px}.uh-body select{grid-column:1/-1;width:100%;background:#223741;color:#cad5d9;min-height:32px}.uh-body h3{font-size:12px;letter-spacing:.6px;color:#e1c09d;border-top:1px solid #40515a;padding-top:12px;margin:4px 0}.uh-body output{font:11px monospace;color:#d7bd98}.uh-info{font-size:11px;line-height:1.7;color:#9fb0ba;margin:0}.uh-presets{display:flex;gap:5px;flex-wrap:wrap}.uh-presets button{font-size:11px}.uh-body a{font-size:11px;color:#d7bd98}#uh-state{font-size:10px;color:#a8b6b8;flex:1;min-width:200px}#uh-message{font-size:11px;color:#d7bd98;margin:0}\n';
build=build.replace('const css=`','const css=`'+css);
fs.writeFileSync(dir+'/ui.css',css);fs.writeFileSync(dir+'/build.cjs',build);fs.copyFileSync(old+'/THIRD_PARTY.txt',dir+'/THIRD_PARTY.txt');
