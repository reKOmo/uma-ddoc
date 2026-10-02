// The files copied from upstream must only import what scripts/update-code.js
// maps to our layout, or packages we have installed.

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { CODE_FILES, ROOT, importsOf, isInstalledPackage } from "../scripts/lib/upstream.js"

describe("files copied from upstream", () => {
  for (const file of CODE_FILES) {
    it(`${file.local} only uses mapped imports`, () => {
      const source = readFileSync(ROOT + file.local, "utf8")
      const mapped = Object.values(file.imports ?? {})
      const unexpected = importsOf(source)
        .map((i) => i.specifier)
        .filter((s) => !mapped.includes(s) && !isInstalledPackage(s))
      expect(unexpected).toEqual([])
    })
  }
})
