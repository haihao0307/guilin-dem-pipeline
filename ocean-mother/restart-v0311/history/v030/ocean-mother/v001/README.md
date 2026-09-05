# Ocean Mother V0.1

独立海洋工作台，输入固定为 Weather Mother Clean V1.0.0。天气原件位于 weather/，全部按原始 ZIP manifest 校验；不修改共享仓库天气内核，不接入其他 DEM 或温州资产。

运行：将此目录以 HTTP/HTTPS 静态托管，打开 index.html。无需 npm、CDN、API 密钥、图片或外部模型。WebGL2 必需。

已实现：单画布海面与天空；24 个定向 Gerstner 几何波及 12 层抗混叠微波法线；解析深水色散；Fresnel 反射、太阳高光、波峰压缩泡沫外观；六个海况；独立风力、云速和海浪演示速度；天气光照同一时钟。云辐射缓存在浏览器显存由原版密度/光照函数生成，天空和海水倒影共用；未存图片素材。

适配范围：这是海面视角的远景天空环境缓存，分条生成后完整交换。近云的视差反射和穿云飞行不在本版。天气反射缓存与海浪采用不同更新频率，首次生成以及换天气需要等待云缓存。阴雨等海况只接入云形、风和光色，降雨粒子、闪电、雪粒子及彩虹未迁移到海洋画布。原完整天气工作台单独保留链接。

水色与泡沫属于图形近似。没有 FFT 海浪谱、流体求解、真实岸线、海底、潮汐、破碎浪或船舶交互。操作采样值由 UI 定义，不能作为实测天气或真实海洋地理。3A 视觉和用户显卡帧率仍待验收。

技术来源：NVIDIA GPU Gems Chapter 1 Effective Water Simulation from Physical Models；Khronos EXT_disjoint_timer_query_webgl2；用户 Weather Mother 交接包。新增海面实现为本轮代码，来源包只提供天气侧。
