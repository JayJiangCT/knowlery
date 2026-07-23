# 发布知识包（CLI）

本页适合终端用户。希望在插件界面中完成操作，请阅读
[在 Obsidian 中分享](./obsidian)；希望交给 Agent，请阅读
[让 Agent 帮你分享](./with-agent)。

```bash
knowlery bundle publish drone-delivery
```

从审核完成的范围到可分享的 URL，一条审慎的命令：

1. **先过审核门**——与 `bundle export` 同一道门。有任何未审项就打印清单，什么都
   不会发布。
2. 编译并打包（复用你上次导出的版本号）。
3. 通过你自己的 `gh` 登录在配置的仓库里创建 GitHub Release，zip 作为资产。
4. 你会得到一条可以直接转发的完整消息：资产 URL、它的 SHA-256，以及
   **谁能安装它**——参见[授权](./grant-access)。

```
Published jay.drone-delivery v0.1.0 to your-org/kb-bundles (private).
  Who can install: members with read access to your-org/kb-bundles (private).
  Grant access: your-org members with base Read permission already have it;
                invite others at https://github.com/your-org/kb-bundles/settings/access
  Share:  knowlery bundle install https://github.com/.../pack.zip --verify sha256-3f7a…
```

## 首次配置

第一次发布需要指定目标仓库——传 `--repo owner/name`（或回答提示）。配置按知识包
记忆，之后发布无需再填。仓库不存在时，Knowlery 会提议以**私有**方式创建——把仓库
转公开是比发布一个 Release 更大的决定，留给你在 GitHub 上做。

在 Obsidian 里，导出对话框的结果页有同样的 "Publish to GitHub" 面板，共享同一份
记忆的配置。

## 公开发布：第二道门

私有永远是默认。`--public` 会陈述一个额外的事实、问一个额外的问题：

> 公开发布是永久的：缓存、镜像与爬虫会保留它，即使之后删除。

如果任何**已批准**的条目带有风险提示（邮箱、凭证、私网 IP、人物页……），这些条目
会被重新列出并要求再次确认——你批准时想的是分享给同事，公开到互联网是另一个决定。
交互模式下输入 `publish` 确认；脚本和 agent 必须传 `--acknowledge-risks`，而 agent
的行为守则要求它只在向你完整展示清单、你明确同意之后才传。

这道门在**每次**公开发布时都会运行——对 v1.2 的同意不会静音 v1.3 的扫描，因为内容
变了，风险就变了。

::: warning 目标仓库已经公开时
Knowlery 不会替你修改 GitHub 仓库的可见性，也不会从仓库状态自动推断你是否有意公开。
只要目标仓库实际是公开的，就必须明确传入 `--public`；在 Obsidian 中则必须选择
**Public**，这样公开风险确认才会出现。
:::

::: warning 诚实的边界
模式扫描识别的是形状（API key、IP、手机号），不是含义。它无法知道某句话在商业上
敏感。逐条人工审核——真人读过每一页——才是真正的门。
:::

## 重新发布

同一版本拒绝重复发布（必要时 `--force` 替换资产）。正常的更新流程：以新的
`--bundle-version` 重新导出，再发布——订阅者会看到新版本。

## 没有 `gh` 时

发布配合 GitHub CLI 最顺（一条命令安装：[cli.github.com](https://cli.github.com)，
然后 `gh auth login`）。没有它时，`publish` 会打印完整的手动路径——zip 的位置、
精确的 `releases/new` 链接、要用的 tag、要随链接公布的 SHA-256——大约一分钟的
拖拽操作，产物与 gh 发布的完全等价。
