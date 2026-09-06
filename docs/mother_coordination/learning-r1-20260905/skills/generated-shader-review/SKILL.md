---
name: generated-shader-review
description: 将文字生成的着色器候选转成有输入约定、规范检查、运行验证与应用边界的可复用技能。
---

# 小妈自学04：ShaderGPT 与生成着色器验收

日期：2026-09-06。用户提供 shadergpt.14islands.com，沿既有学习授权作只读研究与技能整理。本轮未调用第三方AI生成服务，未发送用户代码、照片或生产数据，未修改生产线、原交接包、真值或人工接受状态。

## 已读内容与来源

S1 https://shadergpt.14islands.com/
本轮读取首页文本、公开示例GLSL、时间/鼠标/分辨率输入、收藏/历史/探索入口和复制代码按钮。首页是动态资源，以下发现只指本次取得的示例，不能概括所有输出。

S2 https://www.14islands.com/journal/ai-generated-glsl-shaders
直接读取作者2025-02-28的实验说明。作者说明该原型把文字转成GLSL片元着色器并用WebGL实时展示，使用Next.js和Vercel AI SDK；记录了语法、审美判断和成本方面的局限。该文章的模型比较属于当时实验，未作为2026年排名。调整system prompt也未被解释为已经训练模型权重。

S3 https://www.14islands.com/journal/does-vibe-coding-work
直接读取2025-03-19的作者复盘。涉及生成Explore页面后的审查、修复、撤销多余改动和迭代。这是开发者个案经验，未当作普遍性能或质量数据。

S4 https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/es3/html/smoothstep.xhtml
通过GitHub连接读取Khronos官方OpenGL ES参考页。registry同页的网页读取接口不支持其XHTML响应，改读官方源文件。Description规定edge0 >= edge1时结果未定义。

S5 https://threejs.org/docs/pages/ShaderMaterial.html
直接读取官方说明：GLSL ShaderMaterial用于WebGLRenderer，uniform名称与值必须按约定传入。不能把原GLSL当作WebGPURenderer直接兼容的材料。

S6 https://dev.epicgames.com/documentation/unreal-engine/custom-material-expressions-in-unreal-engine
读取官方Custom Material Expressions说明。UE自定义表达式使用HLSL；迁移需要重建输入和输出约定，并检查开销，不能直接粘贴完整GLSL片元程序。

没有取得或审计站点完整后端、完整系统提示或全部示例许可。公开可读和Copy code按钮不足以证明整个站点源代码开放或所有示例可无条件再分发。本记录只保留定位所需的一行样例，自写验证公式。

## 一项已核实的规范问题

本次首页样例出现：

```glsl
smoothstep(0.5, 0.0, mouseDist)
```

根据S4，此处边界顺序不满足该内置函数的定义条件。它可能在某些实现上呈现作者期望的图案，但一次能编译或显示不能提供跨实现保证。尚未观测该站在任何具体GPU上的故障。

若意图为距离从0增到0.5时权重平滑地由1降到0，可使用有序边界后再取反：

```glsl
1.0 - smoothstep(0.0, 0.5, mouseDist)
```

这是为明确目标重新定义的公式，不宣称与未定义表达式在所有设备上数值等价。做成可调函数时，调用端先保证inner < outer；零宽、反向区间及NaN另按合同拒绝或处理，不能靠任意小常数隐藏问题。

## 技能提炼

把自然语言当作候选生成入口，随后明确输入语义、审核代码、验证实际输出，再讨论复用。源软件、语言和版本保留在来源层；数学关系与检查办法可以跨线学习，但具体代码与参数需匹配运行时。

输入至少声明：目标效果及参照、局部/世界/屏幕/UV坐标、时间单位、鼠标归一化规则、图像分辨率与宽高比、输入纹理语义、seed、颜色空间、可调范围和运行成本约束。输出分别标记颜色、粗糙度、法线、密度或几何位移；画面颜色不能直接当物理状态。

建议工作顺序：先写可观测预测与输入合同；检查未定义运算、除零、非法归一化、依赖的include和采样纹理；在固定参数下测试边界值；编译并检查多时刻、不同宽高比和鼠标位置；记录GPU/运行时及性能；在实际三维对象上做对照；保留来源、原版本、失败例和回滚路径。每一步只登记实际完成范围。

