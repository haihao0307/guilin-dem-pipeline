# R05 三栋共享函数场景 · 2026-10-23

本页由 R04 独立复制，R04 未覆盖。三栋使用一个 Canvas、一个相机、同一最近交点缓冲。对照陈列仅平移，保留米制比例；陈列位置不表示真实街区相邻关系。

225 个原源面、200 个既有函数实例与楼层/梯/电梯归属保留。全局命中 ID 与建筑局部 ID 可追溯。没有模型三角网格；全屏三角形仅发射射线。选中照片/构件时复用已完成的命中缓冲重着色，不重新求交。

源外壳不等于闭合实测内部。楼板、楼梯、门窗、电梯等内部构件仍是既有设计。电梯原函数形体与控制器文件保留，但统一页面尚未接入运行/开关门控制。未配准的独立资料平面没有冒充真实建筑内构。

本机补证入口可把用户自行选择的照片关联到建筑/原源面或局部构件，标为“用户本机参考，未自动配准”。文件不上传服务器；仅保存在本浏览器 IndexedDB，失败时明确为会话内保存，可清除当前关联。

旁栏另外引入同一建筑稳定 ID 的官方 3A 外观贴图：175 个源面通过原平面与 UV 对应验证后可显示裁片（低楼128、龍總21、货仓26），5 个原始 JPEG 图集按 CSDI 条款转载并逐图署名。它们是政府模型外观贴图，不是原始相机照片，采集日期未知；龍總图集呈施工棚架状态。UV 裁片只在旁栏显示，不贴回建筑、不改函数几何；不足或未通过匹配的面留空，不能以别面代替。见 OFFICIAL_APPEARANCE_NOTICE.md、official-appearance-provenance.json 和 https://portal.csdi.gov.hk/csdi-webpage/doc/TNC 。

15 条第三方原站实拍仍仅为来源入口，未转载其像素；来源链接不等于实拍照片已在旁栏显示。本机补证是用户自己的参考，不冒充自动配准。

以下为继承材料的历史说明；其中版本号、性能值和未修改声明仅适用于其当时版本，不是本 R05 的测试结果。

---

# 当前未完成检查版 c69a5f19
公开学习检查版，不是三栋成品或正式产品。运行时冻结 c69a5f196aec6a0f383d30ad790bc86786cb0f50，完整原QA https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39765308173 。只增加独立入口包装/状态提示，原函数几何、渲染、材质、控制器保持逐文件原SHA，不启用缓存实验。
同进程640×544东立面暖帧：未隔离版本5.014/5.113秒，最终守卫6.093/6.345秒，均值增加约22.8%。命中/RGBA相同，但未隔离版本有已记录重叠错误，不能作为正确替代。GPU为Actions SwiftShader，不是真机。包QA 39768488258通过；另一同SHA运行39768273598有20秒fence超时，根因未定，保留失败证据。
四组低楼东侧开口依据公开照片观察分格，隐藏下沿/洞深/6mm玻璃厚度属于设计。02/03仅称glazed-opening，不擅定阳台门/窗或开合机构。其余北南西和底层立面未完整识别。龙总plan-local仍未配准真实外壳，上层不是完整房间；三栋没有完成复原。灰暗、切面点纹、秒级渲染尚在；手机仅视口模拟。
官方外部形状源自香港特别行政区政府地政总署/CSDI，知识产权与TNC保留。见 hk-three-buildings-r01/LICENSE_SCOPE.md、kowloon-building-mother-r01/r07/evidence-ledger.json 及 https://portal.csdi.gov.hk/csdi-webpage/doc/TNC 。不冒称自有测绘或政府认可复原。
现有材质闭包保留来源：STONE_STUDY / LuthBird1 / Stone Brick / CC BY 4.0，见 hk-three-buildings-r01/viewer/provenance/STONE_NOTICE.md 和 material-sources.json。完整旧R06来源说明 https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r06/README.md 。正式发行来源清理尚未完成，不能以删署名代替。
本包没有外部照片、户型原图、教师程序、第三方纹理或外部三角对象模型。全屏三角形仅发射屏幕射线。电梯R02原状态机/控制器未改；未知品牌/真实服务层仍unknown；不作施工或设备安全认证。原ed015入口和其他项目不变。
