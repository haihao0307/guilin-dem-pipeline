// Exact-input GPU evaluation cache of original needle dye terms.
// A camera move does not change a needle's pigment or its dye powers.
import {hash} from './SourceFibres.mjs';
export function sharedNeedleMaterialSources(source,fibres){
 const from='float dyeLuminance=max(.001,dot(dye,vec3(.2126,.7152,.0722)));ffShortDye=dye*pow(dyeLuminance,-.18);ffReflectionDye=mix(dye,vec3(1.),.6);ffTransmissionDye=sqrt(max(dye,vec3(.001)));ffExchangeScale=pow(dyeLuminance,-.28);';
 if(source.split(from).length!==2)throw Error('Shared dye term anchor changed');
 source='uniform highp sampler2D uNeedleOptics;ivec2 needleOpticsCell;\n'+source.replace(from,'vec4 shared0=texelFetch(uNeedleOptics,needleOpticsCell,0);ffShortDye=shared0.rgb;ffExchangeScale=shared0.w;ffReflectionDye=texelFetch(uNeedleOptics,needleOpticsCell+ivec2(1,0),0).rgb;ffTransmissionDye=texelFetch(uNeedleOptics,needleOpticsCell+ivec2(2,0),0).rgb;');
 const dye='vec3 dye=needlePalette(d.w+.5,e.x)*e.w;';if(fibres.split(dye).length!==2)throw Error('Shared needle dye anchor changed');fibres=fibres.replace(dye,'needleOpticsCell=ivec2(int(d.w)*4,int(e.x));vec3 dye=texelFetch(uNeedleOptics,needleOpticsCell+ivec2(3,0),0).rgb;');
 const fragment=`#version 300 es
 precision highp float;precision highp int;uniform highp sampler2D uNeedleVariation;out vec4 outColor;
 ${source}
 void main(){int x=int(gl_FragCoord.x),col=x/4,row=int(gl_FragCoord.y),slot=x%4;vec3 dye=needlePalette(float(col)+.5,float(row))*texelFetch(uNeedleVariation,ivec2(col,row),0).r;float luminance=max(.001,dot(dye,vec3(.2126,.7152,.0722)));if(slot==0)outColor=vec4(dye*pow(luminance,-.18),pow(luminance,-.28));else if(slot==1)outColor=vec4(mix(dye,vec3(1.),.6),0.);else if(slot==2)outColor=vec4(sqrt(max(dye,vec3(.001))),0.);else outColor=vec4(dye,0.);}`;
 return{source,fibres,fragment};
}
export class SharedNeedleMaterial{
 constructor(gl,{programs,program,use,profile,texture}){Object.assign(this,{gl,programs,program,use,profile});const [cols,rows]=profile.grid,variation=new Float32Array(cols*rows);for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)variation[row*cols+col]=1+.18*(hash((row*4099+col)*17+3)-.5)*.65;this.variation=texture(gl.R32F,cols,rows,gl.RED,gl.FLOAT,variation);this.image=texture(gl.RGBA32F,cols*4,rows,gl.RGBA,gl.FLOAT,null);this.framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.image,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Needle material target unavailable');gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.builds=0;this.reuses=0;this.bytes=cols*rows*68;}
 update(material){const values=new Float32Array([...material.baseDye,...material.inkDye]),key=Array.from(new Uint32Array(values.buffer)).join('/');const {gl,profile,use}=this;
  if(key!==this.key){gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);gl.viewport(0,0,profile.grid[0]*4,profile.grid[1]);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);const u=use(this.program);gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,this.variation);gl.uniform1i(u('uNeedleVariation'),7);gl.drawArrays(gl.TRIANGLES,0,3);this.key=key;this.builds++;}else this.reuses++;
  gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,this.image);for(const p of this.programs){const u=use(p);gl.uniform1i(u('uNeedleOptics'),6);}
 }
 report(){return{enabled:!this.disposed,builds:this.builds,reuses:this.reuses,textureBytes:this.bytes,cameraIndependent:true,changesSourceRoots:false};}
 dispose(){this.gl.deleteFramebuffer(this.framebuffer);this.bytes=0;this.disposed=true;}
}
