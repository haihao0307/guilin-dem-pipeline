# 03 · 已批准架构

## 同一 Cloud Object

正式数据关系：

```text
Cloud Object DNA
  ├─ genus
  ├─ cloudSeed
  ├─ detailSeed
  ├─ CloudEnvelope
  ├─ Density / State
  ├─ Detail Bands
  ├─ Transport State
  └─ Optics

Observers
  ├─ 观云
  ├─ 地面观察
  ├─ 飞机远景
  ├─ 云缘
  ├─ 云内
  └─ 穿云后
```

观察者只改变采样位置、光程和可见频带，不能替换云对象。

## 银边

银边由同一云密度场、湿润低密度肩部、太阳方向、相函数和光学厚度产生。太阳或观察方向改变时，银边应沿同一朵云连续移动。不得恢复独立 silver genus。

## YOHEI 方法边界

可继承：相关三角频带、频率递增/振幅递减、稳定低频前缀、log-spherical/domain transform、按观察距离展开频带。

不可继承：可识别原构图、固定常数组合、默认色调和太阳角、把 YOHEI 场直接当气象真值或 Cloud identity。

## 种子

- `cloudSeed`：大形、空洞、云瓣、塔体、层断口和不对称。
- `detailSeed`：局部侵蚀、湿边、丝状和高频褶皱。

两者均为可保存、可复现的整数，不随镜头、帧或设备变化。更换 detailSeed 不得破坏大轮廓。

## 性能与启动

近距读取完整频带，远距只读稳定低频前缀；不重新归一化、不换种子、不换对象。启动先显示天空和低频云，再分片启用高频、light cache 和 history。任何高级路径失败时保留 cloud-first 可见结果。
