# TLO 人机通信合同 R0.1

## 核心问题

用户提出 TLO 的直接原因，是长期对话和跨窗口工作中信息会丢失。机器拥有大量知识和任务状态后，不能依赖“我应该还记得”来维持连续性。

因此 TLO 需要同时成为一种世界描述候选和一种通信压缩候选。

## 基本原则

### 1. 先写事实，再写推断

每个关键记录要区分：

- user-confirmed
- source-confirmed
- inferred
- candidate
- unknown

不能为了让文件“完整”而填补未知项。

### 2. 时间戳和适用时间必须显式

同一句话在不同时间可能对应不同状态。记录至少区分：

- 事件发生时间；
- 信息被记录时间；
- 对象状态有效时间；
- 来源版本时间。

### 3. Location 必须能复位到同一世界

跨 Mother、跨软件、跨运行时，只要读取同一 TLO DNA，就不能因为默认坐标系不同让对象移动到另一个地方。

### 4. Object identity 高于显示结果

同一个对象在远景、近景、不同光照、不同渲染后端下仍然是同一个 Object。

### 5. 关系比重复描述更重要

经验增长后，文件不应该无限复制案例；应把重复经验蒸馏成规则、函数和关系，再让对象引用。

### 6. 定期 Markdown checkpoint

用户明确要求：讨论隔一段时间就把核心结论 markdown 下来，再由小妈自己重新阅读，避免十几分钟后连续性断裂。

因此工作协议建议：

`conversation -> checkpoint -> reread -> continue`

checkpoint 不等于最终定稿。它的价值是提供可恢复的连续上下文。

## 最小通信记录候选

```text
TLORecord {
  T: time context,
  L: location context,
  O: object identity/reference,
  statement,
  status,
  source,
  relations,
  uncertainty,
  nextQuestion
}
```

这是通信层候选，不是最终物理文件 schema。

## 失败模式

- 用模型常识自动补写用户没说过的例子；
- 把之前一次回答当成用户确认；
- 省略时间和位置导致同名对象串线；
- 把 Weather Mother、Ocean Mother 等子线内容误串到小妈主线；
- 只保存最终答案而丢掉对象身份、来源和未知项；
- 让文件越学越重，却没有函数化和压缩。
