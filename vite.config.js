/**
 * Vite Configuration
 *
 * Build configuration for the University Response Tracker application.
 * Configured for deployment to GitHub Pages with client-side routing support.
 */

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom Vite plugin to support client-side routing on GitHub Pages
 *
 * GitHub Pages serves 404.html for any route that doesn't match a file.
 * By copying index.html to 404.html, we enable client-side routing to work
 * properly - when users navigate to /methodology or refresh the page, GitHub
 * Pages will serve 404.html (which is actually our app), and our router will
 * handle the path correctly.
 */
function copyIndexTo404() {
  let outDir = 'dist';
  return {
    name: 'copy-index-to-404',
    // Store the output directory path once Vite config is resolved
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // After build completes, copy index.html to 404.html
    closeBundle() {
      const indexPath = path.join(outDir, 'index.html');
      const notFoundPath = path.join(outDir, '404.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
      }
    }
  };
}

export default defineConfig({
  plugins: [
    svelte(),           // Svelte 5 compiler and HMR
    copyIndexTo404()    // Enable client-side routing on GitHub Pages
  ],

  // Base path for GitHub Pages deployment
  // Update this if deploying to a different path
  base: '/2025_campus_data/',

  build: {
    outDir: 'dist',           // Output directory for production build
    assetsDir: 'assets',      // Directory for static assets (JS, CSS, images)
    sourcemap: false,         // Disable source maps for production (reduce file size)
  },

  server: {
    port: 3000,               // Local development server port
    open: true,               // Automatically open browser on dev server start
  },
});
