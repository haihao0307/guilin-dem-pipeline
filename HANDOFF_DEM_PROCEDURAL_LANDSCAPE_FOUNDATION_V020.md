# 程序化地貌生产线基础实现 v0.2 交接

## 远端起点

```text
repository: haihao0307/guilin-dem-pipeline
branch: skill/dem-procedural-landscape-v010
Draft PR: 51
starting head: 6064a9ad3374221d3726c67d77a827a4b5a068e0
```

## 本轮实现

```text
4 份 JSON Schema
无外部依赖的 fail-closed validator
8 个故障夹具单元测试
桂林、温州、昆明 v0.2 项目绑定
程序化地貌生产线统一状态网页
桌面与 390 × 844 Chromium QA 脚本
GitHub Actions 合同与浏览器工作流
本地 QA manifest
```

## 已通过的本地证据

```text
validator:
passed=true
errors=0
warnings=0
projectBindings=3
registeredBranches=6

unit tests:
8 passed
0 failed

JSON Schema:
4 schemas passed Draft 2020-12 check
registry passed
3 project bindings passed
```

## 浏览器状态

当前执行环境中的 Chromium 对 localhost 和 file URL 返回
`ERR_BLOCKED_BY_ADMINISTRATOR`。本轮没有把该次尝试记录为浏览器通过。

`.github/workflows/procedural-landscape-v020.yml` 已配置真实 Chromium 作业，
要求桌面 1440 × 1000、移动 390 × 844、控制台错误为 0，并上传截图与
`report.json`。远端 Actions 结果需要在提交后重新核对。

## 真值保护

```text
权威 DEM 修改: 0
海底数据修改: 0
潮汐数据修改: 0
水系、道路、聚落、机场和历史真值修改: 0
公开发布: false
PR 状态: Draft
```

## 项目状态

### 桂林

保留 10 km² v0.3.1 方法和视觉回归。真实 12.5 m DEM 尚未挂载。竹类实例
2152 与 2256 的记录保留为待解释差异。

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

## 下一步

1. 核对远端 Actions 的合同与浏览器作业。
2. 将截图、控制台和报告结果写回状态 manifest。
3. 补齐分支级 layer manifest 示例和 validator。
4. 建立统一网页候选的受保护部署流程。
5. 保持 PR #51 为 open、Draft，等待用户视觉审阅。
