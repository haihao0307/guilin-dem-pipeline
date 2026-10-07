# 珊瑚网格生长研究代码：未通过形态验收

用户已明确否决先前 R02 单杯的视觉结果：它不符合参考中的多主枝、折返层片与繁密冠部。R02 保留作诊断锚点，不能视为完成用户目标。

当前 R03 是独立实现的研究检查点，尚未达到参考视频的薄密嵌套卷层，不是新网页成品；不得据此更新公开母台入口。

学习来源：
- Junichiro Horikawa 的 HoudiniHowtos，MIT，固定版本 ebafabe0f2b3559e729b6561153e879cf7d03125。读取了 0008 Coral Growth 和 Live-0053 Differential Growth with Vellum 的实际序列化节点/参数/VEX，借鉴连续重网格及局部 restlength 增长。
- Konstantin Magnus 的公开文章和 coral_tut.hip，学习法向、光照遮挡、方向带与重网格的组合。https://procegen.konstantinmagnus.de/simulating-growth-on-meshes
- Iman Vafaei 的视频只作形态与高层方法参考。未取得或运行其付费工程，不能将本代码称作其原码移植。https://www.youtube.com/watch?v=icN9z23F1ag

运行：在安装 requirements.txt 中列出的依赖后，执行 python run_config.py example-config.json。

normal_growth.py 从低矮连通种子计算三维法向推进、当前表面的三角形光线遮挡、重网格。elastic_growth.py 增加局部边目标长度的差异增长，并在分裂/折叠中传播材料应变。triangle_collision.py 检查严格横向面相交；不覆盖共面接触，也不是完整连续碰撞检测。没有 Houdini/Vellum 求解器运行声明。

时间单位是无量纲迭代。没有预制成熟叶片、最终模型、视频播放、生长缩放、水或沙粒。当前生成物仍有尖片/偏厚、密度不足等形态问题。原有珊瑚案例不属于本检查点范围。
