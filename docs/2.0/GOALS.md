# Knowlery 2.0 Goals

> 状态：产品目标基线。根据项目提供的《Knowlery 2.0 Goals》整理；非实现验收报告。

## North Star

**Knowlery 2.0 is an Agent-native, Markdown-first knowledge system that continuously transforms raw information into a trustworthy, evolving LLM Wiki—autonomously maintained by AI Agents, governed by humans when necessary, and portable across tools and platforms.**

我们不是在建设一个更方便人类整理笔记的工具；我们在建设一个让 AI Agent **可靠地管理知识**的系统。

- 人：持续输入信息、提出问题、给出方向、做重要决策。
- Agent：理解、编译、组织、检索、修订、校验与维护知识。
- Wiki：开放、可追溯、可移植、持续演进。Markdown 可被人阅读与编辑，但日常维护不以人工编辑为中心。
- 自治是默认路径；对证据不足、影响较大或不可逆的操作，按规则请求人类确认。

## 五个核心目标

### G1. Raw Information → Agent-usable Knowledge

将原始笔记、研究、讨论、决策及历史资料持续编译成可复用的 LLM Wiki。Agent 应能快速找到当前结论、形成原因、证据、适用条件、假设、未决事项和已经被取代的历史结论，而不是每次重读大量源文档重建知识。

### G2. Autonomous Knowledge Evolution

Agent 发现新增或变更的来源，识别受影响的知识，只更新必要部分，维护关联、检测冲突与过期结论，保留重要历史；在重要未决冲突时升级给人类。自治受证据质量、变更影响和可逆性约束。

### G3. Trustworthy, Verifiable, Traceable

提供来源定位（Provenance）、源版本、当前性、取代关系、冲突、治理决定和写入保护。人工批准不等于事实自动正确；AI 生成也不等于天然不可信。信任来自可检查的证据及适用条件。

### G4. No Mandatory Obsidian / Harness Dependency

核心采用 Format-first：Knowledge Format 规定长期资产的组织与含义；Skills 组织智能工作流；CLI / Adapter 提供确定性操作；MCP 是可选集成；Obsidian Plugin 提供界面与必要的人类交互；Codex、Claude Code 等 Harness 执行流程。无需建设完整的 Obsidian 替代 Runtime。

### G5. Lower Long-term Knowledge Cost

降低冗余搜索、重复编译、全文改写、无关上下文和日常人工审核成本；提高检索效率与知识更新一致性。性能与质量收益必须以可复现评测证明，不作为先验事实。

## 当前研究优先级

1. **Current Knowledge**：让 Agent 默认读取当前有效结论，避免历史污染。
2. **Knowledge Evolution**：正确定位被影响的局部内容，安全增量更新。
3. **Autonomous Governance**：尽可能自治，且不丢失重要决定和证据。
4. **Agent-native Wiki Organization**：优化 Wiki 的组织，使理解、检索和维护更可靠。

不要从增加知识类型、统一 UUID 或复杂 Frontmatter Schema 开始。先在真实知识簇上研究 Agent 如何消费与维护知识。

## 非目标

2.0 不是完整 Obsidian 替代品、通用 Agent Harness、封闭数据库、传统 AI 摘要器、为图谱而图谱的引擎，或要求人工批准每次日常改动的工作流系统。

## 成功标准（待建立基线和门槛）

- 问答正确性与当前知识优先级
- 重要结论的来源和版本追溯
- 局部更新精度、冲突处理、历史与决定保全
- Token / 搜索成本与人工介入比例
- 无 Obsidian 的跨 Harness 移植能力

关键验收问题：移除 Obsidian Plugin 及 Knowlery 专用运行组件，只保留公开的知识格式、知识资产和兼容工具时，新接入的 Agent 能否正确检索、理解、安全更新并治理知识？
