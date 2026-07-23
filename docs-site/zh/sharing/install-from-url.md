# 从 URL 安装

```bash
knowlery bundle install https://github.com/team/kb-bundles/releases/download/team.delivery-v1.2.0/team.delivery-1.2.0.zip
```

字节流先下载到临时文件，然后走与本地安装**完全相同**的管道——同样的预览、同样的
规范校验与版本门、同样的路径安全检查。远程知识包做不了任何本地包做不了的事。

在 Obsidian 里，安装对话框（Dashboard → Install bundle）的 URL 输入框接受同样的
链接。

## 公开来源

任何能返回 zip 字节流的 `https://` URL 都可以：公开仓库的 GitHub Release 资产、
静态文件托管、对象存储。无需任何配置，也不需要 GitHub 账号。

在可信局域网内也可以用普通 `http://`——Knowlery 会提示传输未加密；拿不准时配合
`--verify` 使用。

## 私有 GitHub 来源

如果 URL 指向**私有**仓库的 Release，匿名下载会被拒绝（GitHub 返回 404——它从不
泄露私有仓库是否存在）。Knowlery 会自动改用你自己的 `gh` CLI 登录重试，并告知你：

```
Anonymous fetch was refused — retrieved via your gh login instead.
```

前提：你对该仓库有读权限（被邀请为 collaborator，或是组织成员），且 `gh` 已安装
并登录（`gh auth login`）。

**没有 `gh` 时**，用浏览器——你的登录会话就是凭证：

1. 打开 Release 页面，下载 zip。
2. `knowlery bundle install ~/Downloads/pack.zip`

## 校验下载

如果分享者在链接旁公布了 SHA-256 校验和：

```bash
knowlery bundle install <url> --verify sha256-3f7a…
```

校验发生在**任何解包动作之前**，针对原始下载字节；不匹配则中止并打印两个哈希，
什么都不会被安装。`--verify` 对本地文件同样有效——适合校验经聊天工具转发的 zip。

## 另请参阅

- [分享故障排查](./troubleshooting)——第一条就是"同事打开链接 404"。
