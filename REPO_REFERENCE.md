# Quick Reference - Your Repository

**Repository Name**: `2025_Tow_university-response-tracker`

## Git Setup Commands

```bash
# Initialize and connect to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/2025_Tow_university-response-tracker.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

## GitHub Pages URL

If you deploy to GitHub Pages, your URL will be:
```
https://YOUR-USERNAME.github.io/2025_Tow_university-response-tracker/
```

## Vite Config for GitHub Pages

If using GitHub Pages, update `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/2025_Tow_university-response-tracker/',  // Add this line
  plugins: [svelte()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

## NPM Scripts

```bash
npm install          # Install dependencies
npm run dev          # Run development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Deployment to Netlify

1. Push to GitHub (using commands above)
2. Go to [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect to GitHub
5. Select: `2025_Tow_university-response-tracker`
6. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
7. Deploy!

Your Netlify URL will be something like:
```
https://2025-tow-university-response-tracker.netlify.app
```

You can customize this to a custom domain later.

## Important File Locations

- **S3 URL to update**: `DataExplorer.svelte` line 5
- **Methodology content**: `Methodology.svelte` (entire file)
- **Project name**: `package.json` (already updated!)
- **Site title**: `index.html` and `App.svelte`

## Repository Structure

```
2025_Tow_university-response-tracker/
├── .gitignore
├── App.svelte
├── DataExplorer.svelte
├── Methodology.svelte
├── index.html
├── main.js
├── package.json
├── vite.config.js
├── svelte.config.js
├── sample-data.json
└── [Documentation files]
```

## First Time Setup

```bash
# 1. Clone or download the repository
cd 2025_Tow_university-response-tracker

# 2. Install dependencies
npm install

# 3. Update S3 URL in DataExplorer.svelte (line 5)
# Edit the file and change:
const S3_BUCKET_URL = 'https://your-bucket.s3.amazonaws.com/data.json';

# 4. Test locally
npm run dev

# 5. Build
npm run build

# 6. Deploy (choose one method from DEPLOYMENT.md)
```

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server (localhost:3000)

# Building
npm run build           # Create production build in dist/
npm run preview         # Preview production build

# Git workflow
git status              # Check what changed
git add .               # Stage all changes
git commit -m "message" # Commit with message
git push                # Push to GitHub

# Deployment (Netlify CLI - optional)
npm install -g netlify-cli
netlify deploy --prod
```

## Environment Variables

If you need different S3 URLs for dev/production:

Create `.env` files:

**`.env.development`**
```
VITE_S3_URL=https://dev-bucket.s3.amazonaws.com/data.json
```

**`.env.production`**
```
VITE_S3_URL=https://prod-bucket.s3.amazonaws.com/data.json
```

Then update `DataExplorer.svelte` line 5:
```javascript
const S3_BUCKET_URL = import.meta.env.VITE_S3_URL || 
  'https://fallback-url.s3.amazonaws.com/data.json';
```

## Common Issues

**Issue**: Repository name too long for some commands  
**Solution**: Use quotes: `cd "2025_Tow_university-response-tracker"`

**Issue**: GitHub Pages shows 404  
**Solution**: Make sure `base` in vite.config.js matches repository name

**Issue**: Netlify build fails  
**Solution**: Check Node version (needs 18+) in Netlify settings

## URLs at a Glance

- **GitHub**: `github.com/YOUR-USERNAME/2025_Tow_university-response-tracker`
- **GitHub Pages**: `YOUR-USERNAME.github.io/2025_Tow_university-response-tracker/`
- **Netlify**: `2025-tow-university-response-tracker.netlify.app`
- **Custom**: Whatever domain you choose!

---

**Repository**: 2025_Tow_university-response-tracker  
**Updated**: Package.json and deployment docs reflect this name  
**Ready**: Yes! Just follow QUICKSTART.md
