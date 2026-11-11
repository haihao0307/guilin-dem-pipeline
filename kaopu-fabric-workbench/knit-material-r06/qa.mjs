import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(process.env.SITE_DIR),out=root+'/evidence';await mkdir(out,{recursive:true});
const result={version:'KNIT-MATERIAL-R06',started:new Date().toISOString(),hardwareTested:false,phoneHardwareTested:false,visualAcceptance:false,errors:[],checks:{},runs:{}};let browser;
try{
 browser=await chromium.launch({headless:false,channel:'chromium',args:['--no-sandbox','--enable-unsafe-webgpu','--enable-features=Vulkan','--use-angle=vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--disable-vulkan-surface','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:1200,height:900}});p.setDefaultTimeout(600000);p.on('pageerror',e=>result.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
 const r=await p.goto('http://127.0.0.1:8925/kaopu-fabric-workbench/knit-material-r06/index.html?qa=1',{waitUntil:'domcontentloaded'});if(!r?.ok())throw Error('HTTP '+r?.status());
 await p.waitForFunction(()=>window.FabricLab?.ready||window.FabricLab?.state.failed,null,{timeout:600000});await p.evaluate(()=>FabricLab.pause());if(await p.evaluate(()=>FabricLab.state.failed))throw Error(await p.locator('#error').innerText());
 result.adapter=await p.evaluate(()=>FabricLab.state.metadata.adapter);result.resolution=await p.evaluate(()=>[document.getElementById('view').width,document.getElementById('view').height]);result.material=await p.evaluate(()=>FabricLab.state.material.name);result.hairDensity=await p.evaluate(()=>FabricLab.state.material.params.hairDensity);
 await p.evaluate(()=>FabricLab.setSolver(false));result.runs.field=await p.evaluate(()=>FabricLab.render());const field=await p.evaluate(()=>FabricLab.read());await p.screenshot({path:out+'/field-reference.png'});
 await p.evaluate(()=>FabricLab.setSolver(true));result.runs.direct=await p.evaluate(()=>FabricLab.render());const direct=await p.evaluate(()=>FabricLab.read());result.solverCoverage=await p.evaluate(()=>FabricLab.readSolverStats());await p.screenshot({path:out+'/direct-r06.png'});
 let sum=0,max=0,above=0;for(let i=0;i<field.length;i++){const d=Math.abs(field[i]-direct[i]);sum+=d;max=Math.max(max,d);if(d>1/255)above++;}result.pixelDelta={mae:sum/field.length,max,channelsOver1of255:above,totalChannels:field.length};
 result.comparison=await p.evaluate(()=>FabricLab.compareSolvers());await p.evaluate(()=>FabricLab.pause());
 result.checks.shaderAndRuntime=true;result.checks.directShareMeasured=Number.isFinite(result.solverCoverage.directShare);result.checks.interleavedBenchmark=!!result.comparison?.summary?.direct?.median;result.checks.fullResolutionNotReduced=result.resolution[0]===160&&result.resolution[1]===120;result.checks.fibreDensityUnchanged=result.hairDensity===960;result.checks.errorsZero=result.errors.length===0;
 result.runtimePassed=Object.values(result.checks).every(Boolean);result.finished=new Date().toISOString();if(!result.runtimePassed)throw Error('QA incomplete '+JSON.stringify(result.checks));
}catch(e){result.runtimePassed=false;result.failure=e.stack;console.error(e);process.exitCode=1;}finally{await writeFile(out+'/QA.json',JSON.stringify(result,null,2));if(browser)await browser.close();}
