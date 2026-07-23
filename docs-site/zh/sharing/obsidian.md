# 在 Obsidian 中分享

这是第一次分享知识包时最直观的路径。发布功能需要桌面版 Obsidian；自动创建
GitHub Release 还需要安装并登录 GitHub CLI：

```bash
gh auth login
gh auth status
```

## 1. 打开分享流程

任选一个入口：

- Knowlery Dashboard → **知识包** → **分享知识…**
- 命令面板 → **Knowlery: 分享知识包…**
- 右键一个知识页面 → **分享这个主题…**

从页面右键进入时，该页面会自动成为种子页面（seed）。从 Dashboard 或命令面板进入时，
先输入主题名称，再搜索并添加种子页面。

![Knowlery Dashboard 中的知识包入口](/images/sharing/dashboard-bundles.png)

## 2. 选择范围并逐项审核

**Link depth** 决定沿双向链接向外收集几层内容。第一次建议使用 **1 hop**，范围更容易
读完。列表同时显示知识页面和它们引用的原始资料：

- **Approve**：允许进入知识包。
- **Flag**：明确排除，并保留“为什么没有发布”的审核记录。
- **Needs review**：尚未决定；不会进入知识包。

右侧预览会显示正文和自动风险提示，例如邮箱、凭证形状、私网 IP、人物页和会议笔记。
审核进度自动保存；关闭弹窗后可以从 Dashboard 继续。

![知识包范围与逐项审核界面](/images/sharing/bundle-scope-review.png)

## 3. 确认版本和安全选项

点击 **Continue — export … items**，检查标题、Bundle ID、版本、许可协议和创建者。

- 第一次发布可从 `0.1.0` 开始。
- 修正文案或小错误时增加 patch，例如 `0.1.1`。
- 新增重要内容时增加 minor，例如 `0.2.0`。
- 已发布的版本不能重复使用；正常更新不要依赖 `--force`。

默认选项适合分享：保留 **Include SCHEMA.md**，关闭完整活动日志和来源元数据，除非你
已经读过这些额外内容并确定需要发送。

![知识包元数据与安全默认选项](/images/sharing/bundle-confirm-export.png)

## 4. 导出并发布

点击 **Export bundle**。结果页可以打开输出目录、保存 zip，或在
**Publish to GitHub** 中直接发布：

1. 输入 `owner/repository`。
2. 根据目标仓库的**实际可见性**选择 Private 或 Public。
3. 仓库不存在时，Knowlery 只能替你创建私有仓库；公开仓库需要在 GitHub 中预先创建
   或手动修改可见性。
4. 公开发布时，阅读第二次风险清单并确认。
5. 点击 **Publish**。

![Publish to GitHub 面板](/images/sharing/bundle-publish-github.png)

::: warning Public 必须手动选择
如果目标仓库本来就是公开的，也必须在面板中选择 **Public**。这个选项触发公开风险门，
并不会改变 GitHub 仓库本身的可见性。
:::

成功后，复制完整的 `knowlery bundle install ... --verify sha256-...` 行给接收者。
不要只发送 zip URL：校验和能在解压前发现内容不一致。

## 没有 GitHub CLI

结果页仍然会生成 zip、tag、SHA-256 和 GitHub Release 创建地址。按照面板给出的清单，
在浏览器中创建 Release 并上传 zip 即可。
