import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'msync',
  description: 'Keeps derived MongoDB data in sync with the documents it comes from.',
  base: '/msync/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Getting started', link: '/getting-started' },
      { text: 'Tutorial', link: '/tutorial/' },
      { text: 'Guide', link: '/guide' },
      { text: 'npm', link: 'https://www.npmjs.com/package/@omegup/msync' },
    ],
    sidebar: [
      { text: 'Getting started', link: '/getting-started' },
      {
        text: 'Tutorial',
        items: [
          { text: 'The domain', link: '/tutorial/' },
          { text: 'A field on the same document', link: '/tutorial/cohort' },
          { text: 'Copy a field across a reference', link: '/tutorial/lookup' },
          { text: 'A total on the parent', link: '/tutorial/group' },
          { text: 'A collection of pairs', link: '/tutorial/entitlements' },
          { text: 'Run them together', link: '/tutorial/run' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Overview', link: '/guide' },
          { text: 'Views', link: '/guide#views' },
          { text: 'Building the pipeline', link: '/guide#building-the-pipeline' },
          { text: 'Expressions', link: '/guide#expressions' },
          { text: 'Stages', link: '/guide#stages' },
          { text: 'Sinks', link: '/guide#sinks' },
          { text: 'Accumulators', link: '/guide#accumulators' },
          { text: 'Predicates and queries', link: '/guide#predicates-and-queries' },
          { text: 'Machine', link: '/guide#machine' },
          { text: 'What gets stored', link: '/guide#what-gets-stored' },
          { text: 'Names', link: '/guide#names' },
          { text: 'Composing areas', link: '/guide#composing-areas' },
          { text: 'Conventions', link: '/guide#conventions-that-keep-types-honest' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/Omegup/msync' }],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: 'Released under the package @omegup/msync',
    },
  },
})
