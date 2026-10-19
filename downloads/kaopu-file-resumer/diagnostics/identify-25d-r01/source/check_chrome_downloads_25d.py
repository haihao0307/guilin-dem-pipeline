# -*- coding: utf-8 -*-
"""Chrome 下载只读诊断（Python 3.12 标准库）。
不联网、不安装、不修改下载、不结束 Chrome、不上传任何内容。
仅输出25D/25C/5A与三个指定匿名残片的下载元数据；路径中的 Windows 用户名会隐藏。
双击同目录run-diagnostic.cmd启动。仅将脱敏诊断结果保存到工具旁。
若数据库忙，且无正在进行的Chrome下载，请自行正常完全退出Chrome后重跑；不强制结束。
区间和文件大小仅是记录，不能单独证明文件内容或连续前缀正确。
"""
import json
import os
from pathlib import Path, PureWindowsPath
import sqlite3
from urllib.parse import urlsplit, unquote

TARGETS = {'11-NW-25D.zip', '11-NW-25C.zip', '11-SW-5A.zip'}
PARTIALS = {'未确认 489918.crdownload', '未确认489918.crdownload',
            '未确认 58495.crdownload', '未确认58495.crdownload',
            'Unconfirmed 489918.crdownload', 'Unconfirmed 58495.crdownload',
            '未确认 367748.crdownload', '未确认367748.crdownload', 'Unconfirmed 367748.crdownload'}
FIELDS = ['id', 'current_path', 'target_path', 'state', 'received_bytes',
          'total_bytes', 'etag', 'last_modified', 'interrupt_reason', 'start_time', 'end_time']

def basename(value):
    return PureWindowsPath(str(value or '')).name

def safe_path(value):
    value = str(value or '')
    home = str(Path.home())
    if value.lower().startswith(home.lower()):
        value = '%USERPROFILE%' + value[len(home):]
    # Also redact usernames in non-current Windows account paths.
    import re
    return re.sub(r'(?i)([A-Z]:[\\/]Users[\\/])[^\\/]+', r'\1[用户]', value)

def columns(con, table):
    return {r[1] for r in con.execute('PRAGMA table_info("' + table + '")')}

