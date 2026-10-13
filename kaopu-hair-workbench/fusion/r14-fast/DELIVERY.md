# R14.2-L02 原质量快启：公网验证完成

https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/fusion/r14-l02-7c1072ee121d/

实现源码：7c1072ee121d73d74cba5382b292faf20aa8261b；包含完整候选证据的构建：8e97c8eef6923d81c1d7c632a2114d8cc89ae5d6；Pages发布：764a52d8c02b514181c4a931855922a10296f845。

入口49,126字节，首开必要资源5,741,226字节，合计5,790,352字节；原L01入口21,035,459字节，首开必要载荷减少约72.47%。不能将49KB入口误称整个应用49KB。

控制对照（5Mbps/80ms，Chromium140/SwiftShader，同一原对照任务）：旧L01整页下载屏障复现首次绘制34.056秒，新版0.144秒；全质量就绪100.214秒→68.9477秒。该旧版为受控传输重放，不是用户网络抓包；软件渲染秒数不是用户电脑承诺。

原生公网实测：{
  "newCold": {
    "version": "R14.2-L02",
    "source": "7c1072ee121d73d74cba5382b292faf20aa8261b",
    "shellMs": 179.5,
    "networkBytes": 5741226,
    "cacheBytes": 0,
    "cacheHits": 0,
    "retries": 0,
    "cacheWarnings": [],
    "phase": "original-groom",
    "firstPaintMs": 276,
    "fullyRenderedMs": 68416.8,
    "assetsReadyMs": 9454.099999999991
  },
  "newColdBuildMs": 20003.800000000017,
  "newWarm": {
    "version": "R14.2-L02",
    "source": "7c1072ee121d73d74cba5382b292faf20aa8261b",
    "shellMs": 49222.80000000005,
    "networkBytes": 0,
    "cacheBytes": 5741226,
    "cacheHits": 15,
    "retries": 0,
    "cacheWarnings": [],
    "phase": "original-groom",
    "firstPaintMs": 49240,
    "fullyRenderedMs": 106900.30000000005,
    "assetsReadyMs": 49360.5
  }
}

质量：49项原运行/材质/图像文件逐字节一致；6张PNG字节及分辨率不降；三种预设完整9类数组每套60,153,348字节SHA与原版一致，三个顶视画面在同一对照环境差异像素通道均为0；自定义117mm/冠部51/起根11完整数组也一致。桌面64k潜在发根、24段、201,117,248字节几何缓冲与原值相同。4,000组精确导向查找和原模型重组/非零基底参数测试通过。

40项候选汇总检查和17项原生公网检查通过。先前任务24项质量通过后撞到默认30秒刷新导航等待，失败证据保留；相同HTML及资源逐字节确认后，剩余冷/热缓存、缓存损坏+503、完整原基底按需恢复、手机视口在新任务完成。发布脚本的稀疏检出阻碍已用相同Git树追加发布解决，旧页面零改动。

边界：缓存未被浏览器清除时复用全部15个启动块；损坏只重读对应块，缓存不可用仍使用原质量网络数据。初次联网、CPU创建和GPU初始化仍需时间，多开重型3D页面仍有显存压力。原冠部视觉缺陷未改；手机390×844仅视口，不是实机。新原生站点与旧htmlpreview存储来源不同，旧存档仍在旧入口，需要JSON导出导入。PR233保持Draft，未合并、未强推。
