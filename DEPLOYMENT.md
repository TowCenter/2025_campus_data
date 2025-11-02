# Deployment Guide

Quick guide to deploy your University Response Tracker website.

## Prerequisites

✅ Node.js 18+ installed  
✅ Data uploaded to AWS S3  
✅ S3 URL configured in `DataExplorer.svelte`

## Quick Start

```bash
# Install dependencies
npm install

# Test locally
npm run dev

# Build for production
npm run build
```

## Deployment Options

### 🚀 Option 1: Netlify (Easiest - Recommended)

**Pros**: Free hosting, automatic deploys, CDN, HTTPS included

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/university-tracker.git
   git push -u origin main
   ```

2. **Deploy on Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy site"

3. **Custom Domain** (optional):
   - Go to Site settings → Domain management
   - Add custom domain
   - Update DNS records as instructed

**That's it!** Netlify will auto-deploy on every push to main.

### ⚡ Option 2: Vercel (Also Easy)

**Pros**: Similar to Netlify, great performance

1. Push code to GitHub (same as above)

2. Deploy on Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import from GitHub
   - Framework Preset: Vite
   - Build settings:
     - Build command: `npm run build`
     - Output directory: `dist`
   - Deploy!

### 🌐 Option 3: GitHub Pages

**Pros**: Free, integrated with GitHub  
**Cons**: A bit more setup

1. **Install gh-pages**:
   ```bash
   npm install -D gh-pages
   ```

2. **Update `package.json`**:
   ```json
   {
     "scripts": {
       "deploy": "npm run build && gh-pages -d dist"
     }
   }
   ```

3. **Update `vite.config.js`**:
   ```javascript
   export default defineConfig({
     base: '/2025_Tow_university-response-tracker/',
     plugins: [svelte()],
     // ... rest of config
   });
   ```

4. **Deploy**:
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages**:
   - Go to repository Settings
   - Pages section
   - Source: gh-pages branch
   - Save

Your site will be at: `https://yourusername.github.io/2025_Tow_university-response-tracker/`

### 🏢 Option 4: Traditional Web Host (cPanel, etc.)

**For**: Shared hosting, cPanel, FTP access

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Upload files**:
   - Upload entire `dist/` folder contents to your web server
   - Make sure files are in the public directory (usually `public_html` or `www`)

3. **Configure domain**:
   - Point your domain to the uploaded directory
   - Done!

### ☁️ Option 5: AWS S3 + CloudFront (Advanced)

**For**: Maximum control, same AWS account as data

1. **Build**:
   ```bash
   npm run build
   ```

2. **Create S3 bucket for website**:
   - Different from your data bucket!
   - Enable static website hosting
   - Upload `dist/` contents

3. **Set up CloudFront**:
   - Create distribution pointing to website bucket
   - Enable HTTPS
   - Set up custom domain

4. **Automate with AWS CLI**:
   ```bash
   aws s3 sync dist/ s3://your-website-bucket/ --delete
   aws cloudfront create-invalidation --distribution-id YOURDISTR --paths "/*"
   ```

## Post-Deployment Checklist

After deploying, verify:

- [ ] Website loads correctly
- [ ] Navigation works (Methodology ↔ Data pages)
- [ ] Data loads from S3 (check browser console for errors)
- [ ] Search functionality works
- [ ] School selection/deselection works
- [ ] CSV download works
- [ ] JSON download works
- [ ] "Last Updated" timestamp appears
- [ ] Mobile responsive (test on phone)
- [ ] HTTPS is enabled (green lock icon)

## Continuous Deployment

### Netlify & Vercel (Automatic)

These platforms automatically redeploy when you push to GitHub:

```bash
# Make changes
git add .
git commit -m "Update methodology"
git push

# Site auto-deploys in ~2 minutes!
```

### GitHub Pages (Manual)

```bash
# Make changes
git add .
git commit -m "Update styling"
git push

# Deploy
npm run deploy
```

### Traditional Host (Manual)

```bash
# Make changes and build
npm run build

# Upload dist/ folder via FTP/cPanel
```

## Environment-Specific Configuration

If you need different S3 URLs for dev/production:

1. **Create `.env` files**:
   
   `.env.development`:
   ```
   VITE_S3_URL=https://dev-bucket.s3.amazonaws.com/data.json
   ```
   
   `.env.production`:
   ```
   VITE_S3_URL=https://prod-bucket.s3.amazonaws.com/data.json
   ```

2. **Update `DataExplorer.svelte`**:
   ```javascript
   const S3_BUCKET_URL = import.meta.env.VITE_S3_URL || 
     'https://fallback-url.s3.amazonaws.com/data.json';
   ```

3. **Netlify/Vercel**: Add environment variables in dashboard

## Troubleshooting

### Build Fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Data Not Loading After Deploy

1. Check S3 URL in deployed code
2. Verify CORS configuration
3. Check browser console for errors
4. Test S3 URL directly in browser

### "404 Not Found" on Page Refresh

**Solution**: Configure redirects

**Netlify**: Create `public/_redirects` file:
```
/*    /index.html   200
```

**Vercel**: Create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Styling Looks Different After Deploy

- Clear browser cache
- Check if build completed successfully
- Verify all CSS files are in dist/

## Performance Tips

1. **Enable Gzip/Brotli**: Most platforms do this automatically

2. **Optimize S3 Data**:
   - Consider compressing JSON
   - Use CloudFront for caching

3. **Lazy Load**: If data gets very large, consider pagination or lazy loading

4. **Monitor**: Use built-in analytics from Netlify/Vercel

## Updating Content

### Update Methodology:
1. Edit `Methodology.svelte`
2. Commit and push (auto-deploys) or run build/upload

### Update Data:
1. Upload new data.json to S3
2. Website automatically fetches latest data
3. "Last Updated" timestamp updates automatically

### Update Styling:
1. Edit component `.svelte` files
2. Commit and push/deploy

## Custom Domain Setup

### Netlify:
1. Domain settings → Add custom domain
2. Update DNS:
   - Add A record: `104.198.14.52`
   - Or CNAME: `yoursitename.netlify.app`

### Vercel:
1. Project settings → Domains
2. Add domain
3. Update DNS as instructed

### Cloudflare (Recommended):
1. Add site to Cloudflare
2. Point DNS to your host
3. Get free SSL, CDN, DDoS protection

## Support

If you run into issues:
- Check the main README.md
- Check AWS_SETUP.md for S3 issues
- Netlify/Vercel have excellent docs
- GitHub Issues for platform-specific problems

---

**Recommended Path for Most Users**: Netlify  
It's free, automatic, fast, and handles everything for you!
