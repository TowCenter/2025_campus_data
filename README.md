# University Response Tracker

A professional dashboard website for the Tow Center for Digital Journalism to release and explore a dataset of university responses to campus protests and federal actions.

## Features

- **Methodology Page**: Comprehensive explanation of data collection and classification methods with space for embedded charts
- **Data Explorer**: Interactive table with search, filtering, and selection capabilities
- **Flexible Downloads**: Export data as CSV or JSON, either selected institutions or entire dataset
- **AWS S3 Integration**: Automatically pulls latest data from S3 bucket
- **Last Updated Timestamp**: Shows when data was last refreshed
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Tow Center Styling**: Professional design matching the Tow Center aesthetic

## Tech Stack

- **Svelte 4**: Modern, reactive JavaScript framework
- **Vite**: Fast build tool and development server
- **Vanilla JavaScript**: No heavy dependencies for maximum performance

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm installed
- AWS S3 bucket with your data
- Data in JSON format (array of objects)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure AWS S3**:
   
   Open `DataExplorer.svelte` and update the S3 URL:
   ```javascript
   const S3_BUCKET_URL = 'https://your-bucket-name.s3.amazonaws.com/data.json';
   ```

3. **Run development server**:
```bash
npm run dev
```

The site will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

This creates optimized files in the `dist/` directory ready for deployment.

## AWS S3 Configuration

### Data Format

Your S3 bucket should contain a JSON file with an array of objects. Each object represents one university response:

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
    "llm_response": { ... },
    "scraper": "..."
  }
]
```

**Note**: The `llm_response` and `scraper` fields are automatically excluded from downloads.

### S3 Bucket Setup

1. **Create S3 Bucket**:
   - Go to AWS S3 Console
   - Create a new bucket (e.g., `university-responses-data`)
   - Enable public access for the data file

2. **Upload Data**:
   - Upload your JSON file (e.g., `data.json`)
   - Set permissions to public-read or configure CORS

3. **CORS Configuration** (if needed):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

4. **Get URL**:
   - Your data URL will be: `https://your-bucket-name.s3.amazonaws.com/data.json`
   - Or use CloudFront for better performance

### Updating Data

Simply upload a new version of your JSON file to S3. The website automatically fetches the latest data on page load. The "Last Updated" timestamp is derived from the most recent `last_updated_at` field in your data.

## Deployment Options

### Option 1: Netlify (Recommended)

1. Push code to GitHub
2. Connect repository to Netlify
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

### Option 2: Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Framework: Vite
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy!

### Option 3: GitHub Pages

1. Install gh-pages: `npm install -D gh-pages`
2. Add to package.json scripts:
   ```json
   "deploy": "vite build --base=/repository-name/ && gh-pages -d dist"
   ```
3. Run: `npm run deploy`

### Option 4: Traditional Web Host

1. Run `npm run build`
2. Upload contents of `dist/` folder to your web server
3. Point your domain to the uploaded files

## Customization

### Styling

All styles use CSS-in-JS within the Svelte components. Key color variables:

- Primary blue: `#4a9eff`
- Dark background: `#1a1a1a`
- Light background: `#f8f9fa`

### Methodology Content

Edit `Methodology.svelte` to add your actual methodology text and embed charts.

### Chart Integration

To add charts to the Methodology page:

1. Install a chart library (optional):
```bash
npm install chart.js
```

2. Import and use in `Methodology.svelte`:
```svelte
<script>
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  
  onMount(() => {
    // Create your chart
  });
</script>
```

## Data Structure

### Input Data Fields

The application expects these fields (MongoDB format):

- `_id.$oid`: Unique identifier
- `url`: URL to original statement
- `content`: Full text of statement
- `date.$date`: Publication date (ISO format)
- `last_updated_at.$date`: Last update timestamp
- `title`: Document title
- `org`: Institution name
- `llm_response`: (excluded from downloads)
- `scraper`: (excluded from downloads)

### Download Data Fields

CSV and JSON downloads include all fields EXCEPT:
- `llm_response`
- `scraper`

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Initial load**: ~500KB (with 18,000 records)
- **Search**: Instant (client-side filtering)
- **Downloads**: Generated client-side
- **Pagination**: 50 records per page (configurable)

## Troubleshooting

### Data Not Loading

1. Check browser console for errors
2. Verify S3 URL is correct
3. Ensure CORS is configured on S3
4. Test S3 URL directly in browser

### CSV Export Issues

If CSV has formatting problems:
- Check for commas in data fields
- Verify special characters are handled
- Try JSON export instead

### Styling Differences

Clear browser cache and hard reload (Ctrl+Shift+R or Cmd+Shift+R)

## Support

For issues or questions:
- Check the [Tow Center website](https://towcenter.columbia.edu/)
- Email: [your contact email]

## License

[Your License] - Tow Center for Digital Journalism, Columbia University

## Credits

Developed for the Tow Center for Digital Journalism at Columbia University.
