# 程序化字段知识最小包

## 用途

这是一个可共享的通用知识包，用于程序化造型、材质、色彩、噪波、测量结果可视化和表面细节生成。

包内只保留方法、字段结构、随机种子、配色逻辑、诊断规则和一份无依赖参考代码。

包内不含三维资产、贴图、图片、项目专用参数、外部运行库和商业软件文件。

## 核心流程

```text
Source Field
→ Shape Field
→ Data and Mask Field
→ Color Field
→ Render Field
→ QA
```

## 推荐阅读顺序

1. `01_CORE_KNOWLEDGE.md`
2. `02_ADAPTATION_GUIDE.md`
3. `field_graph_recipes.json`
4. `field_contract.schema.json`
5. `field_reference.js`
6. `PROMPT_SHARE.txt`

## 六条核心原则

1. 所有复杂结果都拆成可检查的中间字段。
2. 宏观、中观、微观分开控制。
3. 同类效果采用低强度多次复合。
4. 颜色由数据字段和遮罩驱动。
5. 几何、颜色、粗糙度、法线和环境遮蔽共享同一事件字段。
6. 所有随机层拥有独立种子并保持确定性。

## 最小使用方式

把 `field_reference.js` 作为算法词典，把 `field_graph_recipes.json` 作为图谱模板，把 `field_contract.schema.json` 作为数据合同。

实际项目可以使用任意语言和渲染器重新实现。
