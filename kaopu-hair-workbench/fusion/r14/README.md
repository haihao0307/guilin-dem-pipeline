# R14.2 发根与顶部覆盖候选

Parent immutable webpage: c0816ec8388195bb79b12fc82e11ce2d3fa07d56 / fusion/r13c/public-lite.html.

原64k潜在发根、种子724、原生ET18头、发色、单丝半径、灯光、深度覆盖模式保留。不增加头皮黑帽或第二层短毛。

RootProfile: 起根高度从20微米锚点连续变化；最初8毫米使用原生三角形距离，不用粗距离网格替代根部。抬升在根部为零斜率，极短发抑制波纹；聚束延后到起根段之外。
GroomTopology: 保留根部发旋、后部下垂，只让既有发丝中段梳过冠部覆盖原大开口；保留有限额前分缝。鬓角/后颈按第一次越界真实剪短并弧长重采样，不压平余下顶点。
两项可保存参数：起根过渡长度2–16mm、冠部发流覆盖0–100；它们改变真实曲线，不是透明度。起根段查看重用同一发丝网格的前约8mm，不是点云冒充根段。

## 原始方法与边界
SideFX Guide Groom: https://www.sidefx.com/docs/houdini/nodes/sop/guidegroom.html — Lock Root、Ray Bias、Smooth、Cut/Extend、Resample；只迁移原则，未移植Houdini求解器。
Three Material: https://threejs.org/docs/pages/Material.html — depthWrite / alphaToCoverage / blending。
继承原Perm宏/细分离、Digital Salon导向/跟随与原MakeHuman眉毛。没有运行其神经/CUDA求解器。

## 验证与约束
upgrade.py只读旧r13c，仅写r14。CI中的/tmp/hair-r14-reference仅追加测量接口，几何、头部、色彩、光照和半径均为原R13C。
coverageAudit是顶视固定世界区域的白头皮/黑真实发丝ID渲染，保留真实深度和MSAA；不是生物密度测量、不是美术验收，也不涂黑正常画面的头皮。
rootAudit检查固定抽样根点的原生表面间隙和12mm以下短发反向转折。证据还须经人工查看。
当前无动态物理、自碰撞、肩/衣服碰撞。手机只测390×844视口，不是实机。64k顶点内存预算未提升，但导向与精确根部投射增加生成计算；不能声称普通手机影视特写实时。
视觉验收未通过前不得称影视级、最终成品或用户认可。

## 反例已拒绝
R14.0 整个根部场加前向偏置仅把发旋露皮移到旁边，视觉拒绝。R14.1 将生长与中段梳理分开后顶视改善，但后部过度前梳又增加后冠露皮。R14.2 增加后根连续保护带，保留后脑下垂，三发型独立全视图对照。单一顶视ROI改善不能替代后视与侧视验收。
