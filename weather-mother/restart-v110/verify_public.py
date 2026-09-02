from pathlib import Path
import hashlib, io, json, os, sys, time, urllib.request, zipfile

receipt_path = Path(sys.argv[1])
root_handoff_path = Path(sys.argv[2])
pointer_path = Path(sys.argv[3])
package_commit = os.environ['PACKAGE_COMMIT']
package_name = 'Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0'
url = f'https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/{package_name}.zip'

receipt = json.loads(receipt_path.read_text())
raw = None
for attempt in range(42):
    try:
        request = urllib.request.Request(url + '?verify=' + receipt['zipSHA256'][:16], headers={'Cache-Control':'no-cache'})
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
        assert len(raw) == receipt['zipBytes']
        assert hashlib.sha256(raw).hexdigest() == receipt['zipSHA256']
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            assert archive.testzip() is None
            names = set(archive.namelist())
            root = package_name + '/'
            required = {
                root + 'START_HERE.md', root + 'HANDOFF.json', root + 'CURRENT_STATE.md',
                root + 'METHOD_ADOPTION.md', root + 'INTEGRATION.md', root + 'POLICY.json',
                root + 'MANIFEST.json', root + 'RESTART_QA.json', root + 'index.html',
                root + 'engine.js', root + 'cloud.glsl', root + 'field-worker.js',
                root + 'motion.js', root + 'optics.js'
            }
            assert required <= names
        break
    except Exception as error:
        print('Pages propagation', attempt, str(error), flush=True)
        if attempt == 41:
            raise
        time.sleep(10)

receipt.update({
    'githubPublicationPending': False,
    'publicationCommit': package_commit,
    'publicURL': url,
    'publicBytesVerified': True,
    'archiveRequiredFilesVerified': True
})
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')

pointer_path.write_text(f'''# Weather Mother 新窗口启动入口

最新全量重启包：`weather-mother/handoffs/{package_name}.zip`

首次发布提交：`{package_commit}`

ZIP SHA256：`{receipt['zipSHA256']}`

ZIP 字节数：`{receipt['zipBytes']}`

公开下载：`{url}`

解压后先读包内 `START_HERE.md`。包内包含全天气运行代码、当前状态、统一规则快照、接入说明、测试记录和下一窗口指令。没有图片、模型、旧运行版、构建缓存或其他生产线资产。

Weather Mother 运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`，公开证据提交 `970aa25814e5d5f98cf10091da69666f62dbcd28`。人工视觉、3A 与生产批准保持 false。
''', encoding='utf-8')

handoff = json.loads(root_handoff_path.read_text())
handoff.update({
    'latestRestartPackage': f'weather-mother/handoffs/{package_name}.zip',
    'latestRestartPackageSHA256': receipt['zipSHA256'],
    'latestRestartPackageBytes': receipt['zipBytes'],
    'latestRestartStart': 'weather-mother/RESTART_START_HERE.md',
    'latestRestartPublicationCommit': package_commit,
    'latestRestartStatus': 'PUBLIC_BYTES_AND_ARCHIVE_VERIFIED',
    'latestRestartVisualApproved': False,
    'latestRestartAAAQualityApproved': False,
    'latestRestartProductionReady': False
})
root_handoff_path.write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + '\n')

print(json.dumps({'status':'PASS','publicURL':url,'publicationCommit':package_commit,'zipSHA256':receipt['zipSHA256']}, ensure_ascii=False))
