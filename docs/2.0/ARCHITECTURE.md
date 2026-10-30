# Knowlery 2.0 — High-Level Architecture Baseline

> **Status: BASELINE — 方向已确认，具体实现未批准**  
> 日期：2026-10-29。本文是对既有高层共识的文字/图示整理，不声称复原此前设计稿的两张原始图片；图为本次根据已确认职责重新绘制的 Mermaid 示意。

## 设计主张

1. **Format-first**：长期资产是开放、可移植的知识格式及其语义契约，不是某一软件 Runtime。
2. **No full Core Runtime**：不再以开发能够完全替换 Obsidian 的独立 Runtime 为目标；优先复用现有工具。
3. **Agent-native / Agent-first**：Agent 是 Wiki 的主要作者与维护者；人拥有最终控制权，通过对话使用并在必要时确认重要决定。
4. **Markdown-first**：原始资料和加工知识保持可直接读取与编辑的 Markdown；必需的结构化状态可以独立保存，但不得被某一个客户端锁定。
5. **Evidence and governed evolution**：当前结论、来源、来源版本、取代关系与关键治理决定应可解释、可保留；写入不得静默覆盖其他编辑者的修改。
6. **Replaceable implementations**：Skills、CLI、MCP、Obsidian UI 的能力可迭代或替换，不改变知识的核心含义。

## 逻辑架构

~~~mermaid
flowchart TB
    R["Raw Sources<br/>Notes / Research / Conversations / Decisions"]
    H["Agent Harnesses<br/>Codex / Claude Code / compatible Agents"]
    S["Agent Skills<br/>Ask / Cook / Challenge / Update / Govern"]
    K["Living LLM Wiki<br/>Knowledge Format · Markdown · Portable State"]
    T["Deterministic Operations<br/>CLI + Adapters · Validation · Safe Writes"]
    O["Obsidian Plugin<br/>UI / Visualization / Human Control"]
    M["MCP<br/>Optional Integration"]
    R --> S
    H --> S
    S <--> K
    S <--> T
    T <--> K
    O <--> K
    O <--> T
    M <--> T
~~~

这是**目标职责图**，不表示图中所有能力已在 1.x 或此分支实现，也不规定每条箭头是网络 RPC、进程调用还是文件访问。

## 组件职责及约束

| 组件 | 职责 | 不负责 |
| --- | --- | --- |
| Knowledge Format | 定义 Wiki 结构、关系、证据、状态和操作的最低语义保证 | 绑定单一索引或客户端 |
| Agent Skills | 智能检索、编译、质疑、更新及治理工作流 | 单凭 Prompt 保障原子写入 |
| CLI + Adapters | 确定性读取、校验、版本检查、安全写入，按能力使用 Obsidian CLI 或 Headless 方案 | 演化为完整自研 Obsidian 替代 Runtime |
| MCP | 在兼容 Harness 中暴露必要的可选工具能力 | 成为所有客户端的强制依赖 |
| Obsidian Plugin | 知识可视化、交互、配置及必要的人类确认 | 作为知识含义与治理状态的唯一权威 |
| Harnesses | 执行 Skills、调用工具、协调 Agent 上下文 | 定义不可移植的知识所有权 |

## 数据与治理边界（方向原则）

原始内容、来源版本及证据、加工 Wiki、治理记录是需要明确归属的长期资产。运行索引通常可重建，不能替代前述资产。人工批准的废弃、取代等决定不得只保存在易丢失的 Agent 会话或未共享的隐藏目录内。

**已确认的是这些保证的方向，不是存储具体布局。** 数据类别、字段、稳定 ID、版本快照、冲突合并算法及状态机均仍需设计和验证，见 [DECISIONS.md](./DECISIONS.md) 与 [Knowledge Format v0](../../format/KNOWLEDGE-FORMAT-v0.md)。

## 端到端例子（期望行为，而非现有实现宣称）

1. 新的原始资料称“数据库选型已经改变”。
2. Agent 通过 Skills 发现受影响 Wiki，检查当时证据、旧决策和最新来源。
3. 若证据足够且变更安全，工具验证目标版本，再只更新必要知识和来源关系。
4. 若旧 Wiki 正在被编辑，确定性工具阻止静默覆盖，保留冲突待处理。
5. 若来源同等权威且互相矛盾，Agent 不擅自将其中之一宣布为当前事实，必要时请求人类判断。
6. 在 Obsidian 不运行的 Headless 环境中，也必须保留关键知识含义和安全保证。

## 与 1.x 的关系

2.0 延续已经积累的主题 Wiki、来源、状态与关系，但不预设 `src/core/` 中任何单一实现是新核心。当前代码搬迁、弃用和兼容性由 [REPOSITORY-PLAN.md](./REPOSITORY-PLAN.md) 管理。

**限制**：该基线不等于批准 Knowledge Format v1、schema 字段、持久缓存、统一身份或具体工程包结构。
