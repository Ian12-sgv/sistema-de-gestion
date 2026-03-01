// scripts/sync-backend.mjs
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const cwd = process.cwd() // inventario-desktop
const backendSrc = path.resolve(cwd, '..', 'inventory-backend') // carpeta hermana
const backendDst = path.resolve(cwd, 'backend') // carpeta que Electron usará

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function log(msg) {
  console.log(`[sync-backend] ${msg}`)
}

function fail(msg) {
  console.error(`\n[sync-backend] ERROR: ${msg}\n`)
  process.exit(1)
}

function exists(p) {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function rmDirSafe(dir) {
  if (exists(dir)) fs.rmSync(dir, { recursive: true, force: true })
}

function copyFileSafe(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  fs.copyFileSync(src, dst)
}

function copyDir(srcDir, dstDir) {
  if (!exists(srcDir)) return
  fs.mkdirSync(dstDir, { recursive: true })
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name)
    const dst = path.join(dstDir, ent.name)
    if (ent.isDirectory()) copyDir(src, dst)
    else if (ent.isSymbolicLink()) {
      const real = fs.realpathSync(src)
      const stat = fs.statSync(real)
      if (stat.isDirectory()) copyDir(real, dst)
      else copyFileSafe(real, dst)
    } else {
      copyFileSafe(src, dst)
    }
  }
}

