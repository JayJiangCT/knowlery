# 订阅与更新

从 GitHub Release 链接安装知识包的那一刻，你就成了订阅者：vault 记住了它的来源，
并且可以向那个来源询问新版本。

```bash
knowlery bundle check-updates
```

```
jay.drone-delivery  v1.2.0 → v1.3.0 available
team.obs-pack       v2.0.0 — up to date
old.zip-install     v1.0.0 — unchecked (no version protocol for this source)

1 update(s) available — install with: knowlery bundle update <id> (or --all)
```

```bash
knowlery bundle update jay.drone-delivery   # 或 --all
```

更新走**完整的安装管道**——规范门、版本门、路径安全——并且替换是分阶段的：
任何环节失败，已安装版本原封不动。

在 Obsidian 里，dashboard 的 *Installed bundles* 区块有 **Check updates** 按钮
和逐包的 Update 按钮。

## 订阅模型

- **只拉不推。**没有任何后台检查；由你（或你的 agent，按你们约定的节奏）主动
  运行检查。`knowlery sync` 刻意保持离线——`check-updates` 是它的网络侧姊妹命令。
- **权限即成员身份。**更新来自你当初安装的同一来源、同样的访问规则——组织成员
  只要还在组织里就能持续收到更新。参见[授权](./grant-access)。
- **状态分类是诚实的**：`unchecked` 表示该来源没有版本发现协议（裸 zip 链接）；
  `skipped` 表示私有来源需要 `gh`；两者都不是错误。

## 本地修改受保护

如果你编辑过 `Library/<bundle-id>/` 里的文件，更新会覆盖你的改动——所以它会拒绝,
并精确列出哪些文件被编辑、新增或删除。惯例是：**装进来的知识用于引用,不用于
编辑**——把你自己的见解写在自己的页面里,链接到知识包的页面。确定要覆盖时用
`--force`。

## 版本说明

知识包版本是稳定的数字点分格式（`1.2.0`、`1.10.0`——按数字比较,所以
`1.10 > 1.9`）。没有降级命令：要回滚,直接重新安装旧版本 Release 的链接。
