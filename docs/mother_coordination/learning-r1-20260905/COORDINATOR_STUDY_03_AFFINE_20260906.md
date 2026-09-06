# 小妈自学03：先前测试的适用条件与仿射反例

执行日期：2026-09-06。记录类型：coordinator_current_turn_study。此处新增试验在用户本次询问后的当前执行回合完成，不能称为昨夜无人值守研究成果。没有修改生产代码、真值、各线资产或人工接受状态。

## 时间与自动化核查

开始检查时，小妈协调分支 HEAD 仍为 6e4154c07ce149c6bfb5ff51421940f4cd517a3c，最后保存的是2026-09-05的 COORDINATOR_STUDY_02.md。此前坐标试验、参数顺序反例和缓存试验是既有成果，不重复计为新成果。

本轮通过 Make 读取连接环境及其两个团队的全部可见场景列表。私有空间只有三项：Landscape Provider capability probe、Landscape Executor and deadline probe、Brick Candidate engineer；三者均为 inactive、on-demand。标准团队列表为空。未发现小妈自动学习场景。此查询只证明当前可见配置；没有读取全部历史运行，不能推断这些手动任务过去从未执行。本轮没有启动、重建或修改任何 Make 场景，也不声称已确认昨夜持续学习。

用户给出的三个外部分享链接均未取得正文或视频。浏览读取及直接公开页面请求都失败；不猜内容、不把链接标题或算法作推断，不在公共记录保存分享令牌。

## 本轮实际读取的回执更新

检查了总控 Issue 62、guilin-dem-pipeline Issue 61、HOUSE Issue 16、AIRCRAFT Issue 15。以下是已观察到的新阶段，范围限于本轮读到的回执；没有重新审计全部生产分支。

Tiles：已从书面答卷推进到V0.9.9三维候选。读取3679d88d86493a1c3c756b0d20f2a6e048dd26ad下 tiles-mother/v099/DELIVERY_STATUS.md，确认记录中包含形体、材质隔离、A/B/C对照和几何变化后接触重算。报告记录270组几何与15个浏览器案例通过，但软件WebGL性能门槛失败、公网浏览器回读失败。小妈本轮只读取报告，没有独立复跑，因此不授予性能、公开部署或人工视觉通过。
来源：https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5551141149

B24：实际回执5552597082记录新分支feature/b24-native-distillation-r1及V018候选。原回执明确把8,917,196到4,061,477字节的载荷变化、原始数值保持验证，与尚未完成的完整曲面配方分开；桨叶截面候选未通过自定误差门槛，未替换生产几何。小妈本轮读取了完整回执，未独立重跑其几何、动作或公网测试。当前生产定位必须依据本线最新授权与记录，不能回用旧分支推定。
来源：https://github.com/haihao0307/AIRCRAFT/issues/15#issuecomment-5552597082

Landscape：回执5550919113将目标更新为用户指定的“葡萄峰丛区域样板区”，并明确不再默认沿用每座峰脚完全分离等旧准备条件。不得从名称推定所有峰脚都连接或补造共同基座；本轮没有完成样板视觉审查。
来源：https://github.com/haihao0307/guilin-dem-pipeline/issues/61#issuecomment-5550919113

HOUSE另见Brick的R1-A/R1-B答卷；这是收到答卷，尚不构成本轮小妈理解复核通过。此前House的有限实现和Tiles初审保留。没有把留言总数当Mother数量，没有代替其他执行者签字。

## 新问题

先前 COORDINATOR_STUDY_01 的坐标试验仅覆盖平移和旋转。本次检查：把同一处理公式套到非均匀缩放、镜像是否仍成立？法线能否无条件当普通方向向量变换？

本轮读取Three.js官方英文Matrix3文档，getNormalMatrix明确使用4x4变换左上3x3部分的逆转置；invert同时说明零行列式不可逆。另重新核读SideFX复制属性和TOP执行文档，确认属性语义及缓存依赖的具体上下文。本轮没有运行Three.js、Houdini、Blender、UE或Gaea，只在Python中检查数学关系。

原始来源：
https://threejs.org/docs/pages/Matrix3.html#getNormalMatrix
https://www.sidefx.com/docs/houdini/copy/instanceattrs.html
https://www.sidefx.com/docs/houdini/tops/cooking.html

## 试验定义与结果

使用64个固定种子抽象三维点、两个独立切向量及其叉积法线。依次检查恒等、平移、旋转、非均匀缩放、旋转加非均匀缩放、镜像加非均匀缩放六组可逆变换，另对一个精确奇异的变换在求逆前拒绝。

列向量约定为p=Aq+t。恢复局部点应使用A的逆；代码使用行存储，因此对应右乘inv(A).T。法线使用inv(A).T乘原法线后归一化。故意错误的两条路线分别把刚体专用的恢复公式直接套到A，以及把法线直接按A变换。

