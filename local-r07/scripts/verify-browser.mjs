import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.FISH_PLAYWRIGHT_PATH || 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] || pathToFileURL(path.join(root, 'dist/KAOPU_FISH_TAIL_DRIVE_R07_WORKBENCH.html')).href;
const label = process.argv[3] || 'local';
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { startedAt: new Date().toISOString(), target, label, sourceHtmlSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dist/KAOPU_FISH_TAIL_DRIVE_R07_WORKBENCH.html'))).digest('hex'), validationOnlyNoSourceDelta: false, views: [] };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [], failedRequests = [], externalRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== target) externalRequests.push(request.url()); });
    console.log('Opening', label, viewport.width, target);
    const response = await page.goto(target, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__KAOPU_R07__ !== undefined, null, { timeout: 120000 });
    const ready = await page.evaluate(() => ({ ready: window.__KAOPU_R07__.ready, error: window.__KAOPU_R07__.error }));
    if (!ready.ready) throw new Error(ready.error);
    await page.waitForFunction(() => window.__KAOPU_R07__.renderer.frames > 1, null, { timeout: 60000 });
    const checks = await page.evaluate(() => {
      const { renderer: r, handle: h, instrument: A } = window.__KAOPU_R07__;
      r.state.playing = false;
      const modes = Object.keys(h.metadata.motion.modes), snapshots = [];
      for (const mode of modes) {
        const options = { ...r.state, mode, finGains: Array(7).fill(1) };
        A.reset(h, mode, options);
        for (let i = 0; i < 60; i++) A.update(h, 1/60, options);
        const snapshot = A.snapshot(h);
        const positions = Array.from({ length: 80 }, (_, i) => A.deformPoint(h, Math.floor(i * (h.metadata.counts.vertices - 1) / 79))).flat();
        const finite = [...snapshot.q, ...snapshot.response, ...snapshot.eye, ...positions].every(Number.isFinite);
        if (!finite) throw new Error('Non-finite state in ' + mode);
        snapshots.push({ mode, label: h.metadata.motion.modes[mode].label, finite, time: snapshot.time });
      }
      A.reset(h, 'CRUISE', { ...r.state, mode: 'CRUISE' });
      for (let i = 0; i < 60; i++) A.update(h, 1/60, { ...r.state, mode: 'CRUISE' });
      const sixty = A.snapshot(h);
      A.reset(h, 'CRUISE', { ...r.state, mode: 'CRUISE' });
      for (let i = 0; i < 30; i++) A.update(h, 1/30, { ...r.state, mode: 'CRUISE' });
      const thirty = A.snapshot(h);
      const deterministicReplay = JSON.stringify(sixty) === JSON.stringify(thirty);
      const gl=r.gl,program=gl.createProgram();
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
      gl.attachShader(program,shader(gl.VERTEX_SHADER,window.__KAOPU_R07__.shaders.meshVertex));
      gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(1);}'));
      gl.transformFeedbackVaryings(program,['vWorldPos'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      const tf=gl.createTransformFeedback(),buffer=gl.createBuffer();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,buffer);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,12,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);
      const tips=Array(8).fill(-1);for(let i=0;i<h.positions.length/3;i++){const id=h.partInfo[i*2];if(id&&(tips[id]<0||h.partInfo[i*2+1]>h.partInfo[tips[id]*2+1]))tips[id]=i;}
      const samples=[...Array.from({length:80},(_,i)=>Math.floor(i*(h.positions.length/3-1)/79)),...tips.slice(1)];
      let gpuError=0,worst=null;const gpuModes=[];
      for(const mode of ['CRUISE','TURN_LEFT','FIN_FAN','PITCH_UP']){
        const opt={...r.state,mode,finGains:Array(7).fill(1)};A.reset(h,mode,opt);for(let i=0;i<120;i++)A.update(h,1/60,opt);
        gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,r.fieldTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,h.metadata.continuum.body.samples,9,gl.RGBA,gl.FLOAT,h.state.field);
        r.applyMesh(program,r.camera.mvp(r.canvas.width/r.canvas.height),true);gl.bindVertexArray(r.vao);gl.enable(gl.RASTERIZER_DISCARD);
        let maxDelta=0;for(const index of samples){gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,index,1);gl.endTransformFeedback();const actual=new Float32Array(3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,actual);const expected=A.deformPoint(h,index),delta=Math.hypot(...expected.map((x,i)=>x-actual[i]));maxDelta=Math.max(maxDelta,delta);if(!worst||delta>worst.delta)worst={mode,index,delta,actual:Array.from(actual),expected,weights:Array.from(h.weights.slice(index*12,index*12+12)),normal:Array.from(h.normalOct.slice(index*2,index*2+2)),rest:Array.from(h.positions.slice(index*3,index*3+3)),part:Array.from(h.partInfo.slice(index*2,index*2+2))};}
        gpuError=Math.max(gpuError,maxDelta);gpuModes.push({mode,samples:samples.length,maxDeltaM:maxDelta});gl.disable(gl.RASTERIZER_DISCARD);
      }
      gl.bindVertexArray(null);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,null);gl.deleteTransformFeedback(tf);gl.deleteBuffer(buffer);gl.deleteProgram(program);
      if(gpuError>2e-6){
        const vs=window.__KAOPU_R07__.shaders.meshVertex.replace('p=vec3(anchorX+f.x,g.y+f.y,g.z+f.z)+frame*(p-vec3(anchorX,g.y,g.z));','p=vec3(f.w,g.x,sin(g.x));');
        const prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 c;void main(){c=vec4(1);}'));gl.transformFeedbackVaryings(prog,['vWorldPos'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(prog);
        const b=gl.createBuffer(),t=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,t);gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,b);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,12,gl.STREAM_READ);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,b);r.applyMesh(prog,r.camera.mvp(1),true);gl.bindVertexArray(r.vao);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,worst.index,1);gl.endTransformFeedback();const a=new Float32Array(3);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,a);const x=h.positions[worst.index*3],br=h.metadata.continuum.body,u=(x-br.sourceXM)/(br.endXM-br.sourceXM),f=A.readField(h,0,u),g=A.readField(h,1,u);
        throw Error('GPU/CPU material transport mismatch: '+JSON.stringify({gpuError,worst,gpuModes,diagnostics:{gpuYawPitchSin:Array.from(a),cpuYawPitchSin:[f[3],g[0],Math.sin(g[0])],renderer:gl.getParameter(gl.RENDERER)}}));
      }
      const finSliderCount=document.querySelectorAll('#weightSliders input').length,finSelectCount=document.querySelectorAll('#weightChannel option').length;
      if(finSliderCount!==7||finSelectCount!==7||document.getElementById('wg0'))throw Error('Body controls still present');
      A.reset(h, 'REST', { ...r.state, mode: 'REST' });
      r.state.mode = 'REST';
      document.querySelector('[data-motion="REST"]').click();
      r.state.playing = false;
      return { measure: A.measure(h), bodyNodes: h.state.body.q.length, finChains: Object.keys(h.state.parts).length, modes: snapshots, deterministicReplay, gpuModes, gpuErrorM:gpuError, finSliderCount,finSelectCount, eyes: h.metadata.continuum.eyes.eyes.length, glError: r.gl.getError(), frames: r.frames, canvas: [r.canvas.width, r.canvas.height], instrumentAbi: A.ABI, version: document.getElementById('version').textContent };
    });
    await page.screenshot({ path: path.join(root, 'evidence', `${label}-${viewport.width}-rest.png`), fullPage: true });
    await page.locator('[data-motion="TURN_LEFT"]').click();
    await page.evaluate(()=>{const {renderer:r,handle:h,instrument:A}=window.__KAOPU_R07__;r.state.playing=false;r.camera.setView('perspective');r.state.paths=true;for(let i=0;i<120;i++)A.update(h,1/60,r.state);});
    await page.waitForFunction(()=>window.__KAOPU_R07__.renderer.frames%10===0);
    await page.screenshot({path:path.join(root,'evidence',`${label}-${viewport.width}-spine-turn.png`),fullPage:true});
    await page.locator('#wg5').evaluate(input=>{input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('#resetWeights').click();
    if(!await page.evaluate(()=>window.__KAOPU_R07__.renderer.state.finGains.every(x=>x===1)))throw Error('Fin reset UI failed');
    await page.locator('[data-motion="CRUISE"]').click();
    const driveInteraction=[];
    for(const strength of [.5,1.5]){
      await page.locator('#amplitude').evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},strength);
      driveInteraction.push(await page.evaluate(()=>{const {renderer:r,handle:h,instrument:A}=window.__KAOPU_R07__;A.reset(h,'CRUISE',r.state);for(let i=0;i<600;i++)A.update(h,1/60,r.state);return A.snapshot(h).gait;}));
    }
    if(!(driveInteraction[1].frequencyHz>driveInteraction[0].frequencyHz&&driveInteraction[1].speedMps>driveInteraction[0].speedMps))throw Error('Drive UI does not control beat and propulsion response');
    await page.locator('#amplitude').evaluate(input=>{input.value='1';input.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.locator('[data-motion="EYE_TRACK"]').click();
    await page.locator('[data-view="eyePos"]').click();
    await page.locator('#eyeYaw').evaluate(input => { input.value = '.15'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    const eyeInteraction = await page.evaluate(() => {
      const { renderer: r, handle: h, instrument: A } = window.__KAOPU_R07__;
      r.state.playing = false;
      for (let i = 0; i < 60; i++) A.update(h, 1/60, r.state);
      return { mode: r.state.mode, yawOffset: r.state.eyeYawOffset, eye: A.snapshot(h).eye, cameraZoom: r.camera.zoom, finite: A.snapshot(h).eye.every(Number.isFinite), glError: r.gl.getError() };
    });
    await page.screenshot({ path: path.join(root, 'evidence', `${label}-${viewport.width}-eye.png`), fullPage: true });
    const entry = { viewport, httpStatus: response?.status() ?? null, ready: true, checks, driveInteraction, eyeInteraction, errors, failedRequests, externalRequests };
    report.views.push(entry);
    console.log(JSON.stringify({ viewport, modeCount: checks.modes.length, deterministicReplay: checks.deterministicReplay, glError: checks.glError, errors, failedRequests, externalRequests }));
    await context.close();
  }
  report.passed = report.views.every(v => !v.errors.length && !v.failedRequests.length && !v.externalRequests.length && v.checks.glError === 0 && v.eyeInteraction.glError === 0 && v.checks.deterministicReplay && v.eyeInteraction.finite);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.passed = false;
  report.error = String(error.stack || error);
  process.exitCode = 1;
  console.error(report.error);
} finally {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(root, 'evidence', `${label}-BROWSER_REPORT.json`), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
