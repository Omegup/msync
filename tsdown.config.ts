import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: './.build/index.js',
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