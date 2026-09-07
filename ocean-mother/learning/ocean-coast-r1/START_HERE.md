# Ocean Mother Ocean Coast R1 学习接入入口

日期：2026年9月7日。

本目录把小妈在 2026年9月6日至7日整理的海洋、近岸、材质光学、连续浓烟、时间语义和观察带宽经验，接入 Ocean Mother 的独立学习层。当前生产运行时、冻结深海、岛体、沙滩、石头、火焰、烟雾、构图、镜头和公开部署均保持原样。

## 固定来源

Ocean 全量重启包：V0.3.11，归档提交 `7b6bba5f9affb9cfcfea5dabfafa5e7931bb492d`，运行 HTML SHA256 为 `2c689e15c1be7dfd4cd14c83ad3353e63868baee006cd04f3aee3a5f653842e3`。

Ocean 接续基线：分支 `work/ocean-mother-r01812-depth-materials-20260905`，提交 `6f07e94069ad4833eda6204ec0d5cd45f8ebf5a4`。

小妈知识基线：分支 `handoff/xiaoma-mentor-v1.1-20260905`，提交 `b49112dc39b4904d225aac5b921e9a6f060e4c97`。

小妈 Ocean 专包：`docs/mother_coordination/world_knowledge_lab_v1/mother_packages/ocean-coast-r1/`。

## 阅读顺序

1. `CURRENT_IMPLEMENTATION_AUDIT.md`
2. `OCEAN_MOTHER_SKILL.md`
3. `TESTS_AND_GATES.md`
4. `ADOPTION.json`
5. `reference-kernels.mjs`
6. `TEST_RESULTS.txt`

## 复跑参考内核

在仓库根目录执行：

```bash
node ocean-mother/learning/ocean-coast-r1/test-kernels.mjs
```

当前 24 项隔离 JavaScript 检查通过。它们只验证参数曲面、水平位移反求、同源法线与速度、潮位与水深关系、均匀介质束透射。它们没有运行 R018.11 着色器、浏览器、GPU、岸浪、烟雾、浮力或碰撞。

## 第一项运行时接入

固定现有 `breaker` 镜头和一块小海面。保留当前海浪参数、岛形、光照、烟火和相机。先给当前近岸水面建立可测试的 `sampleSurfaceWorld(x,z,t,recipeVersion)` 接口，并逐点比较可见命中位置、法线和查询结果。当前近岸波没有水平位移，第一轮应从直接世界查询开始。以后引入水平位移时，再启用本目录的反求路径和误差门禁。

## 状态

`knowledgeAdopted=true`

`referenceKernelsImplemented=true`

`runtimeIntegrated=false`

`browserGPUValidated=false`

`visualAcceptance=false`

`productionReady=false`
