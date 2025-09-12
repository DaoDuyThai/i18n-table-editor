# VSCode Locale Editor Extension - Refactoring Changes

## Summary of Changes

This refactoring improves the VSCode extension structure and user experience by:

1. **Extracting CSS to separate file** - Better maintainability and organization
2. **Enhanced sidebar with direct structure options** - No more multi-step selection process
3. **Improved command structure** - Clear separation between flat and nested modes

## Files Modified/Created

### New Files
- `src/webview.css` - Extracted CSS styles from webview HTML
- Updated `sidebar.ts` - Now shows two direct options for structure types
- Updated `extension.ts` - New command handlers for both structure types
- Updated `webview.ts` - Uses external CSS file

### Key Changes

#### 1. CSS Extraction (`webview.css`)
- All CSS styles moved from inline `<style>` tag to separate file
- Better organization and maintainability
- Proper VSCode theme integration maintained

#### 2. Enhanced Sidebar (`sidebar.ts`)
```typescript
// Before: Single option requiring additional selection
'Open locale table editor'

// After: Two direct options
'Open with Flat Structure'    (files like en.json, vi.json in root)
'Open with Nested Structure'  (folders like en/, vi/ with files inside)
```

#### 3. New Commands (`extension.ts`)
- `localeLanguagesJsonTableEditor.openTableFlat` - Direct flat structure
- `localeLanguagesJsonTableEditor.openTableNested` - Direct nested structure  
- `localeLanguagesJsonTableEditor.openTable` - Backward compatibility (defaults to flat)

#### 4. Updated Webview (`webview.ts`)
- CSS file loading via `webview.asWebviewUri()`
- Cleaner HTML structure without embedded styles
- Better separation of concerns

## Benefits

1. **Better User Experience**: Users can directly choose their structure type from sidebar
2. **Cleaner Code**: CSS separated from HTML for better maintainability
3. **Faster Workflow**: No multi-step selection process
4. **Better Organization**: Clear file structure and responsibilities
5. **Backward Compatibility**: Old commands still work

## File Structure
```
src/
├── extension.ts      (Updated - new commands)
├── webview.ts        (Updated - external CSS)
├── webview.css       (New - extracted styles)
├── sidebar.ts        (Updated - two options)
├── config.ts         (Unchanged)
├── dataCollector.ts  (Unchanged)
├── jsonUtils.ts      (Unchanged)
└── types.ts          (Unchanged)
```

## Usage

### From Sidebar Panel
- Click "Open with Flat Structure" for traditional structure (en.json, vi.json, etc.)
- Click "Open with Nested Structure" for organized folders (en/, vi/, ko/)

### From Command Palette
- `Locale Editor: Open Locale Table Editor (Flat Structure)`
- `Locale Editor: Open Locale Table Editor (Nested Structure)`
- `Locale Editor: Open Locale Table Editor` (defaults to flat)

## Package.json Updates

Add the new commands to your `package.json`:

```json
"contributes": {
  "commands": [
    {
      "command": "localeLanguagesJsonTableEditor.openTableFlat",
      "title": "Open Locale Table Editor (Flat Structure)",
      "category": "Locale Editor"
    },
    {
      "command": "localeLanguagesJsonTableEditor.openTableNested", 
      "title": "Open Locale Table Editor (Nested Structure)",
      "category": "Locale Editor"
    }
  ]
}
```

The refactoring maintains all existing functionality while providing a much cleaner and more intuitive user experience.