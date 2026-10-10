"""Package the already validated HTML without modifying its bytes or runtime."""
import hashlib, json, pathlib, sys

source = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
body = source.read_bytes()
sha = lambda b: hashlib.sha256(b).hexdigest()
expected = '5b8769dce62a072562ac41de70a087c68216328e2fc580202831ba751050c709'
assert sha(body) == expected, 'Only the CI-validated 44367059 artifact is accepted'
parts = []
text = body.decode('utf8')
for i, start in enumerate(range(0, len(text), 24000)):
    data = text[start:start+24000].encode('utf8')
    assert len(data) <= 32768
    name = f'preview-parts/part-{i:03d}.txt'
    (out/name).parent.mkdir(exist_ok=True)
    (out/name).write_bytes(data)
    parts.append(dict(path=name, bytes=len(data), sha256=sha(data)))
assert b''.join((out/p['path']).read_bytes() for p in parts) == body
loader = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>共同人物 · R02 五官区域材质候选</title><style>body{background:#142129;color:#e5eef2;font:16px system-ui;padding:24px}p{max-width:720px;line-height:1.6}</style><p id="delivery-status">正在校验并载入原生人物候选…</p><script>
(async()=>{
 const expected='__SHA__', sourceURL=location.href, base=new URL('.',sourceURL);
 if(!crypto.subtle||!globalThis.TextDecoder)throw Error('此浏览器不支持安全字节校验，请使用新版浏览器');
 const hex=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
 const mr=await fetch(new URL('BUILD.json',base));if(!mr.ok)throw Error('清单载入失败 '+mr.status);
 const m=await mr.json();if(m.delivery!=='verified-text-parts/1'||m.renderedSHA256!==expected||!Array.isArray(m.parts)||m.parts.length<1||m.parts.length>80)throw Error('候选清单不匹配');
 const data=new Array(m.parts.length);let next=0;
 async function worker(){for(;;){const i=next++;if(i>=m.parts.length)return;const p=m.parts[i];if(!/^preview-parts\\/part-\\d{3}\\.txt$/.test(p.path)||p.bytes>32768)throw Error('分片路径或大小无效');const r=await fetch(new URL(p.path,base));if(!r.ok)throw Error('分片载入失败 '+i+' / '+r.status);const b=new Uint8Array(await r.arrayBuffer());if(b.length!==p.bytes||await hex(b)!==p.sha256)throw Error('分片校验失败 '+i);data[i]=b;}}
 await Promise.all(Array.from({length:4},worker));const size=data.reduce((n,b)=>n+b.length,0),bytes=new Uint8Array(size);let offset=0;for(const b of data){bytes.set(b,offset);offset+=b.length;}
 if(size!==m.renderedBytes||await hex(bytes)!==expected)throw Error('完整候选校验失败');
 const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);window.__REGIONAL_DELIVERY__={verified:true,sha256:expected,bytes:size,parts:data.length,documentURL:sourceURL};document.open();document.write(html);document.close();
})().catch(e=>{document.getElementById('delivery-status').textContent='区域材质候选未载入：'+e.message;document.getElementById('delivery-status').dataset.failed='true';console.error(e);});
</script></html>'''.replace('__SHA__', expected).encode('utf8')
(out/'preview.html').write_bytes(loader)
original=json.loads(source.with_name('BUILD.json').read_text())
manifest=dict(schema='kaopu/regional-preview-delivery@1',delivery='verified-text-parts/1',previewSHA256=sha(loader),previewBytes=len(loader),renderedSHA256=expected,renderedBytes=len(body),parts=parts,sourceBuild=original)
(out/'BUILD.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(parts=len(parts),maxPartBytes=max(p['bytes'] for p in parts),renderedSHA256=expected,loaderBytes=len(loader))))
