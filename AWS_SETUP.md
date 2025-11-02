# AWS S3 Setup Guide

This guide will help you set up AWS S3 to host your data and configure weekly updates.

## Step 1: Create S3 Bucket

1. Log into AWS Console and navigate to S3
2. Click "Create bucket"
3. Choose a name (e.g., `university-responses-data`)
4. Choose a region close to your users
5. **Uncheck** "Block all public access" (we need the data file to be publicly readable)
6. Click "Create bucket"

## Step 2: Configure CORS

1. Go to your bucket
2. Click "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit" and paste:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": [],
        "MaxAgeSeconds": 3000
    }
]
```

5. Click "Save changes"

## Step 3: Upload Your Data

### Prepare Your Data File

Your data should be a JSON array of objects. Example structure:

```json
[
  {
    "_id": { "$oid": "68207fc5a21d85a348da93e6" },
    "url": "https://news.stanford.edu/...",
    "content": "Full statement text...",
    "date": { "$date": "2024-04-26T00:00:00.000Z" },
    "last_updated_at": { "$date": "2025-06-26T18:28:54.790Z" },
    "title": "Message title",
    "org": "Stanford University",
    "llm_response": { ... },
    "scraper": "scrapers.stanford_university.scraper"
  },
  ...more records...
]
```

### Upload Process

1. Go to your bucket
2. Click "Upload"
3. Add your JSON file (name it `data.json`)
4. Under "Permissions", choose "Grant public-read access"
5. Click "Upload"

### Make File Public

If you forgot to grant public access:
1. Click on the file in your bucket
2. Go to "Permissions" tab
3. Click "Edit" under "Access control list (ACL)"
4. Check "Read" for "Everyone (public access)"
5. Save changes

## Step 4: Get Your Data URL

Your data URL will be:
```
https://YOUR-BUCKET-NAME.s3.YOUR-REGION.amazonaws.com/data.json
```

For example:
```
https://university-responses-data.s3.us-east-1.amazonaws.com/data.json
```

Test it in your browser - you should see the JSON data.

## Step 5: Update the Website

Open `DataExplorer.svelte` and update line 5:

```javascript
const S3_BUCKET_URL = 'https://tow-campus-data.s3.us-east-2.amazonaws.com/data.json';
```

Replace with your actual URL.

## Step 6: Set Up Weekly Updates

### Option A: Manual Upload (Simple)

Every week:
1. Export your latest data as JSON
2. Go to S3 bucket
3. Upload new `data.json` file (it will overwrite the old one)
4. Done! The website automatically fetches the new data

### Option B: Automated Upload (Advanced)

Use AWS CLI to automate uploads:

1. **Install AWS CLI**:
```bash
# macOS
brew install awscli

# Windows
# Download from https://aws.amazon.com/cli/

# Linux
sudo apt-get install awscli
```

2. **Configure AWS CLI**:
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your region (e.g., us-east-1)
# Enter output format: json
```

3. **Create Upload Script** (`upload-data.sh`):
```bash
#!/bin/bash

# Generate or export your latest data.json
# Replace this with your actual data export process
python export_data.py  # or whatever your process is

# Upload to S3
aws s3 cp data.json s3://your-bucket-name/data.json \
  --acl public-read \
  --content-type "application/json" \
  --cache-control "max-age=300"

echo "Data uploaded successfully at $(date)"
```

4. **Make script executable**:
```bash
chmod +x upload-data.sh
```

5. **Schedule Weekly Updates** (macOS/Linux):

Create a cron job:
```bash
crontab -e
```

Add this line to run every Monday at 9 AM:
```
0 9 * * 1 /path/to/upload-data.sh >> /path/to/upload.log 2>&1
```

For Windows, use Task Scheduler instead.

### Option C: GitHub Actions (Best for Git-based workflows)

If your data is generated via code, use GitHub Actions:

1. Create `.github/workflows/update-data.yml`:

```yaml
name: Update S3 Data

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  update-data:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Generate data
      run: |
        # Your data generation process
        python scripts/export_data.py
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Upload to S3
      run: |
        aws s3 cp data.json s3://your-bucket-name/data.json \
          --acl public-read \
          --content-type "application/json"
```

2. Add AWS credentials to GitHub Secrets:
   - Go to repository Settings → Secrets → Actions
   - Add `AWS_ACCESS_KEY_ID`
   - Add `AWS_SECRET_ACCESS_KEY`

## Step 7: CloudFront (Optional - Recommended for Production)

For better performance and caching:

1. Go to CloudFront in AWS Console
2. Create distribution
3. Origin domain: Your S3 bucket
4. Origin path: `/`
5. Viewer protocol policy: Redirect HTTP to HTTPS
6. Create distribution
7. Use the CloudFront URL instead of direct S3 URL

CloudFront URL format:
```
https://d1234567890abc.cloudfront.net/data.json
```

## Troubleshooting

### Issue: "Access Denied" error

**Solution**: Check bucket permissions and file ACL. Make sure:
- Bucket allows public access
- File has public-read ACL
- CORS is configured

### Issue: Data not updating

**Solution**: 
- Check if new file was uploaded successfully
- Clear browser cache (Ctrl+Shift+R)
- CloudFront: Invalidate cache in CloudFront console

### Issue: CORS errors in browser

**Solution**:
- Verify CORS configuration in S3
- Make sure `AllowedOrigins` includes your domain or `["*"]`
- Check browser console for specific error

### Issue: Large file size / slow loading

**Solution**:
- Compress JSON: `gzip data.json` and upload as `data.json.gz`
- Update Content-Encoding header to `gzip`
- Consider CloudFront for caching
- Or: Split data into smaller files and load on-demand

## Security Note

Your data file is publicly readable, which is necessary for the website to function. Make sure:
- No sensitive information in the data
- The `llm_response` and `scraper` fields (if sensitive) are excluded from downloads (already handled by the app)
- If you need authentication, consider using AWS API Gateway + Lambda instead

## Cost Estimate

For ~18,000 records (~50MB JSON file):
- S3 storage: ~$0.02/month
- Data transfer: ~$0.09/GB (first 10TB)
- If 1,000 downloads/month: ~$4.50/month

CloudFront can reduce costs and improve performance.

## Data Format Notes

The website automatically:
- Extracts unique institutions from the `org` field
- Finds the latest `last_updated_at` date
- Excludes `llm_response` and `scraper` from downloads
- Handles MongoDB date format (`{ "$date": "..." }`)

Make sure your data follows this format!
