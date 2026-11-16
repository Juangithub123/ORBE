import { defineConfig } from 'vite';

// base:
// - en desarrollo: '/'
// - build web (GitHub Pages, repo "ORBE"): '/ORBE/'
// - build para Electron (`--mode electron`): './' (rutas relativas, se abre desde archivo)
// - build para itch.io (`--mode itch`): './' (itch.io lo sirve desde una carpeta propia), en dist-itch/
export default defineConfig(({ command, mode }) => ({
  base: command === 'serve' ? '/' : mode === 'electron' || mode === 'itch' ? './' : '/ORBE/',
  build: {
    outDir: mode === 'itch' ? 'dist-itch' : 'dist',
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
