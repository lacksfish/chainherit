import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import pkg from './package.json'

import dotenv from 'dotenv'
dotenv.config({ path: `.env` })

export default defineConfig((({ command }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    plugins: [
      nodePolyfills({
        globals: {
          Buffer: true,
        }
      }),
      vue(),
      electron({
        main: {
          entry: 'electron/main.js',
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/',
              rollupOptions: {
                external: [
                  '@prisma/client',
                  '.prisma/client',
                  'prisma'
                ]
              },
            },
          },
        },
        preload: {
          input: path.join(__dirname, 'electron/preload.js'),
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/',
              rollupOptions: {
              },
            },
          },
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      }
    },
    optimizeDeps: { }
  }
}))
