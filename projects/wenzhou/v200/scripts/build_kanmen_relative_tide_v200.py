#!/usr/bin/env python3
"""Build the Wenzhou V200 numeric-only Kanmen relative tide driver.

The source series remains the audited UHSLC comparison series from PR #49.
This builder stores compact numbers, schemas, hashes and QA only. It never
creates or persists mesh geometry. Absolute water elevation stays locked until
an explicit vertical datum transform is verified.
"""

from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import math
import struct
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[4]
CONFIG_PATH = REPO_ROOT / "projects/wenzhou/v200/config/numeric_field_pipeline_v200.json"
DATA_ROOT = REPO_ROOT / "projects/wenzhou/v200/data/tides/kanmen"
REPORT_ROOT = REPO_ROOT / "projects/wenzhou/v200/reports"
WEB_ROOT = REPO_ROOT / "web/wenzhou-v200-tide-inspector"

BINARY_PATH = DATA_ROOT / "KANMEN_RELATIVE_TIDE_HOURLY_I16MM.bin"
CSV_PATH = DATA_ROOT / "KANMEN_RELATIVE_TIDE_HOURLY.csv"
EVENTS_PATH = DATA_ROOT / "KANMEN_RELATIVE_TIDE_TURNING_POINTS.csv"
COMPACT_PATH = DATA_ROOT / "KANMEN_RELATIVE_TIDE_COMPACT.json"
MANIFEST_PATH = DATA_ROOT / "KANMEN_RELATIVE_TIDE_MANIFEST.json"
SVG_PATH = REPORT_ROOT / "KANMEN_RELATIVE_TIDE_35D_QA.svg"
QA_PATH = REPORT_ROOT / "KANMEN_RELATIVE_TIDE_NUMERIC_QA.json"
STATE_PATH = REPORT_ROOT / "WENZHOU_V200_NUMERIC_PIPELINE_STATE.json"
HTML_PATH = WEB_ROOT / "index.html"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def write_json(path: Path, payload: Any) -> None:
    write_text(path, json.dumps(payload, ensure_ascii=False, sort_keys=True, indent=2) + "\n")


def file_record(path: Path, role: str) -> dict[str, Any]:
    return {
        "role": role,
        "path": str(path.relative_to(REPO_ROOT)),
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
    }


def parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_source(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "time_utc",
            "sea_level_m_window_mean_removed",
            "quality",
            "record_id",
            "uhslc_id",
            "version",
            "reference_datum",
            "absolute_datum_transform_applied",
        }
        if set(reader.fieldnames or []) != required:
            raise RuntimeError(f"unexpected source columns: {reader.fieldnames}")
        for source in reader:
            rows.append(
                {
                    "time": parse_utc(source["time_utc"]),
                    "valueMeters": float(source["sea_level_m_window_mean_removed"]),
                    "quality": int(source["quality"]),
                    "recordId": int(source["record_id"]),
                    "uhslcId": int(source["uhslc_id"]),
                    "version": source["version"],
                    "referenceDatum": source["reference_datum"],
                    "absoluteDatumTransformApplied": source["absolute_datum_transform_applied"].strip().lower() == "true",
                }
            )
    return rows


