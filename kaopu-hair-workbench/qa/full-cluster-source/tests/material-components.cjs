'use strict';
const fs=require('fs'),path=require('path');
module.exports=async(page,out)=>{
 fs.mkdirSync(out,{recursive:true});const report={scope:'Actual final shader component isolation at the same photographic side/macro camera; geometry, light powers, alpha/depth and display conversion retained',samples:[],errors:[]};
 for(const kind of ['normal','pigment','ambient','direct','thin','wet']){
  const x=await page.evaluate(kind=>{
   const r=anemone.renderer,g=r.gl,original=[r.materialProgram,r.materialBodyProgram],made=[];
   function component(source){
    let s=source.replace('void main(){','void main(){vec3 studyComponent=vec3(0.);');
    if(kind==='normal')s=s.replace('lit=max(lit,vec3(0.));','lit=normalize(normal)*.5+.5;');
    else if(kind==='pigment')s=s.replace('lit=max(lit,vec3(0.));','lit=base;');
    else{
     if(kind==='ambient'||kind==='direct'){
      const anchor='lit=base*(vec3(.085+.20*coc)+.85*r13Diffuse*teacherCoverage*sharp);';
      if(!s.includes(anchor))throw Error('Diagnostic diffuse anchor missing');
      s=s.replace(anchor,anchor+'studyComponent='+(kind==='ambient'?'base*vec3(.085+.20*coc)':'base*.85*r13Diffuse*teacherCoverage*sharp')+';');
     }else{
      const pattern=kind==='thin'?/lit\+=(mix\(coloredReturn,milk,\.035\)[^;]+);/:/lit\+=(mix\(vec3\(1\.\),base,\.12\)\*r13Wet[^;]+);/;
      const match=s.match(pattern);if(!match)throw Error('Diagnostic '+kind+' anchor missing');s=s.replace(match[0],match[0]+'studyComponent='+match[1]+';');
     }
     const shoulder='if(r13LightingMode==1){float peak=max(max(lit.r,lit.g),lit.b);';
     if(s.includes(shoulder))s=s.replace(shoulder,'lit=max(studyComponent,vec3(0.));'+shoulder);
     else s=s.replace('lit=max(lit,vec3(0.));','lit=max(studyComponent,vec3(0.));');
    }
    return s;
   }
   function make(old){const p=g.createProgram(),shaders=[];for(const shader of g.getAttachedShaders(old)){const type=g.getShaderParameter(shader,g.SHADER_TYPE),source=g.getShaderSource(shader),s=g.createShader(type);g.shaderSource(s,type===g.FRAGMENT_SHADER?component(source):source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));g.attachShader(p,s);shaders.push(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));made.push({p,shaders});return p;}
   try{r.materialProgram=make(original[0]);r.materialBodyProgram=make(original[1]);r.draw(anemone.state.time);const bytes=new Uint8Array(r.canvas.width*r.canvas.height*4);g.readPixels(0,0,r.canvas.width,r.canvas.height,g.RGBA,g.UNSIGNED_BYTE,bytes);let max=[0,0,0],sum=[0,0,0];for(let i=0;i<bytes.length;i+=4)for(let k=0;k<3;k++){max[k]=Math.max(max[k],bytes[i+k]);sum[k]+=bytes[i+k];}return{kind,glError:g.getError(),camera:{...r.camera},light:anemone.lighting,meanDisplayRGB:sum.map(x=>x/(bytes.length/4)),maxDisplayRGB:max,image:r.canvas.toDataURL('image/jpeg',.9)};}
   finally{r.materialProgram=original[0];r.materialBodyProgram=original[1];for(const {p,shaders}of made){g.deleteProgram(p);shaders.forEach(s=>g.deleteShader(s));}r.draw(anemone.state.time);}
  },kind);
  if(x.glError)throw Error('Material diagnostic GL error '+x.glError);const file=path.join(out,kind+'.jpg');fs.writeFileSync(file,Buffer.from(x.image.split(',')[1],'base64'));delete x.image;report.samples.push({...x,file});
 }
 fs.writeFileSync(path.join(out,'material-components.json'),JSON.stringify(report,null,2));return report;
};