function run(cmd, args, opts = {}) {
  log(`RUN: ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...opts
  })
  if (res.status !== 0) {
    fail(`Falló: ${cmd} ${args.join(' ')} (exit=${res.status})`)
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function ensureBackendSource() {
  if (!exists(backendSrc)) {
    fail(`No existe backend fuente: ${backendSrc}\nAsegúrate de que tu backend esté en ../inventory-backend`)
  }
  const pkg = path.join(backendSrc, 'package.json')
  if (!exists(pkg)) {
    fail(`No existe ${pkg}. Esa carpeta no parece un proyecto Node/NestJS.`)
  }
}

function detectBuildOutputDirCandidates() {
  // Nest suele usar nest-cli.json / nest.json compilerOptions.outputPath
  const nestCli =
    readJsonSafe(path.join(backendSrc, 'nest-cli.json')) ||
    readJsonSafe(path.join(backendSrc, 'nest.json'))

  const nestOut = nestCli?.compilerOptions?.outputPath
  const tsBuild = readJsonSafe(path.join(backendSrc, 'tsconfig.build.json'))
  const tsOut = tsBuild?.compilerOptions?.outDir

  const candidates = []
  if (typeof nestOut === 'string' && nestOut.trim()) candidates.push(nestOut.trim())
  if (typeof tsOut === 'string' && tsOut.trim()) candidates.push(tsOut.trim())
  candidates.push('dist') // fallback esperado

  // únicos, en orden
  return [...new Set(candidates)]
}

function findAllFilesNamed(dir, fileName, maxDepth = 10) {
  const out = []
  function walk(curr, depth) {
    if (depth > maxDepth) return
    let entries
    try {
      entries = fs.readdirSync(curr, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      const p = path.join(curr, ent.name)
      if (ent.isDirectory()) walk(p, depth + 1)
      else if (ent.isFile() && ent.name === fileName) out.push(p)
    }
  }
  walk(dir, 0)
  return out
}

function pickMainJs(distDir) {
  const direct = path.join(distDir, 'main.js')
  if (exists(direct)) return direct

  const common = path.join(distDir, 'src', 'main.js')
  if (exists(common)) return common

  const all = findAllFilesNamed(distDir, 'main.js', 12)
  if (all.length === 0) return null

  // Heurística: si hay muchos, prioriza uno que termine en "/src/main.js"
  const srcCandidate = all.find((p) => p.replaceAll('\\', '/').endsWith('/src/main.js'))
  return srcCandidate ?? all[0]
}

function buildBackendSource() {
  log(`Backend fuente: ${backendSrc}`)

  // deps backend fuente (solo si no existen)
  const nm = path.join(backendSrc, 'node_modules')
  if (!exists(nm)) {
    const lock = path.join(backendSrc, 'package-lock.json')
    if (exists(lock)) run(npmCmd, ['ci'], { cwd: backendSrc })
    else run(npmCmd, ['install'], { cwd: backendSrc })
  }

  // build
  run(npmCmd, ['run', 'build'], { cwd: backendSrc })

  // detectar outputPath real
  const outCandidates = detectBuildOutputDirCandidates()
  let distDir = null
  for (const rel of outCandidates) {
    const abs = path.join(backendSrc, rel)
    if (exists(abs) && fs.statSync(abs).isDirectory()) {
      distDir = abs
      break
    }
  }
  if (!distDir) {
    fail(
      `Nest build terminó pero no existe la carpeta de salida.\n` +
        `Busqué: ${outCandidates.map((c) => path.join(backendSrc, c)).join(' | ')}`
    )
  }

  const mainAbs = pickMainJs(distDir)
  if (!mainAbs) {
    fail(
      `Nest build generó ${distDir} pero no encontré ningún main.js dentro.\n` +
        `Ejecuta en el backend: find "${distDir}" -maxdepth 12 -name "main.js" -print`
    )
  }

  return { distDir, mainAbs }
}

function prepareBackendDst() {
  log(`Destino backend embebido: ${backendDst}`)
  ensureDir(backendDst)

  rmDirSafe(path.join(backendDst, 'dist'))
  rmDirSafe(path.join(backendDst, 'prisma'))
  rmDirSafe(path.join(backendDst, 'node_modules'))

  copyFileSafe(path.join(backendSrc, 'package.json'), path.join(backendDst, 'package.json'))

  const lock = path.join(backendSrc, 'package-lock.json')
  if (exists(lock)) {
    copyFileSafe(lock, path.join(backendDst, 'package-lock.json'))
  }

  const prismaSrc = path.join(backendSrc, 'prisma')
  if (!exists(prismaSrc)) {
    fail(`No existe carpeta prisma/ en el backend fuente: ${prismaSrc}`)
  }
  copyDir(prismaSrc, path.join(backendDst, 'prisma'))
}

function installProdDepsAndGenerate() {
  const lock = path.join(backendDst, 'package-lock.json')
  if (exists(lock)) run(npmCmd, ['ci', '--omit=dev'], { cwd: backendDst })
  else run(npmCmd, ['install', '--omit=dev'], { cwd: backendDst })

  run(npxCmd, ['prisma', 'generate'], { cwd: backendDst })
}

function writeShimIfNeeded(mainRel) {
  const normalized = mainRel.replaceAll('\\', '/')
  if (normalized === 'main.js') return // ya está en raíz

  if (normalized.startsWith('..')) {
    fail(`Ruta inválida del main.js detectado: ${mainRel}`)
  }

  const shimPath = path.join(backendDst, 'dist', 'main.js')
  const shim = [
    '/* Auto-generado por scripts/sync-backend.mjs */',
    `require('./${normalized}');`,
    ''
  ].join('\n')

  fs.writeFileSync(shimPath, shim, 'utf8')
  log(`Shim creado: backend/dist/main.js -> ./${normalized}`)
}

function copyDistAndEnsureEntry(distDir, mainAbs) {
  const distDst = path.join(backendDst, 'dist')
  copyDir(distDir, distDst)

  const mainRel = path.relative(distDir, mainAbs)
  writeShimIfNeeded(mainRel)

  const entryDst = path.join(backendDst, 'dist', 'main.js')
  if (!exists(entryDst)) {
    fail(`No quedó ${entryDst}. Algo falló copiando la salida del backend.`)
  }
}

function main() {
  log('Iniciando sincronización…')
  ensureBackendSource()

  const { distDir, mainAbs } = buildBackendSource()

  prepareBackendDst()
  installProdDepsAndGenerate()
  copyDistAndEnsureEntry(distDir, mainAbs)

  log('OK ✅ backend listo en inventario-desktop/backend/dist/main.js')
}

main()