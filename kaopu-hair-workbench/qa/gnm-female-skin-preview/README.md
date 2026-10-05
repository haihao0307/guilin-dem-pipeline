# GNM 女性研究头

独立的女性交互候选，基于官方 GNM FEMALE 语义条件生成。它不是 TEN24 原扫描，也不是对男头仅换肤色。此候选未替换现有人物入口。

## 已完成

- 原始官方 GNM 形状数据和语义采样器逐文件 SHA-256 验证
- 固定默认身份：female、种子 20261005、sigma 0.6；四个训练数据类别等权混合，仅作为合成形状参数，不代表真人背景
- 17,821 模型顶点、35,324 三角面，253 身份与 383 表情参数；相对男性条件均值，17,821 个顶点全部改变
- 发根保持官方 GNM 相同拓扑上的三角面 ID 与重心权重，并在真实当前女头顶点和法线处求值
- 全量 14,000 头发及 1,000 眉毛的发根/法线偏移数值检查通过
- 女性中性、微笑、惊讶、另一女性身份的实际皮肤/眼球网格中心线碰撞已复测；局部颈部末端和实际触发的发干修正不移动发根、不重新随机发束。有限半径接触和视觉验收仍分开进行
- 官方材质 ID 区分眼白、虹膜、瞳孔、牙齿和口腔，不再把全部组件涂为同一灰泥色；它不是照片级眼睛材质
- 保留 R8 毛发材质和分层投影模块的原始字节，不承诺不同头形得到相同像素
- 继承手动／自动旋转、100–600%缩放、正侧背视角、冷暖灯、发型及眉毛控制
- 表情切换和重置保留女性身份；第二身份按钮生成另一个明确标记的女性候选

## 尚未验收

- 浏览器执行、真实像素、移动布局和交互尚待现有 QA 路线验证；不能把脚本语法检查当成浏览器通过
- 皮肤目前是无纹理几何研究材质。使用官方 GNM UV 与获准纹理的皮肤层仍需接入和验证
- 全部发丝与眼、耳、脸、颈部的最终接触验收未通过；既有局部防穿处理不构成全面无穿模保证
- 实体手机性能未测试；不承诺实时帧率

## 验证与文件

`tests/female-browser.cjs` 是给已有 Playwright/Chromium QA runner 使用的 helper，支持 core/catalog/orbit/touch 组和 file/public 加载；不更改工作流或权限。

上一级 `candidate-evidence.json`、`female-binding-evidence.json` 和 `renderer-provenance.json` 记录实际数据生成、根绑定和渲染模块字节证据。

## 来源及许可

- GNM: https://github.com/google/GNM/tree/940c36b850d951f14203e751463bc9b422900fad
- 官方语义示例: https://github.com/google/GNM/blob/main/gnm/shape/README.md
- 已固定的浏览器数据: https://github.com/xrblocks/assets-gnm/tree/134feb02b11fa642a43ff5e7e880246255a74e86
- GNM 使用 Apache 2.0，完整许可包含舌头网格的 Salvador Medina MIT 通知；见 licenses/GNM-LICENSE.txt
- Three.js 使用 MIT；原老师毛发数据使用其来源所载 CC BY-SA，来源与修改记录见 TEACHER-GROOM-PROVENANCE.json

此目录不包含任何 TEN24 网格、贴图或派生数据。GNM 模型数据从固定的官方来源加载；离线 QA 包嵌入相同可分发字节。
