import sharp from "sharp"
import fs from "fs"
import path from "path"

const SRC = path.resolve("scripts/icon-source.svg")
const OUT = path.resolve("public/icons")

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

async function main() {
  ensureDir(OUT)
  const svg = fs.readFileSync(SRC)

  for (const size of sizes) {
    // any-purpose icon
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(OUT, `icon-${size}x${size}.png`))

    // maskable icon (512 only, with safe zone)
    if (size === 512) {
      await sharp(svg)
        .resize(410, 410) // 80% safe zone
        .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#0f172a" })
        .png()
        .toFile(path.join(OUT, "icon-maskable-512x512.png"))
    }
  }

  // apple touch icon 180x180
  await sharp(svg).resize(180, 180).png().toFile(path.join(OUT, "apple-touch-icon.png"))

  // favicon
  await sharp(svg).resize(32, 32).png().toFile(path.resolve("public/favicon.png"))

  console.log("Icons generated in", OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
