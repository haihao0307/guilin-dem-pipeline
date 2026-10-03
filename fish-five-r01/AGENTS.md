# 鱼类的制谱师：制作入口

本目录沿用仓库根 AGENTS.md 的门禁。不要抢用户鼠标，浏览器检查使用后台 headless。

开始任何鱼类制作或修改时，先调用实际工位入口，不依赖聊天记忆：

`node scripts/production-stage-r09.mjs --fish <source-id> --stage <stage-id>`

工位：identity → surface → spine / fins → cranial → behavior → verify。只读取当前工位返回的规则、公式、源差异、未知和回归检查；不要把所有物种压成同一骨架或一组参数。

新鱼使用 `--create <new-id> --out <card.json>` 建立未确认卡，然后 `--card <card.json> --stage <stage-id>`。填入原文件测量、身份依据、许可、源哈希和验证，不从名字推物种、不自动继承验收。新母型未覆盖时保持 HOLD_LOCAL，其他可测工位继续。

共性规则唯一执行源：`src/production-knowledge-r09.js`；差异/证据源：`data/production-cards-r09.json`。修改某结构时同时维护规则、对应数学函数 ownership 与回归检查；运行 `node scripts/verify-production-r09.mjs`。知识变更须通过构建预检，不允许仅追加一份无人使用的笔记。

保持源完整表面、UV、拓扑和原像素；中心脊椎负责身体，局部鳍权重不招募身体；未确认口鳃保留原姿态。工程参数不等于生物实测，工位可制作不等于视觉接受或发布通过。

交付要求：真实生产源码修改、可交互实时三维、没有生成图片替代；当前版本独立验证及公网回读成功后，才分享统一工作台入口。只有截图或文档不构成三维交付。
