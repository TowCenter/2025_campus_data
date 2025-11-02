# 🎨 Website Visual Guide

This document describes what your University Response Tracker website will look like.

## Overall Design Philosophy

- **Professional & Clean**: Academic research aesthetic
- **Tow Center Branding**: Dark header, clean typography
- **Data-Forward**: Easy access to downloads
- **Mobile-First**: Works beautifully on all devices

---

## 🏠 Page Structure

```
┌─────────────────────────────────────────────┐
│  DARK HEADER (#1a1a1a)                      │
│  University Response Tracker                │
│  Monitoring institutional responses...      │
│  [Methodology] [Data & Downloads]           │  ← Navigation tabs
└─────────────────────────────────────────────┘
│                                             │
│  WHITE CONTENT AREA                         │
│  (Methodology or Data page content)         │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  DARK FOOTER                                │
│  A project by the Tow Center...            │
│  [CJR] • [Tow Center]                      │
└─────────────────────────────────────────────┘
```

---

## 📄 Page 1: Methodology

### Layout

```
┌──────────────────────────────────────────┐
│                                          │
│  Methodology                             │  ← Large heading
│                                          │
│  [Lead paragraph in larger text]         │
│                                          │
│  Data Collection                         │  ← Section heading
│  [Paragraph explaining collection...]    │
│  [More content...]                       │
│                                          │
│  • Bullet point 1                        │
│  • Bullet point 2                        │
│                                          │
│  Classification Process                  │
│  [Content...]                            │
│                                          │
│  [CHART PLACEHOLDER BOX]                 │  ← Space for charts
│  "Interactive chart will be here"        │
│                                          │
│  Data Quality and Limitations            │
│  [Content...]                            │
│                                          │
│  [CHART PLACEHOLDER BOX]                 │
│  "Timeline chart will be here"           │
│                                          │
│  Citation and Usage                      │
│  [Citation format in box]                │
│                                          │
└──────────────────────────────────────────┘
```

### Visual Elements

- **Max width**: 800px (centered, comfortable reading)
- **Typography**: 
  - Heading: 2.5rem, bold
  - Subheadings: 1.5rem
  - Body: 1rem, line-height 1.8 (very readable)
- **Chart placeholders**: Dashed border boxes with instructions
- **Lists**: Clean bullets with spacing
- **Citation box**: Light blue background with left border

---

## 📊 Page 2: Data & Downloads

### Top Section (Introduction)

```
┌──────────────────────────────────────────┐
│                                          │
│  Data & Downloads                        │  ← Large heading
│                                          │
│  [Lead paragraph explaining dataset...]  │
│                                          │
│  📅 Last Updated: June 26, 2025 6:28 PM │  ← Blue info box
│                                          │
└──────────────────────────────────────────┘
```

### Download Section

```
┌──────────────────────────────────────────┐
│  Download Options                        │
│  45 institutions selected • 1,234 records│  ← Real-time count
│                                          │
│  [Download Selected CSV] [Download JSON] │  ← Blue buttons
│                   or                     │
│  [Download All CSV] [Download All JSON]  │  ← Outline buttons
│                                          │
└──────────────────────────────────────────┘
```

### Search and Table Section

```
┌──────────────────────────────────────────┐
│  🔍 [Search institutions...]        [x]  │  ← Search bar
│  Showing 520 institutions                │
│                                          │
├──────────────────────────────────────────┤
│  ☐  Institution              Records    │  ← Table header
├──────────────────────────────────────────┤
│  ☐  Columbia University         234     │  ← Selectable rows
│  ☑  Harvard University          189     │  ← Selected (blue bg)
│  ☐  MIT                         156     │
│  ☐  Stanford University         298     │
│  ☐  Yale University             145     │
│  ...                                     │
│                                          │
│  [First] [Previous] Page 1 of 11 [Next] [Last]  ← Pagination
└──────────────────────────────────────────┘
```

### Table Features

- **Checkbox column**: Select individual schools
- **Select all**: Checkbox in header to select everything
- **Search**: Real-time filtering as you type
- **Hover**: Rows highlight on hover
- **Selected**: Selected rows have blue background
- **Pagination**: 50 items per page
- **Sort**: Click header to sort alphabetically

### Bottom Section

```
┌──────────────────────────────────────────┐
│  About This Dataset                      │
│                                          │
│  The dataset includes the following:     │
│  • URL: Link to original statement       │
│  • Title: Document title                 │
│  • Organization: Institution name        │
│  • Content: Full text                    │
│  • Date: Publication date                │
│                                          │
│  Note: Internal processing fields        │
│  (llm_response and scraper) are          │
│  excluded from downloads.                │
│                                          │
└──────────────────────────────────────────┘
```

---

## 🎨 Color Palette

### Primary Colors
- **Blue**: `#4a9eff` - Primary actions, links, accents
- **Dark**: `#1a1a1a` - Header, footer, dark text
- **Light Background**: `#f8f9fa` - Page background
- **White**: `#ffffff` - Content areas, cards

