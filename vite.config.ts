import { defineConfig } from 'vite'

// Honor a PORT provided by the environment (e.g. the preview harness),
// falling back to Vite's default for local `npm run dev`.
export default defineConfig({
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
  },
})
