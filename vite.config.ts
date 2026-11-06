import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

const demoDir = fileURLToPath(new URL('./src/lib/demo/', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID)
  // Demo mode: on whenever Firebase isn't configured (force with VITE_DEMO=true / VITE_DEMO=false).
  const demo = env.VITE_DEMO ? env.VITE_DEMO === 'true' : !configured
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5174 },
    define: { __DEMO__: JSON.stringify(demo) },
    // In demo mode the Firebase SDKs are swapped for in-memory copies loaded with sample data.
    resolve: demo ? { alias: { 'firebase/firestore': `${demoDir}firestore.ts`, 'firebase/storage': `${demoDir}storage.ts`, 'firebase/app': `${demoDir}app.ts` } } : {},
  }
})
