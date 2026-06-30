import { defineConfig } from 'vite'

// Honor a PORT provided by the environment (e.g. the preview harness),
// falling back to Vite's default for local `npm run dev`.
export default defineConfig({
  // Relative base so the build works both locally and when served from a
  // GitHub Pages project subpath (username.github.io/PanicBuffet/).
  base: './',
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
})
