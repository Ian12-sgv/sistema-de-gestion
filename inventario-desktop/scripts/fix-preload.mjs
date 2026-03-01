// scripts/fix-preload.mjs
import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd() // inventario-desktop
const distElectron = path.join(cwd, 'dist-electron')

const mjs = path.join(distElectron, 'preload.mjs')
const cjs = path.join(distElectron, 'preload.cjs')

function fail(msg) {
  console.error(`\n[fix-preload] ERROR: ${msg}\n`)
  process.exit(1)
}

function log(msg) {
  console.log(`[fix-preload] ${msg}`)
}

if (!fs.existsSync(distElectron)) {
  fail(`No existe ${distElectron}. Primero ejecuta el build de Electron (vite build con electron.vite.config.ts).`)
}

if (!fs.existsSync(mjs)) {
  log(`No existe preload.mjs en ${distElectron}. Nada que hacer.`)
  process.exit(0)
}

const txt = fs.readFileSync(mjs, 'utf8')
const pareceCjs = txt.includes('require(') || txt.includes('module.exports')

if (!pareceCjs) {
  log('preload.mjs parece ESM real (no usa require). No creo preload.cjs.')
  process.exit(0)
}

fs.copyFileSync(mjs, cjs)
log(`Creado: ${path.relative(cwd, cjs)} (copia de preload.mjs porque usa require)`)