def inspect_history(db, label):
    result = {'profile': label, 'matches': [], 'conclusion': 'unknown'}
    # WAL files require a coordinated snapshot; do not risk creating or changing
    # shared-memory sidecars, or reading an inconsistent main-file-only copy.
    if Path(str(db) + '-wal').exists() or Path(str(db) + '-shm').exists():
        result['status'] = 'stopped_wal_sidecar_present'
        result['说明'] = '发现数据库事务附属文件，已跳过。如无仍在进行的Chrome下载，可自行正常完全退出Chrome后重跑；不要强制结束或删除附属文件。'
        return result
    con = None
    stage = "open_read_only"
    try:
        con = sqlite3.connect(db.resolve().as_uri() + '?mode=ro', uri=True, timeout=0.25)
        stage = 'set_query_only'
        con.execute('PRAGMA query_only=ON')
        stage = 'begin_read_transaction'
        con.execute('BEGIN')
        stage = 'inspect_downloads_schema'
        cols = columns(con, 'downloads')
        if not cols or 'id' not in cols:
            result['status'] = 'unsupported_schema'
            return result
        present = [f for f in FIELDS if f in cols]
        stage = 'inspect_optional_schema'
        urlcols = columns(con, 'downloads_url_chains')
        slicescols = columns(con, 'downloads_slices')
        stage = 'read_download_rows'
        rows = con.execute('SELECT ' + ','.join('"'+f+'"' for f in present) + ' FROM downloads')
        for row in rows:
            item = dict(zip(present, row))
            evidence = []
            if basename(item.get('target_path')) in TARGETS:
                evidence.append('target_filename_exact')
            if basename(item.get('current_path')) in TARGETS:
                evidence.append('current_filename_exact')
            if basename(item.get('current_path')) in PARTIALS:
                evidence.append('provided_partial_filename_exact_only')
            matched_urls = set()
            if {'id', 'url'} <= urlcols:
                stage = 'read_target_url_metadata'
                for (url,) in con.execute('SELECT url FROM downloads_url_chains WHERE id=?', (item['id'],)):
                    try:
                        name = unquote(urlsplit(url).path.rsplit('/', 1)[-1])
                        if name in TARGETS:
                            matched_urls.add(name)
                    except (ValueError, TypeError):
                        pass
            if matched_urls:
                evidence.append('url_filename_exact')
            if not evidence:
                continue
            # This proves only an association recorded by Chrome. It does not
            # authenticate today's bytes, a moved copy, or a continuous prefix.
            recorded_names = set(matched_urls)
            if basename(item.get('target_path')) in TARGETS:
                recorded_names.add(basename(item['target_path']))
            item['recorded_mapping'] = None
            item['mapping_status'] = 'unknown'
            if basename(item.get('current_path')) in PARTIALS:
                if len(recorded_names) == 1:
                    item['recorded_mapping'] = next(iter(recorded_names))
                    item['mapping_status'] = 'chrome_record_association_only'
                elif len(recorded_names) > 1:
                    item['mapping_status'] = 'conflicting_filenames_do_not_guess'
            for field in ['current_path', 'target_path']:
                raw = item.get(field)
                item[field] = safe_path(raw) if field in item else None
                if raw:
                    try:
                        item[field + '_actual_size'] = Path(raw).stat().st_size
                    except OSError:
                        item[field + '_actual_size'] = None
            item['matched_url_filenames'] = sorted(matched_urls)
            item['match_evidence'] = evidence
            item['missing_fields'] = [f for f in FIELDS if f not in cols]
            item['received_slices'] = None
            if {'download_id', 'offset', 'received_bytes'} <= slicescols:
                sf = ['offset', 'received_bytes'] + (['finished'] if 'finished' in slicescols else [])
                stage = 'read_target_slices'
                item['received_slices'] = [dict(zip(sf, v)) for v in con.execute(
                    'SELECT ' + ','.join(sf) + ' FROM downloads_slices WHERE download_id=? ORDER BY offset', (item['id'],))]
            item['continuous_prefix_verified'] = False
            item['conclusion'] = 'unknown'
            result['matches'].append(item)
        result['status'] = 'read_only_query_complete'
    except sqlite3.Error as exc:
        code = getattr(exc, 'sqlite_errorcode', None)
        name = getattr(exc, 'sqlite_errorname', None)
        primary = code & 255 if isinstance(code, int) else None
        result['sqlite_errorcode'] = code
        result['sqlite_errorname'] = name
        result['stage'] = stage
        result['status'] = {
            5: 'stopped_database_busy', 6: 'stopped_database_locked',
            14: 'stopped_cannot_open', 23: 'stopped_authorization_denied',
            8: 'stopped_readonly_restriction', 11: 'stopped_database_corrupt',
            26: 'stopped_not_sqlite_database', 10: 'stopped_io_error',
            1: 'stopped_sql_or_schema_error',
        }.get(primary, 'stopped_sqlite_error')
        result['说明'] = '已停止；没有重试、解锁、复制数据库或修改权限。错误码仅用于区分原因，不包含原始错误文本。'
        if primary in (5, 6):
            result['说明'] += ' 如无仍在进行的Chrome下载，请自行正常完全退出Chrome后重跑；不要强制结束。'
    except OSError:
        result['status'] = 'stopped_filesystem_access_error'
        result['stage'] = stage
    finally:
        if con is not None:
            con.close()
    return result

def main():
    root = Path(os.environ.get('LOCALAPPDATA', '')) / 'Google' / 'Chrome' / 'User Data'
    report = {'tool': 'Chrome 25D and three partials read-only diagnostic r01',
              'conclusion': 'unknown', 'profiles': [],
              '说明': '只读取目标下载记录；无网络请求。状态为数据库记录，可能滞后。区间、大小和ETag均不能单独证明现有文件完整。临时文件名匹配不代表已确认对应ZIP。'}
    if not os.environ.get('LOCALAPPDATA') or not root.is_dir():
        report['status'] = 'chrome_standard_profile_directory_not_found'
    else:
        try:
            profiles = sorted(p for p in root.iterdir() if p.is_dir() and (p.name == 'Default' or p.name.startswith('Profile ')))
            for number, profile in enumerate(profiles, 1):
                db = profile / 'History'
                if db.is_file():
                    report['profiles'].append(inspect_history(db, '配置' + str(number)))
            report['status'] = 'finished'
        except OSError:
            report['status'] = 'stopped_directory_access_error'
    output = '\n=== BEGIN DOWNLOAD DIAGNOSTIC ===\n' + json.dumps(report, ensure_ascii=False, indent=2) + '\n=== END DOWNLOAD DIAGNOSTIC ===\n'
    print(output)
    from datetime import datetime
    log = Path(__file__).resolve().parent / ('download-diagnostic-25d-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.txt')
    try:
        with log.open('x', encoding='utf-8') as f:
            f.write(output)
        print('已将脱敏结果保存在工具旁：' + log.name + '\n请只回传这份文本，不需要上传Chrome数据库或下载残片。')
    except OSError:
        print('无法在工具旁保存文本；请复制上方BEGIN/END之间的结果。未修改数据库或下载文件。')

if __name__ == '__main__':
    main()
