# 程序化地貌生产线基础实现 v0.2 交接

## 远端身份

```text
repository: haihao0307/guilin-dem-pipeline
branch: skill/dem-procedural-landscape-v010
Draft PR: 51
controller alias: 小华
contract commit: 6064a9ad3374221d3726c67d77a827a4b5a068e0
foundation commit: 020e105f334f6b794fad6333d23d3249c78c1e5f
browser fix commit: a6c591b0cb5e3b520bfd3d2105db65ba851592f7
```

## 本轮完成

```text
程序化地貌生产纲领
桂林参考、地形地貌、水体、生态农业、历史重建、运行时发布六条分支
4 份 Draft 2020-12 JSON Schema
无外部依赖的 fail-closed validator
8 个故障夹具单元测试
桂林、温州、昆明 v0.2 项目绑定
统一状态网页
桌面与 390 × 844 Chromium QA
GitHub Actions 合同和浏览器工作流
远端 CI 证据 manifest
```

## 远端 Actions 证据

```text
workflow: Procedural landscape v0.2 foundation QA
run: 32933500293
conclusion: success

contract job:
id: 98070189072
validator errors: 0
validator warnings: 0
project bindings: 3
registered branches: 6
unit tests: 8 passed

browser job:
id: 98070222626
desktop 1440 × 1000: passed
mobile 390 × 844: passed
branch cards: 6
project cards: 3
console errors: 0
page errors: 0
failed requests: 0
```

浏览器 artifact ID 为 `9594041753`，artifact digest 为
`sha256:a39309bd8cdf1b6b40d9b2043bc9e1c6e3c43294d4b952dc09c758b0ea0cc03e`。
合同 artifact ID 为 `9594022183`，artifact digest 为
`sha256:dd06ecf29ea60fdd223f6c4f6cf14d07c4c5fee01f80ee308999b0ca21cad2a5`。

首轮浏览器作业暴露 `/favicon.ico` 404。修复提交加入实体 favicon，并将失败证据上传改为
`if: always()`。修复后的桌面和移动作业均已成功。

## 真值保护

```text
权威 DEM 修改: 0
海底数据修改: 0
潮汐数据修改: 0
水系、道路、聚落、机场和历史真值修改: 0
30 m 最终回退: 0
合成缺口填充: 0
公开发布: false
PR 状态: Draft
```

## 项目状态

### 桂林

保留 10 km² v0.3.1 方法和视觉回归。真实 12.5 m DEM 尚未挂载。竹类实例
`2152` 与 `2256` 的记录保留为待解释差异。已有两个参考入口，继续作为方法与
GAEA 视觉证明，不传播代理高程。

### 温州

陆地真值 SHA256 固定为
`8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e`。
GEBCO 2026 Stage A QA 已通过，陆地修改像元为 0。FES2022b、验潮站对照、
垂直基准、湿润干出和浏览器运行时继续在 Draft PR #49。

### 昆明

源 COG SHA256 固定为
`af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50`。
权威源 DEM 未挂载，5892 × 8095 无压缩像元一致裁剪主文件尚未生成。
地貌、水文、GAEA、1 m 历史增强和网页阶段保持锁定。

## 下一阶段 v0.3

```text
01 为 truth、derived、historical-delta、procedural-delta 和 visual-delta 建立样例
02 增加坡度、坡向、曲率、汇流、湿度、河距和地貌单元 manifest
03 增加父级掩膜、最大增量、回滚值和真值校验和的编译门槛
04 从温州沿海真实实现接入第一组只读图层状态
05 建立受保护的统一状态网页候选
06 保持 PR #51 open、Draft，等待用户视觉批准
```
