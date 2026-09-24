"""Read-only packaging of existing public repository files only.
No private Library uploads, account data, issue exports or production edits.
"""
from pathlib import Path
import hashlib,json,shutil,zipfile
OUT=Path('FISH_MOTHER_R011_PROJECT')
CODE=Path('code_snapshot');SITE=Path('public_snapshot/fish-mother-yellowfin')
R='restart/fish-yellowfin-teacher-r2'
GLB='apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/source-workspace/source/tuna_fish_4k.glb'
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()
def copy(a,b):
 b.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(a,b)
def main():
 assert not OUT.exists()
 proof=json.loads((SITE/'PUBLICATION_PROOF.json').read_text())
 assert proof['sourceBuildSha']=='a40cb964bd484deedb8901721fc4813ea021bc91' and proof['shareAllowed']
 assert digest(SITE/'index.html')=='34725bd559733f8f12d49feecf6efa388886b0ddfc02d35158b34eaee8a68e35'
 assert digest(CODE/GLB)=='5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe'
 copy(SITE/'index.html',OUT/'index.html')
 shutil.copytree(CODE/R,OUT/'project'/R)
 copy(CODE/GLB,OUT/'project'/GLB)
 for p in (CODE/'.github/workflows').glob('fish-*.yml'):copy(p,OUT/'project/.github/workflows'/p.name)
 for p in SITE.iterdir():
  if p.is_file() and p.name!='index.html':copy(p,OUT/'workbench-data'/p.name)
  elif p.is_dir() and (p.name=='evidence' or p.name.startswith(('canonical-','parts-','boundary-','head-','feature-','oral-','tail-','pectoral-'))):shutil.copytree(p,OUT/'workbench-data'/p.name)
 (OUT/'开始这里.md').write_text('''# Fish Mother R011 可运行工程完整快照

解压到任意文件夹，双击根目录 index.html 即可打开原三维工作台。日常查看不需要服务器或安装工具。

包含已发布的完整单体HTML、构建使用的原始老师GLB、R003至R011继承运行源码与编译器、当前全部研究字段、检查结果、浏览器证据和仓库内逐版交付回执。

这是现有公开仓库的可运行工程快照，不是整个私有资料库镜像。最初上传的双格式FBX/glTF ZIP和私有连续Markdown日志未包含在本GitHub包内，仍在原资料库单独保留。没有删除它们，也不把索引冒称原始字节。

原始贴图精度、骨架、动画和现有功能未修改。Stage A、独立生成器、生产就绪与用户真机验收仍未完成。网页本体约88.7MB，网络、显卡和内存限制仍存在。

project/ 保持原来的相对目录结构；workbench-data/ 保存当前派生数据和证明。旧网页回退仍在原仓库，不放入本包重复占用体积。完整清单见MANIFEST.json。
''')
 (OUT/'SOURCE_CREDIT.txt').write_text('''Source attribution supplied with the user's glTF archive:
This work is based on "Tuna Fish" (https://sketchfab.com/3d-models/tuna-fish-642c6515d893474a8fc8f129491efcac) by GoldenZtuff (https://sketchfab.com/dhjwdwd) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
The workbench adds source-data extraction, reconstruction and observation tools. Original teacher bytes are unchanged.
''')
 entries=[{'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)}for p in sorted(OUT.rglob('*'))if p.is_file()]
 manifest={'version':'R011_PROJECT_FULL_SNAPSHOT','sourceCommit':'675137a657c615602431641b6a26fb68da902737','publicSnapshotCommit':'4babde056ca653508c8e1af6c9079de5ecc6439c','testedImplementation':proof['sourceBuildSha'],'fullRunnableProject':True,'entirePrivateSourceVault':False,'originalFbxZipIncluded':False,'privateContinuousLogIncluded':False,'files':entries}
 (OUT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 path=Path('FISH_MOTHER_R011_FULL_PROJECT_20260924.zip')
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True)as z:
  for p in sorted(OUT.rglob('*')):
   if p.is_file():z.write(p,(Path(OUT.name)/p.relative_to(OUT)).as_posix())
 with zipfile.ZipFile(path)as z:
  assert z.testzip()is None
  for row in entries:
   b=z.read(OUT.name+'/'+row['path']);assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256']
 receipt={'file':path.name,'bytes':path.stat().st_size,'sha256':digest(path),'verifiedFileCount':len(entries),'zipCrcPass':True,'scope':'complete runnable R011 public project; private Library originals and private continuous log excluded'}
 Path('PACKAGE_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
 print(json.dumps(receipt),flush=True)
if __name__=='__main__':main()
