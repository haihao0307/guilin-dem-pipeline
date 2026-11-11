from pathlib import Path
import json,hashlib
r=Path(__file__).parent
base=r.parent/'knit-material-r04'
s=(base/'core.wgsl').read_text()
old='let bin=bins[uv.y*16u+uv.x];'
new='''var bin=bins[uv.y*16u+uv.x];
 let zm=g.geom.x*.4*g.geom.w+g.geom.z+1.35;
 if(g.view.w>.5&&cell.x>=1&&cell.x+1<i32(g.fabric.x)&&cell.y>=3&&cell.y+3<i32(g.fabric.y)&&abs(p.z)<zm){
  let ix=clamp(u32(local.x/g.geom.x*64.),0u,63u);
  let iy=clamp(u32(local.y/(g.geom.x*.5*g.geom.y)*32.),0u,31u);
  let iz=clamp(u32((p.z+zm)/(2.*zm)*32.),0u,31u);
  if(ix/4u==uv.x&&iy/4u==uv.y){bin=bins[128u+(iz*32u+iy)*64u+ix];}
 }
'''
assert s.count(old)==1;s=s.replace(old,new)
old='let d=b.xy-a.xy;let dd=max(.000001,dot(d,d));'
s=s.replace(old,'if(g.view.w>.5&&segmentHidden(lo,hi,min(a.z,b.z))){a=b;continue;}\n        '+old)
old='let baseDepth=pixels[pi].w*dot(direction(xy),g.forward.xyz);'
assert old in s;s=s.replace(old,'var baseDepth=0.;if(g.view.w>.5){baseDepth=depthCache[pi];}else{baseDepth=pixels[pi].w*dot(direction(xy),g.forward.xyz);}')
s+='\n'+(r/'depth.wgsl').read_text()
a=(base/'app.js').read_text().replace("VERSION='KNIT-MATERIAL-R04'","VERSION='KNIT-MATERIAL-R05'")
a=a.replace("texture=device.createTexture({size:[W,H]", "buffers.depthCache?.destroy();buffers.depthCache=gpuBuffer((W*H+Math.ceil(W/8)*Math.ceil(H/8))*4,GPUBufferUsage.STORAGE);texture=device.createTexture({size:[W,H]")
a=a.replace("['controls','render','clearHairs','hairs','composite']","['controls','render','clearHairs','makeDepth','hairs','composite']")
a=a.replace("Math.tan(camera.fov*Math.PI/360),0]","Math.tan(camera.fov*Math.PI/360),accelerated?1:0]")
a=a.replace("['hairAccum',7]","['hairAccum',7],['depthCache',8]")
a=a.replace("...[4,5,7].map","...[4,5,7,8].map")
a=a.replace("sourcePreparationCpuMs:source?.cpuMs,", "sourcePreparationCpuMs:source?.cpuMs,acceleration:source?.acceleration,accelerated,")
a=a.replace("function changed(){revision++;dirty=true;lastReport=null;frameTimes=[];", "function changed(){revision++;dirty=true;lastReport=null;")
assert a.endswith('boot();\n');a=a[:-len('boot();\n')]
a+='\n'+(r/'search.js').read_text()+'\n'+(r/'performance.js').read_text()+'\nboot();\n'
html=(base/'shell.html').read_text().replace('R04','R05')
html=html.replace('/*DATA*/','const CORE='+json.dumps(s,ensure_ascii=False)+';\nconst DEFAULT_MATERIAL='+json.dumps((base/'material.wgsl').read_text(),ensure_ascii=False)+';\nconst PRESET_DATA='+(base/'presets.json').read_text()+';')
html=html.replace('/*APP*/',a)
(r/'index.html').write_text(html);(r/'app-built.js').write_text(a);(r/'core-built.wgsl').write_text(s)
manifest={'version':'KNIT-MATERIAL-R05','sha256':hashlib.sha256(html.encode()).hexdigest(),'bytes':len(html.encode()),'baseline':'b219fedcf42260b9c349c0357668d580001c98e4','materialSourceUnchanged':True,'noiseAndFibresUnchanged':True,'samplesUnchanged':True,'targetFps':60,'hardwareTargetVerified':False}
(r/'BUILD.json').write_text(json.dumps(manifest,indent=2));print(manifest)
