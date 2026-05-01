import { defineConfig } from 'vitepress'

const base = process.env.KNOWLERY_DOCS_BASE || '/'
const repo = 'https://github.com/JayJiangCT/knowlery'

const englishSidebar = [
  {
    text: 'Start Here',
    items: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Core Concepts', link: '/concepts/' },
    ],
  },
  {
    text: 'Use Knowlery',
    items: [
      { text: 'Guides', link: '/guides/' },
      { text: 'Troubleshooting', link: '/troubleshooting/' },
      { text: 'Reference', link: '/reference/' },
    ],
  },
  {
    text: 'Project',
    items: [
      { text: 'Developer Notes', link: '/developer/' },
    ],
  },
]

const chineseSidebar = [
  {
    text: '开始',
    items: [
      { text: '快速开始', link: '/zh/getting-started/' },
      { text: '核心概念', link: '/zh/concepts/' },
    ],
  },
  {
    text: '使用 Knowlery',
    items: [
      { text: '使用指南', link: '/zh/guides/' },
      { text: '故障排查', link: '/zh/troubleshooting/' },
      { text: '参考', link: '/zh/reference/' },
    ],
  },
  {
    text: '项目',
    items: [
      { text: '开发者说明', link: '/zh/developer/' },
    ],
  },
]

export default defineConfig({
  base,
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', href: `${base}knowlery-pot.svg`, type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#f5e4c6' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: `${base}knowlery-pot.svg` }],
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'Knowlery',
      description: 'Official documentation for Knowlery, the AI knowledge base control panel for Obsidian.',
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
      description: 'Knowlery 官方文档：面向 Obsidian 的 AI 知识库控制台。',
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
    logo: '/knowlery-pot.svg',
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
