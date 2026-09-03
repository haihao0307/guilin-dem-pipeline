// Wenzhou presentation atmosphere. Analytic approximation, not measured meteorology.
export function createSky(gl) {
  const p=gl.createProgram();
  const vs=`#version 300 es
  precision highp float;
  void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,1.,1.);}`;
  const fs=`#version 300 es
  precision highp float;
  out vec4 color;
  uniform vec3 uForward,uRight,uUp,uSun;
  uniform vec2 uSize;
  uniform float uDay,uCloudiness,uElevation;
  void main(){
    vec2 uv=gl_FragCoord.xy/uSize*2.-1.;
    vec3 rd=normalize(uForward+uRight*uv.x*(uSize.x/uSize.y)*.41421356+uUp*uv.y*.41421356);
    float h=pow(clamp(rd.y,0.,1.),.42);
    vec3 horizon=vec3(.59,.75,.84),zenith=vec3(.10,.36,.66);
    vec3 daylight=mix(horizon,zenith,h);
    float mu=max(0.,dot(rd,uSun));
    float warm=(1.-smoothstep(.02,.38,uSun.y))*smoothstep(-.10,.05,uSun.y);
    daylight+=vec3(.23,.075,.01)*pow(mu,12.)*warm;
    daylight=mix(daylight,mix(vec3(.66,.72,.76),vec3(.32,.43,.54),h),uCloudiness*.64);
    float twilight=smoothstep(-.20,.015,uSun.y)*(1.-smoothstep(.02,.18,uSun.y));
    vec3 night=mix(vec3(.028,.043,.075),vec3(.008,.016,.036),h);
    night+=vec3(.14,.068,.026)*twilight*pow(1.-h,3.);
    vec3 c=mix(night,daylight,uDay);
    // Solar disc has angular radius near 0.27 degrees. No scene or cloud scaling.
    float disc=smoothstep(cos(.0051),cos(.0045),dot(rd,uSun));
    c+=vec3(1.,.90,.68)*disc*uDay*(1.-uCloudiness*.8);
    color=vec4(clamp(c,0.,1.),1.);
  }`;
  for(const [type,src] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p,s);gl.deleteShader(s);
  }
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  const vao=gl.createVertexArray(),u={};
  for(const n of ['uForward','uRight','uUp','uSun','uSize','uDay','uCloudiness','uElevation'])u[n]=gl.getUniformLocation(p,n);
  const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d)};
  return {draw(eye,target,w,h,weather){
    const f=norm(target.map((x,i)=>x-eye[i])),r=norm([-f[2],0,f[0]]),up=[r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]];
    gl.useProgram(p);gl.bindVertexArray(vao);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
    gl.uniform3fv(u.uForward,f);gl.uniform3fv(u.uRight,r);gl.uniform3fv(u.uUp,up);
    gl.uniform3fv(u.uSun,weather?.solar.direction||[0,1,0]);gl.uniform2f(u.uSize,w,h);
    gl.uniform1f(u.uDay,weather?.solar.day??1);
    gl.uniform1f(u.uCloudiness,Math.min(1,(weather?.profile.opticalClass||0)*.42));
    gl.drawArrays(gl.TRIANGLES,0,3);gl.bindVertexArray(null);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
  },dispose(){gl.deleteProgram(p);gl.deleteVertexArray(vao)}};
}
