import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock BookmarkManager for testing
class MockBookmarkManager {
  private deps: any;

  constructor(deps: any) {
    this.deps = deps;
  }

  // Copy the validation methods from BookmarkManager for testing
  validateImportFile(filePath: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if file exists
    if (!this.deps.file.exists(filePath)) {
      errors.push('File does not exist');
      return { isValid: false, errors };
    }

    // Validate file extension
    const lastDotIndex = filePath.lastIndexOf('.');
    const extension =
      lastDotIndex === -1 ? null : filePath.substring(lastDotIndex + 1).toLowerCase();
    if (!extension || !['json', 'csv'].includes(extension)) {
      errors.push(
        `Unsupported file extension: ${extension || 'none'}. Only JSON and CSV files are supported.`,
      );
    }

    // Check for path traversal patterns in the full path
    if (filePath.includes('..')) {
      errors.push('File name contains invalid or suspicious characters');
    }

    // Validate file name (basic security check)
    const fileName = filePath.split('/').pop() || filePath;
    if (fileName.length > 255) {
      errors.push('File name is too long (maximum 255 characters)');
    }

    // Check for suspicious filename patterns
    const suspiciousPatterns = [
      /[<>:"\\|?*]/, // Invalid characters for most file systems
      /^\s+|\s+$/, // Leading/trailing spaces
    ];

    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(fileName)) {
        errors.push('File name contains invalid or suspicious characters');
      }
    });

    // Check Windows reserved names separately (without extension)
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(nameWithoutExt)) {
      errors.push('File name contains invalid or suspicious characters');
    }

    return { isValid: errors.length === 0, errors };
  }

  validateFileContent(filePath: string, content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const extension = filePath.split('.').pop()?.toLowerCase();

    // Check file size (prevent memory issues)
    const contentSize = new Blob([content]).size;
    const maxSize = 50 * 1024 * 1024; // 50MB limit
    if (contentSize > maxSize) {
      errors.push(
        `File is too large (${Math.round(contentSize / 1024 / 1024)}MB). Maximum allowed size is 50MB.`,
      );
      return { isValid: false, errors };
    }

    // Check for minimum content length
    if (content.length < 10) {
      errors.push('File content is too short to contain valid bookmark data');
      return { isValid: false, errors };
    }

    // Format-specific validation
    if (extension === 'json') {
      return this.validateJSONContent(content);
    } else if (extension === 'csv') {
      return this.validateCSVContent(content);
    }

    return { isValid: true, errors };
  }

  validateJSONContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const parsed = JSON.parse(content);

      // Check if it's an array or object with bookmarks property
      if (!Array.isArray(parsed)) {
        if (typeof parsed !== 'object' || parsed === null) {
          errors.push(
            'JSON must contain an array of bookmarks or an object with bookmarks property',
          );
          return { isValid: false, errors };
        }

        if (!parsed.bookmarks || !Array.isArray(parsed.bookmarks)) {
          errors.push("JSON object must have a 'bookmarks' property containing an array");
          return { isValid: false, errors };
        }
      }

      const bookmarks = Array.isArray(parsed) ? parsed : parsed.bookmarks;

      // Validate bookmark count
      if (bookmarks.length === 0) {
        errors.push('No bookmarks found in file');
        return { isValid: false, errors };
      }

      if (bookmarks.length > 10000) {
        errors.push(`Too many bookmarks (${bookmarks.length}). Maximum allowed is 10,000.`);
        return { isValid: false, errors };
      }

      // Sample validation of first few bookmarks
      const sampleSize = Math.min(bookmarks.length, 5);
      for (let i = 0; i < sampleSize; i++) {
        const bookmark = bookmarks[i];
        if (typeof bookmark !== 'object' || bookmark === null) {
          errors.push(`Bookmark ${i + 1} is not a valid object`);
          continue;
        }

        // Check required fields existence (not content validation, just presence)
        const requiredFields = ['id', 'title', 'timestamp', 'filepath'];
        const missingFields = requiredFields.filter((field) => !(field in bookmark));
        if (missingFields.length > 0) {
          errors.push(`Bookmark ${i + 1} missing required fields: ${missingFields.join(', ')}`);
        }
      }
    } catch (error: any) {
      errors.push(`Invalid JSON format: ${error.message}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  validateCSVContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const lines = content.trim().split('\n');

      if (lines.length < 2) {
        errors.push('CSV file must have at least a header row and one data row');
        return { isValid: false, errors };
      }

      if (lines.length > 10001) {
        // Header + 10000 data rows
        errors.push(`Too many rows (${lines.length - 1}). Maximum allowed is 10,000 bookmarks.`);
        return { isValid: false, errors };
      }

      // Validate header row
      const headers = this.parseCSVLine(lines[0]);
      if (headers.length === 0) {
        errors.push('CSV file has no headers');
        return { isValid: false, errors };
      }

      if (headers.length > 20) {
        errors.push('Too many columns in CSV file. Maximum 20 columns allowed.');
        return { isValid: false, errors };
      }

      // Check for required headers
      const requiredHeaders = ['id', 'title', 'timestamp', 'filepath'];
      const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
      const missingHeaders = requiredHeaders.filter(
        (header) => !normalizedHeaders.includes(header),
      );

      if (missingHeaders.length > 0) {
        errors.push(`CSV file missing required headers: ${missingHeaders.join(', ')}`);
      }

      // Validate a few sample rows for structure
      const sampleSize = Math.min(lines.length - 1, 5);
      for (let i = 1; i <= sampleSize; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length !== headers.length) {
          errors.push(
            `Row ${i + 1} has ${values.length} values but expected ${headers.length} (matching headers)`,
          );
        }
      }

      // Check for suspicious content patterns
      const suspiciousPatterns = [/<script/i, /<iframe/i, /javascript:/i, /data:text\/html/i];

      suspiciousPatterns.forEach((pattern) => {
        if (pattern.test(content)) {
          errors.push('File contains potentially unsafe content');
        }
      });
    } catch (error: any) {
      errors.push(`CSV parsing error: ${error.message}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  }
}

