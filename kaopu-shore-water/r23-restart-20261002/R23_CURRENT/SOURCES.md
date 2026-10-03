# 来源与用途

## 老师视频

用户上传：XDown.app_Jt4rzmsH_1JTU3XC_1624p.mp4。
公开帖子由用户指定：https://x.com/mlperego/status/2105448230616023446/video/1
本版直接使用用户已上传的字节抽取画面，不把未取得的作者工程冒充为已读源码。
视频、截图用于私人学习和对照，不自动授予对原作品的发布/再许可权。

## 观察方法

KAOPU_小妈研读总账_20261001.md；KAOPU_WORKFILE_MASTER_ZH_SCORE_20260927.md。
已从当前用户资料库检索读取。

## 投影方法参考

OpenCV 官方相机模型说明：
https://docs.opencv.org/4.13.0/d9/d0c/group__calib3d.html
OpenCV 官方 Homography 方法与适用范围：
https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html

平面对应只能支持相应假设下的投影关系，不能单凭一帧唯一决定未知深度。

## 实现

新场景使用原生 WebGL2，无外部依赖。虽然查阅了 Three.js 相机说明，但最终没有载入 Three.js 库，也没有从旧工作台复制数学/渲染模块。
