# 小妈自学02：依赖完整性与旧缓存

日期：2026-09-05。类型：coordinator_study。状态：指定原文已读取，隔离Python算例已执行；生产采用未批准。本次沿用户要求继续自学，没有给其他Mother追加新任务或改写生产线。

## 本轮问题

改材质、改厚度、改环境历史时，怎样判断哪些派生结果需要重算？怎样发现看起来有缓存却使用了旧结果的问题？

## 依据与阅读边界

本轮直接读取 SideFX 官方英文 Cooking/Executing the TOP network 页的 Overview 与 Cooking 部分：
https://www.sidefx.com/docs/houdini/tops/cooking.html

文档描述了工作项的过期标记与重算，并明确提示：删除或替换中间结果文件，不一定自动使使用它的下游工作项失效。外部文件扫描与中间结果检查需分别看待。本条限于该页描述，不把它推广为所有Houdini节点、构建号和缓存模式的共同性质。本轮没有运行Houdini。

另检索到 Blender Dependency Graph 设计文档，该文开头明确属于Blender 2.8项目设计背景。搜索结果中的说明已读，直接打开返回402；未把其中架构细节当成当前Blender实现事实，也不据此新增实操能力声明：
https://developer.blender.org/docs/features/core/depsgraph/

## 本次提炼

缓存复用至少要核查当前输入、依赖关系、实现版本和结果内容是否匹配。仅确认文件存在不足以确认其适用于当前任务。输入签名也有前提：所有影响结果的依赖必须列全。漏掉一个真实依赖，签名检查可能完全发现不了变化。

对于依赖随时间演化的状态，当前天气值相同不保证历史状态相同。一个安全的状态缓存需要明确初态、历史或可信检查点、时间推进方法和参数版本。这里是团队候选方法，本次只用抽象递推算例检查历史依赖，没有建立真实风雨或材料模型。

## 实际试验

执行环境Python 3.13.5，只用标准库。五个派生节点分别为geometry、contact、moisture、surface、view_record；这些名称均代表抽象标量或字典，未生成真实网格和画面。所有修改发生在两次求值之间，不涉及并发。

每项缓存记录输入与上游签名、手动维护的实现版本、结果值和结果内容散列。完整重算使用空缓存，数值计算函数与增量路径相同，因此本试验只检验缓存一致性，不能证明数值公式或物理模型正确。

七个正确配置用例的增量结果均与完整重算一致：

| 用例 | 实际重算节点 |
|---|---|
| 输入不变 | 无 |
| 只改外观粗糙度参数 | surface、view_record |
| 改厚度 | geometry、contact、view_record |
| 改过去降雨序列，当前降雨仍为0 | moisture、surface、view_record |
| 只改几何实现版本号 | geometry、contact、view_record |
| 篡改contact缓存值且不更新内容散列 | contact |
| 删除geometry缓存项 | geometry |

后两个用例修复后得到与原来相同的输出和签名，因此已正确缓存的下游不必再次计算。这里记录实际重算范围，没有声称这是任意系统的最小计算量或性能收益。

两个故意配置错误的反例均被完整重算对照发现：

1. 从geometry的输入声明中漏掉thickness。修改厚度后，增量路径重算0项，geometry、contact、view_record均保留错误的旧值。
2. moisture实际使用历史序列，却只把当前降雨与dt写入输入声明。替换过去历史后，增量路径重算0项，moisture、surface、view_record与完整重算不符。

抽象湿度递推在两段历史下分别得到0.19404和0.0941192，二者当前降雨值均为0。数值只是自定义递推的结果，没有观测单位、材料标定或气象真实性。本轮共9项检查，其中7项正确配置对照一致、2项故障注入被对照发现；数量不代表普遍可靠率。

## 对各线可能有用的检查

Tiles/House：修改实体厚度或装配输入时，旧接触检查应绑定到对应几何和变换版本。纯显示粗糙度实验可以尝试保留几何结果，但这需要先声明该实验没有位移、膨胀、摩擦或其他物理耦合。

Weather/材料：未来接入累积湿度或损伤时，缓存要覆盖所用历史或检查点。不能只看当前是否下雨来判断状态是否相同。

知识体系：技能卡引用的来源、适用版本或验证条件改变后，旧结论同样要重新核对。此处是工作方法类比，不等同于上述程序试验已经验证了知识管理效果。

以上均为候选检查，不改变真实DEM数据、权威资产、生产源码或人工接受状态。没有重新确认其他Mother当前进度，也没有把本次自学计作他们的答卷。

## 复现源码

以下代码为本轮实际执行源码。运行不会联网或写生产文件。

