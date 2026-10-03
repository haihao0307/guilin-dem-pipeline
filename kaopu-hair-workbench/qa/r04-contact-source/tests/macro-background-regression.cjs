const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
for(const file of ['tests/contact-browser-qa.cjs','optics-stage/tests/optics-browser-qa.cjs']){
 const s=fs.readFileSync(path.join(root,file),'utf8');assert(s.includes('g.getParameter(g.COLOR_CLEAR_VALUE)'),file+' must use actual GL clearColor');assert(!/background\s*=\s*p\.slice\(0,3\)|backgroundRgb\s*=\s*\[p\[0\]/.test(s),file+' must never infer background from the first pixel');
}
const clear=[.035,.075,.071].map(v=>Math.round(v*255));const image=new Uint8Array([128,150,91,255,128,150,91,255,...clear,255,85,122,68,255]);
const count=background=>{let objects=0;for(let i=0;i<image.length;i+=4)if(Math.abs(image[i]-background[0])+Math.abs(image[i+1]-background[1])+Math.abs(image[i+2]-background[2])>3)objects++;return objects;};
assert.equal(count(clear),3);assert.equal(count(Array.from(image.slice(0,3))),2);assert.notDeepEqual(clear,Array.from(image.slice(0,3)));
console.log(JSON.stringify({passed:true,checks:7,regression:'A macro foreground covers pixel0. Pixel0 is not a background sample. Actual GL clearColor is authoritative.',measurementScope:'Encoded display RGB and non-clear mask are not radiometric energy; source visibility uses an explicit shader eligibility channel.'},null,2));
