"""Native R07.4 adapter. Meshing/solver/gates remain original.
Read exact existing paper -> native mesher -> same solver / actual common collider.
"""
from pathlib import Path
import hashlib,json,re
P=Path(__file__).resolve().parent
src=P/'native/kaopu-tailor-workbench/catalogue/r074-worker.bundle.mjs'
raw=src.read_text();s=raw;changes=[]
def patch(a,b,count=1):
 global s
 assert s.count(a)==count,(a[:100],s.count(a),count)
 s=s.replace(a,b);changes.append({'old':a,'new':b,'occurrences':count})
lock=json.loads((P/'assets/identity.json').read_text());cat=json.loads((P/'assets/catalogue.json').read_text())
prefix="import {sha,requirePerson,materialHash} from '../../../source-contract.mjs';\n"
prefix+='const R04_LOCK='+json.dumps(lock,separators=(',',':'))+';\n'
prefix+='const R04_ROWS='+json.dumps({r['id']:{k:r[k] for k in ['id','style','recipeHash','geometryHash','decodedSHA256']} for r in cat['rows']},separators=(',',':'))+';\n'
prefix+='''var nativeBinding=null;
const nativeAssets=new URL('../../../assets/',import.meta.url);
async function nativeJSON(url,expected){const r=await fetch(url);if(!r.ok)throw Error('原系统输入读取失败 '+r.status);const b=await r.arrayBuffer();if(await sha(b)!==expected)throw Error('原系统输入文件版本不符');return JSON.parse(new TextDecoder().decode(b));}
async function loadNativePaper(data){
 stop();requestId=data.requestId;nativeBinding=null;spec=analytic=lab=null;resetContinuation();
 requirePerson(data.person,R04_LOCK.person);
 const row=R04_ROWS[data.presetId];if(!row)throw Error('未知原始纸样 ID');
 if(await sha(data.paperText)!==row.decodedSHA256)throw Error('原纸样内容哈希不符');
 const original=JSON.parse(data.paperText);if(original.recipeHash!==row.recipeHash||original.geometryHash!==row.geometryHash||!original.validation?.analytic2DPass)throw Error('原裁片身份不符');
 for(const key in profile)profile[key]=0;
 const token=epoch;analytic=await recoverExplicitPantsCuffGathering(original);if(token!==epoch)return;
 config={kind:'analytic',recipe:{bodyCm:structuredClone(original.bodyCm),design:{...structuredClone(original.design),style:row.style}}};
 const start=performance.now();spec=compileAnalytic(analytic,{allowUnsupportedSeams:true,numericalStitchSpacingMm:12,measurementSnapshot:{bodyId:'common-native-default-r04',sizingOrigin:'original-reference-paper-not-remeasured'}});
 spec.source.bodyId='common-native-default-r04';spec.source.patternSizingOrigin=R04_LOCK.sizingPolicy;
 validate2(spec);profile.meshMs=performance.now()-start;
 nativeBinding={person:structuredClone(R04_LOCK.person),presetId:row.id,recipeHash:row.recipeHash,paperSHA256:row.decodedSHA256,materialSHA256:await materialHash(spec),nativeAnchor:R04_LOCK.nativeAnchor,patternSizingOrigin:R04_LOCK.sizingPolicy};
 spec.source.nativeBinding=structuredClone(nativeBinding);
 const positionsM=initialPositions(spec),fit=preflightSizing(analytic);
 emit('paper',{spec,analytic,positionsM,fingerprint:fingerprint2(spec),topology:topology(spec),profile,fitPreflight:fit,canSew:!fit.blocking,physicalStatus:'原尺码纸样已原生重网格；尚未缝合，不是合格成衣'},[positionsM.buffer]);
}
'''
patch('postMessage({ requestId, ...data, type }, transfer)','postMessage({ requestId, ...data, type, binding:nativeBinding }, transfer)')
patch('bodyPath = "garments-r04/assets/body-anny-adult.json", metaPath = directory + "/assets/body-sdf-grid.json"','bodyPath = new URL("common-body.json",nativeAssets).href, metaPath = new URL("body-sdf-grid.json",nativeAssets).href')
patch('body = await json(bodyPath);','body = await nativeJSON(bodyPath,R04_LOCK.bodyFileSHA256);')
patch('const meta = await json(metaPath), raw = await bytes(directory + "/assets/" + meta.transport.file), buffer = await decodeSDF(new Blob([raw]), meta);','const meta = await nativeJSON(metaPath,R04_LOCK.sdfMetadataSHA256), raw = await bytes(new URL(meta.transport.file,nativeAssets).href);\n    if(await sha(raw)!==R04_LOCK.sdfFileSHA256)throw Error("共同人物碰撞场内容不符");\n    const buffer = await decodeSDF(new Blob([raw]), meta);')
patch('configureWasm(await bytes("r07/stability/joint-r072.wasm"));','configureWasm(await bytes(new URL("../r07/stability/joint-r072.wasm",import.meta.url).href));')
patch('} else if (data.type === "generate") {','} else if(data.type === "load-native-paper") {\n      await loadNativePaper(data);\n    } else if (data.type === "generate") {\n      throw Error("本橱柜只接入已记录的原纸样；新量体制版必须走完整原系统，不回退到旧人台。");')
patch('await continuationEdit(data);','throw Error("裁片编辑继续使用保留的原 R07.4；此来源修正版不冒称已接通共同人物重新制版。");')
patch('if (!spec) throw Error("Generate the current flat material first");','if (!spec) throw Error("Generate the current flat material first");\n      requirePerson(data.person,R04_LOCK.person);\n      if(!nativeBinding)throw Error("缺少原材料来源绑定");')
patch('record.trial={version:"R07.4",','record.nativeBinding=structuredClone(nativeBinding);\n            record.trial={version:"R07.4-native-common-adapter",')
out=prefix+s
(src.parent/'native-adapter.mjs').write_text(out)
def part(text,start,end):return text[text.index(start):text.index(end,text.index(start))]
regions=[('compileAnalytic','function compileAnalytic(', '// garment-catalogue-assembly-20261007/src/workbench-worker.mjs'),('tick','function tick(token)', '// This extension is assembled')]
proof={}
for name,a,b in regions:
 old=part(raw,a,b);new=part(s,a,b)
 if name=='tick':new=new.replace('record.nativeBinding=structuredClone(nativeBinding);\n            record.trial={version:"R07.4-native-common-adapter",','record.trial={version:"R07.4",')
 assert old==new,name
 proof[name]=hashlib.sha256(old.encode()).hexdigest()
(P/'assets/ADAPTER_PROOF.json').write_text(json.dumps({'originalWorkerSHA256':hashlib.sha256(raw.encode()).hexdigest(),'adapterSHA256':hashlib.sha256(out.encode()).hexdigest(),'patches':changes,'unchangedNumericalRegions':proof,'nativeStaticGatesChanged':False,'nativeMaterialTopologyModifiedForDisplay':False,'newBodyCollisionField':True,'originalPaperSizeRetained':True},ensure_ascii=False,indent=2))
print('NATIVE_ADAPTER_READY',len(out),len(changes),flush=True)
