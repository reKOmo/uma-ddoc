// Syncs the tier list calculation, scenario presets and upstream's test for
// them with upstream main, then verifies the result (tests + app build). If
// verification fails, every touched file is restored. Card data is separate:
// see scripts/update-cards.js.
//
// Usage:
//   pnpm update-code            update to upstream main
//   pnpm update-code --check    only report whether upstream differs
//   pnpm update-code --force    re-verify even if nothing changed
//
// Exit codes (for CI / alerting):
//   0  already in sync, or updated and verified
//   1  update failed verification and was rolled back
//   2  couldn't check or download (network, GitHub API, file gone upstream)
//   3  --check only: upstream differs from the local code
//
// Each run also writes update-status.json describing what happened.

import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { CODE_FILES, ROOT, download, latestRef, toLocal } from "./lib/upstream.js"

const STATUS_FILE = `${ROOT}update-status.json`
const BACKUP_DIR = `${ROOT}.update-backup/`
const LOCAL_FILES = CODE_FILES.map((f) => f.local)

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)

// `files` lists everything this script manages, for the workflow's PR.
function finish(code, status) {
  const full = { ...status, files: LOCAL_FILES, checked_at: new Date().toISOString(), exit_code: code }
  writeFileSync(STATUS_FILE, JSON.stringify(full, null, 2) + "\n")
  console.log(`\n${status.result.toUpperCase()}: ${status.message}`)
  process.exit(code)
}

function backup() {
  rmSync(BACKUP_DIR, { recursive: true, force: true })
  for (const path of LOCAL_FILES) cpSync(ROOT + path, BACKUP_DIR + path)
}

function restore() {
  for (const path of LOCAL_FILES) cpSync(BACKUP_DIR + path, ROOT + path)
  rmSync(BACKUP_DIR, { recursive: true, force: true })
}

// Runs one verification step; returns null on success or the failure output.
function step(name, command, commandArgs) {
  console.log(`\n▶ ${name}`)
  const run = spawnSync(command, commandArgs, { cwd: ROOT, encoding: "utf8" })
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`
  if (run.status === 0) {
    console.log("  ok")
    return null
  }
  console.log(output)
  return output.split("\n").slice(-60).join("\n")
}

// What each local file should contain to match upstream main.
let ref, short
const wanted = {}
try {
  ref = await latestRef()
  short = ref.slice(0, 10)
  console.log(`Upstream main is at ${short}`)
  const sources = await download(ref, CODE_FILES)
  for (const file of CODE_FILES) wanted[file.local] = toLocal(file, sources[file.upstream])
} catch (err) {
  finish(2, { result: "error", message: `Couldn't fetch upstream code: ${err.message}` })
}

const changed = LOCAL_FILES.filter((path) => readFileSync(ROOT + path, "utf8") !== wanted[path])

if (changed.length === 0 && !flag("--force")) {
  finish(0, { result: "up-to-date", message: `Code matches upstream ${short}`, ref })
}

if (flag("--check")) {
  finish(3, { result: "update-available", message: `Upstream ${short} changes ${changed.join(", ")}`, ref, changed })
}

backup()
for (const path of changed) writeFileSync(ROOT + path, wanted[path])
console.log(changed.length ? `Changed: ${changed.join(", ")}` : "No files changed.")

// The tests fetch card data first if it's missing (test/global-setup.js).
let failure = null
for (const [name, command, commandArgs] of [
  ["Run tests", "pnpm", ["exec", "vitest", "run"]],
  ["Build app", "pnpm", ["exec", "vite", "build", "--outDir", `${BACKUP_DIR}dist`, "--emptyOutDir"]],
]) {
  const output = step(name, command, commandArgs)
  if (output !== null) {
    failure = { step: name, output }
    break
  }
}

if (failure) {
  restore()
  finish(1, {
    result: "failed",
    message: `"${failure.step}" failed with upstream ${short}; local code left unchanged`,
    ref,
    changed,
    failed_step: failure.step,
    output: failure.output,
  })
}

rmSync(BACKUP_DIR, { recursive: true, force: true })
finish(0, {
  result: "updated",
  message: changed.length
    ? `Synced with upstream ${short} (${changed.join(", ")})`
    : `Re-verified against upstream ${short} (no files changed)`,
  ref,
  changed,
})
