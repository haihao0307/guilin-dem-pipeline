# KAOPU · 体素列车循环场景 / R01

独立编写的实时三维复现研究。参考 Thibault Simar / Voxelmade 的《Voxel train》，不是该作者源码移植，也不是已经逐像素匹配的成品。此案例暂不增加得分、任务、驾驶等玩法。

## 参考与边界

- 作者原作：https://www.voxelmade.com/portfolio-item/voxeltrain/
- 原帖：https://x.com/i/status/1080814823288569856
- 已实看作者三张图片及原帖 6 秒、520×520 动画。地景上表面向车尾回退，拱桥由前端卷入、穿过列车，列车留在画面中心附近
- 烟雾使用透明粒子近似，未经流体求解；灯光、几何、植被、原镜头的轻微变化仍需逐帧校准
- 仅发布新写的程序化场景和许可允许的 Three.js 库。作者图片、视频、模型、字标与网站素材均未嵌入或发布

## 本地运行

仓库根目录运行 `python3 -m http.server 8765`，打开 `/kaopu-minigame-workbench/voxel-train-study/`。无需后端、联网模型或外部 CDN。浏览器使用 WebGL。

离线检查：在本目录运行 `npm test` 和 `npm run check`。专属 GitHub Actions 只读工作流运行 Chromium/WebKit，保留桌面/手机画面与 0、1、2、3、4、5、5.999 秒截图。功能测试通过并不等于视觉匹配。

## 实现

`scene.mjs` 生成机车、罐车、草地、枕木、钢轨、石子、围栏、植物和桥。闭环以真实弧长参数化，变形在顶点着色器中完成；地面、轨道、桥与树一起卷入/展开。车体不会被卷曲。

`app.mjs` 管理按关键帧校准的弱透视镜头、阴影、灯光、粒子以及可暂停的确定性时间轴。默认不允许鼠标意外转动镜头；自由观察可显式打开。原镜头按钮恢复视角。系统减少动态效果偏好会使初始状态暂停。

Three.js r170 使用 MIT 许可，全文见 `licenses/THREE-LICENSE.txt`。
