import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  // 部署到 GitHub Pages 项目子路径时需要 base；仅 GitHub Actions 构建时启用，不影响本地开发
  base: process.env.GITHUB_ACTIONS === 'true' ? '/daoshi-webapp/' : '/',
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
