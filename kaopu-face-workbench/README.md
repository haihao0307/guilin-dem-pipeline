# KAOPU 捏脸工作台 R02 实验候选

保留 Google GNM Head v3 原始 17,821 顶点模型、253 身份/383 表情基底与精确归零。`r01.html` 可回到完整 R01 输入/手工编辑流程；来源基线为已发布提交 `920ecc213701c14a9666308fdcd453273f141a83`。其他工作台不变。

## 新接入的真实计算

1. 用户指定人物并确认同人；选 1–8 张本地照片或手动视频取帧。没有自动认人或跨档案检索。
2. MediaPipe Face Landmarker 0.10.34 / float16 模型版本 1，在浏览器 CPU/WASM 实际提取 478 点。双脸、无脸、过小脸、约40度以上侧转明确拒绝；不伪造逐点置信度或遮挡mask。
3. 采用 Google XRBlocks 已有 GNM/MediaPipe 校准对应473点与 Horn/Cholesky数学工具。身份为共享24个前导PCA；每图独立6自由度弱透视相机与12个表情分量（每眼4、下脸4）。不复制FLAME参数到GNM。
4. 联合交替求解真实二维误差。MediaPipe非公制z仅初始化相机；身份在刚性子集求解，表情每图独立。其余身份/表情参数保持零。
5. 每第五个对应点（95点）在初始化、相机、身份与表情求解前完全留出。3图以上执行逐图排除身份的交叉验证，留出图只用训练点估计其相机/表情。
6. 求解在Web Worker执行；检测逐图实际运行并让出UI。可取消，不自动应用。用户可应用中性共享身份、当前图表情、导出完整参数与验证报告。

## 质量边界

这是一条可运行、可测误差的稀疏/校准特征拟合基线，不是稠密照片重建、摄影测量、真实皮肤或已经验收的本人相似度。深度没有标定，镜头内参与公制深度均为null。

校准对应点的位置不同于真实GNM表面。UI分别报告校准点与实际网格对应点的留出误差，均和原始身份基线（独立拟合相机与表情）比较，避免把检测器校准改善当成真实表面改善。没有遮挡估计、鲁棒权重、动态轮廓、透视镜头或纹理损失；侧脸、张嘴、强阴影、宽角镜头仍可能失真。刚性子集无法充分约束下脸身份。单张图尤其欠约束。低pixel误差不证明像本人。

GNM原始68点下颌2..6顺序与iBUG不同；专门测试记录该事实。本拟合使用不同的473点对应，不把68点冒当MediaPipe顺序。

## 可选毛发 / 眉毛 / 睫毛

保留现有毛发台的老师原长发与原眉毛数据，新增224根眼睑曲线睫毛。默认关闭，点击添加后才在可取消Worker里绑定；照片流程无需等待。毛发、眉毛和睫毛随同一真实GNM三角形变形，不改原头模。保留原发缝与发根，三种长度来自原曲线裁切。具体来源、CC BY-SA声明、参数与验证见GROOM-INTEGRATION.md和TEACHER-GROOM-PROVENANCE.json。恢复原始基线会隐藏毛发；OBJ仍只导出GNM头。

## 本地与隐私

照片只用blob URL/canvas内存，不写浏览器持久存储，不上传。仅GET读取公开GNM权重、固定版本MediaPipe WASM与经过SHA-256校验的检测模型。应用不调用外部照片推理服务。

通用档案JSON仍支持R01，并验证/恢复毛发设置（不包含毛发曲线），拟合参数标记 `sparse-landmark-fit-needs-review`。详细拟合报告另用 `kaopu-face-fit/1`，包含共享身份、每图camera/expression、留点/留图误差及来源，无图像。通用档案回导只恢复参数/文字，不能声称恢复完整拟合证据。OBJ仍是原GNM几何，无纹理。

## 验证

- `npm test`：原26条契约
- `GNM_ASSET=/path/gnm_head_web.bin node tests/model.mjs`：原模型、维数、表情独立、精确归零
- `GNM_ASSET=/path/gnm_head_web.bin node tests/fitting.mjs`：真实GNM基底、共享身份、每图独立参数、预留点与逐图验证、顺序不变、非法输入与精确恢复
- `GNM_ASSET=/path/gnm_head_web.bin node tests/landmark-order.mjs`：68顺序与473边界
- `FACE_ASSETS=/path/assets FACE_URL=http://127.0.0.1:8765/kaopu-face-workbench/ node tests/fitting-browser.cjs`：真实MediaPipe CPU照片推理、应用/恢复、重复图拒绝、无脸拒绝、取消、导出、隐私网络断言。Chromium与Linux WebKit分别运行

合成3视角求解自检在本地达到按留点数量合并的RMS 1.453→0.668px；是同一基底生成的数值正确性测试，不是检测器或真人精度。公开MediaPipe测试照片只用于CI本地验证，非用户资料，不嵌入产品或仓库。实体iPhone与用户真实同人多视角相似度尚未验收。PR保持Draft，不合并、不部署。

## 上游与许可证

- GNM: https://github.com/google/GNM
- XRBlocks固定提交: https://github.com/google/xrblocks/tree/265c2adadadb286854ff081fd9d07b16f39c4134/samples/avatar_lab/gnm
- XRBlocks FaceFit及对应来自 https://github.com/edualvarado/gnm-webcam-puppet （Apache-2.0）；原注释保留
- MediaPipe Web API: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js
- MediaPipe官方测试引用: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/face_landmarker_test.py
- GNM/XRBlocks/MediaPipe Apache-2.0；Three.js MIT。许可证保留于licenses

R01详细说明保留在README-r01.md。后续Pixel3DMM等稠密FLAME路线需要其原生模型验证与独立拓扑注册适配，不能把本基线称为该路线已完成。

## 方法体系与效率记录

METHODS.html为工作台内可见方法卡：观察→特征/可见性门槛→共享身份+逐图相机/表情→留点/留图复验。AMADEUS等仅作研究启发，未引入其模型或训练。逐点置信度与遮挡mask尚无实现，均为null。现有检查只覆盖单脸、脸宽、画面边界与近似侧转。报告保留原图/处理图尺寸和缩放映射。timings记录真实各阶段耗时；浏览器QA另记视频导入与取帧，不声称实体手机性能。
