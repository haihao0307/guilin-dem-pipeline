from __future__ import annotations
from pathlib import Path
from io import BytesIO
import hashlib, json, shutil, subprocess, tarfile, zipfile

SOURCE_COMMIT = '039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90'
R4_REJECTED = 'c8d31fc1de3b75dbd6da8877cf65d90dadfde918'
PACKAGE_DIRNAME = 'Landscape_Mother_Full_Handoff_R5_2026-09-07'
OUT_ROOT = Path('handoffs/landscape-mother/full-r5-20260907')
BUILD = Path('/tmp') / PACKAGE_DIRNAME

ARCHIVE_PATHS = [
    'workbenches/landscape-surface-r5',
    'workbenches/landscape-function',
    'workbenches/landscape-microscope-r2',
    'workbenches/landscape-microscope-r3',
    'landscape-mother',
]
SELECTED_FILES = [
    'handoffs/landscape-mother/CLEANUP.json',
    'handoffs/landscape-mother/LEARNING_CURRENT.md',
    'handoffs/landscape-mother/TERRAIN_RECORD.json',
    'handoffs/landscape-mother/check_record.py',
    '.github/workflows/landscape-surface-r5.yml',
    '.github/workflows/landscape-microscope-r3.yml',
]


def run(*args: str, **kw):
    return subprocess.run(args, check=True, **kw)


def export_paths(paths: list[str], dest: Path) -> None:
    for path in paths:
        p = run('git', 'archive', '--format=tar', SOURCE_COMMIT, path, stdout=subprocess.PIPE).stdout
        with tarfile.open(fileobj=BytesIO(p), mode='r:') as tf:
            tf.extractall(dest)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_r5_sha256() -> str:
    raw = run('git', 'show', f'{SOURCE_COMMIT}:workbenches/landscape-surface-r5/index.html', stdout=subprocess.PIPE).stdout
    return hashlib.sha256(raw).hexdigest()


def write_docs(root: Path) -> None:
    r5_sha = source_r5_sha256()
    restart = f'''# Landscape Mother — RESTART START HERE\n\n日期：2026-09-07\n\n## 当前唯一继续入口\n\n当前候选：`workbenches/landscape-surface-r5/index.html`\n\n固定 R5 来源提交：`{SOURCE_COMMIT}`\n固定 R5 SHA256：`{r5_sha}`\n\n固定直开地址：\n`https://raw.githack.com/haihao0307/guilin-dem-pipeline/{SOURCE_COMMIT}/workbenches/landscape-surface-r5/index.html`\n\nR5 的生产原则已经冻结：Macroscopic microscope 只在现有岩石表面的薄壳层工作。它可以影响微法线、粗糙度和极小尺度表面响应；它不得重造峰体、主洞口、峰脚、土体或落石位置。\n\n## 重新启动时先读\n\n1. `CURRENT_STATE.json`\n2. `SYSTEM_LAYER_CONTRACT.md`\n3. `handoffs/landscape-mother/LEARNING_CURRENT.md`\n4. `workbenches/landscape-function/README.md` 与源码\n5. `workbenches/landscape-microscope-r2/` 与 `workbenches/landscape-microscope-r3/`\n6. `landscape-mother/` 七文件干净核心\n\n## 当前视觉状态\n\n用户已经明确退回 R4 的整峰重塑路线。R4 的错误是让 microscope 进入宏观隐式体积并重新造山，造成鼓腹、束腰、瓶状峰体。这个方向不得复活。\n\n用户对水蚀石灰岩基线的大形给予有限正向反馈，要求沿该大形继续细化表面。R5 以这份基线为宏观形体来源，把 microscope 限制回表面层。R5 自身尚未获得最终视觉批准。\n\n`visualApproved=false`\n`productionReady=false`\n\n## 下一轮优先事项\n\n1. R5 `Microscope 壳层=0` 与默认值同镜头对照，顶点与索引必须完全不变。\n2. 显微细节继续消除可见重复，同时守住大洞、大裂缝、水蚀沟的既有位置。\n3. 黑色水痕必须读取来水、遮蔽和湿润代理，避免喷黑。\n4. 苔藓保持团簇/块状附着，避免喷绿。\n5. 坡脚石块继续检查真实支承，禁止悬空。\n6. 色彩追求高对比和丰富石灰岩变化，颜色不能冒充几何。\n7. 用户每轮只需要固定 GitHub 提交的 raw.githack 直开入口，聊天中不要塞下载包。\n'''
    (root / 'RESTART_START_HERE.md').write_text(restart)

    state = {
        'schema': 'landscape-mother-full-handoff/1',
        'date': '2026-09-07',
        'repo': 'haihao0307/guilin-dem-pipeline',
        'sourceCommit': SOURCE_COMMIT,
        'currentCandidate': {
            'id': 'R5-surface-shell',
            'path': 'workbenches/landscape-surface-r5/index.html',
            'sha256': r5_sha,
            'macroGeometrySource': 'workbenches/landscape-function/index.html',
            'microscopeScope': 'surface-only',
            'visualApproved': False,
            'productionReady': False,
        },
        'rejected': {'R4': R4_REJECTED, 'reason': 'microscope incorrectly reshaped macro peaks'},
        'frozenRules': [
            'microscope must not regenerate macro peak geometry',
            'camera/display must not change world identity',
            'R4 macro-reshaping route must not return',
            'delivery uses a fixed-commit raw.githack HTML link',
        ],
        'externalEvidence': {
            'r3QAArtifact': 10000271891,
            'r3QAArtifactSHA256': '3f2fcaf5d2de280de89be3c4ed4f2a1811eb2b00c1949630ceb0b00c4ea76b19',
            'r3WorkflowRun': 34070192285,
        },
    }
    (root / 'CURRENT_STATE.json').write_text(json.dumps(state, ensure_ascii=False, indent=2))

    contract = '''# SYSTEM LAYER CONTRACT\n\n## L0 地理 / 宏观主形\n负责世界坐标、峰体轮廓、峰顶、鞍部、峰脚、主洞口和整体体积。R5 从水蚀石灰岩基线继承。Microscope 无写权限。\n\n## L1 结构过程\n负责裂隙、溶蚀洞、脱落缺口、来水代理、落石与母岩关系。几何变化必须显式、可检查。\n\n## L2 Microscope 表面壳层\n只负责近表面多尺度响应。允许写微法线、粗糙度、极小 relief 与诊断着色。调节此层时，顶点和索引必须保持。\n\n## L3 材料 / 环境\n负责石灰岩色域、矿物差异、水痕黑化、苔藓团簇、土壤颜色和粗糙度。颜色不得冒充几何。\n\n## L4 显示\n负责相机、曝光、诊断模式和 UI。不得改变 L0-L3 世界身份。\n\n## Gate\n每个修改必须说明：属于哪一层、读什么、写什么、哪些上游缓冲必须保持。说不清就不进入生产线。\n'''
    (root / 'SYSTEM_LAYER_CONTRACT.md').write_text(contract)

    history = f'''# HISTORY MAP\n\n- `workbenches/landscape-function/`：水蚀石灰岩宏观基线与 Brick 石材迁移后的可重建源码。当前 R5 的大形来源。\n- `workbenches/landscape-microscope-r2/`：Macroscopic microscope 原理学习与复现。\n- `workbenches/landscape-microscope-r3/`：裂隙、色彩、湿痕和苔藓扩展实验，可供表面层参考。\n- R4 提交 `{R4_REJECTED}`：用户明确退回。不得作为地形真值或恢复基线。\n- R5 提交 `{SOURCE_COMMIT}`：当前候选，microscope 仅表面。\n- R017/R018 及其他大型旧实验继续保留在 Git 历史，不重复进入本包，避免重新污染运行依赖。\n'''
    (root / 'HISTORY_MAP.md').write_text(history)


