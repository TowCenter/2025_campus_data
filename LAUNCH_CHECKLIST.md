# 🚀 Pre-Launch Checklist

Use this checklist before launching your University Response Tracker to the public.

## 📋 Configuration Checklist

### AWS S3 Setup
- [ ] S3 bucket created
- [ ] Data uploaded as JSON file
- [ ] File set to public-read permissions
- [ ] CORS configuration added
- [ ] S3 URL tested in browser (should download JSON)
- [ ] S3 URL added to `DataExplorer.svelte` (line 5)

### Content Updates
- [ ] Methodology text updated (replace all placeholders in `Methodology.svelte`)
- [ ] Charts added to methodology (or placeholders removed)
- [ ] Project title updated in `App.svelte` if needed
- [ ] Footer links verified (CJR, Tow Center)
- [ ] Page meta tags updated in `index.html` (title, description)

### Data Verification
- [ ] Data format matches expected structure (see sample-data.json)
- [ ] All records have `org` field (institution name)
- [ ] All records have `last_updated_at` field
- [ ] `llm_response` and `scraper` fields present (they'll be excluded from downloads)
- [ ] Date fields in correct format: `{ "$date": "ISO-8601-date" }`

## 🧪 Testing Checklist

### Local Testing (npm run dev)
- [ ] Site loads without errors (check browser console)
- [ ] Data loads from S3 (check Network tab)
- [ ] Both pages accessible (Methodology, Data & Downloads)
- [ ] Navigation works correctly
- [ ] "Last Updated" displays correct date

### Functionality Testing
- [ ] Search bar filters universities
- [ ] "Select All" checkbox works
- [ ] Individual checkboxes work
- [ ] Selected count updates correctly
- [ ] "Download Selected CSV" works (with schools selected)
- [ ] "Download Selected JSON" works (with schools selected)
- [ ] "Download All CSV" works
- [ ] "Download All JSON" works
- [ ] Downloaded files exclude `llm_response` and `scraper` fields
- [ ] Table pagination works (if more than 50 schools)

### Content Testing
- [ ] Methodology text is readable and formatted correctly
- [ ] No placeholder text visible (unless intentional)
- [ ] No typos in visible text
- [ ] All links work (footer links, etc.)

### Responsive Testing
- [ ] Test on mobile phone (actual device or browser dev tools)
- [ ] Test on tablet
- [ ] Test on desktop (1920x1080)
- [ ] Navigation usable on mobile
- [ ] Table scrolls horizontally on mobile if needed
- [ ] Buttons are tappable on mobile
- [ ] Text is readable on all devices

### Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (Mac/iOS)
- [ ] Check for console errors in each browser

### Performance Testing
- [ ] Initial page load < 3 seconds
- [ ] Data loads within 5 seconds
- [ ] Search responds instantly
- [ ] Download completes within 10 seconds (for full dataset)
- [ ] No browser freezing with large datasets

## 🌐 Deployment Checklist

### Pre-Deploy
- [ ] Run `npm run build` successfully
- [ ] Check `dist/` folder contains all files
- [ ] Test production build locally (`npm run preview`)
- [ ] Git repository created (if using Netlify/Vercel)
- [ ] `.gitignore` includes node_modules/ and dist/

### Deploy
- [ ] Site deployed to hosting platform
- [ ] Custom domain configured (if using)
- [ ] HTTPS enabled (green lock icon)
- [ ] DNS propagated (if custom domain)

### Post-Deploy Verification
- [ ] Live site loads correctly
- [ ] Data loads from S3 (not locally cached)
- [ ] All functionality works on live site
- [ ] Test from different network (mobile data)
- [ ] Check analytics/monitoring is working (if set up)

## 📱 Mobile-Specific Checks

### iOS
- [ ] Test in Safari
- [ ] Add to home screen test
- [ ] Check touch interactions
- [ ] Verify scrolling is smooth

### Android
- [ ] Test in Chrome
- [ ] Test in Samsung Internet (if available)
- [ ] Check touch interactions
- [ ] Verify scrolling is smooth

## 🔒 Security Checklist

### Data Privacy
- [ ] Confirm no sensitive data in dataset
- [ ] Verify `llm_response` excluded from downloads
- [ ] Verify `scraper` excluded from downloads
- [ ] Check that only intended data is public

### Infrastructure
- [ ] S3 bucket has appropriate permissions (public read for data file only)
- [ ] No AWS credentials in code
- [ ] HTTPS enforced on live site
- [ ] No exposed API keys or secrets

## 📊 Data Quality Checks

### Before Launch
- [ ] All 18,000 records present in S3
- [ ] No duplicate records (check by `_id`)
- [ ] All institutions have names (`org` field)
- [ ] Dates are valid and reasonable
- [ ] URLs are properly formatted
- [ ] Content field not empty for records

### Sample Downloads
- [ ] Download sample CSV and open in Excel/Google Sheets
- [ ] Verify columns are correct
- [ ] Check for formatting issues
- [ ] Download sample JSON and validate format
- [ ] Confirm `llm_response` and `scraper` are NOT in downloads

## 📝 Documentation Checklist

### For Users
- [ ] Methodology page is complete and accurate
- [ ] Citation format provided
- [ ] Contact information available
- [ ] "Last Updated" reflects actual last update

### For Maintenance
- [ ] README.md reviewed
- [ ] AWS_SETUP.md instructions tested
- [ ] DEPLOYMENT.md matches your setup
- [ ] Update process documented

## 🎯 SEO & Accessibility

### SEO
- [ ] Page title is descriptive
- [ ] Meta description added
- [ ] URL structure is clean
- [ ] Sitemap created (optional but recommended)

### Accessibility
- [ ] All images have alt text (if any added)
- [ ] Color contrast meets WCAG standards
- [ ] Keyboard navigation works
- [ ] Screen reader friendly (test if possible)
- [ ] Buttons have descriptive text

## 📢 Pre-Announcement Checklist

### Internal Review
- [ ] Tow Center staff have reviewed
- [ ] Data has been verified by team
- [ ] Methodology approved
- [ ] Legal/compliance review completed (if required)

### Communications
- [ ] Press release prepared (if applicable)
- [ ] Social media posts drafted
- [ ] Email announcement ready
- [ ] Blog post written (if applicable)

### Support Preparation
- [ ] FAQ document created
- [ ] Support email set up
- [ ] Team briefed on how to answer questions
- [ ] Known issues documented

## 🔄 Weekly Update Preparation

### Automation
- [ ] S3 upload process tested
- [ ] Upload script created (if using automated updates)
- [ ] Cron job or GitHub Action set up (if applicable)
- [ ] Backup process in place

### Manual Process
- [ ] Data export process documented
- [ ] S3 upload steps documented  
- [ ] Notification plan for updates
- [ ] Changelog process defined

## 🚨 Emergency Checklist

### If Something Goes Wrong
- [ ] Rollback plan documented
- [ ] Previous data version backed up
- [ ] Contact list for technical issues
- [ ] Status page plan (how to communicate downtime)

## ✅ Final Check Before Launch

### The Big Ones
- [ ] Dataset is complete and accurate
- [ ] S3 URL is correct in code
- [ ] Site is publicly accessible
- [ ] Downloads work correctly
- [ ] Methodology is final
- [ ] No placeholder text visible
- [ ] Mobile experience is smooth
- [ ] Team has tested the site

### Launch Day
- [ ] Monitor site for issues
- [ ] Check analytics/traffic
- [ ] Respond to initial feedback
- [ ] Have fun! 🎉

---

## Post-Launch (First Week)

- [ ] Monitor for errors
- [ ] Collect user feedback
- [ ] Fix any reported issues
- [ ] Document common questions
- [ ] Plan first data update
- [ ] Consider CloudFront if traffic is high
- [ ] Set up monitoring/alerts if needed

---

**Pro Tip**: Print this checklist or keep it open while preparing your launch. Check off items as you go!

**Questions?** Refer to the comprehensive guides included with the project.

**Ready to launch?** If all checks pass, you're good to go! 🚀
