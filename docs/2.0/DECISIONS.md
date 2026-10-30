# Knowlery 2.0 — Decision Register

> 用于区分已确认方向、候选设计与需要评测的事项。仅记录本轮已有依据；不自动把研究提案转换为 Accepted。

| ID | 议题 | 状态 | 决定或待决内容 |
| --- | --- | --- | --- |
| A-001 | 产品定位 | **BASELINE** | Agent-native，Agent 负责日常知识管理；人保留最终控制权与必要升级 |
| A-002 | 架构中心 | **BASELINE** | Format-first + Markdown-first；Knowledge Format 是长期契约 |
| A-003 | Runtime | **BASELINE** | 不以自研完整 Core Runtime / Obsidian 替代品为目标 |
| A-004 | 技术分工 | **BASELINE** | Skills 管智能行为；CLI/Adapter 管确定性操作；MCP 可选；Obsidian Plugin 专注 UI |
| A-005 | 资产可靠性 | **BASELINE** | 重要证据、人工决定、当前与历史知识不能因替换客户端而丢失 |
| A-006 | 自治治理 | **BASELINE** | Agent 默认自主，重要证据冲突或高风险不可逆变更触发人工升级 |
| R-001 | GitHub 组织 | **ACCEPTED FOR BOOTSTRAP** | 继续同一仓库；`develop/2.0` 独立开发；暂保留 1.x 代码与发布配置 |
| F-001 | Wiki 结构 | **RESEARCH** | 在现有主题 Wiki 上研究“当前知识入口 + 按需历史 + 可定位局部更新” |
| F-002 | Frontmatter 字段 | **OPEN** | 哪些字段必需、可选、可扩展；不先批准固定 Schema |
| F-003 | Note 身份 | **OPEN** | 路径定位、受管理对象 ID、复制/移动/改名规则；不批量注入 UUID |
| F-004 | 来源版本 | **OPEN** | 完整快照、片段、外部历史、hash 与证据定位的组合及保证级别 |
| F-005 | Governance 持久化 | **OPEN** | 跨设备可恢复的权威状态存储、冲突语义及导出规则 |
| F-006 | 知识关系 | **OPEN** | Wiki/来源引用的可验证表示；如何区分直接证据与二次综合 |
| F-007 | 写入安全 | **OPEN** | 候选版本检查、局部更新、冲突保全和恢复的确定性约定 |
| E-001 | 对照实验 | **PLANNED** | 现有 1.x Wiki vs 优化 Topic Wiki vs 支持局部更新的 Topic Wiki |
| E-002 | 无 Obsidian 测试 | **PLANNED** | 使用 Pilot 与独立副本执行问答、编译和更新安全测试 |

## 状态规则

- **BASELINE**：Owner 已确认的高层方向，原则可以直接约束设计；具体实现仍需评审。
- **ACCEPTED FOR BOOTSTRAP**：仅适用于本次分支搭建的工程决定，不是永久的多包/发布策略。
- **RESEARCH / OPEN**：不应被代码或文档暗中固化成强制规范。
- **PLANNED**：计划而非已经完成的实验。

要将 OPEN / RESEARCH 改为 Accepted，至少补上实验或证据、替代方案、风险与升级路径、Owner 决定及日期。历史争议可追溯至 [SOURCES.md](./SOURCES.md) 的研究材料；不可仅依据本表推断旧 ADR 已获批准。
