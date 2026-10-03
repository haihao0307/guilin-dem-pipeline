const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=process.argv[2];
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8'),raw=fs.readFileSync(path.join(dir,'iq-teacher.txt'),'utf8');
if(crypto.createHash('sha256').update(app).digest('hex')!=='2d11f0843f18ee2897cb4616f282c53a976105de1ca0c876549cc2e15bce063d')throw Error('R07 compiler source differs');
// Execute only two reviewed local compiler definitions, from the hash-locked R07 source.
eval(app.slice(app.indexOf('function replaceOne('),app.indexOf('function mediaKind(')));
let s=iqShader(raw,false).replace(/#if 0[\s\S]*?#else\s*([\s\S]*?)#endif/,(_,x)=>x);
s=s.replace('box_mapped_texture(iChannel0,opos*0.2,onor).xyz','constant_gray(180.0/255.0,onor)');
s=s.replace(/vec3 box_mapped_texture\([\s\S]*?\n\}/,'').replace('uniform sampler2D iChannel0;','');
const helper=`// Constant-color equivalent of the old 1x1 input; retains weighted arithmetic, no sampler.
vec3 constant_gray(float value,vec3 n){
    n=n*n;
    vec3 c=vec3(value);
    return (c*n.x+c*n.y+c*n.z)/(n.x+n.y+n.z);
}

`;
s=s.replace('mat4x4 get_camera_to_world',helper+'mat4x4 get_camera_to_world');
fs.writeFileSync(path.join(dir,'audit_03_no_texture_weighted.frag'),s);