结果：六组正确坐标恢复与法线垂直检查均通过1e-12阈值，最大坐标误差6.38378239159465e-16，最大法线垂直误差8.890951067639307e-17。两个故意错误的公式各在三组包含非均匀缩放的样本中被检出，在前三组刚体样本中均没有暴露错误。

镜像组的变换后切向量叉积，与逆转置法线的点积为-1，标示顶点绕序方向反转。该结果要求实际渲染/导出链核对绕序、剔除和法线语义，不能据此全局盲目翻转所有法线。

Python 3.13.5，NumPy 2.3.5。全部点和坐标为无物理单位的抽象数据；1e-12为本次float64数学比较阈值，不是地形真值、木构施工容差或GPU精度标准。精确奇异矩阵只检查了零行列式，未研究近奇异条件数和稳定求逆。未测真实木材、几何变形、GPU、跨引擎、当前产品性能；不授权任何生产线缩放固定骨架或改权威资产。

## 对学习体系的改进建议

技能卡必须带“已验证的变换/输入范围”。刚体测试通过不能推定非均匀缩放或镜像通过，静态通过也不能推定时间演化通过。验收样本应覆盖能打破原公式前提的输入。当前加入的是一个可复现反例，尚未发现或修复任何生产源码中的具体同类错误。

进一步的候选组织方法：分别保存对象自身属性、与其他对象的关系、当前环境输入、累积历史、生成实现与验证证据。输入变化先查受影响的关系与证据，避免全局重建或继续沿用过期结果。这个组织方法仍需在实际项目上证明收益。

## 本轮执行源码

```python
import math, json, sys
import numpy as np

rng = np.random.default_rng(20260906)
q = rng.uniform(-1.0, 1.0, (64,3))
u = np.array([1., 1., .2])
v = np.array([-.3, 1., 1.1])
normal = np.cross(u, v); normal /= np.linalg.norm(normal)
theta = math.radians(37)
R = np.array([[math.cos(theta), -math.sin(theta),0.],
              [math.sin(theta), math.cos(theta),0.], [0.,0.,1.]])
D = np.diag([2.0, .5, 1.3])
F = np.diag([-2.0, .5, 1.3])
t = np.array([.37, -.21, .13])
cases = [
    ('identity', np.eye(3), np.zeros(3)),
    ('translation', np.eye(3), t),
    ('rotation', R, t),
    ('nonuniform_scale', D, t),
    ('rotation_and_nonuniform_scale', R@D, t),
    ('reflection_and_nonuniform_scale', R@F, t)
]
rows = []
for name, A, shift in cases:
    p = q @ A.T + shift
    recovered = (p-shift) @ np.linalg.inv(A).T
    rigid_only_recovery = (p-shift) @ A
    nw = np.linalg.inv(A).T @ normal; nw /= np.linalg.norm(nw)
    bad_nw = A @ normal; bad_nw /= np.linalg.norm(bad_nw)
    tangents = [A@u, A@v]
    normalized_tangents = [x/np.linalg.norm(x) for x in tangents]
    face_nw = np.cross(*tangents); face_nw /= np.linalg.norm(face_nw)
    row = {
        'case': name, 'determinant': float(np.linalg.det(A)),
        'correct_local_recovery_error': float(np.abs(recovered-q).max()),
        'rigid_only_recovery_error': float(np.abs(rigid_only_recovery-q).max()),
        'correct_normal_orthogonality_error': max(abs(float(nw @ x)) for x in normalized_tangents),
        'ordinary_vector_normal_error': max(abs(float(bad_nw @ x)) for x in normalized_tangents),
        'normal_vs_transformed_winding_dot': float(nw @ face_nw),
    }
    assert row['correct_local_recovery_error'] < 1e-12
    assert row['correct_normal_orthogonality_error'] < 1e-12
    assert abs(row['normal_vs_transformed_winding_dot'] - np.sign(row['determinant'])) < 1e-12
    rows.append(row)
singular = np.diag([1., 0., 1.])
assert np.linalg.det(singular) == 0
result = {
    'executed_in_current_turn': True,
    'execution_date': '2026-09-06',
    'python_version': sys.version.split()[0],
    'numpy_version': np.__version__,
    'points_per_case': 64,
    'invertible_cases': len(rows),
    'singular_case_rejected_before_inverse': True,
    'wrong_rigid_formula_detected_cases': sum(r['rigid_only_recovery_error'] > 1e-12 for r in rows),
    'wrong_normal_formula_detected_cases': sum(r['ordinary_vector_normal_error'] > 1e-12 for r in rows),
    'reflection_winding_reversal_cases': sum(r['normal_vs_transformed_winding_dot'] < 0 for r in rows),
    'max_correct_local_error': max(r['correct_local_recovery_error'] for r in rows),
    'max_correct_normal_error': max(r['correct_normal_orthogonality_error'] for r in rows),
    'rows': rows
}
print(json.dumps(result, ensure_ascii=False, indent=2))
```
