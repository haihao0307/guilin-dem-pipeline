# 程序化地貌生产线下一对话交接包

```text
owner alias: 小华
repository: haihao0307/guilin-dem-pipeline
branch: skill/dem-procedural-landscape-v010
PR: 51
handoff baseline head: 9b99b1f4b9514d3c2a60a024d0038d0cab85d336
```

## 使用方法

1. 下载同目录中的公开交接 ZIP。
2. 新开对话后上传 ZIP。
3. 发送 `docs/05_NEXT_CHAT_PROMPT.txt`。
4. 新对话先核对远端最新 HEAD，再从最新 HEAD 正常快进。

## 当前视觉结论

现有桂林蒸馏示范区已经封存为失败视觉基线。用户确认画面仍呈现宽缓棕色土山，典型阳朔漓江塔状峰林、峰脚、贴水崖壁、沿江平地和稻田关系没有真正形成。

## 下一阶段

先在阳朔漓江沿线提出 2 至 4 个真实候选片区。用户确认片区后，再建立 `z_macro_delta_m` 与 `z_micro_delta_m`，重做漓江、峰体、峰脚、崖壁、河岸、滩地、稻田田块和灌排关系。

原三地区工作台框架继续保留。新版本仍在同一工作台中提供可直接打开的 HTML 页面。

## 权限边界

公开包排除了用户提供的 18 张原始参考照片。公开仓库继续保存来源收据、哈希、逐图观察和蒸馏规则。
