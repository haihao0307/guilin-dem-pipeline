# MP02-S1 — 实体材料成衣适配候选

接续用户指定 MP01 页面 `material-products/mp01-ff151f3bf29e/?look=L04&top=leather-patent&bottom=denim-bleach`，继承源码提交 `c8e9b7b6979e26029bc7dd67411bbb8ecd336cb6`。独立分支 `feature/tailor-mp02-solid-textiles-20261011`，旧版目录、人物、绑定、原裁片数据不改，不合并、不强推。

## 当前状态

这是实际运行时与几何代码，不是生成图片或纸片贴图。**交付验收未完成**：本环境浏览器访问本机开发入口返回 `ERR_BLOCKED_BY_ADMINISTRATOR`，未绕过该限制，未取得新版实际渲染画面。因此 `visualVerified=false`、`deliveryComplete=false`，不能凭源码、编译或 HTTP 成功声称视觉合格。若存在 RELEASE_STATE.json，其中 URL 只是明确标记的开发候选，原用户页面没有被替换。

## 实际接入范围

针织读取并研究了用户 R11 固定提交 `20b466073bb458408a078260a018460c81f627b9` 的针目、载纱与配方。新适配层在原成衣毫米裁片坐标上构建连续针目曲线、三股封闭截面、整针换色、背浮线及有限代表毛羽。它不是完整原 Ray/Wave 光谱传输、精确全载纱时钟或针织力学系统的移植。

牛仔核查到 R09 提交 `bef688f8152212bf57207aa99703a9be81a0272f`；实际复用它继承的 R08 cotton-surface.js 截面函数，并保存 core.js 作为来源。新成衣适配构建交织经纬纱和有限代表纤维。没有把 R09 朝向相机的纤维带搬进来，也不能将新适配器称作整个 R09 运行时。原色、复古、漂洗和黑色配方保持独立。

皮革核查到 R12-S1A 提交 `dafd69cf7819e7c5a67e0dd2643e79fc154bdc7d`；这是源码规范化，不是新的视觉内核。实际采用其保持等效的 R10 LeatherKernel（`af389cc216ddd01e3b1aa66c972f42b2587bc797`）与原配方，建立内外表面、封闭切边和顶点粒面起伏。没有引入 Adobe 图像资产。细于网格的纹路仍有程序化法线表达，并非每个毛孔都具有独立几何。

## 不再用可见纸片代替结构

原 nativeGarmentMesh 只作不可见的位置来源、选取与相机定位；不加入可见场景。纱线各距离都用封闭三维截面，远处仅减少管面细分（3/5/8 边），不会换成摄像机朝向纸带、贴图布片或不透明毛衣背板。材料不载入颜色、法线、粗糙度图片；浮点查找纹理只保存三维位置与法线，不是外观图。

十二套上下装组合、独立上衣/裤装材质选择、正背侧视、整身/局部镜头、双击特写、曝光及无色几何检查保留。生成在 Worker 中完成，过期请求可终止；新结果没有就绪时保留旧结果，不用空页面冒充成功。

## 检查和证据

`test-geometry.mjs` 在七个原款上重放来源哈希、有限坐标、几何查找、闭合皮层的边连接/绕序、纱线区间与 uniform 有效性，另验封闭截面模板和整针边界连续性。本地首次为 3,508 项通过；CI 必须独立重跑，准确结果见 GEOMETRY_REPORT.json。数值检查不证明纱线全局无相交、视觉真实或动态碰撞正确。

`emit-shaders.mjs` 与 glslangValidator 只检查自定义顶点函数和接口链接，结果见 SHADER_REPORT.json；不是完整浏览器帧或最终 PBR 画面验证。PUBLIC_BYTES.json 若存在，只证明候选文件经公开 HTTPS 取得且哈希匹配，不证明浏览器渲染。

## 未完成和现实成本

本轮仍使用原静态衣形作为材料定位基面，没有按毛衣、牛仔、皮革重算弯曲、伸长、摩擦和厚度碰撞。缝线是两条进入厚度的几何路径演示，不是已认证的 301 工业锁式拓扑，也没有针孔重网格或缝线拉力求解。反绒革还没有完整的独立绒毛几何；针织和牛仔只生成有限代表毛羽，不能声称所有微观纤维都复刻完毕。

毫米纱线铺满长裤会产生大量几何和顶点计算；查找数据、实例记录、管面模板和渲染附件分别占用内存。文件小不等于显存小。当前未证明普通显卡帧率、手机实机、长时稳定性、亚像素闪烁或完整镜头无穿模。材质结构不是免费的纹理替换，不能承诺满纤维整衣在普通设备上立即流畅运行。

## 复验

已登记的规范源直接修改，不通过修改旧网页字符串搭建运行时。首次在仓库根运行 `COTTON_SOURCE=<已检出的R09提交>/denim-workshop/r08 python kaopu-tailor-workbench/material-products/r02/bootstrap.py`，只继承缺失的原依赖、配方和固定服装包，不覆盖已有可编辑源码。之后使用冻结 Three.js：

```sh
export THREE_PATH="$PWD/kaopu-tailor-workbench/presets/r04/person-core/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js"
node --loader ./kaopu-tailor-workbench/material-products/r02/node-loader.mjs kaopu-tailor-workbench/material-products/r02/test-geometry.mjs
node --loader ./kaopu-tailor-workbench/material-products/r02/node-loader.mjs kaopu-tailor-workbench/material-products/r02/emit-shaders.mjs
```

旧目录只读；所有来源版本与继承文件摘要见 SOURCE_LOCK.json 和 INHERITANCE.json。
