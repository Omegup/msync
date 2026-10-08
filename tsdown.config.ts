import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'dist/index.js',
  format: ['cjs', 'esm'],
  outDir: 'dist',
  clean: false,
  dts: false,
  tsconfig: false,
  outExtensions: ({ format }) => ({
    js: format === 'es' ? '.esm.js' : '.js',
  }),
})