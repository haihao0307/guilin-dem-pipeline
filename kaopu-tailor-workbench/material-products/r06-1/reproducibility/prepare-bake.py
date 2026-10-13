from pathlib import Path
p=Path(__file__).resolve().parent/'bake.mjs';s=p.read_text();a=s.index('const data=');b=s.index('const settings=',a)
s=s[:a]+"const source=JSON.parse(fs.readFileSync(path.join(root,'probe/inputs',name+'.json'))),fit=JSON.parse(fs.readFileSync(path.join(root,'fitting',lookID+'.json'))),data={...source,oldBody:fit.oldBody},input=fit.rows.map(r=>({...r,positions:Float32Array.from(r.positions)}));\n"+s[b:]
s=s.replace('newMotionAuthoring:false,oldPhysicalFramesUsed:false,','newMotionAuthoring:false,oldPhysicalFramesUsed:false,paperFit:fit.paperFit,').replace('proof:bootProof}));','proof:bootProof,fitRows:fit.rows,paperFit:fit.paperFit}));');p.write_text(s)
