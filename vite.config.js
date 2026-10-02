import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { ensureCards } from "./scripts/update-cards.js"

export default defineConfig({
  plugins: [
    react(),
    // Fetch card data into generated/ on first dev/build of a fresh checkout.
    { name: "ensure-cards", buildStart: ensureCards },
  ],
  // Relative asset URLs so the build works under a GitHub Pages project path.
  base: "./",
})
