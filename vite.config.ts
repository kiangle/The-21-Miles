import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
const branchName = execSync('git branch --show-current').toString().trim()
const buildTimestamp = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(commitHash),
    __BUILD_BRANCH__: JSON.stringify(branchName),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
})