```python
"""Isolated dependency-cache exercise; no DCC or production assets are used."""
from copy import deepcopy
from hashlib import sha256
import json


def digest(value):
    data = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return sha256(data.encode("utf-8")).hexdigest()


# A deliberately synthetic recurrence, not a calibrated physical moisture model.
def moisture(history, dt):
    value = 0.0
    for rain in history:
        value = max(0.0, min(1.0, value + dt * (rain - 0.2 * value)))
    return round(value, 10)


# Already in topological order. Source keys and upstream node IDs are explicit.
SPEC = {
    "geometry": (("thickness",), ()),
    "contact": (("support",), ("geometry",)),
    "moisture": (("history", "dt"), ()),
    "surface": (("dry_roughness",), ("moisture",)),
    "view_record": ((), ("geometry", "contact", "surface")),
}
BASE = {
    "thickness": 0.02, "support": 0.98,
    "history": [0.0, 1.0, 1.0, 0.0], "current_rain": 0.0,
    "dt": 0.1, "dry_roughness": 0.7,
}


def run(state, cache=None, spec=None, revisions=None):
    cache = deepcopy(cache) if cache is not None else {}
    spec = SPEC if spec is None else spec
    revisions = {} if revisions is None else revisions
    values, signatures, rebuilt = {}, {}, []
    for name, (keys, parents) in spec.items():
        # Deliberately keep compute reads independent of the declared keys:
        # negative tests can demonstrate a forgotten dependency.
        signature = digest({
            "implementation_revision": revisions.get(name, "v1"),
            "keys": keys, "parents": parents,
            "inputs": {key: state[key] for key in keys},
            "upstream": {p: (signatures[p], digest(values[p])) for p in parents},
        })
        previous = cache.get(name)
        valid = (previous is not None
                 and previous["signature"] == signature
                 and previous["payload_digest"] == digest(previous["value"]))
        if valid:
            value = deepcopy(previous["value"])
        else:
            rebuilt.append(name)
            if name == "geometry":
                value = {"bottom": round(1.0 - state["thickness"], 10)}
            elif name == "contact":
                value = {"gap": round(values["geometry"]["bottom"] - state["support"], 10)}
            elif name == "moisture":
                value = moisture(state["history"], state["dt"])
            elif name == "surface":
                value = round(state["dry_roughness"] * (1.0 - 0.5 * values["moisture"]), 10)
            elif name == "view_record":
                value = {p: values[p] for p in parents}
            else:
                raise ValueError("Unknown exercise node: " + name)
            cache[name] = {
                "signature": signature, "value": deepcopy(value),
                "payload_digest": digest(value),
            }
        values[name], signatures[name] = value, signature
    return values, cache, rebuilt


def exercise():
    _, baseline_cache, _ = run(BASE)
    cases = []
    for label, change, revisions, mutation, expected in [
        ("unchanged", {}, {}, None, []),
        ("appearance_only", {"dry_roughness": 0.8}, {}, None, ["surface", "view_record"]),
        ("thickness", {"thickness": 0.03}, {}, None, ["geometry", "contact", "view_record"]),
        ("past_rain_same_current", {"history": [1.0, 0.0, 0.0, 0.0]}, {}, None,
         ["moisture", "surface", "view_record"]),
        ("implementation_revision", {}, {"geometry": "v2"}, None,
         ["geometry", "contact", "view_record"]),
        ("corrupt_contact_cache", {}, {}, "corrupt", ["contact"]),
        ("missing_geometry_cache", {}, {}, "delete", ["geometry"]),
    ]:
        state, prior = deepcopy(BASE), deepcopy(baseline_cache)
        state.update(change)
        if mutation == "corrupt":
            prior["contact"]["value"]["gap"] = 999.0
        if mutation == "delete":
            del prior["geometry"]
        incremental, _, rebuilt = run(state, prior, revisions=revisions)
        clean, _, _ = run(state, revisions=revisions)
        if incremental != clean or rebuilt != expected:
            raise AssertionError((label, rebuilt, expected, incremental, clean))
        cases.append({"case": label, "rebuilt": rebuilt, "matches_clean_rebuild": True})

    negative = []
    for label, bad_node, bad_keys, change in [
        ("forgotten_thickness_input", "geometry", (), {"thickness": 0.03}),
        ("history_replaced_by_current_weather", "moisture", ("current_rain", "dt"),
         {"history": [1.0, 0.0, 0.0, 0.0]}),
    ]:
        bad_spec = dict(SPEC)
        bad_spec[bad_node] = (bad_keys, SPEC[bad_node][1])
        _, prior, _ = run(BASE, spec=bad_spec)
        state = deepcopy(BASE)
        state.update(change)
        stale, _, rebuilt = run(state, prior, spec=bad_spec)
        clean, _, _ = run(state)  # Correct dependencies, same numerical functions.
        different = [name for name in SPEC if stale[name] != clean[name]]
        if not different:
            raise AssertionError("Negative control failed to expose stale results")
        negative.append({
            "case": label, "incremental_rebuilt": rebuilt,
            "stale_nodes_detected_by_clean_comparison": different,
        })
    return {
        "ordinary_cases": cases, "negative_controls": negative,
        "ordinary_passed": len(cases), "negative_controls_detected": len(negative),
        "test_count": len(cases) + len(negative),
        "rain_at_now_both_cases": BASE["current_rain"],
        "moisture_original_history": moisture(BASE["history"], BASE["dt"]),
        "moisture_changed_history": moisture([1.0, 0.0, 0.0, 0.0], BASE["dt"]),
        "limits": [
            "Synthetic scalar exercise, not geometry/physics/rendering validation.",
            "Clean rebuild shares numeric functions; this tests cache consistency, not physical truth.",
            "All input changes between evaluations; concurrency and disk publication are not tested.",
            "In-memory cache mutation, not a Houdini cache implementation reproduction.",
            "Caller-maintained implementation revisions; no automatic source-code hashing.",
            "No DCC software execution or production approval.",
        ],
    }


if __name__ == "__main__":
    print(json.dumps(exercise(), indent=2))
```

## 尚未验证

没有运行Houdini、Blender、UE或Gaea，没有真实曲面接触、湿度标定、动态碰撞、磁盘缓存发布、并发或性能测试。实现版本号由调用方维护，真实工具链仍需可靠记录源码、环境和依赖版本。摘要校验用于发现本例中非协同篡改的结果值，不是对恶意修改者的完整性安全证明。完整重算与增量共用公式，无法发现两条路径共同包含的计算错误。

下一次研究可从实际Mother答卷选一项，把增量结果与隔离完整重算作固定条件对照；这一建议未启动任何后台任务。
