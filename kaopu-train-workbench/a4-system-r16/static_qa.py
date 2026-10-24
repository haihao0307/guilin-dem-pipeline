import re,json,subprocess
from pathlib import Path
from system import system_pose
h=Path('index.html').read_text();script=re.findall(r'<script>(.*?)</script>',h,re.S)[0];Path('app.js').write_text(script)
subprocess.run(['node','--check','app.js'],check=True)
expected={str(t):{s:{k:system_pose(t,[0,1.7,4.3],[0,.11,0])[s][k].tolist() for k in ['big','small']} for s in ['left','middle','right']} for t in [0,.3,1.5,3.8,6.1]}
Path('expected.json').write_text(json.dumps(expected))
mock="""const fs=require('fs'), vm=require('vm');let frame;let strokes=0;
const ctx=new Proxy({measureText:s=>({width:s.length*9})},{get:(o,k)=>k in o?o[k]:(...a)=>{if(a.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error('nonfinitecanvas');if(k==='stroke')strokes++},set:(o,k,v)=>{o[k]=v;return true}});
let els={};const el=(s)=>els[s]||(els[s]={value:s==='#layer'?'all':'',textContent:'',innerHTML:'',add(){},getContext:()=>ctx,width:1300,height:760,clientWidth:1300,clientHeight:760,setPointerCapture(){}});
const sandbox={console,Math,Option:function(a,b){},document:{querySelector:el},window:{},requestAnimationFrame:f=>{frame=f}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('data.js','utf8')+'\\n'+fs.readFileSync('app.js','utf8'),sandbox);
let api=sandbox.window.testAPI, expected=JSON.parse(fs.readFileSync('expected.json'));let error=0;
for(let [t,py] of Object.entries(expected)){let js=api.pose(+t);for(let s of ['left','middle','right'])for(let k of ['big','small'])js[s][k].forEach((v,i)=>error=Math.max(error,Math.abs(v-py[s][k][i])))};
els['#play'].onclick();frame(1000);let advance=api.getState().t>0;els['#play'].onclick();let paused=api.getState().t;frame(2000);let holds=paused===api.getState().t;
for(let layer of ['drive','steam','support','control','all']){els['#layer'].value=layer;els['#layer'].onchange()};els['#part'].value='superheater';els['#part'].onchange();
if(error>1e-12||!advance||!holds)throw Error('logicfailure');console.log(JSON.stringify({runtime:'Node with mocked DOM/canvas, NOT browser',syntax_pass:true,pose_max_abs_error:error,play_advance:advance,pause_holds:holds,layers_executed:5,selected:api.getState().selected,draw_strokes:strokes,visual_layout_verified:false},null,2));
"""
Path('node_qa.js').write_text(mock)
r=subprocess.run(['node','node_qa.js'],check=True,capture_output=True,text=True);Path('STATIC_QA.json').write_text(r.stdout);print(r.stdout)
