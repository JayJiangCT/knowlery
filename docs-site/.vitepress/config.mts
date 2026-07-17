import { defineConfig } from 'vitepress'

const base = process.env.KNOWLERY_DOCS_BASE || '/'
const repo = 'https://github.com/JayJiangCT/knowlery'

const englishSidebar = [
  {
    text: 'Start Here',
    items: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Install the CLI', link: '/getting-started/install-cli' },
      { text: 'Core Concepts', link: '/concepts/' },
    ],
  },
  {
    text: 'With Your Agent',
    items: [
      { text: 'Connect Your Agent', link: '/guides/connect-your-agent' },
      { text: 'Talk to Your Knowledge Base', link: '/guides/talk-to-your-kb' },
      { text: 'CLI Workflows', link: '/guides/cli-workflows' },
      { text: 'Agents & MCP Reference', link: '/guides/agents-mcp' },
    ],
  },
  {
    text: 'In Obsidian',
    items: [
      { text: 'Start in Obsidian', link: '/getting-started/obsidian' },
      { text: 'Obsidian Plugin Guide', link: '/guides/' },
    ],
  },
  {
    text: 'Every Surface',
    items: [
      { text: 'Best Practices', link: '/guides/best-practices' },
      { text: 'Multiple Knowledge Bases', link: '/guides/multiple-knowledge-bases' },
      {
        text: 'Sharing Knowledge',
        link: '/sharing/',
        items: [
          { text: 'Publish a Bundle', link: '/sharing/publish' },
          { text: 'Grant Access', link: '/sharing/grant-access' },
          { text: 'Install from a URL', link: '/sharing/install-from-url' },
          { text: 'Subscribe & Update', link: '/sharing/subscribe-update' },
          { text: 'Troubleshooting', link: '/sharing/troubleshooting' },
        ],
      },
      { text: 'Troubleshooting', link: '/troubleshooting/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Stability Contract', link: '/reference/stability' },
    ],
  },
  {
    text: 'Project',
    items: [
      { text: 'Architecture', link: '/developer/architecture' },
      { text: 'Design Decisions', link: '/developer/design' },
      { text: 'Developer Notes', link: '/developer/' },
    ],
  },
]

const chineseSidebar = [
  {
    text: '开始',
    items: [
      { text: '快速开始', link: '/zh/getting-started/' },
      { text: '安装 CLI', link: '/zh/getting-started/install-cli' },
      { text: '核心概念', link: '/zh/concepts/' },
    ],
  },
  {
    text: '与你的 Agent',
    items: [
      { text: '接入你的 Agent', link: '/zh/guides/connect-your-agent' },
      { text: '用对话使用知识库', link: '/zh/guides/talk-to-your-kb' },
      { text: 'CLI 工作流', link: '/zh/guides/cli-workflows' },
      { text: 'Agent 与 MCP 参考', link: '/zh/guides/agents-mcp' },
    ],
  },
  {
    text: '在 Obsidian 中',
    items: [
      { text: '从 Obsidian 开始', link: '/zh/getting-started/obsidian' },
      { text: 'Obsidian 插件指南', link: '/zh/guides/' },
    ],
  },
  {
    text: '所有表面通用',
    items: [
      { text: '最佳实践', link: '/zh/guides/best-practices' },
      { text: '使用多个知识库', link: '/zh/guides/multiple-knowledge-bases' },
      {
        text: '分享知识',
        link: '/zh/sharing/',
        items: [
          { text: '发布知识包', link: '/zh/sharing/publish' },
          { text: '授权', link: '/zh/sharing/grant-access' },
          { text: '从 URL 安装', link: '/zh/sharing/install-from-url' },
          { text: '订阅与更新', link: '/zh/sharing/subscribe-update' },
          { text: '故障排查', link: '/zh/sharing/troubleshooting' },
        ],
      },
      { text: '故障排查', link: '/zh/troubleshooting/' },
      { text: '参考', link: '/zh/reference/' },
      { text: '稳定性契约', link: '/zh/reference/stability' },
    ],
  },
  {
    text: '项目',
    items: [
      { text: '技术架构', link: '/zh/developer/architecture' },
      { text: '设计决策', link: '/zh/developer/design' },
      { text: '开发者说明', link: '/zh/developer/' },
    ],
  },
]

export default defineConfig({
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: `${base}knowlery-app-icon.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#151713' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${base}knowlery-app-icon.svg` }],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Knowlery',
      description: 'Official documentation for Knowlery, the knowledge base built for agents — MCP, CLI, and an Obsidian plugin over one plain-markdown workspace.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/getting-started/' },
          { text: 'Concepts', link: '/concepts/' },
          { text: 'Troubleshooting', link: '/troubleshooting/' },
          { text: '中文', link: '/zh/' },
        ],
        sidebar: englishSidebar,
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      title: 'Knowlery',
      description: 'Knowlery 官方文档：为 agent 构建的知识库——MCP、CLI 与 Obsidian 插件，共享一种纯 markdown 工作区。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/getting-started/' },
          { text: '概念', link: '/zh/concepts/' },
          { text: '故障排查', link: '/zh/troubleshooting/' },
          { text: 'English', link: '/' },
        ],
        sidebar: chineseSidebar,
        docFooter: {
          prev: '上一页',
          next: '下一页',
        },
        outline: {
          label: '本页内容',
        },
        lastUpdated: {
          text: '最后更新',
        },
        darkModeSwitchLabel: '外观',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
      },
    },
  },
  themeConfig: {
    logo: { light: '/knowlery-mark.svg', dark: '/knowlery-mark-dark.svg', alt: 'Knowlery Atlas Fold mark' },
    siteTitle: 'Knowlery',
    socialLinks: [
      { icon: 'github', link: repo },
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除搜索',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc',
                },
              },
            },
          },
        },
      },
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Jay Jiang',
    },
    editLink: {
      pattern: `${repo}/edit/main/docs-site/:path`,
      text: 'Edit this page on GitHub',
    },
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
  },
})
