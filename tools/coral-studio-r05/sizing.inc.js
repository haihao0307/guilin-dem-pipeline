function setQuality(value){quality=value==='hq'?'hq':'native';state.quality=quality;$('quality').value=quality;try{localStorage.setItem('coral-render-quality-v1',quality)}catch(_){}dirty=true;request()}
function syncSize(){
 const target=$('screenB'),rect=target.getBoundingClientRect();
 if(rect.width<2||rect.height<2)return;
 const dpr=window.devicePixelRatio||1,mult=quality==='hq'?1.5:1;
 let rw=Math.max(1,Math.ceil(rect.width*dpr*mult)),rh=Math.max(1,Math.ceil(rect.height*dpr*mult));
 if(sizeOverride)[rw,rh]=sizeOverride;
 const limit=viewsGL.reduce((m,v)=>{const a=v.gl.getParameter(v.gl.MAX_VIEWPORT_DIMS),b=v.gl.getParameter(v.gl.MAX_RENDERBUFFER_SIZE);return[Math.min(m[0],a[0],b),Math.min(m[1],a[1],b)]},[Infinity,Infinity]);
 const factor=Math.min(1,limit[0]/rw,limit[1]/rh);W=Math.max(1,Math.floor(rw*factor));H=Math.max(1,Math.floor(rh*factor));
 state.hardwareLimited=factor<1;state.quality=quality;state.pixelScale=dpr*mult;state.requestedResolution=[rw,rh];state.displaySize=[rect.width,rect.height];state.devicePixelRatio=dpr;state.resolution=[W,H];
 $('studioGrid').style.setProperty('--student-aspect',String(W/H));
 for(const v of viewsGL){if(v.canvas.width!==W||v.canvas.height!==H){v.canvas.width=W;v.canvas.height=H;v.gl.viewport(0,0,W,H)}}
 $('qualityWarning').hidden=!state.hardwareLimited;
 if(state.hardwareLimited)$('qualityWarning').textContent='设备最大画布限制：请求 '+rw+'×'+rh+'，实际 '+W+'×'+H+'。没有自动降低抗锯齿或模型细节。';
 $('pixelStatus').textContent=W+' × '+H+' · AA=2 · '+(quality==='hq'?'1.5× 超采样':'原生像素');
}
