# 动物视频动作观察 R03

原动作入口不变：`#animal-learning/video-motion-silhouette`。保留 R02 的三位老师、旧工作入口、单图人工观察与 OBJ 检查。新增的是可执行的本地人工观察闭环，不是自动动物动捕。

## 可直接完成的流程

1. 打开内置公版奔马样例，或导入本地 MP4 / WebM / MOV（上限 100 MiB，浏览器须支持其编码）
2. 暂停或步进。支持的浏览器用 `requestVideoFrameCallback.mediaTime` 记录实际解码帧时间；不支持时明确保存 `seek_time_browser_fallback`。手填帧率仅决定步进间隔，不声称检测了原帧率
3. 在原视频像素坐标上记录可见表面代理点；遮挡和不确定部位不补造。A/B 是轨迹槽，不默认等于身体左右。只有相邻两关键帧都确认同一部位身份才插值；插值不是直接观察
4. 同屏查看可旋转的 XYZ 观察骨架。初始 Z=0；深度由人填写，是假设而非恢复结果。可编辑 XY 偏移以查看投影偏差
5. 显示侧面正交投影的 RMS/最大像素误差，以及人工确认接触足端的离地误差。直接回投为零不能验证真实三维；本版骨段长度随点位变化，没有固定骨长、物理接触或皮肤绑定
6. 导出观察与三维骨架 JSON。视频不进入 JSON。导入同一视频后可以回读记录；SHA-256、宽高、时长不匹配会拒绝

导入媒体只形成当前页面 Blob URL；无上传 API、无持久缓存、无收费 AI 调用。导航离开或关闭时停止播放并释放 URL。需要自行导出 JSON 才能保留记录。

## 内置验证材料

Eadweard Muybridge 1887 年奔马照片，Waugsberg 2006 年的动画，来源页列为公有领域。`assets/SOURCES.json` 保存原始 URL、许可及原/转码 SHA-256。保留原始 300×200、15 帧、每帧 0.1 秒，转为 1.5 秒 H.264 MP4。动画编排速度不是生物真实步频。

`src/motion-sample.json` 是根据逐帧图像人工填写的粗略表面代理点，不是解剖关节真值。候选肢体 A 的时间身份未确认，B 保持不确定，因此样例肢体不自动插值，身体左右也不赋值。样例用于验证媒体/帧/编辑/导出链路，不能用作动捕精度基准。

## 与原动物库的关系

已检查原 `haihao0307/Humanoid-Rig-Lab-Next/animal-atlas`：现有 `live-bindings.js` 可以复制原动物层级/骨架与生命活动；`vendor/mammal/src/instrument.js` 和 `vendor/quad/src/instrument.js` 是原有建形参数实现，不是这个视频观察槽位的通用重定向接口。本版未复制其他动物模型，也未声称已绑定原 Atlas 模型。

导出字段 `rig.schema=kaopu/observation-rig@1` 明确坐标系、17 个槽位、骨段连接、逐帧坐标和误差；`rig.adapter=null`。后续绑定原动物模型前，需逐模型确认骨架层级、rest pose、轴向、单位、槽位对应关系和左右身份。不能仅凭轮廓拟合断言深度正确。

## 构建与验收

- `node tools/build.mjs`：可重复生成不依赖外部请求的薄页（内嵌公版视频约 139 KiB）
- `node tests/static-numeric.mjs`：原研究/工具 69 项回归
- `node tests/motion-numeric.mjs`：动作数值、数据边界与素材指纹检查
- `MOTION_ENGINE=chromium python tests/motion-browser.py`
- `MOTION_ENGINE=webkit python tests/motion-browser.py`

真实桌面浏览器验收记录绑定具体提交与 HTML SHA-256。生产发布由主任务串行处理，QA 分支通过不等于已发布。
