# F05 数据契约与接入边界

## 方案文档：kaopu/hair-design@1

入口 `Design.mjs`：`createDesign`、`validateDesign`、`revise`、`usePreset`、`importDesign`、`DesignHistory`。所有编辑先验证再提交；外部引用只记录元数据。`id` 标识方案，`revision` 是本地修订号，撤销可以返回先前号；不把它当不可变发布版本。不可变交付依靠 Git 提交及文件 SHA256。

| 字段 | 含义 |
| --- | --- |
| target | 拓扑、原生头部哈希、三角面索引哈希、生长域及根库锁 |
| recipe | 原样沿用 kaopu/hair-guide-recipe@2 / F04，单位参数沿用既有定义 |
| references | 文件哈希、名称、格式、尺寸、用户选择的视角，尚未分析的证据状态 |
| fitStatus | 本轮只允许 not-fitted；不接受未经实现的拟合成功声明 |
| notes | 有界文本说明；不执行其中内容 |

参考图原文存在本机图片库，不进入 JSON。把文档搬到另一台机器后，可依据 SHA256 重新关联原图。未知/不可见区域保持未观测状态。

## 导向交换：kaopu/guide-groom@1

入口 `GuideExchange.mjs`：`buildCoverage`、`exportGroom`、`validateGroom`、`attachGroom`。

坐标是原生右手系，Y向上、Z向前，米。`arcLengthMM`、覆盖距离字段为毫米，名称中明确 MM；点位和局部位移始终为米。每条导向根点绑定 `triangle + barycentric`，没有把根移到额头或新头模。`localOffsets` 通过三角面边构成的双精度正交架保存，坐标架与用于着色的平滑法线分开。数组连续三个数为一个三维点。

`coverage.bindings` 包含3067个激活根点的稳定编号、原生绑定、区域和最多3个同区导向编号/权重。对应192条完整导向；不是3067条已渲染密发。映射只依赖原生头部、根库和导向选择，长度或颜色变化不重建它；本轮没有颜色表现功能。

`states.design` 描述当前静态构造，`rest / equilibrium / runtime` 留空；`extensions.appearance / physics` 留空。消费方创建自己的瞬态状态，不反写方案。新增其他类型的物理状态应通过明确扩展或新版本契约处理，不伪装成已经标定的当前接口。

```javascript
import {attachGroom} from './src/GuideExchange.mjs';

// nativeHead 为消费方已有的同拓扑人物头部；pack 为用户导出的 JSON。
const attached = await attachGroom(nativeHead, pack);
for (const guide of attached.guides) {
  // guide.points 为当前人物坐标中的三维导向点；交给消费方自己的渲染器。
  consumeGuide(guide.rootId, guide.points);
}
```

适配器核查包的单位、目标锁、数量、绑定范围、有限数值、区域和权重，随后核对目标头部实际三角面数组 SHA256。声明相同 topology 但索引顺序改变仍拒绝。刚性转头和平移已测试；非刚性拉伸、变胖变瘦和换拓扑需要额外适配与接触检查，不能仅凭本测试宣称支持。

## 安全替换和隐私

无效方案在替换前拒绝；生成线程失败保留原文档和旧结果；过期结果忽略。导出时若方案在准备期间改变，拒绝下载旧绑定包并提示重新导出。名称和文件名在界面按文本显示，不作为 HTML 执行。

没有把原图提交 GitHub，也没有向其他工作台或会话发送文件。接口交付不等于跨工作台已经接入。当前预览使用基础线条，材质、物理和最终发型观感由对应工作台继续处理。
