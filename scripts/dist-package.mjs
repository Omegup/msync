import { copyFileSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const published = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  repository: pkg.repository,
  homepage: pkg.homepage,
  license: pkg.license,
  bugs: pkg.bugs,
  main: 'index.js',
  module: 'index.esm.js',
  typings: 'index.d.ts',
  dependencies: {
    dayjs: pkg.dependencies.dayjs,
    dotenv: pkg.dependencies.dotenv,
    'json-canonicalize': pkg.dependencies['json-canonicalize'],
    mongodb: pkg.dependencies.mongodb,
  },
}
writeFileSync(join(root, 'dist/package.json'), JSON.stringify(published, null, 4) + '\n')
copyFileSync(join(root, 'README.md'), join(root, 'dist/README.md'))
copyFileSync(join(root, 'LICENSE'), join(root, 'dist/LICENSE'))
