# SK-001 — Knowlery 2.0 不默认分发 Obsidian Markdown / Obsidian CLI Skills

**日期：** 2026-11-02  
**状态：** ACCEPTED（Owner 明确提出 2.0 仅保留 Knowlery 自身的知识规则与工具教学，并在澄清“CLI”是 Knowlery CLI 后表示认可）  
**范围：** Knowlery 2.0 Agent Skills / Agent Plugin 的默认依赖策略  
**相关决策：** A-002、A-003、A-004、I-001、CLI-001

## 决定

1. **2.0 默认安装/分发的 Knowlery Skills 不包含独立的 `obsidian-markdown` 和 `obsidian-cli` Skills，也不以安装 `kepano/obsidian-skills` 为运行前提。** 这是一项 2.0 产品目标，不是立即移除 1.x 目录的修改命令。
2. Knowlery 自己的 Skills 负责指导 Agent 按已接受的 **Knowledge Format v1.0** 和 `CONVENTIONS.md` 读取、撰写、编译、更新和治理知识。必要的 Wikilinks、Claim Block IDs、Frontmatter 等 Obsidian-compatible Markdown 知识直接纳入 Knowlery 的最小指导，而不是把完整的第三方 Skill 当作规范来源。
3. **“优先使用 CLI”严格指 Knowlery CLI，不指 Obsidian CLI。**
   - Agent 可以直接访问文件且 Knowlery CLI 可用时，Skills 优先使用 Knowlery CLI 提供的已实现且适用的受控操作。
   - Agent 有文件工具但 Knowlery CLI 不可用时，仍按 KF v1.0/`CONVENTIONS.md` 使用通用文件工具完成 Level 0 工作，并明确不能宣称 Level 1 的强制写入安全。
   - Agent 仅通过 MCP 访问 Vault 时，使用 Knowlery MCP Connector 暴露的操作；没有任意文件工具的隐含回退。这遵循 CLI-001。
4. **Obsidian CLI 可以继续作为 Knowlery 内部可选 Adapter 的能力来源。** Agent 无须安装/加载 `obsidian-cli` Skill，也不应为了执行 Knowlery 知识操作而必须了解原生 `obsidian` 命令。是否、何时调用 Obsidian CLI，以及调用进程边界/能力路由，仍属于未批准的 Adapter 详细设计。
5. 可**参考或选择性改编** `kepano/obsidian-skills` 的经验和 Obsidian 语法说明，但知识语义与治理规则以 KF 为准。若实际复制上游受 MIT 许可的实质内容，则保留适用的版权与许可通知；仅借鉴思想时不产生对该仓库的运行依赖。

## 为什么

- 上游 `obsidian-markdown` 教的是**通用 Obsidian Markdown**，并不提供 Knowlery Claim `^cN` 的特殊行末锚点、Sources、History、版本及保护语义。
- 上游 `obsidian-cli` 教 Agent 直接调用原生 Obsidian 命令；这会使 Agent 面对两个可能的写入入口，而不能单凭原生 Obsidian 文件修改命令保证 Knowlery 的版本前置条件与治理规则。
- Knowlery Format-first 的 Level 0 能力不应被特定 Skill 包安装状态或 Obsidian 运行状态锁定。
- 减少默认 Skill 之间的规则竞争，也降低 Agent 在执行 Knowlery 任务时需要理解的工具表面。

## 现状与实施边界

经核对 `develop/2.0`，现有 `plugin/skills/obsidian-markdown/` 与 `plugin/skills/obsidian-cli/` 均存在；这是保留的 **1.x Agent Plugin** 资产，并不表示 2.0 将继续默认分发。按 `docs/2.0/REPOSITORY-PLAN.md`，暂不删除或变更 1.x 路径、版本与发布配置。

**未决定**其他第三方 Skills（如 `obsidian-bases`、`json-canvas`、`defuddle`）是否在 2.0 中独立提供、捆绑或完全移除；本决定仅覆盖上面两个明确讨论的 Skills。

**未决定** CLI-002 的最小命令集、具体 Adapter 路由、Skill 的文件布局与平台特定分发方式；这些尚需设计/验收。

## 替代方案及取舍

| 方案 | 处理 |
| --- | --- |
| 2.0 继续默认内嵌两个上游 Obsidian Skills | 不采用：增加 Prompt 表面和规则冲突；形成不必要的用户依赖 |
| 2.0 在所有情形下强制 Agent 使用 Knowlery CLI | 不采用：破坏已有的 Level 0 文件工具模式 |
| 完全禁止 Knowlery 内部调用 Obsidian CLI | 不采用：可复用搜索、Backlinks 等能力，不等于向 Agent 暴露原生命令 |
| 由 Knowlery 自己的 Skills 承载必要语法指导、调用 Knowlery CLI/MCP 并保留 Level 0 回退 | **接受** |

## 风险与验证方向

1. **语法覆盖不够**：独立运行 2.0 Knowlery Skills（不安装上游 Obsidian Skills），验证可正确生成 KF 笔记、Wikilinks、`^cN`、引用和历史记录。
2. **回退路径失效**：在无 Obsidian、无 Knowlery CLI、只有文件工具的环境执行 Level 0 用例，验证仍能遵守 `CONVENTIONS.md`。
3. **双 Skill 冲突**：当用户自己额外安装上游 Skill 时，用针对性测试确认 Knowlery 管理页面遵循 KF 的特殊规则；不能假设能控制所有外部 Agent 提示优先级。
4. **对 Obsidian Adapter 的误解**：验证不安装 `obsidian-cli` Skill 并不阻止 Knowlery 自身在已选中的环境使用 Obsidian CLI。
5. **迁移影响**：从 1.x Agent Plugin 迁移时说明哪些 Skills 不再默认捆绑，并确认无对旧 Skill 名的硬编码引用仍被 2.0 使用。

## 证据与来源

- 讨论：Owner 表示 2.0 不应再保留默认的 `obsidian-markdown` 和 `obsidian-cli` 两个 Skills，而应借鉴其知识到新的 Knowlery Skills；经确认「CLI」特指 Knowlery CLI 后表示认可。
- `docs/2.0/decisions/2026-11-02-cli-execution-contract.md`（CLI-001）已经正式界定文件工具回退及 MCP-only 环境。
- `format/KNOWLEDGE-FORMAT-v1.0.md` 和 `format/CONVENTIONS.md` 是 Knowlery Format 规范来源。
- 上游参考：https://github.com/kepano/obsidian-skills（MIT License）。
- 1.x 遗留实现：`plugin/skills/obsidian-cli/SKILL.md`、`plugin/skills/obsidian-markdown/SKILL.md`。

**记录性质：** 已接受的 2.0 默认依赖和 Agent 教学策略，不代表已删除 1.x Skills、批准了 CLI-002 或实现了新的 2.0 Skills。
