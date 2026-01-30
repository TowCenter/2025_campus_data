# Template Usage Guide

This template is fully configurable. All settings are controlled through the configuration object in `src/routes/+page.svelte`.

## Quick Start

1. **Open `src/routes/+page.svelte`**
2. **Find the `config` object** (around line 20)
3. **Customize all settings** in one place

## Configuration Options

### 1. Your Data (`data`)

Replace the `data` array with your dataset. Your data should be an array of objects. Each object can have any fields you need.

**Example:**
```javascript
data: [
  {
    date: '2025-01-15',
    platform: ['OpenAI'],
    category: ['AI / automation'],
    title: 'My Title',
    description: 'Description text',
    links: [{ text: 'Source', url: 'https://example.com' }],
    last_updated: '2025-01-15T12:00:00.000Z'
  },
  // ... more items
]
```

### 2. Field Mappings

Tell the template which fields in your data contain dates:

```javascript
dateField: 'date',              // Field name for dates
lastUpdatedField: 'last_updated' // Field name for last updated timestamp
```

### 3. Filter Configuration (`filterConfig`)

Choose which columns get which filters. You can add, remove, or reorder filters.

**Filter Types:**
- `'multi-select'` - Dropdown with multiple selections
- `'hierarchical'` - Two-level filter (parent → child)
- `'date-range'` - Date range picker
- `'search'` - Text search

**Example:**
```javascript
filterConfig: [
  {
    type: 'multi-select',
    column: 'Platform',        // Display name
    label: 'Platform',          // Filter label
    dataKey: 'platform'        // Actual field name in your data
  },
  {
    type: 'multi-select',
    column: 'Category',
    label: 'Category',
    dataKey: 'category'
  },
  {
    type: 'date-range',
    label: 'Date Range',
    dataKey: 'date'            // Field name for dates
  },
  {
    type: 'search',
    label: 'Search'            // No column/dataKey needed for search
  }
]
```

### 4. Left Navigation (`navItems`)

Customize the left sidebar navigation:

```javascript
navItems: [
  { href: '#section1', label: 'Section 1' },
  { href: '#section2', label: 'Section 2' },
  // Add or remove items
]
```

To hide the navigation, set to empty array: `navItems: []`

### 5. Headline Configuration

```javascript
headline: 'Your Page Title',
subheadline: 'Optional subtitle',
brand: 'Your Brand Name',      // Optional
dateLabel: 'Last Updated On',  // Customize date label
bylineLabel: 'Maintained By'    // Customize byline label
```

### 6. Body Content

```javascript
bodyText: `Your content here. <strong>HTML</strong> is supported.`
```

### 7. Credits and Acknowledgements

```javascript
maintainedBy: [
  { name: 'Person Name', url: 'https://example.com' }
],
designDevelopment: [
  { name: 'Designer', url: 'https://example.com' }
],
acknowledgements: 'Your acknowledgements text (HTML supported)'
```

### 8. Timeline Settings

```javascript
showYearNavigation: true,      // Show/hide year navigation
initialVisibleCount: 20,        // Items to show initially
categoryDefinitions: {}        // Category definitions (if needed)
```

## Complete Example

```javascript
const config = createTemplateConfig({
  // Your data
  data: yourDataArray,
  
  // Field mappings
  dateField: 'date',
  lastUpdatedField: 'last_updated',
  
  // Filters - customize which columns get which filters
  filterConfig: [
    { type: 'multi-select', column: 'Status', label: 'Status', dataKey: 'status' },
    { type: 'search', label: 'Search' }
  ],
  
  // Navigation
  navItems: [
    { href: '#intro', label: 'Introduction' }
  ],
  
  // Headline
  headline: 'My Tracker',
  dateLabel: 'Last Updated',
  
  // Body
  bodyText: 'Your description here',
  
  // Credits
  maintainedBy: [{ name: 'Your Name', url: 'https://example.com' }]
});
```

## Key Features

✅ **Fully Configurable** - Everything is customizable in one place  
✅ **No Hardcoded Values** - All strings and settings are configurable  
✅ **Generic Filtering** - Works with any data structure  
✅ **Flexible Data** - Use any field names you want  
✅ **Easy to Customize** - Change dataset, filters, navigation, and content easily

## Need Help?

All configuration happens in `src/routes/+page.svelte`. Just modify the `config` object to match your needs!
