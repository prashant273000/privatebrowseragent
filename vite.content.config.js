import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Separate build config for content.ts.
 *
 * Why IIFE? Chrome's content script injection (both manifest-declared and
 * chrome.scripting.executeScript) does NOT support ES modules that import
 * external chunk files. Building as a self-contained IIFE inlines every
 * dependency so the single content.js file is injectable without any external
 * imports.
 */
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'extension/content.ts'),
      name: 'PrivacyAgentContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        exports: 'none',
      },
    },
  },
});
