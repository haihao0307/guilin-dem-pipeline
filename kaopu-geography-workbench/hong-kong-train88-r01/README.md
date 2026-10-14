# 香港主线 × 88号 · 同场整合 R01

首个大布局可玩候选。保留全部原入口；不等外形和近景最终审定。

- 单一 canvas、共享相机和深度缓冲，真实 R03 地形、Ocean/Weather、九龙建筑与现有88列车在同一场景。沙田暂为既有站台示意；欧洲赌场式辉煌建筑、一侧大学另一侧马场只是待建概念。
- 首段15712.57m：九龙—红磡—天后宫站（暂定）—狮子山—沙田。隧道按门户间作者线位穿过山体，以局部地形剖视看路线；隧道内衬未完成。大埔/罗湖仅留原地图参考，首期不延长。
- 88沿原 FH88 R04 120Hz SI 内核累积的 positionM 采样路线；汽门、惰行、逐步建立的急刹。到站需在25m区间内停稳3秒。
- 1×默认；5×明确为审看时间。审看定位会重置暂停，单独计数，不冒充驾驶进度。
- 站场出口连接段为新故事摆位，沿线高程是粗DSM上的显示层，不代表工程可行性。首版没有曲线阻力、车轮滑移、脱轨、车钩或三维建筑碰撞认证。
- 列车为 grand-steam-r01@5140912c；原生尺寸与材质回调保留，刚性构件同材质合批，保留驱动轮机构。新外形尺寸尚未最终校准；不等待A6定稿。
- 九龙用 R03 已公开有限采样建筑。失物局 R03f 和城寨旧双栋按原函数场采样，放入可开关、可调整故事位置；它们不是最终近景/室内或测绘建筑。

## 操作
出发，滑条调汽门/制动；惰行；空格急停，P暂停。跟随/车侧/站台导演/整体关系切换。跟随画面拖动改变视角、滚轮距离。整体关系保留原地图操作。

## 源码与许可
运行时先校验原R03 index.html SHA256 54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117，再应用 host-patches.json 的显式接入差异。同一文档内执行原海洋/地图代码，不是 iframe 或两页拼接。原地图没有被修改。

train-source/ 保留列车同源母体和原素材许可；train-drive/SOURCE_MANIFEST.json 记录6份原驱动物理模块的Git blob/SHA256校验。candidates/记录候选版本和采样限制。私密参考照片、CAD原图与受限资产不在运行包。

地图源许可继续适用：produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved。CEDD / Lands Department HKSAR Government官方开放数据；现代走廊参照 © OpenStreetMap contributors, ODbL。原天气与Ocean自有源保持。

## 核验
CPU原驱动13项回归通过；路由连续性通过。正常视口浏览器核验状态以 qa/results/BROWSER_QA.json 为准。软件GPU测试不等于真机性能，未宣称60FPS。

## 当前首批验证
QA 38485784963、38486144841 主场正常1440×900与844×390通过控制闭环。最初读数0.28FPS包含天空首次分条计算，稳态性能另测，不能当真实设备流畅认证。源方城寨 GPU 查询编译未完成，缺项控件明确禁用；乘客车厢待接。

Optional 简览 skips only the original dynamic ocean draw call; cached procedural sky and all terrain/train/candidate meshes are unchanged. Default remains full ocean. Physical GPU performance remains unverified.
