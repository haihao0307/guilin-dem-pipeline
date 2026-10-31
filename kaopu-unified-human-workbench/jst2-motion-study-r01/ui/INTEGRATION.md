# UI integration

`index.html` and `styles.css` are static, with no application logic. Add the root controller script before `</body>`. Paths assume HTML and CSS are copied together; change `nativeFrame.src` to the built native host location.

- All requested element IDs exist: `sourceVideo`, `nativeFrame`, `sampleList`, `playButton`, `prevFrame`, `nextFrame`, `speedSelect`, `timeline`, `timeLabel`, `viewMode`, `cameraFront`, `cameraSide`, `cameraReset`, `statusText`, `nativeStatus`, `sourceStatus`, `clipTitle`, `clipPrompt`, `sourceLink`, `readinessBadge`, `metrics`.
- Extra IDs: `workspace`, `sourceStage`, `nativeStage`, `sourcePlaceholder`, `nativePlaceholder`, `sampleCount`.
- Updated source stage: visible `canvas#sourceCanvas` for the actual public GLB motion; `video#sourceVideo` is hidden fallback. If using the video, hide the canvas and unhide the video. Root owns the render context.
- `input#motionFile` accepts `.glb,model/gltf-binary` and is attached to the styled import label. Root must read files locally to match the explicit local-processing copy; adjust copy if implementation differs.
- The view selector has values `compare`, `source`, `native`. Set `workspace.dataset.view` to the selected value; CSS handles the stage layout.
- Set `sourcePlaceholder.hidden = true` when media is loaded and `nativePlaceholder.hidden = true` once the native host reports ready. Error/status can be displayed in these placeholders if needed.
- Media playback and camera controls start disabled. Enable only supported actions. The video is muted, plays inline, loops, and preloads metadata. No autoplay was assumed.
- Replace `sampleList` children with buttons using class `sample-card` and `aria-pressed="true"` or `.active`. Expected children: `.sample-number` or `.sample-icon`, a wrapper containing `.sample-title` and `.sample-meta`, optional `.sample-duration` / `.sample-arrow`. All are optional.
- `readinessBadge.dataset.state` supports `ready` / `error`; default neutral loading. Set plain text to the actual overall result.
- `metrics` is a `<dl>` with three cells, each `<div><dt>label</dt><dd>value</dd></div>`. Replace or populate with measurements, never placeholder claims.
- `playButton` has a `<span>` text child and inline SVG. Update text/icon to playback state.
- Source/own-rig columns label the source “JST-2 · 官方公开样本” and target “我们的完整人物 · 适配实验”. Copy states “公开示例回放，非本次在线生成”. Current explanatory copy does not claim successful retargeting before verification.
- Responsive breakpoints: 1600 / 1180 / 900 / 640 px. Below 900 px sample list becomes horizontal; dual stages remain side by side on mobile with single-stage mode available.

Root may update any explanatory copy to reflect verified results and actual source data. No external fonts, images, third-party UI libraries, fabricated measurements, or fake sample controls are included.
