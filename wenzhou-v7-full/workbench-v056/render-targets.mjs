// Numeric GPU render buffers, never image assets. Terrain/UI stay at device resolution.
export function createRenderTargets(gl){
  let width=0,height=0,cw=0,ch=0,scene=null,cloud=null;
  const stats={scenePixels:[0,0],cloudPixels:[0,0],cloudScale:1,depthAware:true};
  function texture(w,h,depth=false){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,depth?gl.DEPTH_COMPONENT24:gl.RGBA8,w,h,0,depth?gl.DEPTH_COMPONENT:gl.RGBA,depth?gl.UNSIGNED_INT:gl.UNSIGNED_BYTE,null);return t;}
  function target(w,h,depth){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);const color=texture(w,h);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);const d=depth?texture(w,h,true):null;if(d)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,d,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Wenzhou render target incomplete');return{f,color,depth:d};}
  function drop(t){if(!t)return;gl.deleteFramebuffer(t.f);gl.deleteTexture(t.color);if(t.depth)gl.deleteTexture(t.depth);}
  const program=gl.createProgram();
  const vs=`#version 300 es
  precision highp float;out vec2 vUv;
  void main(){vec2 q=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));vUv=q;gl_Position=vec4(q*2.-1.,0.,1.);}`;
  const fs=`#version 300 es
  precision highp float;in vec2 vUv;out vec4 color;
  uniform sampler2D uScene,uCloud,uDepth;uniform vec2 uCloudSize;
  void main(){
    vec3 background=texture(uScene,vUv).rgb;float depth=texture(uDepth,vUv).r;
    vec2 p=vUv*uCloudSize-.5,b=floor(p),f=fract(p);vec4 sum=vec4(0.);float weight=0.;
    for(int j=0;j<2;j++)for(int i=0;i<2;i++){
      vec2 uv=(b+vec2(float(i),float(j))+.5)/uCloudSize;
      float d=texture(uDepth,uv).r;
      float w=(i==0?1.-f.x:f.x)*(j==0?1.-f.y:f.y)*exp(-abs(d-depth)*320.);
      vec4 cloud=texture(uCloud,uv);sum+=vec4(cloud.rgb*cloud.a,cloud.a)*w;weight+=w;
    }
    vec4 c=weight>1e-5?sum/weight:vec4(0.);
    color=vec4(background*(1.-c.a)+c.rgb,1.);
  }`;
  for(const[type,src]of[[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(program,s);gl.deleteShader(s);}
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const vao=gl.createVertexArray(),u={};for(const n of ['uScene','uCloud','uDepth','uCloudSize'])u[n]=gl.getUniformLocation(program,n);
  return {stats,begin(w,h){
    if(w!==width||h!==height){drop(scene);scene=target(w,h,true);width=w;height=h;stats.scenePixels=[w,h];}
    gl.bindFramebuffer(gl.FRAMEBUFFER,scene.f);gl.viewport(0,0,w,h);gl.activeTexture(gl.TEXTURE0);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
  },drawCloud(weather,args){
    const quality=weather.getState().quality,scale=quality==='high'?1:(args.moving?.35:.5);
    const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    if(w!==cw||h!==ch){drop(cloud);cloud=target(w,h,false);cw=w;ch=h;}
    stats.cloudPixels=[w,h];stats.cloudScale=scale;
    gl.bindFramebuffer(gl.FRAMEBUFFER,cloud.f);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const drawn=weather.draw({...args,viewport:[0,0,w,h],cameraAspect:width/height,sceneDepth:scene.depth});
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindVertexArray(vao);
    for(const[n,t,i]of[['uScene',scene.color,0],['uCloud',cloud.color,1],['uDepth',scene.depth,2]]){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);gl.uniform1i(u[n],i);}
    gl.uniform2f(u.uCloudSize,cw,ch);gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);gl.activeTexture(gl.TEXTURE0);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);return drawn;
  },dispose(){drop(scene);drop(cloud);gl.deleteProgram(program);gl.deleteVertexArray(vao)}};
}