def validate_source(rows: list[dict[str, Any]], config: dict[str, Any], source: Path) -> dict[str, Any]:
    tide = config["kanmenTide"]
    expected_count = int(tide["sampleCount"])
    cadence = int(tide["cadenceSeconds"])
    start = parse_utc(tide["windowStartUtc"])
    end_exclusive = parse_utc(tide["windowEndExclusiveUtc"])
    checks: dict[str, bool] = {
        "sourceExists": source.is_file(),
        "sourceBytesMatch": source.stat().st_size == int(tide["sourceCsvBytes"]),
        "sourceSha256Matches": sha256_file(source) == tide["sourceCsvSha256"],
        "sampleCountMatches": len(rows) == expected_count,
        "startMatches": bool(rows) and rows[0]["time"] == start,
        "endExclusiveMatches": bool(rows) and rows[-1]["time"] + timedelta(seconds=cadence) == end_exclusive,
        "allQualityCode4": all(row["quality"] == 4 for row in rows),
        "allRecordIdsMatch": all(row["recordId"] == int(tide["recordId"]) for row in rows),
        "allUhslcIdsMatch": all(row["uhslcId"] == int(tide["uhslcId"]) for row in rows),
        "allVersionA": all(row["version"] == "A" for row in rows),
        "allReferenceDatumStationZero": all(row["referenceDatum"] == tide["referenceDatum"] for row in rows),
        "noAbsoluteDatumTransform": all(row["absoluteDatumTransformApplied"] is False for row in rows),
        "hourlyCadence": all(int((rows[index]["time"] - rows[index - 1]["time"]).total_seconds()) == cadence for index in range(1, len(rows))),
        "timestampsUnique": len({row["time"] for row in rows}) == len(rows),
        "valuesFinite": all(math.isfinite(row["valueMeters"]) for row in rows),
    }
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise RuntimeError(f"Kanmen source validation failed: {failed}")
    return checks


def quantize_mm(rows: list[dict[str, Any]]) -> tuple[list[int], float]:
    values: list[int] = []
    max_error_mm = 0.0
    for row in rows:
        exact_mm = row["valueMeters"] * 1000.0
        value = int(round(exact_mm))
        if value < -32768 or value > 32767:
            raise RuntimeError(f"int16 overflow: {value}")
        values.append(value)
        max_error_mm = max(max_error_mm, abs(value - exact_mm))
    return values, max_error_mm


def turning_points(rows: list[dict[str, Any]], values: list[int]) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for index in range(1, len(values) - 1):
        before, current, after = values[index - 1], values[index], values[index + 1]
        kind: str | None = None
        if before < current and current >= after:
            kind = "high"
        elif before > current and current <= after:
            kind = "low"
        if kind:
            events.append({"sampleIndex": index, "timeUtc": iso_z(rows[index]["time"]), "type": kind, "relativeMillimeters": current})
    return events


def write_numeric_csv(rows: list[dict[str, Any]], values: list[int]) -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["sample_index", "time_utc", "relative_tide_mm_window_mean_removed", "quality", "record_id", "uhslc_id", "reference_datum", "absolute_datum_transform_applied"])
        for index, (row, value) in enumerate(zip(rows, values, strict=True)):
            writer.writerow([index, iso_z(row["time"]), value, row["quality"], row["recordId"], row["uhslcId"], row["referenceDatum"], "false"])


def write_events_csv(events: list[dict[str, Any]]) -> None:
    with EVENTS_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["sample_index", "time_utc", "type", "relative_tide_mm"])
        for event in events:
            writer.writerow([event["sampleIndex"], event["timeUtc"], event["type"], event["relativeMillimeters"]])


