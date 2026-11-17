import sharp from "sharp"
import fs from "fs"
import path from "path"

const SRC = path.resolve("scripts/icon-source.svg")
const MASKABLE_SRC = path.resolve("scripts/icon-maskable.svg")
const MASK_SRC = path.resolve("scripts/icon-mask.svg")
const OUT = path.resolve("public/icons")
const APP_FAVICON = path.resolve("src/app/favicon.ico")
const APP_ICON_SVG = path.resolve("src/app/icon.svg")

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const icoSizes = [16, 32, 48]

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

type IcoImage = { width: number; height: number; data: Buffer }

function buildIco(images: IcoImage[]) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const entries = Buffer.alloc(16 * images.length)
  let offset = 6 + entries.length

  images.forEach((image, index) => {
    const entry = index * 16
    entries.writeUInt8(image.width >= 256 ? 0 : image.width, entry)
    entries.writeUInt8(image.height >= 256 ? 0 : image.height, entry + 1)
    entries.writeUInt8(0, entry + 2)
    entries.writeUInt8(0, entry + 3)
    entries.writeUInt16LE(1, entry + 4)
    entries.writeUInt16LE(32, entry + 6)
    entries.writeUInt32LE(image.data.length, entry + 8)
    entries.writeUInt32LE(offset, entry + 12)
    offset += image.data.length
  })

  return Buffer.concat([header, entries, ...images.map((image) => image.data)])
}

async function main() {
  ensureDir(OUT)
  const svg = fs.readFileSync(SRC)
  const maskableSvg = fs.readFileSync(MASKABLE_SRC)
  const maskSvg = fs.readFileSync(MASK_SRC)

  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, `icon-${size}x${size}.png`))
  }

  for (const size of [192, 512]) {
    await sharp(maskableSvg)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, `icon-maskable-${size}x${size}.png`))
  }

  await sharp(maskableSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(OUT, "apple-touch-icon.png"))

  await sharp(maskSvg)
    .resize(512, 512)
    .png()
    .toFile(path.join(OUT, "mask-icon.png"))

  fs.copyFileSync(MASK_SRC, path.join(OUT, "mask-icon.svg"))
  fs.copyFileSync(SRC, path.join(OUT, "icon.svg"))

  await sharp(svg).resize(32, 32).png().toFile(path.resolve("public/favicon.png"))

  const icoImages = await Promise.all(
    icoSizes.map(async (size) => {
      const data = await sharp(svg).resize(size, size).png().toBuffer()
      return { width: size, height: size, data }
    }),
  )
  fs.writeFileSync(APP_FAVICON, buildIco(icoImages))

  fs.copyFileSync(SRC, APP_ICON_SVG)

  console.log("Icons generated in", OUT, "and", APP_FAVICON)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