describe('File Validation', () => {
  let mockDeps: any;
  let manager: MockBookmarkManager;

  beforeEach(() => {
    mockDeps = {
      file: {
        exists: vi.fn(),
        read: vi.fn(),
      },
      console: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      },
    };
    manager = new MockBookmarkManager(mockDeps);
  });

  describe('File Path Validation', () => {
    it('should reject non-existent files', () => {
      mockDeps.file.exists.mockReturnValue(false);

      const result = manager.validateImportFile('/path/to/nonexistent.json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File does not exist');
    });

    it('should accept valid JSON files', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/bookmarks.json');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid CSV files', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/bookmarks.csv');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unsupported file extensions', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/bookmarks.txt');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Unsupported file extension: txt. Only JSON and CSV files are supported.',
      );
    });

    it('should reject files with no extension', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/bookmarks');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Unsupported file extension: none. Only JSON and CSV files are supported.',
      );
    });

    it('should reject files with names that are too long', () => {
      mockDeps.file.exists.mockReturnValue(true);
      const longName = 'a'.repeat(256) + '.json';

      const result = manager.validateImportFile(`/path/to/${longName}`);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name is too long (maximum 255 characters)');
    });

    it('should reject files with path traversal patterns', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/../../../etc/passwd.json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name contains invalid or suspicious characters');
    });

    it('should reject files with invalid characters', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/book<marks>.json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name contains invalid or suspicious characters');
    });

    it('should reject Windows reserved names', () => {
      mockDeps.file.exists.mockReturnValue(true);

      const result = manager.validateImportFile('/path/to/con.json');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name contains invalid or suspicious characters');
    });
  });

  describe('File Content Size Validation', () => {
    it('should reject files that are too large', () => {
      const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB

      const result = manager.validateFileContent('/path/to/large.json', largeContent);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/File is too large.*Maximum allowed size is 50MB/);
    });

    it('should reject files that are too small', () => {
      const result = manager.validateFileContent('/path/to/tiny.json', 'tiny');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File content is too short to contain valid bookmark data');
    });

    it('should accept files of reasonable size', () => {
      const validContent = JSON.stringify([
        {
          id: '1',
          title: 'Test',
          timestamp: 100,
          filepath: '/test.mp4',
          createdAt: '2023-01-01T00:00:00Z',
        },
      ]);

      const result = manager.validateFileContent('/path/to/valid.json', validContent);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('JSON Content Validation', () => {
    it('should accept valid bookmark array', () => {
      const validJSON = JSON.stringify([
        { id: '1', title: 'Test', timestamp: 100, filepath: '/test.mp4' },
        { id: '2', title: 'Test 2', timestamp: 200, filepath: '/test2.mp4' },
      ]);

      const result = manager.validateJSONContent(validJSON);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid wrapped bookmark object', () => {
      const validJSON = JSON.stringify({
        bookmarks: [{ id: '1', title: 'Test', timestamp: 100, filepath: '/test.mp4' }],
      });

      const result = manager.validateJSONContent(validJSON);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid JSON', () => {
      const invalidJSON = '{ invalid json }';

      const result = manager.validateJSONContent(invalidJSON);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Invalid JSON format/);
    });

    it('should reject JSON without bookmarks array', () => {
      const invalidJSON = JSON.stringify({ data: 'not bookmarks' });

      const result = manager.validateJSONContent(invalidJSON);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "JSON object must have a 'bookmarks' property containing an array",
      );
    });

    it('should reject empty bookmark arrays', () => {
      const emptyJSON = JSON.stringify([]);

      const result = manager.validateJSONContent(emptyJSON);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No bookmarks found in file');
    });

    it('should reject arrays with too many bookmarks', () => {
      const manyBookmarks = Array(10001)
        .fill(0)
        .map((_, i) => ({
          id: i.toString(),
          title: `Test ${i}`,
          timestamp: i,
          filepath: `/test${i}.mp4`,
        }));

      const result = manager.validateJSONContent(JSON.stringify(manyBookmarks));

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Too many bookmarks.*Maximum allowed is 10,000/);
    });

    it('should detect missing required fields', () => {
      const incompleteJSON = JSON.stringify([
        { id: '1', title: 'Test' }, // Missing timestamp and filepath
      ]);

      const result = manager.validateJSONContent(incompleteJSON);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Bookmark 1 missing required fields.*timestamp, filepath/);
    });

    it('should handle non-object bookmarks', () => {
      const invalidJSON = JSON.stringify(['string', 123, null]);

      const result = manager.validateJSONContent(invalidJSON);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bookmark 1 is not a valid object');
    });
  });

  describe('CSV Content Validation', () => {
    it('should accept valid CSV with all required headers', () => {
      const validCSV = 'id,title,timestamp,filepath,description\n1,Test,100,/test.mp4,Test desc';

      const result = manager.validateCSVContent(validCSV);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject CSV with missing headers', () => {
      const invalidCSV = 'id,title\n1,Test';

      const result = manager.validateCSVContent(invalidCSV);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/CSV file missing required headers.*timestamp, filepath/);
    });

    it('should reject CSV with only headers', () => {
      const headerOnlyCSV = 'id,title,timestamp,filepath';

      const result = manager.validateCSVContent(headerOnlyCSV);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CSV file must have at least a header row and one data row');
    });

    it('should reject CSV with too many rows', () => {
      const header = 'id,title,timestamp,filepath';
      const rows = Array(10001)
        .fill(0)
        .map((_, i) => `${i},Test ${i},${i},/test${i}.mp4`);
      const csvContent = [header, ...rows].join('\n');

      const result = manager.validateCSVContent(csvContent);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Too many rows.*Maximum allowed is 10,000 bookmarks/);
    });

    it('should reject CSV with too many columns', () => {
      const headers = Array(21)
        .fill(0)
        .map((_, i) => `col${i}`)
        .join(',');
      const data = Array(21).fill('value').join(',');
      const csvContent = `${headers}\n${data}`;

      const result = manager.validateCSVContent(csvContent);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Too many columns in CSV file. Maximum 20 columns allowed.');
    });

    it('should detect mismatched column counts', () => {
      const csvContent = 'id,title,timestamp,filepath\n1,Test,100'; // Missing last column

      const result = manager.validateCSVContent(csvContent);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Row 2 has 3 values but expected 4/);
    });

    it('should detect potentially unsafe content', () => {
      const unsafeCSV =
        'id,title,timestamp,filepath\n1,<script>alert("xss")</script>,100,/test.mp4';

      const result = manager.validateCSVContent(unsafeCSV);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File contains potentially unsafe content');
    });

    it('should handle empty CSV file', () => {
      const result = manager.validateCSVContent('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CSV file must have at least a header row and one data row');
    });
  });

  describe('CSV Line Parsing', () => {
    it('should parse simple CSV lines', () => {
      const result = manager.parseCSVLine('a,b,c');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted fields with commas', () => {
      const result = manager.parseCSVLine('a,"b,c",d');
      expect(result).toEqual(['a', 'b,c', 'd']);
    });

    it('should handle escaped quotes', () => {
      const result = manager.parseCSVLine('a,"b ""quoted"" c",d');
      expect(result).toEqual(['a', 'b "quoted" c', 'd']);
    });

    it('should trim whitespace', () => {
      const result = manager.parseCSVLine(' a , b , c ');
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty fields', () => {
      const result = manager.parseCSVLine('a,,c');
      expect(result).toEqual(['a', '', 'c']);
    });
  });
});
