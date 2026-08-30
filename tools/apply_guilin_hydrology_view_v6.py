from __future__ import annotations

import re
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected one regex replacement, found {count}")
    return updated


def patch_app() -> None:
    path = Path("viewer/app.js")
    text = path.read_text(encoding="utf-8")
    text = text.replace("longitudinal-flow-taper-v4", "network-directed-physical-width-v6")
    text = replace_once(
        text,
        "  const WATERWAY_DEFAULT_EMPHASIS = 0.82;",
        "  const WATERWAY_DEFAULT_EMPHASIS = 1.0;",
        "default waterway emphasis",
    )
    segment_shader = r'''  const SEGMENT_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aStart;
layout(location=2) in vec3 aEnd;
layout(location=3) in float aClass;
layout(location=4) in float aMainstemCode;
layout(location=5) in float aSourceWidth;
layout(location=6) in float aStartProgress;
layout(location=7) in float aEndProgress;
layout(location=8) in float aStartFlowDistance;
layout(location=9) in float aEndFlowDistance;
uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vProgress;
out float vMainstem;
out float vAcross;
out float vFlowDistance;
float physicalWidthMeters(float classValue,float mainstemCode,float sourceWidth,float progress){
  float p=pow(clamp(progress,0.0,1.0),1.25);
  if(mainstemCode>0.5){
    float upstream=clamp(sourceWidth*0.08,8.0,18.0);
    return mix(upstream,sourceWidth,p);
  }
  if(classValue<0.5){
    float upstream=clamp(sourceWidth*0.18,3.0,16.0);
    return mix(upstream,sourceWidth,p);
  }
  if(classValue<1.5){
    float upstream=clamp(sourceWidth*0.18,1.5,5.0);
    return mix(upstream,sourceWidth,p);
  }
  float upstream=clamp(sourceWidth*0.35,2.0,8.0);
  return mix(upstream,sourceWidth,p);
}
void main(){
  vec3 startPosition=vec3(aStart.x,aStart.y-uVerticalOrigin+uSurfaceOffset,aStart.z);
  vec3 endPosition=vec3(aEnd.x,aEnd.y-uVerticalOrigin+uSurfaceOffset,aEnd.z);
  vec4 clipStart=uViewProjection*vec4(startPosition,1.0);
  vec4 clipEnd=uViewProjection*vec4(endPosition,1.0);
  float progress=mix(aStartProgress,aEndProgress,aCorner.x);
  vClass=aClass;
  vProgress=progress;
  vMainstem=step(0.5,aMainstemCode);
  vAcross=aCorner.y;
  vFlowDistance=mix(aStartFlowDistance,aEndFlowDistance,aCorner.x);
  if(clipStart.w<=0.0||clipEnd.w<=0.0){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
  vec3 centerPosition=mix(startPosition,endPosition,aCorner.x);
  vec2 groundDelta=endPosition.xz-startPosition.xz;
  float groundLength=max(length(groundDelta),0.001);
  vec2 direction=groundDelta/groundLength;
  vec2 perpendicular=vec2(-direction.y,direction.x);
  float halfWidthM=0.5*physicalWidthMeters(aClass,aMainstemCode,aSourceWidth,progress)*uEmphasis;
  vec4 centerClip=uViewProjection*vec4(centerPosition,1.0);
  vec3 widthPosition=centerPosition+vec3(perpendicular.x*halfWidthM,0.0,perpendicular.y*halfWidthM);
  vec4 widthClip=uViewProjection*vec4(widthPosition,1.0);
  vec2 centerNdc=centerClip.xy/max(0.00001,centerClip.w);
  vec2 widthNdc=widthClip.xy/max(0.00001,widthClip.w);
  float projectedHalfWidth=length((widthNdc-centerNdc)*uViewport*0.5);
  float minimumHalfWidth=(aMainstemCode>0.5?0.10:(aClass<0.5?0.075:(aClass<1.5?0.055:0.06)))*uPixelRatio;
  float halfWidth=max(minimumHalfWidth,projectedHalfWidth);
  vec2 ndcStart=clipStart.xy/max(0.00001,clipStart.w);
  vec2 ndcEnd=clipEnd.xy/max(0.00001,clipEnd.w);
  vec2 pixelDelta=(ndcEnd-ndcStart)*uViewport*0.5;
  float pixelLength=max(length(pixelDelta),0.001);
  vec2 pixelDirection=pixelDelta/pixelLength;
  vec2 pixelPerpendicular=vec2(-pixelDirection.y,pixelDirection.x);
  float overlap=clamp(halfWidth*0.35+0.18*uPixelRatio,0.18*uPixelRatio,1.8*uPixelRatio);
  vec4 clipPosition=mix(clipStart,clipEnd,aCorner.x);
  vec2 pixelOffset=pixelPerpendicular*aCorner.y*halfWidth+pixelDirection*mix(-overlap,overlap,aCorner.x);
  clipPosition.xy+=pixelOffset*2.0/uViewport*clipPosition.w;
  gl_Position=clipPosition;
}`;
'''
    text = regex_once(
        text,
        r"  const SEGMENT_VERTEX_SHADER = `#version 300 es\n.*?`;\n\n  const SEGMENT_FRAGMENT_SHADER",
        segment_shader + "\n  const SEGMENT_FRAGMENT_SHADER",
        "segment physical width shader",
    )
    node_shader = r'''  const NODE_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aClass;
layout(location=2) in float aMainstemCode;
layout(location=3) in float aSourceWidth;
layout(location=4) in float aProgress;
layout(location=5) in float aDegree;
uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vProgress;
out float vMainstem;
float physicalWidthMeters(float classValue,float mainstemCode,float sourceWidth,float progress){
  float p=pow(clamp(progress,0.0,1.0),1.25);
  if(mainstemCode>0.5){float upstream=clamp(sourceWidth*0.08,8.0,18.0);return mix(upstream,sourceWidth,p);}
  if(classValue<0.5){float upstream=clamp(sourceWidth*0.18,3.0,16.0);return mix(upstream,sourceWidth,p);}
  if(classValue<1.5){float upstream=clamp(sourceWidth*0.18,1.5,5.0);return mix(upstream,sourceWidth,p);}
  float upstream=clamp(sourceWidth*0.35,2.0,8.0);return mix(upstream,sourceWidth,p);
}
void main(){
  vec3 position=vec3(aPosition.x,aPosition.y-uVerticalOrigin+uSurfaceOffset+0.04,aPosition.z);
  vec4 centerClip=uViewProjection*vec4(position,1.0);
  float halfWidthM=0.5*physicalWidthMeters(aClass,aMainstemCode,aSourceWidth,aProgress)*uEmphasis;
  vec4 offsetClip=uViewProjection*vec4(position+vec3(halfWidthM,0.0,0.0),1.0);
  vec2 centerNdc=centerClip.xy/max(0.00001,centerClip.w);
  vec2 offsetNdc=offsetClip.xy/max(0.00001,offsetClip.w);
  float halfWidthPx=length((offsetNdc-centerNdc)*uViewport*0.5);
  float minimumHalfWidth=(aMainstemCode>0.5?0.10:(aClass<0.5?0.075:0.055))*uPixelRatio;
  halfWidthPx=max(minimumHalfWidth,halfWidthPx);
  gl_Position=centerClip;
  float multiplier=aDegree>2.5?2.18:(aDegree>1.5?2.08:1.72);
  gl_PointSize=max(0.58*uPixelRatio,halfWidthPx*multiplier+0.12*uPixelRatio);
  vClass=aClass;
  vProgress=aProgress;
  vMainstem=step(0.5,aMainstemCode);
}`;
'''
    text = regex_once(
        text,
        r"  const NODE_VERTEX_SHADER = `#version 300 es\n.*?`;\n\n  const NODE_FRAGMENT_SHADER",
        node_shader + "\n  const NODE_FRAGMENT_SHADER",
        "node physical width shader",
    )
    text = replace_once(
        text,
        "      viewProjection: gl.getUniformLocation(state.nodeProgram, 'uViewProjection'),\n      verticalOrigin:",
        "      viewProjection: gl.getUniformLocation(state.nodeProgram, 'uViewProjection'),\n      viewport: gl.getUniformLocation(state.nodeProgram, 'uViewport'),\n      verticalOrigin:",
        "node viewport uniform",
    )
    text = replace_once(
        text,
        "    gl.uniformMatrix4fv(state.nodeUniforms.viewProjection, false, state.viewProjection);\n    gl.uniform1f(state.nodeUniforms.verticalOrigin, state.verticalOrigin);",
        "    gl.uniformMatrix4fv(state.nodeUniforms.viewProjection, false, state.viewProjection);\n    gl.uniform2f(state.nodeUniforms.viewport, canvas.width, canvas.height);\n    gl.uniform1f(state.nodeUniforms.verticalOrigin, state.verticalOrigin);",
        "node viewport draw",
    )
    metrics = r'''  function waterwayZoomScale() {
    return 1;
  }

  function waterwayPhysicalWidthM(classIndex, mainstemCode, sourceWidthM, progress) {
    const p = Math.pow(clamp(progress, 0, 1), 1.25);
    if (mainstemCode > 0) {
      const upstream = clamp(sourceWidthM * 0.08, 8, 18);
      return upstream + (sourceWidthM - upstream) * p;
    }
    if (classIndex === 0) {
      const upstream = clamp(sourceWidthM * 0.18, 3, 16);
      return upstream + (sourceWidthM - upstream) * p;
    }
    if (classIndex === 1) {
      const upstream = clamp(sourceWidthM * 0.18, 1.5, 5);
      return upstream + (sourceWidthM - upstream) * p;
    }
    const upstream = clamp(sourceWidthM * 0.35, 2, 8);
    return upstream + (sourceWidthM - upstream) * p;
  }

  function approximateMetersPerCssPixel() {
    const height = Math.max(1, canvas.clientHeight || 1000);
    const visibleHeight = 2 * state.camera.distance * Math.tan((Math.PI / 4.05) * 0.5);
    return Math.max(0.01, visibleHeight / height);
  }

  function waterwayFullWidthCssPx(classIndex, mainstemCode, sourceWidthM, progress) {
    const physical = waterwayPhysicalWidthM(classIndex, mainstemCode, sourceWidthM, progress) * state.waterwayEmphasis;
    const minimum = mainstemCode > 0 ? 0.20 : (classIndex === 0 ? 0.15 : 0.11);
    return Math.max(minimum, physical / approximateMetersPerCssPixel());
  }

  function waterwayStyleMetrics() {
    const ordinaryRiverWidth = state.maxOrdinarySourceWidthByClass[0] || 28;
    const streamSourceWidth = state.maxOrdinarySourceWidthByClass[1] || 6;
    const canalSourceWidth = state.maxOrdinarySourceWidthByClass[2] || 5;
    const mainstemSourceWidth = state.maxMainstemSourceWidth || 180;
    const secondaryRiver = Number(waterwayFullWidthCssPx(0, 0, ordinaryRiverWidth, 1).toFixed(3));
    const stream = Number(waterwayFullWidthCssPx(1, 0, streamSourceWidth, 1).toFixed(3));
    const canal = Number(waterwayFullWidthCssPx(2, 0, canalSourceWidth, 1).toFixed(3));
    const upstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 0).toFixed(3));
    const midstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 0.5).toFixed(3));
    const downstream = Number(waterwayFullWidthCssPx(0, 1, mainstemSourceWidth, 1).toFixed(3));
    return {
      profile: WATERWAY_STYLE_PROFILE,
      width_mode: 'source-width-meters-projected-to-screen',
      emphasis: Number(state.waterwayEmphasis.toFixed(3)),
      approximate_meters_per_css_pixel: Number(approximateMetersPerCssPixel().toFixed(3)),
      mainstem_upstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 0).toFixed(3)),
      mainstem_midstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 0.5).toFixed(3)),
      mainstem_downstream_physical_width_m: Number(waterwayPhysicalWidthM(0, 1, mainstemSourceWidth, 1).toFixed(3)),
      mainstem_upstream_full_width_css_px: upstream,
      mainstem_midstream_full_width_css_px: midstream,
      mainstem_downstream_full_width_css_px: downstream,
      mainstem_full_width_css_px: downstream,
      mainstem_downstream_to_upstream_width_ratio: Number((downstream / Math.max(0.001, upstream)).toFixed(3)),
      secondary_river_max_full_width_css_px: secondaryRiver,
      stream_max_full_width_css_px: stream,
      canal_max_full_width_css_px: canal,
      max_full_width_css_px: Math.max(secondaryRiver, stream, canal),
      mainstem_names: ['漓江及桂江连续干流', '湘江', '资江'],
      mainstem_segment_counts: state.hydrologyManifest?.styling?.mainstem_segment_counts || null,
      mainstem_progress_ranges: state.hydrologyManifest?.styling?.mainstem_progress_ranges || null,
      li_gui_continuation_segment_count: state.hydrologyManifest?.styling?.li_gui_continuation_segment_count || 0,
      li_south_of_yangshuo_segment_count: state.hydrologyManifest?.styling?.li_south_of_yangshuo_segment_count || 0,
      li_reaches_aoi_south_boundary: state.hydrologyManifest?.styling?.li_reaches_aoi_south_boundary ?? false,
      runtime_route_break_count: state.hydrologyManifest?.topology?.runtime_route_break_count ?? 0,
      flow_direction: 'upstream_to_downstream',
      flow_progress_monotonic: true,
      future_flow_animation_ready: true,
      color_gradient: 'upstream-light-and-thin_to_downstream-dark-and-wide',
      source_width_meters_preserved: true,
    };
  }
'''
    text = regex_once(
        text,
        r"  function waterwayZoomScale\(\) \{.*?\n  function buildOverviewGeometry\(\)",
        metrics + "\n  function buildOverviewGeometry()",
        "physical width metrics",
    )
    text = replace_once(
        text,
        "    $('waterwayWidthStatus').textContent = `主河上游 ${style.mainstem_upstream_full_width_css_px.toFixed(1)} → 下游 ${style.mainstem_downstream_full_width_css_px.toFixed(1)} px · 支流 ${style.secondary_river_max_full_width_css_px.toFixed(1)} px · 小溪 ${style.stream_max_full_width_css_px.toFixed(1)} px`;",
        "    $('waterwayWidthStatus').textContent = `漓桂干流 ${style.mainstem_upstream_physical_width_m.toFixed(0)} → ${style.mainstem_downstream_physical_width_m.toFixed(0)} m · 当前屏幕 ${style.mainstem_upstream_full_width_css_px.toFixed(1)} → ${style.mainstem_downstream_full_width_css_px.toFixed(1)} px`;",
        "data panel width text",
    )
    text = replace_once(
        text,
        "      hydrology_future_flow_animation_ready: state.hydrologyManifest?.direction?.future_flow_animation_ready ?? false,\n",
        "      hydrology_future_flow_animation_ready: state.hydrologyManifest?.direction?.future_flow_animation_ready ?? false,\n      hydrology_orientation_method: state.hydrologyManifest?.direction?.orientation_method || null,\n      hydrology_runtime_route_break_count: state.hydrologyManifest?.topology?.runtime_route_break_count ?? 0,\n      li_gui_continuation_segment_count: state.hydrologyManifest?.styling?.li_gui_continuation_segment_count ?? 0,\n      li_south_of_yangshuo_segment_count: state.hydrologyManifest?.styling?.li_south_of_yangshuo_segment_count ?? 0,\n      li_reaches_aoi_south_boundary: state.hydrologyManifest?.styling?.li_reaches_aoi_south_boundary ?? false,\n",
        "QA continuity fields",
    )
    path.write_text(text, encoding="utf-8")


