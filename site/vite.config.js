import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works on any GitHub Pages path
// (user.github.io/<repo>/) without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'assets' },
  server: {
    fs: {
      // The plaintext record and the password live in ../private/, outside this
      // directory. strict + an explicit allow-list keeps the dev server from
      // serving anything above the project root via /@fs/, and the deny rules
      // are a second line of defence if those files are ever copied back in.
      strict: true,
      allow: ['.'],
      deny: ['**/private/**', '**/content.json', '**/password.txt', '**/*.bin', '**/*.mbox', '**/*.eml'],
    },
  },
  preview: {
    fs: {
      strict: true,
      allow: ['.'],
      deny: ['**/private/**', '**/content.json', '**/password.txt', '**/*.bin', '**/*.mbox', '**/*.eml'],
    },
  },
})
