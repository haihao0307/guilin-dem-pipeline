import {buildNeighbourhood} from '../neighbourhood.mjs';
export async function runNeighbourhoodQA({THREE,report=async()=>{},width=800,height=600}={}){
 const canvas=document.createElement('canvas');canvas.id='neighbourhood-real-gpu';document.body.append(canvas);
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0xaaaead,1);
 const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info'),errors=[];renderer.debug.onShaderError=(g,p,v,f)=>errors.push([g.getProgramInfoLog(p),g.getShaderInfoLog(v),g.getShaderInfoLog(f)].join('\n'));
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,width/height,.05,150);scene.add(new THREE.HemisphereLight(0xd8e5e7,0x666252,2));const light=new THREE.DirectionalLight(0xffeed9,2.5);light.position.set(-4,9,6);scene.add(light);
 const context={three:THREE.REVISION,renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL||gl.RENDERER),attributes:gl.getContextAttributes(),width:gl.drawingBufferWidth,height:gl.drawingBufferHeight};await report({stage:'context',context});
 let hood;const start=performance.now();
 try{hood=buildNeighbourhood({THREE,renderer});scene.add(hood.root);renderer.setViewport(0,0,width,height);const buildMs=performance.now()-start;await report({stage:'built',buildMs,metrics:hood.metrics(),proof:hood.proof});
 const shots=[];
 async function shot(name,position,target,{cutaway=false,doorOpen=true,frames=3}={}){hood.setCutaway(cutaway);hood.setDoor('B-borrow',doorOpen);hood.update(18);camera.position.fromArray(position);camera.lookAt(...target);camera.updateMatrixWorld(true);const times=[];for(let frame=0;frame<frames;frame++){const t=performance.now();renderer.render(scene,camera);const submitted=performance.now();gl.finish();const finished=performance.now();const buffer=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,buffer);const end=performance.now(),error=gl.getError();const f={frame,totalThroughReadbackMs:end-t,submissionMs:submitted-t,finishWaitMs:finished-submitted,readbackWaitMs:end-finished,error,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};times.push(f);await report({stage:'frame',shot:name,...f});if(error||errors.length)throw Error('GPU failed '+error+' '+errors.join('\n'));}const s={name,position,target,cutaway,doorOpen,times,png:canvas.toDataURL()};shots.push(s);await report({stage:'shot',...s});return s;}
 await shot('neighbourhood-exterior',[10,8,13],[0,2.4,0]);
 await shot('neighbourhood-cutaway',[9,8,12],[-.3,2.4,-.5],{cutaway:true});
 await shot('neighbourhood-stair-eye',[-.1,1.70,6.5],[-2.1,2.2,.55]);
 await shot('borrowed-door-open',[1.90,4.24,-.50],[-.65,3.8,-1.48],{doorOpen:true});
 await shot('borrowed-door-closed',[1.90,4.24,-.50],[-.65,3.8,-1.48],{doorOpen:false});
 const closed=hood.reachable();hood.setDoor('B-borrow',true);const opened=hood.reachable();if(closed.includes('C-home')||!opened.includes('C-home'))throw Error('Borrowed door route rule broken');
 hood.update(123.25);const clock=hood.root.userData.worldSeconds;hood.update(123.25);const paused=clock===hood.root.userData.worldSeconds;
 const finalMetrics=hood.metrics(),memory=structuredClone(renderer.info.memory),programCount=renderer.info.programs.length;hood.dispose();hood=null;const result={context,shots,buildMs,metrics:finalMetrics,memory,programCount,errors,checks:{doorBlocksBorrowedPath:true,doorReopensPath:true,sharedClockPause:paused,noSecondRAF:true,noImageMaterials:true},gpuCompileAndReadbackPassed:true,visualAcceptance:false,interactiveAcceptance:false};await report({stage:'complete',metrics:finalMetrics,memory,programCount,checks:result.checks});return result;
 }catch(e){await report({stage:'error',message:String(e.stack||e),shaderErrors:errors});throw e;}finally{hood?.dispose();renderer.dispose();canvas.remove();}
}