### Text Colors
- **Primary Text**: `#333` - Main body text
- **Secondary Text**: `#666` - Less important text
- **Light Text**: `#999` - Muted text
- **Headers**: `#1a1a1a` - Section headings

### UI Colors
- **Borders**: `#dee2e6` - Subtle borders
- **Hover Background**: `#f8f9fa` - Hover states
- **Selected Background**: `#e7f3ff` - Selected items
- **Info Background**: `#f0f7ff` - Info boxes

---

## 📱 Responsive Behavior

### Desktop (1200px+)
```
┌────────────────────────────────────────────────────┐
│  Full width header with navigation                │
│  Max-width content (1200px) centered              │
│  Table shows all columns                          │
│  Multiple buttons visible side-by-side            │
└────────────────────────────────────────────────────┘
```

### Tablet (768px - 1199px)
```
┌──────────────────────────────────────┐
│  Header scales down                 │
│  Content adjusts to width           │
│  Table still comfortable            │
│  Buttons may wrap to two rows       │
└──────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌────────────────────────┐
│  Compact header        │
│  Navigation tabs small │
│  Stacked buttons       │
│  Table scrolls horiz.  │
│  Touch-friendly sizes  │
└────────────────────────┘
```

---

## 🎭 Interactive Elements

### Buttons

**Primary (Blue)**
```
┌─────────────────────────┐
│ 📥 Download Selected CSV│  ← Blue bg, white text
└─────────────────────────┘
  Hover: Darker blue + slight lift
```

**Secondary (Outline)**
```
┌─────────────────────────┐
│   Download All JSON     │  ← White bg, blue border
└─────────────────────────┘
  Hover: Blue bg, white text
```

**Disabled**
```
┌─────────────────────────┐
│ Download Selected CSV   │  ← Gray, not clickable
└─────────────────────────┘
```

### Checkboxes

```
☐  Unchecked (gray border)
☑  Checked (blue background, white check)
□  Hover (blue border)
```

### Search Box

```
┌─────────────────────────┐
│ 🔍 Search institutions..│  ← Icon + placeholder
└─────────────────────────┘
  Focus: Blue border
  
┌─────────────────────────┐
│ 🔍 Stanford          [×]│  ← With clear button
└─────────────────────────┘
```

---

## 💫 Animations & Transitions

### Smooth Interactions
- **Button hover**: 0.2s transition, slight lift
- **Row hover**: Instant background change
- **Selection**: Smooth blue background fade-in
- **Page changes**: Instant (no loading spinner needed)

### Loading States

**When fetching data:**
```
┌──────────────────┐
│    ⌛ Loading    │  ← Spinner animation
│  Loading data... │
└──────────────────┘
```

**If error:**
```
┌──────────────────┐
│   ⚠️ Error       │  ← Red text
│  Failed to load  │
│  [Retry Button]  │
└──────────────────┘
```

---

## 📊 Example Screenshots (Text Description)

### Homepage (Methodology)
```
Clean, academic design
Large readable text
Professional typography
Plenty of white space
Sections clearly divided
Chart placeholders visible
Easy to scan
Mobile-friendly
```

### Data Page (Table View)
```
Search bar prominent at top
Download buttons clearly visible
Table with clean rows
Checkboxes easy to click
Selected rows highlighted
Pagination at bottom
Stats visible (X selected, Y total)
Professional data table aesthetic
```

---

## 🎯 Design Goals Achieved

✅ **Professional**: Academic/journalistic aesthetic  
✅ **Accessible**: High contrast, clear hierarchy  
✅ **Intuitive**: Obvious how to search and download  
✅ **Responsive**: Works on all devices  
✅ **Fast**: Instant search, quick interactions  
✅ **Clean**: No clutter, focused on data  
✅ **Branded**: Matches Tow Center style  

---

## 🔍 Key Design Details

### Typography
- **Headings**: Bold, generous spacing
- **Body**: Comfortable line-height (1.8)
- **Lists**: Clear bullets, good spacing
- **Code**: Monospace, light background

### Spacing
- **Sections**: 2-3rem between sections
- **Elements**: 1rem default spacing
- **Padding**: Generous (1-2rem)
- **Margins**: Consistent throughout

### Hierarchy
- **Clear visual hierarchy**
- **Important items larger/bolder**
- **Secondary info smaller/lighter**
- **Consistent sizing scale**

---

## 💡 Why These Design Choices?

**Dark Header**: Professional, makes content area pop  
**Blue Accents**: Trustworthy, academic, clickable  
**White Space**: Reduces cognitive load  
**Large Text**: Accessibility and readability  
**Simple Tables**: Focus on data, not decoration  
**Mobile-First**: Most users on mobile  

---

## 🎨 Want to Customize?

### Change Primary Color
Find/replace `#4a9eff` with your color

### Adjust Spacing
Change `padding` and `margin` values in CSS

### Different Fonts
Add to `body` font-family in App.svelte

### Layout Width
Change `max-width: 1200px` to your preference

All styling is in `<style>` tags within .svelte files!

---

*This is what your website will look like. Clean, professional, and ready to release your research!*
