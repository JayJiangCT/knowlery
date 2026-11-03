# GR-001 — Graph-guided Retrieval 的关系类别

**日期：** 2026-11-03  
**状态：** ACCEPTED（Owner 明确认可将检索关系区分为语义关系与探索关系）  
**范围：** Knowlery 2.0 / Retrieval 语义，非 CLI-002 整体实施授权  
**相关：** A-002、F-003、F-006、F-008、CLI-001、SK-001、PR #95

## 已接受的决定

1. **语义关系（Semantic Relations）**：Knowledge Format v1.0 已定义的来源、依赖和知识演进关系，包括 Knowledge Claim 引用 Record / Source 的证据关系、Claim-to-Claim 的 `derived` 推导关系，以及 `superseded_by`、`supersedes`、`followed_by` 等演进关系。遵循 KF v1.0 的具体方向、版本和证据语义；尤其 `derived` 不产生新的独立证据。
2. **探索关系（Navigational Relations）**：普通 Wikilink、Backlink、`related`、`## Related` 等关联，供 Agent/检索系统导航与寻找候选，不凭链接本身证明事实、因果或来源。
3. 两类关系都可以参与 Retrieval，关系扩展应考虑问题意图和上下文预算；**不得将探索关系自动升级为来源证据**。对确切 Claim 仍遵循 F-008 的来源检查规则。
4. 这属于**关系解释和使用分类**，不新增 KF v1.0 的字段或状态，不要求所有 Source / Raw Notes 必须先有 Wikilink 才能被索引或发现。

## 核心边界：显式链接覆盖不均匀

Owner 在后续讨论中强调：用户撰写的 Raw Notes 往往缺少结构化 Wikilinks；Agent 生成的 LLM Wiki / Knowledge Pages 通常更有意识地建立交叉链接。这是重要的设计约束：**缺少链接不等于没有知识相关性，也不能让未编译 Raw Notes 永久不可检索**。已编译 Knowledge Page 对 Raw Source 的 KF `## Sources` Wikilink 可以形成从 Raw Source 出发可发现的 Backlink，即使 Source 本身没有对外链接。

但「如何在没有显式链接时发现潜在关联」、「是否需要语义检索或推断关联」、「是否将候选关系持久化」、「如何组装上下文和预算」仍为 **OPEN / PROPOSED**，本记录**不**将这些实现方案视为已接受。Agent 创建的链接也不自动具有证据效力；仍须验证是否确实支持相关 Claim。

## 需要后续验证的问题

- Raw Notes 与 Knowledge / Record 的链接覆盖率和链接正确性如何？
- 从已编译知识到被引用 Raw Source 的显式路径能覆盖哪些问答？
- 对未编译、未链接的 Raw Notes，词法检索、Agent 语义判断和候选关系发现如何互补？
- 将普通 Backlinks 作为候选与按 KF 来源/演进关系扩展，在固定 Token 预算内各有什么收益和噪声？
- 是否会误用高连接度 hub 页面、将未经验证的 Agent 推断链接当成事实？

## 现有依据

- `format/KNOWLEDGE-FORMAT-v1.0.md` §3、§7–§12：KF 对证据、`derived`、演进链接和普通 Wikilinks 的区别。
- `evals/experiments/obsidian-headless/scripts/plan.ts`、`run-obsidian.ts`（PR #95）：现有检索仅在关键词结果不足 K 时追加链接邻居，尚未充分验证主动 Graph-guided Retrieval。
- Owner 对 1.x Raw Notes / Agent-generated Wiki 链接差异的实际使用观察；链接覆盖率仍待量化。
- Andrej Karpathy, *LLM Wiki*（2026-04-04）：https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

**记录性质：** 已确认关系类别与证据边界；CLI-002 命令、检索策略、隐式关联、上下文组装及实现/发布仍待确认。
