function shader(g,t,s){const x=g.createShader(t);g.shaderSource(x,s);g.compileShader(x);if(!g.getShaderParameter(x,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(x));return x}
function prog(g,v,f){const p=g.createProgram();g.attachShader(p,shader(g,g.VERTEX_SHADER,v));g.attachShader(p,shader(g,g.FRAGMENT_SHADER,f));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p}
function tex(g,img,u){const t=g.createTexture();g.activeTexture(g.TEXTURE0+u);g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,img);return t}

// The terrain index order currently produces the opposite winding after the
// north-up Z-axis conversion. Prevent WebGL from culling the entire surface.
if(typeof gl!=='undefined'&&gl){
  const originalEnable=gl.enable.bind(gl);
  gl.enable=function(cap){
    if(cap===gl.CULL_FACE){gl.disable(gl.CULL_FACE);return;}
    return originalEnable(cap);
  };
  gl.disable(gl.CULL_FACE);
}

// Always leave the user with a visible map when a browser-specific WebGL
// failure occurs. The 2D renderer is defined by ui.js immediately afterwards.
let kunmingFallbackStarted=false;
window.addEventListener('unhandledrejection',event=>{
  console.error('Kunming WebGL initialization failed:',event.reason);
  setTimeout(()=>{
    if(kunmingFallbackStarted||typeof init2D!=='function')return;
    kunmingFallbackStarted=true;
    glCanvas.style.display='none';
    fallback.style.display='block';
    statusEl.textContent='三维渲染未完成，已自动切换到可见的二维地形与水系';
    init2D().catch(error=>{
      console.error('Kunming 2D fallback failed:',error);
      statusEl.textContent='页面资源载入失败，请刷新页面';
    });
  },0);
});
