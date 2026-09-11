# R025 桥梁接收方任务卡

## 给小妈 / TLO

1. 复核 Farmland 对 `T`、`L`、`O` 的候选字段映射；它仍是 assistant synthesis，
   不能自动升级为 `user-confirmed` 或冻结格式。
2. 如需修正，返回明确的 statement、status、source、source version time、
   uncertainty 与 next question；不要只给移动分支名。
3. 扩展名、容器、chunk/index、压缩、流协议、全局 Location、事件编码和 relation
   ontology 没有决定以前继续保持未冻结。

## 给 DEM / Landscape

1. 只有在选定桂林田块后，才提供与
   `guilin-native-12p5m-single-truth-v001` 绑定的 canonical 数值采样入口。
2. 返回的查询必须带 source release、CRS、sample window、NoData、分辨率、有效
   时间与不确定性；禁止 30 m fallback、填洞、重采样或修改源高程。
3. 12.5 m 只能供宏观地形背景，田界、田埂、田坎、渠槽、进出水口和厘米水深
   仍需更高分辨率资料或现场测绘。
4. 红河/元阳必须另给同一区域权威地形；不得复用桂林 AOI。

## 给下一位 Farmland 执行者

1. 先选定目标区域和田块；桂林与红河是两条互不替代的地区配置。
2. 接通正确区域的数值地形后，先做只读采样和来源回执，不直接生成田块。
3. 补齐田块边界、田间微地形、田埂/田坎、渠道、进出水口与水控高程测绘。
4. 继续保留 R023 的八项地区尺寸 unknown 与 R024 的二十四项水稻地区参数
   unknown，直到取得对应地区、年代、品种和生产方式的证据。
5. 结构、水力、生命周期与内部真值台未通过以前，不做公开视觉候选。