首页示例使用了颜色输出include，这表明至少该示例依赖宿主预处理/着色器块上下文。不能假定单独拷贝即可在所有宿主编译。多个噪声层或raymarch步数应有明确预算；不用图像贴图也可能有较高逐像素计算成本，不能据代码短或无下载纹理推定适合手机。

完整生成服务、编译错误自动修复、视觉反馈到模型的闭环是否存在，本轮未验证。我们提出的检查流程是自建候选方法，不声称该网站已实现全部流程。

## 分层应用建议

Brick/Tiles/House：优先学分层噪声、遮罩、色差和粗糙度的独立控制。先在已有三维件上比较，不改已认可的照明和几何。苔藓厚度、破损轮廓和支承缺陷不能仅靠颜色遮罩判定修好。

Weather/Ocean：学习扰动、边缘衰减和外观动画的参数组织。烟雾、泡沫的像素表现与真实密度、流动、浮力、碰撞分别验收。没有求解器或测量依据时只记视觉近似。

Landscape：可用于表面层和候选显示函数；主形、洞穴、尺度与真实DEM边界继续按本线合同，不用漂亮shader掩盖错误几何。

Houdini、Blender、UE：吸收通用函数和输入输出关系；分别实现为目标环境认可的节点或代码，独立验证。原GLSL不自动成为各环境的已测试插件。无需所有Mother放弃现有任务或统一换工具。

## 本轮实测与未完成项

已执行Python标量检查：7个解析对照值全部符合预期；201个采样点落在[0,1]且非增；调用端显式拒绝反向区间、零宽区间和NaN三类输入。这只检查下面的数学函数及调用约束，未运行GLSL。

另尝试了两种Chromium启动配置运行自写1像素WebGL2探针，均在创建上下文时返回WebGL2 unavailable，尚未进入着色器编译。故GLSL执行、站点实时预览、GPU差异、手机真机和性能均未验证。没有把CPU数学通过记成着色器或产品通过。

```json
{
  "source_review": "completed_for_listed_scope",
  "finding": "one_observed_example_uses_undefined_smoothstep_edges",
  "math_reference_cases_passed": 7,
  "math_monotonicity_samples": 201,
  "invalid_input_classes_rejected": 3,
  "webgl_probe_attempts": 2,
  "webgl_execution": "blocked_before_compilation",
  "blocker": "WebGL2 unavailable",
  "shadergpt_generation_called": false,
  "mother_product_tests": "not_run",
  "production_adoption": "not_approved"
}
```

可复现的标量检查代码如下，仅用Python标准库：

```python
import math

def decreasing_mask(inner, outer, distance):
    if not all(math.isfinite(x) for x in (inner, outer, distance)):
        raise ValueError('All inputs must be finite.')
    if inner >= outer:
        raise ValueError('Require inner < outer.')
    t = min(1.0, max(0.0, (distance-inner)/(outer-inner)))
    return 1.0-t*t*(3.0-2.0*t)

cases = [(-.1,1.),(0.,1.),(.125,.84375),(.25,.5),
         (.375,.15625),(.5,0.),(.6,0.)]
for distance, expected in cases:
    assert math.isclose(decreasing_mask(0.,.5,distance), expected, abs_tol=1e-12)
values = [decreasing_mask(0.,.5,-.1+.7*i/200) for i in range(201)]
assert all(0. <= value <= 1. for value in values)
assert all(a >= b for a,b in zip(values,values[1:]))
rejected = 0
for args in ((.5,0.,.25),(.5,.5,.25),(0.,.5,float('nan'))):
    try:
        decreasing_mask(*args)
    except ValueError:
        rejected += 1
    else:
        raise AssertionError('Invalid inputs must be rejected.')
assert rejected == 3
print({'reference_cases':len(cases),'samples':len(values),'rejected':rejected})
```

## 下一步核验问题

实际执行者使用这条技能时，说明所选效果的坐标附着、输出通道和合法输入范围；给一个有效例、一个打破假设的反例；报告真实宿主的编译与多时刻输出。比较时维持已有相机/灯光和结构基线。只在具体原任务需要时领取，不因资料到达就启动无关重构。

本次有价值的新增是把可生成代码与规范可移植性、运行效果和物理正确性分别检查。新技能卡存在不等于执行端已读；同学互审和生产接入等待真实记录。本轮没有重新核对各Mother的最新进度，也没有启用后台巡查。
