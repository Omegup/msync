import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './.build/index.js',
    'adapters/mongodb': './.build/adapters/mongodb.js',
  },
  format: ['cjs', 'esm'],
  outDir: 'dist',
  clean: true,
  dts: false,
  tsconfig: false,
  sourcemap: true,
  outExtensions: ({ format }) => ({
    js: format === 'es' ? '.esm.js' : '.js',
  }),
})