# 当前未完成检查版 c69a5f19
公开学习检查版，不是三栋成品或正式产品。运行时冻结 c69a5f196aec6a0f383d30ad790bc86786cb0f50，完整原QA https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39765308173 。只增加独立入口包装/状态提示，原函数几何、渲染、材质、控制器保持逐文件原SHA，不启用缓存实验。
同进程640×544东立面暖帧：未隔离版本5.014/5.113秒，最终守卫6.093/6.345秒，均值增加约22.8%。命中/RGBA相同，但未隔离版本有已记录重叠错误，不能作为正确替代。GPU为Actions SwiftShader，不是真机。包QA 39768488258通过；另一同SHA运行39768273598有20秒fence超时，根因未定，保留失败证据。
四组低楼东侧开口依据公开照片观察分格，隐藏下沿/洞深/6mm玻璃厚度属于设计。02/03仅称glazed-opening，不擅定阳台门/窗或开合机构。其余北南西和底层立面未完整识别。龙总plan-local仍未配准真实外壳，上层不是完整房间；三栋没有完成复原。灰暗、切面点纹、秒级渲染尚在；手机仅视口模拟。
官方外部形状源自香港特别行政区政府地政总署/CSDI，知识产权与TNC保留。见 hk-three-buildings-r01/LICENSE_SCOPE.md、kowloon-building-mother-r01/r07/evidence-ledger.json 及 https://portal.csdi.gov.hk/csdi-webpage/doc/TNC 。不冒称自有测绘或政府认可复原。
现有材质闭包保留来源：STONE_STUDY / LuthBird1 / Stone Brick / CC BY 4.0，见 hk-three-buildings-r01/viewer/provenance/STONE_NOTICE.md 和 material-sources.json。完整旧R06来源说明 https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/r06/README.md 。正式发行来源清理尚未完成，不能以删署名代替。
本包没有外部照片、户型原图、教师程序、第三方纹理或外部三角对象模型。全屏三角形仅发射屏幕射线。电梯R02原状态机/控制器未改；未知品牌/真实服务层仍unknown；不作施工或设备安全认证。原ed015入口和其他项目不变。
