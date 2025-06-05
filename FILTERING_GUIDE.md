# Comprehensive Bookmark Filtering Guide

## Overview

The IINA Bookmarks Plugin now includes advanced filtering capabilities that allow you to quickly find and organize your bookmarks using powerful search syntax, quick filter presets, and intelligent suggestions.

## Features

### 🔍 Advanced Search Syntax

#### Field-Specific Search
Search within specific bookmark fields using the `field:value` syntax:

- `title:"meeting notes"` - Search in bookmark titles
- `description:important` - Search in descriptions  
- `tag:work` - Filter by specific tags
- `filepath:movie.mp4` - Filter by file path
- `created:today` - Filter by creation date

#### Boolean Operators
Combine search terms with logical operators:

- `tag:work AND title:meeting` - Must have both work tag AND meeting in title
- `tag:personal OR tag:family` - Must have either personal OR family tag
- `title:video NOT tag:completed` - Has video in title but NOT completed tag

#### Date Shortcuts
Use convenient date filters:

- `created:today` - Bookmarks created today
- `created:yesterday` - Bookmarks from yesterday
- `created:this-week` - Bookmarks from the past 7 days
- `created:this-month` - Bookmarks from current month
- `created:>2024-01-01` - Bookmarks after specific date
- `created:<2024-12-31` - Bookmarks before specific date

#### Complex Examples
```
tag:work AND title:meeting NOT tag:completed
description:"project review" OR title:"weekly sync"
created:this-week AND tag:urgent
filepath:*.mp4 AND tag:favorite
```

### 🎯 Quick Filter Presets

#### Built-in Presets
- **Recent** 🕒 - Bookmarks created today
- **This Week** 📅 - Bookmarks from the past 7 days
- **Untagged** 🏷️ - Bookmarks without any tags
- **Favorites** ⭐ - Bookmarks with favorite tag
- **Need Description** 📝 - Bookmarks missing descriptions

#### Custom Presets
- Save your current filter combination as a custom preset
- Name and describe your presets for easy identification
- Track usage statistics to see your most-used filters
- Export/import presets for backup or sharing

### 📊 Filter Analytics

Monitor your filtering efficiency:
- **Results Count** - Number of bookmarks matching current filters
- **Reduction Percentage** - How much the filters narrowed down results
- **Performance Metrics** - Track filter usage patterns

### 🔄 Search History

- **Recent Searches** - Automatically saves your last 10 search queries
- **Quick Access** - Click any recent search to reapply it
- **Smart Suggestions** - Get autocomplete suggestions based on:
  - Available tags
  - Field operators
  - Boolean operators
  - Recent searches
  - Date shortcuts

## User Interface

### Window View (Full-Featured)
- Complete filter presets panel with custom preset management
- Advanced search toggle with full syntax support
- Filter analytics display
- Search history management

### Sidebar View (Compact)
- Streamlined advanced search toggle
- Essential filtering controls optimized for narrow space
- Quick access to recent searches

### Overlay View (Minimal)
- Basic advanced search with toggle button
- Context-aware filtering (auto-applies current file filter)
- Compact suggestions dropdown

## Usage Tips

### Getting Started
1. **Basic Search**: Start typing in any search box - it works like traditional search
2. **Enable Advanced**: Click the "Advanced Search" toggle to access field-specific syntax
3. **Use Suggestions**: As you type, suggestions appear to help with syntax
4. **Save Presets**: When you find useful filter combinations, save them as presets

### Power User Tips
1. **Keyboard Navigation**: Use arrow keys to navigate suggestions, Enter to apply
2. **Quoted Phrases**: Use quotes for exact phrase matching: `title:"exact phrase"`
3. **Combine Filters**: Mix advanced search with traditional filter controls
4. **Export Data**: Backup your search history and custom presets

### Performance Optimization
- **Debounced Search**: 200ms delay prevents excessive filtering during typing
- **Efficient Filtering**: Filters are applied in optimal order for best performance
- **Virtual Scrolling**: Large bookmark collections are handled efficiently

## Technical Implementation

### Components
- **AdvancedSearch**: Intelligent search input with syntax parsing and suggestions
- **FilterPresets**: Quick filter management with custom preset support
- **Enhanced FilterComponent**: Backward-compatible with new analytics
- **useAdvancedBookmarkFilters**: Core filtering logic with performance optimization
- **useFilterHistory**: Persistent storage for search history and presets

### Data Persistence
- Search history stored in localStorage (max 10 entries)
- Custom presets stored in localStorage (max 20 presets)
- Filter usage statistics tracked for analytics
- Export/import functionality for data portability

### Browser Compatibility
- Modern ES6+ features with Safari 9+ support
- Responsive design for various screen sizes
- Dark mode support with system preference detection
- Accessibility features with keyboard navigation

## Troubleshooting

### Common Issues
1. **Suggestions not appearing**: Ensure you're in advanced search mode
2. **Syntax not working**: Check for typos in field names (title:, tag:, etc.)
3. **Performance slow**: Try more specific filters to reduce result set
4. **Presets not saving**: Check browser localStorage permissions

### Debug Mode
Enable debug logging by setting `localStorage.setItem('bookmark-filter-debug', 'true')`

## Future Enhancements

Planned features for upcoming releases:
- **Regex Support**: Advanced pattern matching in search
- **Saved Searches**: Persistent named searches with notifications
- **Filter Sharing**: Share filter presets between users
- **AI Suggestions**: Smart filter recommendations based on usage patterns
- **Bulk Operations**: Apply actions to filtered bookmark sets

---

For technical support or feature requests, please open an issue on the project repository. 