def patch_browser_test() -> None:
    path = Path("tests/browser_full_map_cdp.py")
    text = path.read_text(encoding="utf-8")
    text = text.replace("longitudinal-flow-taper-v4", "network-directed-physical-width-v6")
    text = replace_once(
        text,
        '''        "hydrology_future_flow_animation_ready": True,
        "centerline_coordinates_mutated": False,
''',
        '''        "hydrology_future_flow_animation_ready": True,
        "hydrology_orientation_method": "connected-network outlet shortest-path distance",
        "hydrology_runtime_route_break_count": 0,
        "li_reaches_aoi_south_boundary": True,
        "centerline_coordinates_mutated": False,
''',
        "browser expected direction",
    )
    text = regex_once(
        text,
        r"    maximum_width = float\(style.get\(\"max_full_width_css_px\"\) or 999\).*?    if style.get\(\"color_gradient\"\) != \"upstream-light-and-thin_to_downstream-dark-and-wide\":",
        '''    if style.get("width_mode") != "source-width-meters-projected-to-screen":
        failures.append(f"waterway width mode: {style.get('width_mode')}")
    upstream_m = float(style.get("mainstem_upstream_physical_width_m") or 0)
    midstream_m = float(style.get("mainstem_midstream_physical_width_m") or 0)
    downstream_m = float(style.get("mainstem_downstream_physical_width_m") or 0)
    if not 8.0 <= upstream_m <= 18.0:
        failures.append(f"mainstem upstream physical width {upstream_m:.3f}m")
    if not upstream_m < midstream_m < downstream_m:
        failures.append(f"mainstem physical width is not increasing: {upstream_m:.3f}, {midstream_m:.3f}, {downstream_m:.3f}")
    if downstream_m < 150.0:
        failures.append(f"mainstem downstream physical width too small: {downstream_m:.3f}m")
    upstream = float(style.get("mainstem_upstream_full_width_css_px") or 0)
    midstream = float(style.get("mainstem_midstream_full_width_css_px") or 0)
    downstream = float(style.get("mainstem_downstream_full_width_css_px") or 0)
    if not upstream <= midstream <= downstream:
        failures.append(f"projected mainstem width is not increasing: {upstream:.3f}, {midstream:.3f}, {downstream:.3f}")
    if int(style.get("li_gui_continuation_segment_count", 0)) <= 0:
        failures.append("Gui River continuation is missing")
    if int(style.get("li_south_of_yangshuo_segment_count", 0)) <= 0:
        failures.append("Li River stops at Yangshuo")
    if style.get("li_reaches_aoi_south_boundary") is not True:
        failures.append("Li and Gui mainstem does not reach AOI south boundary")
    if int(style.get("runtime_route_break_count", -1)) != 0:
        failures.append(f"distilled waterway route breaks: {style.get('runtime_route_break_count')}")
    if style.get("color_gradient") != "upstream-light-and-thin_to_downstream-dark-and-wide":''',
        "browser physical width checks",
    )
    path.write_text(text, encoding="utf-8")


def main() -> int:
    patch_app()
    patch_browser_test()
    print("patched Guilin hydrology viewer v6")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
