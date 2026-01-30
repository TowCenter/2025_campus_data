# Tow Design System Template

A customizable template with Svelte components for building journalism trackers and projects, developed by the Tow Center for Digital Journalism.

## Quick Start

### Using as a Template

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/TowCenter/website-design-template.git my-project
   cd my-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Customize your project**
   - Edit `src/routes/+page.svelte` to build your page
   - Import and use components from `src/lib/`
   - Modify or remove components you don't need

### Using as an NPM Package

You can also install this as a package in another SvelteKit project:

```bash
npm install github:TowCenter/website-design-template
```

Then import components:

```javascript
import {
  Article,
  Body,
  BodyText,
  CardView,
  Filters,
  Footer,
  Head,
  Header,
  Headline,
  TowPartnerLogo
} from '@tow/website-design-template';
```

### Import Styles

```javascript
// Import CSS files directly
import '@tow/design-system/tow.css';
import '@tow/design-system/cjr.css';

// Or import CSS URLs programmatically
import { towCSS, cjrCSS } from '@tow/website-design-template';
```

### Example

```svelte
<script>
  import {
    Head,
    Article,
    Header,
    Headline,
    Body,
    BodyText,
    Footer,
    TowPartnerLogo
  } from '@tow/design-system';
  import '@tow/design-system/tow.css';
</script>

<Head />
<Header />
<Article>
  <Headline
    hed="Your Headline Here"
    subhed="Your subheadline here"
    date="September 23, 2025"
    byline_url="https://example.com/author"
    byline="Author Name"
  >
    <TowPartnerLogo />
  </Headline>

  <Body>
    <BodyText
      text="Your article content goes here..."
    />
  </Body>
</Article>
<Footer />
```

## Available Components

### Layout Components
- **Article**: Main article container
- **Body**: Article body container
- **BodyText**: Text content component
- **Header**: Site header
- **Footer**: Site footer
- **Head**: Document head with metadata
- **Headline**: Article headline with byline and date

### Data Display Components
- **CardView**: Display data as cards
- **Card**: Individual card component
- **CardContent**: Card content wrapper
- **CardHeader**: Card header section
- **CardField**: Individual field in a card
- **Table**: Table component for data display
- **Timeline**: Timeline visualization

### Filter Components
- **Filters**: Main filter container
- **FilterBar**: Filter controls bar
- **SearchBar**: Search input component
- **MultiSelect**: Multi-select dropdown
- **HierarchicalFilter**: Two-level hierarchical filter

### Utility Components
- **TowPartnerLogo**: Tow Center partner logo
- **StatusBadge**: Status indicator badge
- **InteractionTag**: Interaction type tag
- **SourcesList**: List of sources with links
- **HighlightedText**: Text with search highlighting

## Customization

All components in `src/lib/` are yours to modify. You can:
- Edit existing components to match your design
- Remove components you don't need
- Add new components for your project
- Customize styles in `src/lib/cjr.css` and `src/lib/tow.css`

See `TEMPLATE_USAGE.md` for detailed customization instructions.

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Build for production: `npm run build`
5. Package as npm module: `npm run package`

## License

MIT
