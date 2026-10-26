# 协记货仓三维证据练习

这里只加载既有 B369121858401063C0.score.json 的 28 个有限平面与 1 个孔，由既有 R16/r07/cases.mjs 的 deriveMeasuredCase 生成；不导入 GLTF/OBJ/网格、不新造替代盒子、不生成墙厚、地基、内部、电梯或设备。原 cases profile 将其列为 upper_component_not_complete_ground_to_roof_building；不能把它称为完整实楼。组件局部 y=0 不是实际地面，源 undersidePlane 不是基础。

源 score 路径：kaopu-geography-workbench/hk-three-buildings-r01/geometry/B369121858401063C0.score.json。已核基线 commit 928fea4be616d065f21ce8dda5106f00ce1fc939。外观数据生成身份与照片命题身份独立，旧字段 observed_derived_source_surface 不被本页作为“照片已观察”输出。

显示使用屏幕载体上的解析射线求交，不把模型转为三角网格。所有源面/凹边界/孔保留；CPU 拾取仍用同一原模块 intersectCaseRay。灰背景双侧照明，无投影阴影，无外部照片贴图。显示底色是候选近似，sRGB 先解码再照明再编码。选中高亮只表示交互选择，不是证据等级。

资料依赖既有 knowledge-lab-r01/warehouse-study.json 与 validate-study.mjs。p024 的图集观察 WH-O-005 只表示图像痕迹；WH-I-002 是 p024/p012 生成横带的代码意图，其余照片命题不伪造逐面配准。unknown 不生成实体。第三方照片仅外链。

手机：WebGL1 / WebGL2 highp，默认颜色缓冲，无 Float32 多附件/深度读回依赖。原生设备像素，预算不足明确停止，不静默降分辨率；不支持时给错误和手动重启，不以静态图替代。pointercancel、失去捕获、双指与拖动均不能触发误点选。无持续动画或自动刷新；真实 iOS 设备视觉/性能未测试。
