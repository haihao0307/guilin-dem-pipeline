# Hair Fiber System R03

白底的男士中长发 / 长发样束。范围只包含发丝形态、光学和运动，没有短绒、毛皮层、头部模型或外部头发贴图。

- `preview-medium.html`：基准 14 cm 的中长发样束。
- `preview-long.html`：基准 34 cm 的长发样束。
- 两个 HTML 均包含完整运行代码，可直接打开；不需要本地服务器。
- 点击「开启微风」，再点画面右下「发梢」，检查相邻细丝的相对运动。关闭微风可检查回落。拖动空白处旋转，滚轮缩放。

## 本次修正

默认纯白背景。反射仍使用头发的介电界面与色素吸收，重新调整有限面积光源、表面粗糙度、色素和曝光；使用保留颜色比例的亮度压缩，最后再与白色背景合成。没有使用金属材质，也没有把反光染黑来隐藏问题。

运动保留重力、根部固定、曲率与导向链长度约束；降低固定束聚合并加强末端释放。每根可见发丝另有两个受空气力驱动的局部弯曲模态，粗细、刚度和迎风暴露程度不同，使邻丝可以相对运动。局部模态是有惯性和阻尼的状态求解，不是按时间直接平移一整束的动画。微风测试中固定发根。

## 检查与边界

见 `docs/research.md`、`BUILD_MANIFEST.json` 与 `qa/*report.json`。交付附有实际 WebGL 截图和风中连续帧 GIF。独立文件检查断开了对本地源码服务器的依赖；光学检查覆盖黑发 / 栗棕、三种灯光、多个相机角度和灯光方位。

这是独立样束的实时近似。尚未实现逐丝自碰撞、接触摩擦、头肩碰撞或真实空气流体耦合；局部显示丝模态也没有逐段严格保长。参数未通过真实发束实验标定。导向数值测试与亮度阈值不能代替视觉判断。

## 代码与来源

`src/` 为这一版的组合与新增实现，`references/manifest.json` 冻结两个用户指定网页的原始来源与哈希。原引擎与光学来源的许可 / 声明保存在 `references/`。原 fur 页面中的短绒与针毛逻辑不参与头发运行。

构建：`node tools/build.cjs`。当前工具使用工作站现有 esbuild 0.25.0；预览 HTML 本身没有此依赖。`tools/serve.cjs` 可在本机 8767 端口供后台检查。`tests/` 与截图工具使用工作站现有 Playwright / Chrome 路径；不会操作桌面鼠标。

## 公开预览

- [男士中长发](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/a40770509a935aff331213c5b69df02d99e661c6/kaopu-hair-workbench/research/hair-system-r03/preview-medium.html)
- [长发](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/a40770509a935aff331213c5b69df02d99e661c6/kaopu-hair-workbench/research/hair-system-r03/preview-long.html)
