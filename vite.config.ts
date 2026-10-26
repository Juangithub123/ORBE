import { defineConfig } from 'vite';

// base:
// - en desarrollo: '/'
// - build web (GitHub Pages, repo "ORBE"): '/ORBE/'
// - build para Electron (`--mode electron`): './' (rutas relativas, se abre desde archivo)
export default defineConfig(({ command, mode }) => ({
  base: command === 'serve' ? '/' : mode === 'electron' ? './' : '/ORBE/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
