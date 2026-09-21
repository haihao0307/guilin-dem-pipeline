# 否决版本记录

用户已明确否决 `R2.6.4 冻结缓存生产版`，要求删除其活动效力并回到 `R2.6.3 生产候选版`。

## 禁止继承

- `workbenches/landscape-karst-dem-field-r2-6-4-cached/`
- `.github/workflows/landscape-karst-dem-field-r264-cached.yml`
- 量化索引表面缓存作为当前默认运行架构
- 把函数场提前转成普通 Mesh/缓存并替代 R2.6.3 的连续场验证

## 保留原则

Git 历史不改写，因此历史提交仍可追溯；但本交接分支从 R2.6.3 的固定提交直接建立，不包含 R2.6.4 文件，也不得重新引入。
