# Supabase Storage Integration

## Overview

The Handwriting Worksheet Generator is now fully integrated with Supabase for persistent storage of worksheets, fonts, images, and user data.

## Architecture

### Database Schema

Three main tables are configured in Supabase with Row-Level Security (RLS):

#### 1. **worksheets** table
- Stores worksheet metadata
- Fields:
  - `id` (UUID): Primary key
  - `user_id` (UUID): References auth.users(id)
  - `title` (text): Worksheet title
  - `description` (text): Optional description
  - `template` (text): Page template type
  - `file_path` (text): Path to stored worksheet JSON
  - `storage_bucket` (text): Default 'worksheets'
  - `metadata` (jsonb): Additional metadata (grade level, subject, tags)
  - `created_at`, `updated_at` (timestamps)

#### 2. **user_fonts** table
- Tracks uploaded fonts per user
- Fields:
  - `id` (UUID): Primary key
  - `user_id` (UUID): References auth.users(id)
  - `name` (text): Font display name
  - `family` (text): Font family
  - `style` (text): Font style (normal, italic, bold)
  - `file_path` (text): Path to font file in storage
  - `storage_bucket` (text): Default 'fonts'
  - `file_size` (integer): Font file size in bytes
  - `source` (text): 'uploaded' or 'google'
  - `created_at` (timestamp)

#### 3. **worksheet_images** table
- Tracks images within worksheets
- Fields:
  - `id` (UUID): Primary key
  - `worksheet_id` (UUID): References worksheets(id)
  - `user_id` (UUID): References auth.users(id)
  - `image_path` (text): Path to image in storage
  - `storage_bucket` (text): Default 'worksheet-images'
  - `position_x`, `position_y` (float): Image position
  - `width`, `height` (float): Image dimensions
  - `rotation` (float): Image rotation in degrees
  - `created_at` (timestamp)

### Storage Buckets

Three public storage buckets are created:

1. **worksheets** - Stores exported worksheet files (JSON, PDF)
2. **fonts** - Stores uploaded font files (TTF, OTF, WOFF)
3. **worksheet-images** - Stores images inserted into worksheets

## Client Utilities

### `lib/supabase/storage.ts`

Core storage functions:

**Worksheet Operations:**
- `uploadWorksheet()` - Upload worksheet file
- `deleteWorksheet()` - Delete worksheet file
- `downloadWorksheet()` - Download worksheet file
- `saveWorksheetMetadata()` - Save to database
- `getWorksheets()` - List user's worksheets

**Font Operations:**
- `uploadFont()` - Upload font file
- `deleteFont()` - Delete font file
- `downloadFont()` - Download font file
- `getFontDownloadUrl()` - Get public URL
- `saveFontMetadata()` - Save to database
- `getUserFonts()` - List user's fonts
- `deleteFont_DB()` - Delete from database

**Image Operations:**
- `uploadImage()` - Upload image file
- `deleteImage()` - Delete image file
- `getImageUrl()` - Get public URL
- `saveImageMetadata()` - Save to database
- `getWorksheetImages()` - List worksheet images

## React Hooks

### `lib/hooks/useWorksheets.ts`

Provides worksheet management:
```typescript
const { 
  worksheets,      // Array of user's worksheets
  loading,         // Loading state
  error,           // Error message
  saveWorksheet,   // Save worksheet function
  deleteWorksheet, // Delete worksheet function
  refetch          // Refresh list
} = useWorksheets();
```

### `lib/hooks/useFonts.ts`

Provides font management:
```typescript
const { 
  fonts,           // Array of user's fonts
  loading,         // Loading state
  error,           // Error message
  uploadFont,      // Upload font file
  deleteFont,      // Delete font
  getFontUrl,      // Get font download URL
  refetch          // Refresh list
} = useFonts();
```

## Components

### Updated `FontManager` Component

The FontManager component now uses Supabase for persistent font storage:

- Displays user's uploaded fonts from database
- Upload new fonts with validation (TTF, OTF, WOFF, max 5MB)
- Delete fonts with confirmation
- Real-time error/success messages
- Font metadata parsing using opentype.js

**Usage:**
```tsx
import { FontManager } from '@/components/FontManager';

<FontManager 
  onFontSelect={(font) => console.log('Selected:', font)}
  selectedFontId={selectedId}
/>
```

## API Routes

### `app/api/worksheets/export/route.ts`

Handles worksheet export:
- **POST** `/api/worksheets/export`
- Supports formats: `pdf`, `json`
- Returns download URL and storage path
- Automatically saves to Supabase storage

**Request:**
```json
{
  "worksheet": { /* worksheet object */ },
  "format": "pdf"
}
```

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "path": "user_id/timestamp.pdf"
}
```

### `app/api/images/upload/route.ts`

Handles image uploads:
- **POST** `/app/images/upload`
- Validates image files
- Max 10MB file size
- Saves to storage and database

**Request:**
```
FormData:
- file: File
- worksheetId: string (optional)
```

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "path": "user_id/timestamp-filename"
}
```

## Integration in Components

### Supabase Client Usage

**In Client Components:**
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data: { user } } = await supabase.auth.getUser();
```

**In Server Components:**
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
```

## Security

### Row-Level Security (RLS)

All tables have RLS enabled with policies:

- Users can **SELECT** only their own data
- Users can **INSERT** only their own data  
- Users can **UPDATE** only their own data
- Users can **DELETE** only their own data

### Data Isolation

- All queries filtered by `auth.uid()`
- User ID automatically added from authenticated session
- No cross-user data access possible

### File Access

- Storage files are scoped by user ID in path
- Only authenticated users can upload/download
- Public URLs are used for serving files (no credentials in URL)

## Usage Examples

### Save a Worksheet

```typescript
const { saveWorksheet } = useWorksheets();

const worksheet = {
  title: 'Handwriting Practice',
  pages: [{ /* page data */ }],
  metadata: { gradeLevel: 'year1' }
};

const worksheetId = await saveWorksheet(worksheet, 'practice.json');
```

### Upload a Font

```typescript
const { uploadFont } = useFonts();

const file = fileInput.files[0]; // User selects TTF/OTF/WOFF
const fontMetadata = await uploadFont(file);
console.log('Font uploaded:', fontMetadata.name);
```

### Upload an Image

```typescript
const response = await fetch('/api/images/upload', {
  method: 'POST',
  body: formData,
});

const { url, path } = await response.json();
```

## Environment Variables

Required Supabase environment variables (automatically set):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key

## Error Handling

All functions include error handling:
- Try-catch blocks with detailed logging
- Console warnings prefixed with `[v0]` for debugging
- User-friendly error messages returned

## Future Enhancements

- PNG/image export for worksheets
- Font preview generation and caching
- Batch upload for multiple files
- Worksheet sharing and collaboration
- Image cropping and editing tools
- Automatic backup and versioning
