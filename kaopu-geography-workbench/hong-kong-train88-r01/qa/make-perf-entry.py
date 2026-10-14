from pathlib import Path
p=Path(__file__).resolve().parent.parent/'src/integration.mjs'
s=p.read_text().replace("../../carriage-readonly/compare-workbench/build/node_modules/three/build/three.module.js","three").replace("../../carriage-readonly/compare-workbench/build/node_modules/three/examples/","three/examples/")
needle="if(g.index)g=g.toNonIndexed();"
assert s.count(needle)==1
s=s.replace(needle,"if(globalThis.HK_QA_INDEXED===true){if(!g.index)g.setIndex(new T.BufferAttribute(Uint32Array.from({length:g.attributes.position.count},(_,i)=>i),1));}else if(g.index)g=g.toNonIndexed();")
s=s.replace("const api={ready:true,", "const api={setLensVisible(v){scene.traverse(n=>{if(n.isMesh&&n.material?.transmission>0)n.visible=v});requestFrame()},ready:true,")
p.with_name('perf-entry.mjs').write_text(s)