def manifest(root: Path) -> dict:
    rows = []
    for p in sorted(root.rglob('*')):
        if p.is_file() and p.name not in {'MANIFEST.json', 'VERIFY_PACKAGE.py'}:
            b = p.read_bytes()
            rows.append({'path': p.relative_to(root).as_posix(), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()})
    data = {'schema': 'landscape-mother-package-manifest/1', 'fileCount': len(rows), 'totalPayloadBytes': sum(r['bytes'] for r in rows), 'files': rows}
    (root / 'MANIFEST.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return data


def verify(root: Path, data: dict) -> None:
    for item in data['files']:
        p = root / item['path']
        assert p.is_file(), item['path']
        b = p.read_bytes()
        assert len(b) == item['bytes'], item['path']
        assert hashlib.sha256(b).hexdigest() == item['sha256'], item['path']
    current = root / 'workbenches/landscape-surface-r5/index.html'
    assert sha256(current) == source_r5_sha256()
    assert 'Microscope 壳层' in current.read_text()
    assert "release:'karst-surface-shell-r5'" in current.read_text()


def make_zip(root: Path, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in sorted(root.rglob('*')):
            if p.is_file():
                z.write(p, f'{PACKAGE_DIRNAME}/{p.relative_to(root).as_posix()}')
    with zipfile.ZipFile(out) as z:
        bad = z.testzip()
        assert bad is None, bad
        assert f'{PACKAGE_DIRNAME}/RESTART_START_HERE.md' in z.namelist()


def main() -> None:
    run('git', 'cat-file', '-e', f'{SOURCE_COMMIT}^{{commit}}')
    if BUILD.exists(): shutil.rmtree(BUILD)
    BUILD.mkdir(parents=True)
    export_paths(ARCHIVE_PATHS, BUILD)
    export_paths(SELECTED_FILES, BUILD)
    write_docs(BUILD)
    data = manifest(BUILD)
    verify(BUILD, data)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    zip_path = OUT_ROOT / f'{PACKAGE_DIRNAME}.zip'
    make_zip(BUILD, zip_path)
    zip_sha = sha256(zip_path)
    (OUT_ROOT / 'RESTART_START_HERE.md').write_text((BUILD / 'RESTART_START_HERE.md').read_text())
    (OUT_ROOT / 'CURRENT_STATE.json').write_text((BUILD / 'CURRENT_STATE.json').read_text())
    (OUT_ROOT / 'PACKAGE_SHA256.txt').write_text(f'{zip_sha}  {zip_path.name}\n')
    result = {'sourceCommit': SOURCE_COMMIT, 'r5SHA256': source_r5_sha256(), 'package': str(zip_path), 'bytes': zip_path.stat().st_size, 'sha256': zip_sha, 'files': data['fileCount']}
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
