import fs from 'fs'
import path from 'path'
import mkdirp from 'mkdirp'
import rimraf from 'rimraf'
import { compile } from 'ejs'
import { camelCase, upperFirst } from '../utils'

const { readdir } = fs.promises

const SVG_PATTERN = /^(.+)\.svg$/

const COMPONENT_TPL = fs.readFileSync(
  path.resolve(__dirname, './component.ejs'),
  'utf8'
)
const EXPORT_TPL = fs.readFileSync(
  path.resolve(__dirname, './export.ejs'),
  'utf8'
)
const renderComponent = compile(COMPONENT_TPL)
const renderExport = compile(EXPORT_TPL)

const VENDOR_PACKS = [
  'dls-illustrations-react',
  'dls-illustrations-vue',
  'dls-illustrations-vue-3',
]
const DATA_PACK = 'dls-graphics'

function getPackDir(name, ...rest) {
  return path.resolve(__dirname, `../../packages/${name}`, ...rest)
}

const DATA_DIR = getPackDir(DATA_PACK, 'dist')

function clearDir(dir) {
  rimraf.sync(dir)
  mkdirp.sync(dir)
}

async function getIllustrationSlugs() {
  const fileNames = await readdir(DATA_DIR)
  return fileNames
    .filter((fileName) => SVG_PATTERN.test(fileName))
    .map((fileName) => fileName.replace(SVG_PATTERN, '$1'))
}

async function build() {
  VENDOR_PACKS.forEach((pack) => {
    const illustrationDir = path.join(getPackDir(pack), 'src/illustrations')
    clearDir(illustrationDir)
  })

  const illustrations = await Promise.all(
    (
      await getIllustrationSlugs()
    ).map(async (slug) => {
      const name = camelCase(slug)
      const Name = upperFirst(name)

      const tplData = {
        name,
        Name,
      }

      const componentCode = renderComponent(tplData)

      VENDOR_PACKS.forEach((pack) => {
        const illustrationDir = path.join(getPackDir(pack), 'src/illustrations')
        fs.writeFileSync(
          path.join(illustrationDir, `${Name}.js`),
          componentCode,
          'utf8'
        )
      })

      return { slug, name, Name }
    })
  )

  const index =
    illustrations.map((data) => renderExport(data)).join('') +
    `export { createSVG } from './core'\n`

  VENDOR_PACKS.forEach((pack) => {
    const packDir = getPackDir(pack)
    fs.writeFileSync(path.join(packDir, 'src/index.js'), index, 'utf8')
  })

  console.log('Build vendors complete.')
}

export default build
