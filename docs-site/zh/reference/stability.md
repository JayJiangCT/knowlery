# 稳定性契约

自 1.0.0 起，下列表面在 semver 下冻结：**破坏其中任何一项都需要主版本号**。
minor 和 patch 更新可以向这些表面*添加*内容，但绝不改变或移除既有含义。
本页的每一条承诺都由仓库中的契约测试（`tests/contract/`）钉住——冻结由
CI 强制，而不是靠善意。

## 1.x 更新可以对你做什么

新增命令、旗标、工具、可选字段和可选文件。改进检索分数。修复 bug。
更新技能内容。

## 1.x 更新绝不会对你做什么

移除或重命名命令、旗标或工具；改变既有文件或字段的含义；改变 JSON 输出的
键；破坏 1.0.0 创建的工作区或知识包。

## 冻结的表面

### 工作区格式

- `KNOWLEDGE.md`、`SCHEMA.md`、`INDEX.base`、四个编译目录（`entities/`、
  `concepts/`、`comparisons/`、`queries/`）、`inbox/`、`Library/<bundle-id>/`
  的含义和位置。
- `.knowlery/manifest.json`（既有字段）和 `.knowlery/bundles.json`
  （schemaVersion 1）。任何 1.x 永远能读取 1.0.0 写下的状态。
- 页面层级规则（编译目录是 agent 层级；其余一切是用户层级）。

### CLI 表面

- 1.0 发布的每个命令和子命令、它们的位置参数数量和旗标。
- `--json` 输出形状：既有键永不改变；新增键属于 minor。
- 退出码语义：`0` 成功——**包括发现**（弃答的查询、空报告）；`1` 操作
  失败；`2` 用法错误。
- `--kb` / `--dir` 解析规则：`--kb` 经注册表解析、`--dir` 永久有效、两者
  同传是错误、注册表永远不是前置条件。

### MCP 契约

- 八个工具名（`list_kbs`、`query`、`stale`、`health`、`list_bundles`、
  `init_kb`、`capture`、`sync`）、它们的输入 schema（必填字段和类型；新增
  *可选*输入属于 minor）以及 `structuredContent` 形状（既有键）。广播的
  schema 携带冻结的键——客户端通过 `tools/list` 内省到的就是契约本身，
  且服务器在运行时对每个结果做校验。
- 发现与错误的语义：弃答、`healthy: false`、很长的 stale 报告是成功结果；
  工具错误只留给坏掉的调用。
- 九个提示词名、`knowlery://{kb}/{+path}` 资源方案，以及可读层白名单边界。
- `knowlery mcp serve` 的旗标和认证契约（bearer token、401 形状）。

### 知识包格式（OKF）

- `knowlery-bundle.json` schemaVersion 1 的字段和 zip 布局（`index.md`、
  `agent-index.json`、`_sources/`、更新日志）。
- 安装/更新门禁语义：版本必须递增、本地修改拒绝覆盖。

### KB 注册表

- `registry.json` schemaVersion 1、名字语法（`[a-z0-9][a-z0-9-_]`，最长
  64 字符）、保留名（`*`、`all`），以及"损坏即响亮报错"规则（受损的注册表
  会被报告，绝不静默重置）。

## 明确不冻结的

同样直白地说出来，让"没有承诺"永远不会被误认为承诺：

- **检索排序内部。** 分数、候选之间的排序、置信门禁的阈值可以在任何版本
  改进。契约是结果的*形状*和弃答判定串（`no-confident-match`），不是数字。
- **技能文本。** 技能内容会演进；技能*名字*是契约。
- **`health` 的 `config` 对象的内部键。** 各检查字段可以随健康检查器演进
  而增加、重命名或退役——冻结它们等于冻结检查本身。它的契约是 `healthy`
  （布尔值）加上 `config` 对象的存在。
- **插件 UI**（dashboard 布局、弹窗、设置组织）、**文档**、**eval 阈值**。
- 上面未列出的 `.knowlery/` 私有状态（活动回执、报告）。
- TypeScript 内部：`src/` 不是公开 API；从包中 import 不受支持。

## 弃用路径

一个表面可以在 minor 版本中获得继任者（新旗标、新工具）；旧的持续工作，
直到某个主版本移除它。别名不算破坏。
