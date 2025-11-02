# 🚀 Quick Start Guide

Get your University Response Tracker website running in 10 minutes!

## What You're Getting

A professional data dashboard website with:
- ✅ Methodology page with placeholder content for your text
- ✅ Interactive data explorer with searchable table
- ✅ Checkbox selection for specific universities
- ✅ CSV and JSON download options
- ✅ AWS S3 integration for automatic data updates
- ✅ "Last Updated" timestamp
- ✅ Mobile-responsive design matching Tow Center style
- ✅ Automatically excludes `llm_response` and `scraper` columns from downloads

## 📋 Before You Start

You need:
1. Your data in JSON format (18,000 records)
2. AWS account with S3 access
3. Node.js 18+ installed on your computer

## 🎯 Setup in 3 Steps

### Step 1: Install Dependencies (2 minutes)

```bash
# Navigate to the project folder
cd university-response-tracker

# Install packages
npm install
```

### Step 2: Configure AWS S3 (5 minutes)

**A. Upload your data to S3:**
1. Go to AWS S3 Console
2. Create bucket (e.g., `university-responses-data`)
3. Upload your `data.json` file
4. Make file publicly readable
5. Configure CORS (see AWS_SETUP.md for details)

**B. Update the website:**

Open `DataExplorer.svelte` and change line 5:

```javascript
const S3_BUCKET_URL = 'https://YOUR-BUCKET.s3.YOUR-REGION.amazonaws.com/data.json';
```

### Step 3: Test Locally (1 minute)

```bash
npm run dev
```

Visit `http://localhost:3000` - your site is running!

## ✅ Verify Everything Works

- [ ] Methodology page displays
- [ ] Data & Downloads page loads
- [ ] Search bar filters universities
- [ ] Checkboxes select/deselect schools
- [ ] "Download Selected CSV" works
- [ ] "Download All JSON" works
- [ ] "Last Updated" shows correct date

## 🌐 Deploy to Production

**Easiest Option - Netlify (Free):**

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/2025_Tow_university-response-tracker.git
git push -u origin main

# 2. Go to netlify.com
# 3. Click "Add new site" → Import from GitHub
# 4. Build command: npm run build
# 5. Publish directory: dist
# 6. Deploy!
```

Done! Your site is live with automatic deployments.

See DEPLOYMENT.md for other hosting options (Vercel, GitHub Pages, etc.)

## 📝 Customize Content

### Update Methodology:
Edit `Methodology.svelte` - replace placeholder text with your actual methodology.

### Add Charts:
The methodology page has placeholder sections for charts. To add real charts:

```bash
# Install a chart library
npm install chart.js

# Then import and use in Methodology.svelte
```

### Change Styling:
All styles are in the `<style>` sections of each `.svelte` file. Main colors:
- Primary: `#4a9eff`
- Dark: `#1a1a1a`
- Light: `#f8f9fa`

## 🔄 Weekly Data Updates

To update your data weekly:

**Option 1: Manual (Simplest)**
1. Export new data.json
2. Upload to S3 (overwrites old file)
3. Done! Website auto-fetches new data

**Option 2: Automated**
See AWS_SETUP.md for scripts to automate uploads via:
- AWS CLI + Cron jobs
- GitHub Actions
- Lambda functions

## 📚 Full Documentation

- **README.md** - Complete feature documentation
- **AWS_SETUP.md** - Detailed S3 configuration
- **DEPLOYMENT.md** - All deployment options
- **This file** - Quick start guide

## 🆘 Troubleshooting

### Data not loading?
- Check S3 URL in DataExplorer.svelte
- Verify CORS is configured in S3
- Check browser console for errors
- Test S3 URL directly in browser

### Build failing?
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Need help?
- Check the detailed guides (README, AWS_SETUP, DEPLOYMENT)
- All styling is self-contained in the Svelte components
- Data format must match the structure shown in the sample

## 📊 Data Format Requirements

Your JSON should be an array of objects with these fields:

```json
[
  {
    "_id": { "$oid": "..." },
    "url": "https://...",
    "content": "Statement text...",
    "date": { "$date": "2024-04-26T00:00:00.000Z" },
    "last_updated_at": { "$date": "2025-06-26T18:28:54.790Z" },
    "title": "Message title",
    "org": "Stanford University",
    "llm_response": { ... },  // Excluded from downloads
    "scraper": "..."  // Excluded from downloads
  }
]
```

The `org` field is used to create the list of universities in the table.

## ✨ Features Included

1. **Smart Search**: Auto-filters universities as you type
2. **Bulk Selection**: Select all or individual universities
3. **Flexible Export**: Download selected data or everything
4. **Format Options**: CSV or JSON exports
5. **Data Cleaning**: Automatically removes internal fields
6. **Auto-Update**: Fetches latest data from S3 on load
7. **Responsive**: Works on all devices
8. **Accessible**: Keyboard navigation, screen reader friendly

---

**Questions?** Check the comprehensive documentation files included with your download!

**Ready to launch?** Follow the 3 steps above and you'll be live in minutes! 🎉
