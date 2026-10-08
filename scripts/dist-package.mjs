import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import remapping from '@ampproject/remapping'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const build = join(root, '.build')
const dist = join(root, 'dist')
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

for (const mapName of ['index.js.map', 'index.esm.js.map']) {
  const mapPath = join(dist, mapName)
  const map = JSON.parse(readFileSync(mapPath, 'utf8'))
  const composed = remapping(map, (source, { importer }) => {
    const importerPath = importer ? resolve(dirname(mapPath), importer) : mapPath
    const sourcePath = resolve(dirname(importerPath), source)
    const sourceMapPath = `${sourcePath}.map`
    return existsSync(sourceMapPath) ? JSON.parse(readFileSync(sourceMapPath, 'utf8')) : null
  })
  writeFileSync(mapPath, JSON.stringify(composed) + '\n')
}

const copyDeclarations = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name)
    if (entry.isDirectory()) {
      copyDeclarations(source)
    } else if (entry.name.endsWith('.d.ts')) {
      const target = join(dist, relative(build, source))
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(source, target)
    }
  }
}

copyDeclarations(build)
writeFileSync(join(dist, 'package.json'), JSON.stringify(published, null, 4) + '\n')
copyFileSync(join(root, 'README.md'), join(dist, 'README.md'))
copyFileSync(join(root, 'LICENSE'), join(dist, 'LICENSE'))
rmSync(build, { recursive: true, force: true })