def build_svg(rows: list[dict[str, Any]], values: list[int], events: list[dict[str, Any]]) -> str:
    width, height = 1500, 620
    left, right, top, bottom = 88, 30, 56, 86
    plot_w, plot_h = width - left - right, height - top - bottom
    y_min, y_max = min(values), max(values)
    padding = max(200, int((y_max - y_min) * 0.08))
    low, high = y_min - padding, y_max + padding
    sx = lambda index: left + (index / max(1, len(values) - 1)) * plot_w
    sy = lambda value: top + (high - value) / max(1, high - low) * plot_h
    points = " ".join(f"{sx(i):.2f},{sy(v):.2f}" for i, v in enumerate(values))
    zero_y = sy(0)
    day_lines: list[str] = []
    labels: list[str] = []
    for index in range(0, len(values), 24):
        x = sx(index)
        day_lines.append(f'<line x1="{x:.2f}" y1="{top}" x2="{x:.2f}" y2="{top + plot_h}" stroke="#d9e4eb" stroke-width="1"/>')
        labels.append(f'<text x="{x:.2f}" y="{height - 42}" font-size="15" text-anchor="middle" fill="#385060">{rows[index]["time"].strftime("%m-%d")}</text>')
    event_marks = []
    for event in events:
        i, v = int(event["sampleIndex"]), int(event["relativeMillimeters"])
        fill = "d45d45" if event["type"] == "high" else "3c78b4"
        event_marks.append(f'<circle cx="{sx(i):.2f}" cy="{sy(v):.2f}" r="2.2" fill="#{fill}"/>')
    y_ticks: list[str] = []
    for meter in range(int(math.floor(low / 1000.0)), int(math.ceil(high / 1000.0)) + 1):
        y = sy(meter * 1000)
        y_ticks.append(f'<line x1="{left}" y1="{y:.2f}" x2="{left + plot_w}" y2="{y:.2f}" stroke="#d9e4eb" stroke-width="1"/><text x="{left - 12}" y="{y + 5:.2f}" font-size="15" text-anchor="end" fill="#385060">{meter:+d} m</text>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect width="100%" height="100%" fill="#f5f8fa"/>
<text x="{left}" y="30" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#183341">Kanmen UHSLC relative tide numeric QA</text>
<text x="{left}" y="50" font-family="Arial,sans-serif" font-size="14" fill="#526a78">840 hourly observations, 1997-11-26 16:00 UTC to 1997-12-31 16:00 UTC exclusive, window mean removed</text>
{''.join(day_lines)}{''.join(y_ticks)}
<line x1="{left}" y1="{zero_y:.2f}" x2="{left + plot_w}" y2="{zero_y:.2f}" stroke="#59717f" stroke-width="1.8"/>
<polyline points="{points}" fill="none" stroke="#1684b8" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
{''.join(event_marks)}
<rect x="{left}" y="{top}" width="{plot_w}" height="{plot_h}" fill="none" stroke="#8398a5" stroke-width="1.2"/>
{''.join(labels)}
<text x="{width / 2:.2f}" y="{height - 12}" font-family="Arial,sans-serif" font-size="14" text-anchor="middle" fill="#526a78">Historical relative series only. Absolute shoreline motion remains locked until vertical datum alignment.</text>
</svg>'''


def build_html(compact: dict[str, Any], events: list[dict[str, Any]]) -> str:
    compact_json = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    events_json = json.dumps(events, ensure_ascii=False, separators=(",", ":"))
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>温州 V200 砍门相对潮汐数字检查器</title><style>
:root{{color-scheme:dark;--bg:#07131c;--panel:#102330;--line:#294757;--text:#edf6fa;--muted:#a8c0cc;--warn:#ffd16a;--ok:#70df9a}}*{{box-sizing:border-box}}html,body{{margin:0;min-height:100%;background:var(--bg);color:var(--text);font-family:Inter,Segoe UI,Microsoft YaHei,sans-serif}}main{{max-width:1200px;margin:0 auto;padding:22px}}.panel{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 18px 44px rgba(0,0,0,.25)}}h1{{font-size:22px;margin:0 0 8px}}p{{color:var(--muted);line-height:1.65}}.facts{{display:grid;grid-template-columns:180px 1fr;gap:7px 14px;font-size:14px;margin:16px 0}}.facts b{{color:var(--muted);font-weight:500}}.facts span{{overflow-wrap:anywhere}}canvas{{display:block;width:100%;height:420px;background:#f6fafc;border-radius:12px}}.controls{{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;margin-top:14px}}button{{background:#1d526b;color:white;border:1px solid #3e7892;border-radius:10px;padding:8px 13px;cursor:pointer}}input[type=range]{{width:100%}}.readout{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}}.card{{background:#0a1a24;border:1px solid var(--line);border-radius:12px;padding:12px}}.card b{{display:block;color:var(--muted);font-size:12px;margin-bottom:6px}}.card strong{{font-size:17px}}.warn{{color:var(--warn)}}.ok{{color:var(--ok)}}@media(max-width:700px){{main{{padding:10px}}.facts{{grid-template-columns:1fr}}.readout{{grid-template-columns:1fr 1fr}}canvas{{height:300px}}}}</style></head><body><main><section class="panel">
<h1>温州 V200 砍门相对潮汐数字检查器</h1><p>本页只读取压缩数字序列，不保存海面 Mesh，也不写入任何中间几何。数据来自砍门 UHSLC 840 个整点观测样本，已经去除本窗口均值。当前可用于潮汐相位、涨落方向和潮差验证。绝对水位与真实岸线淹没范围继续锁定。</p>
<div class="facts"><b>观测窗口</b><span>{compact['startUtc']} 至 {compact['endExclusiveUtc']}，结束时刻不含</span><b>样本</b><span>{compact['sampleCount']} 个，间隔 {compact['cadenceSeconds']} 秒</span><b>编码</b><span>little-endian int16，单位为毫米，最大量化误差 {compact['maxQuantizationErrorMillimeters']:.6f} mm</span><b>相对范围</b><span>{compact['minimumMillimeters']} mm 到 {compact['maximumMillimeters']} mm，潮差 {compact['rangeMillimeters']} mm</span><b>基准</b><span class="warn">station zero，尚无经过验证的绝对高程转换</span><b>当前日期预测</b><span class="warn">关闭，等待经过验证的 FES2022b 指定日期输出</span><b>持久化 Mesh</b><span class="ok">0</span></div>
<canvas id="chart" width="1500" height="620"></canvas><div class="controls"><button id="play">播放</button><input id="slider" type="range" min="0" max="{compact['sampleCount'] - 1}" step="1" value="0"><span id="counter">1 / {compact['sampleCount']}</span></div><div class="readout"><div class="card"><b>UTC 时间</b><strong id="utc"></strong></div><div class="card"><b>北京时间</b><strong id="china"></strong></div><div class="card"><b>相对窗口均值</b><strong id="level"></strong></div><div class="card"><b>潮汐状态</b><strong id="state"></strong></div></div><p class="warn">这组 1997 年观测不能直接冒充 2026 年或其他日期的逐日预报。没有垂直基准转换时，页面不会驱动岛屿露出与淹没。</p></section></main>
<script>const DATA={compact_json};const EVENTS={events_json};const raw=atob(DATA.samplesBase64);const buffer=new ArrayBuffer(raw.length);const bytes=new Uint8Array(buffer);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);const view=new DataView(buffer),samples=[];for(let i=0;i<raw.length;i+=2)samples.push(view.getInt16(i,true));const start=Date.parse(DATA.startUtc),step=DATA.cadenceSeconds*1000,canvas=document.getElementById('chart'),ctx=canvas.getContext('2d'),slider=document.getElementById('slider');let active=0,timer=null;function timeAt(i){{return new Date(start+i*step)}}function tideState(i){{const a=samples[Math.max(0,i-1)],b=samples[Math.min(samples.length-1,i+1)],d=b-a;if(d>40)return '涨潮';if(d<-40)return '落潮';return '转折附近'}}function draw(){{const W=canvas.width,H=canvas.height,L=80,R=25,T=34,B=68;ctx.clearRect(0,0,W,H);ctx.fillStyle='#f6fafc';ctx.fillRect(0,0,W,H);const min=DATA.minimumMillimeters-300,max=DATA.maximumMillimeters+300,sx=i=>L+i/(samples.length-1)*(W-L-R),sy=v=>T+(max-v)/(max-min)*(H-T-B);ctx.strokeStyle='#d6e2e9';ctx.lineWidth=1;for(let m=Math.floor(min/1000);m<=Math.ceil(max/1000);m++){{const y=sy(m*1000);ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(W-R,y);ctx.stroke();ctx.fillStyle='#425a67';ctx.font='15px sans-serif';ctx.textAlign='right';ctx.fillText(`${{m>=0?'+':''}}${{m}} m`,L-10,y+5)}}for(let i=0;i<samples.length;i+=24){{const x=sx(i);ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,H-B);ctx.stroke();ctx.save();ctx.translate(x,H-B+18);ctx.rotate(-.7);ctx.textAlign='right';ctx.fillStyle='#425a67';ctx.fillText(timeAt(i).toISOString().slice(5,10),0,0);ctx.restore()}}ctx.strokeStyle='#1489bd';ctx.lineWidth=2.4;ctx.beginPath();samples.forEach((v,i)=>{{const x=sx(i),y=sy(v);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}});ctx.stroke();const x=sx(active),y=sy(samples[active]);ctx.strokeStyle='#ee7a43';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,H-B);ctx.stroke();ctx.fillStyle='#ee7a43';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8096a2';ctx.strokeRect(L,T,W-L-R,H-T-B)}}function update(){{active=Number(slider.value);const d=timeAt(active);document.getElementById('utc').textContent=d.toISOString().replace('.000Z','Z');document.getElementById('china').textContent=new Intl.DateTimeFormat('zh-CN',{{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}}).format(d);document.getElementById('level').textContent=`${{samples[active]>=0?'+':''}}${{(samples[active]/1000).toFixed(3)}} m`;document.getElementById('state').textContent=tideState(active);document.getElementById('counter').textContent=`${{active+1}} / ${{samples.length}}`;draw()}}slider.addEventListener('input',update);document.getElementById('play').onclick=()=>{{if(timer){{clearInterval(timer);timer=null;document.getElementById('play').textContent='播放';return}}document.getElementById('play').textContent='暂停';timer=setInterval(()=>{{slider.value=(Number(slider.value)+1)%samples.length;update()}},120)}};update();</script></body></html>'''


def verify_declared_files(records: Iterable[dict[str, Any]]) -> None:
    for record in records:
        path = REPO_ROOT / record["path"]
        if not path.is_file() or path.stat().st_size != int(record["bytes"]) or sha256_file(path) != record["sha256"]:
            raise RuntimeError(f"declared file verification failed: {path}")


def build(source: Path) -> int:
    generated = datetime.now(timezone.utc)
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    rows = read_source(source)
    checks = validate_source(rows, config, source)
    values, max_error_mm = quantize_mm(rows)
    events = turning_points(rows, values)
    binary = b"".join(struct.pack("<h", value) for value in values)
    write_bytes(BINARY_PATH, binary)
    write_numeric_csv(rows, values)
    write_events_csv(events)
    compact = {
        "schema": "kanmen_relative_tide_compact@1.0.0", "generatedAtUtc": iso_z(generated), "station": config["kanmenTide"]["station"], "uhslcId": config["kanmenTide"]["uhslcId"], "recordId": config["kanmenTide"]["recordId"], "wgs84": config["kanmenTide"]["wgs84"], "startUtc": config["kanmenTide"]["windowStartUtc"], "endExclusiveUtc": config["kanmenTide"]["windowEndExclusiveUtc"], "sampleCount": len(values), "cadenceSeconds": config["kanmenTide"]["cadenceSeconds"], "encoding": "little-endian signed int16 millimeters", "samplesBase64": base64.b64encode(binary).decode("ascii"), "minimumMillimeters": min(values), "maximumMillimeters": max(values), "rangeMillimeters": max(values) - min(values), "meanMillimetersAfterQuantization": sum(values) / len(values), "maxQuantizationErrorMillimeters": max_error_mm, "turningPointCount": len(events), "referenceDatum": config["kanmenTide"]["referenceDatum"], "absoluteDatumTransformApplied": False, "relativePhaseAndRangeUseAllowed": True, "absoluteWaterLevelUseAllowed": False, "currentDailyPredictionReady": False, "persistedMeshCount": 0
    }
    write_json(COMPACT_PATH, compact)
    write_text(SVG_PATH, build_svg(rows, values, events))
    write_text(HTML_PATH, build_html(compact, events))
    records = [file_record(BINARY_PATH, "relative_tide_int16_millimeters"), file_record(CSV_PATH, "relative_tide_tabular"), file_record(EVENTS_PATH, "relative_tide_turning_points"), file_record(COMPACT_PATH, "relative_tide_compact_json"), file_record(SVG_PATH, "relative_tide_static_qa"), file_record(HTML_PATH, "relative_tide_offline_inspector")]
    manifest = {"schema": "kanmen_relative_tide_manifest@1.0.0", "generatedAtUtc": iso_z(generated), "source": {"repository": "haihao0307/guilin-dem-pipeline", "branch": config["kanmenTide"]["sourceBranch"], "path": config["kanmenTide"]["sourceCsvPath"], "bytes": source.stat().st_size, "sha256": sha256_file(source)}, "numericContract": str(CONFIG_PATH.relative_to(REPO_ROOT)), "storagePolicy": {"persistedMeshCount": 0, "intermediateMeshCount": 0, "numericOutputsOnly": True, "previewGeometryStored": False}, "files": records}
    write_json(MANIFEST_PATH, manifest)
    verify_declared_files(records)
    qa = {"schema": "kanmen_relative_tide_numeric_qa@1.0.0", "generatedAtUtc": iso_z(generated), "passed": True, "sourceChecks": checks, "sampleCount": len(values), "cadenceSeconds": config["kanmenTide"]["cadenceSeconds"], "minimumMillimeters": min(values), "maximumMillimeters": max(values), "rangeMillimeters": max(values) - min(values), "maxQuantizationErrorMillimeters": max_error_mm, "turningPointCount": len(events), "absoluteDatumTransformApplied": False, "absoluteWaterLevelUseAllowed": False, "currentDailyPredictionReady": False, "persistedMeshCount": 0, "intermediateMeshCount": 0, "manifest": file_record(MANIFEST_PATH, "numeric_tide_manifest"), "files": records}
    write_json(QA_PATH, qa)
    state = {"schema": "wenzhou_v200_numeric_pipeline_state@1.0.0", "generatedAtUtc": iso_z(generated), "status": "kanmen_relative_driver_ready_absolute_surface_locked", "truthCogSha256": config["truth"]["targetCogSha256"], "heightTruthStatus": "frozen_identity_binary_archive_gate_separate", "tideNumericDriverStatus": "historical_relative_series_ready", "absoluteTideSurfaceStatus": "blocked_vertical_datum_transform_missing", "currentDatePredictionStatus": "blocked_materialized_fes2022b_output_missing", "xiaowangPipelineAlignment": "pending", "persistedMeshCount": 0, "intermediateMeshCount": 0, "publicDeploymentAllowed": False, "visualAcceptance": False, "productionReady": False}
    write_json(STATE_PATH, state)
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0


def verify() -> int:
    qa = json.loads(QA_PATH.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    verify_declared_files(manifest["files"])
    verify_declared_files([qa["manifest"]])
    if qa["passed"] is not True or qa["persistedMeshCount"] != 0 or qa["intermediateMeshCount"] != 0 or qa["absoluteWaterLevelUseAllowed"] is not False:
        raise RuntimeError("numeric tide gate failed")
    print(json.dumps({"verified": True, "files": len(manifest["files"]), "sampleCount": qa["sampleCount"]}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    if args.verify:
        return verify()
    if args.source is None:
        parser.error("--source is required for build")
    return build(args.source.resolve())


if __name__ == "__main__":
    raise SystemExit(main())
