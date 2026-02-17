import React, { useState, useEffect, useCallback } from 'react';
import { BookmarkData, ImportResult } from '../types';
import { handleDialogKeyDown } from '../utils/focusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useWindowMessage } from '../hooks/useWindowMessage';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  postMessage?: (type: string, data?: any) => void;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ isOpen, onClose, postMessage }) => {
  const [step, setStep] = useState<'file-selection' | 'options' | 'processing' | 'results'>(
    'file-selection',
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileFormat, setFileFormat] = useState<'json' | 'csv' | null>(null);
  const [parsedData, setParsedData] = useState<BookmarkData[]>([]);
  const [importOptions, setImportOptions] = useState({
    duplicateHandling: 'skip' as 'skip' | 'replace' | 'merge',
    validateData: true,
    preserveIds: false,
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('file-selection');
      setSelectedFile(null);
      setFileFormat(null);
      setParsedData([]);
      setImportResult(null);
      setParseErrors([]);
    }
  }, [isOpen]);

  // Escape key handler for dialog a11y
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    onClose();
  }, [isProcessing, onClose]);

  useEscapeKey(isOpen, handleClose);

  const handleImportResult = useCallback((data: any) => {
    setIsProcessing(false);
    setImportResult(data);
    setStep('results');
  }, []);

  useWindowMessage('IMPORT_RESULT', handleImportResult);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const errors: string[] = [];

    // Validate file type
    const extension = file.name.toLowerCase().split('.').pop();
    if (!extension || !['json', 'csv'].includes(extension)) {
      errors.push('Please select a valid JSON or CSV file.');
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push(
        `File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed size is 50MB.`,
      );
    }

    // Validate minimum file size
    if (file.size < 10) {
      errors.push('File is too small to contain valid bookmark data.');
    }

    // Validate file name
    if (file.name.length > 255) {
      errors.push('File name is too long (maximum 255 characters).');
    }

    // Check for suspicious file patterns
    const suspiciousPatterns = [
      /\.\./, // Path traversal
      /[<>:"\\|?*]/, // Invalid characters
      /^\s+|\s+$/, // Leading/trailing spaces
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
    ];

    const fileName = file.name;
    suspiciousPatterns.forEach((pattern) => {
      if (pattern.test(fileName)) {
        errors.push('File name contains invalid or suspicious characters.');
      }
    });

    if (errors.length > 0) {
      setParseErrors(errors);
      setSelectedFile(null);
      setFileFormat(null);
      return;
    }

    setSelectedFile(file);
    setFileFormat(extension as 'json' | 'csv');
    setParseErrors([]);
  };

  const handleFileRead = () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        parseFileContent(content, fileFormat!);
      } catch (error) {
        setParseErrors([
          `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        ]);
      }
    };
    reader.readAsText(selectedFile);
  };

  const parseFileContent = (content: string, format: 'json' | 'csv') => {
    const errors: string[] = [];
    let data: BookmarkData[];

    try {
      if (format === 'json') {
        data = parseJSONContent(content, errors);
      } else {
        data = parseCSVContent(content, errors);
      }

      if (errors.length > 0) {
        setParseErrors(errors);
        return;
      }

      // Validate parsed data
      const validatedData = validateBookmarkData(data, errors);

      if (errors.length > 0) {
        setParseErrors(errors);
        return;
      }

      setParsedData(validatedData);
      setStep('options');
    } catch (error: any) {
      setParseErrors([`Parse error: ${error.message}`]);
    }
  };

  const parseJSONContent = (content: string, errors: string[]): BookmarkData[] => {
    const parsed = JSON.parse(content);

    // Handle both direct array format and wrapped format with metadata
    let bookmarks: any[];

    if (Array.isArray(parsed)) {
      bookmarks = parsed;
    } else if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
      bookmarks = parsed.bookmarks;
    } else {
      throw new Error(
        'Invalid JSON format. Expected array of bookmarks or object with bookmarks array.',
      );
    }

    return bookmarks.map((bookmark, index) => {
      if (!bookmark.id || !bookmark.title || !bookmark.filepath) {
        errors.push(`Bookmark ${index + 1}: Missing required fields (id, title, filepath)`);
      }

      const now = new Date().toISOString();
      return {
        id: bookmark.id || `imported-${Date.now()}-${index}`,
        title: bookmark.title || 'Untitled',
        timestamp: bookmark.timestamp || 0,
        filepath: bookmark.filepath || '',
        description: bookmark.description || '',
        createdAt: bookmark.createdAt || now,
        updatedAt: bookmark.updatedAt || now,
        tags: Array.isArray(bookmark.tags) ? bookmark.tags : [],
      };
    });
  };

  const parseCSVContent = (content: string, errors: string[]): BookmarkData[] => {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    // Parse header row
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const requiredFields = ['id', 'title', 'filepath'];

    // Check for required fields
    const missingFields = requiredFields.filter((field) => !headers.includes(field));
    if (missingFields.length > 0) {
      throw new Error(`Missing required CSV columns: ${missingFields.join(', ')}`);
    }

    // Parse data rows
    return lines.slice(1).map((line, index) => {
      const values = parseCSVLine(line);
      const bookmark: any = {};

      headers.forEach((header, headerIndex) => {
        const value = values[headerIndex] || '';

        // Process special fields
        if (header === 'tags') {
          bookmark[header] = value ? value.split(';').map((tag) => tag.trim()) : [];
        } else if (header === 'timestamp') {
          bookmark[header] = parseFloat(value.split('(')[0].trim()) || 0;
        } else {
          bookmark[header] = value;
        }
      });

      // Validate required fields
      if (!bookmark.id || !bookmark.title || !bookmark.filepath) {
        errors.push(`Row ${index + 2}: Missing required fields`);
      }

      // Set defaults for missing optional fields
      const now = new Date().toISOString();
      return {
        id: bookmark.id || `imported-${Date.now()}-${index}`,
        title: bookmark.title || 'Untitled',
        timestamp: bookmark.timestamp || 0,
        filepath: bookmark.filepath || '',
        description: bookmark.description || '',
        createdAt: bookmark.createdAt || now,
        updatedAt: bookmark.updatedAt || now,
        tags: bookmark.tags || [],
      };
    });
  };

  const parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  };

  const validateBookmarkData = (data: BookmarkData[], errors: string[]): BookmarkData[] => {
    return data.filter((bookmark, index) => {
      let isValid = true;

      // Check required fields
      if (!bookmark.id || typeof bookmark.id !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing ID`);
        isValid = false;
      }

      if (!bookmark.title || typeof bookmark.title !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing title`);
        isValid = false;
      }

      if (!bookmark.filepath || typeof bookmark.filepath !== 'string') {
        errors.push(`Bookmark ${index + 1}: Invalid or missing filepath`);
        isValid = false;
      }

      // Validate timestamp
      if (typeof bookmark.timestamp !== 'number' || bookmark.timestamp < 0) {
        errors.push(`Bookmark ${index + 1}: Invalid timestamp`);
        isValid = false;
      }

      return isValid;
    });
  };

  const handleImport = () => {
    if (parsedData.length === 0) return;

    setIsProcessing(true);
    setStep('processing');

    postMessage?.('IMPORT_BOOKMARKS', {
      bookmarks: parsedData,
      options: importOptions,
    });
  };

  const handleRetry = () => {
    setStep('file-selection');
    setImportResult(null);
    setParseErrors([]);
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" onKeyDown={handleDialogKeyDown}>
      <div className="dialog-content import-dialog">
        <div className="dialog-header">
          <h3>Import Bookmarks</h3>
          <p className="dialog-subtitle">Import bookmarks from JSON or CSV files</p>
          <button onClick={handleClose} className="close-btn" disabled={isProcessing}>
            &times;
          </button>
        </div>

        <div className="dialog-body">
          {step === 'file-selection' && (
            <div className="import-step file-selection">
              <div className="step-header">
                <h4>Step 1: Select File</h4>
                <p>Choose a JSON or CSV file containing bookmark data</p>
              </div>

              <div className="file-input-section">
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={handleFileSelect}
                  className="file-input"
                  id="bookmark-file"
                />
                <label htmlFor="bookmark-file" className="file-input-label">
                  {selectedFile ? selectedFile.name : 'Choose File...'}
                </label>
              </div>

              {selectedFile && (
                <div className="file-info">
                  <div className="info-item">
                    <strong>File:</strong> {selectedFile.name}
                  </div>
                  <div className="info-item">
                    <strong>Size:</strong> {(selectedFile.size / 1024).toFixed(2)} KB
                  </div>
                  <div className="info-item">
                    <strong>Format:</strong> {fileFormat?.toUpperCase()}
                  </div>
                </div>
              )}

              {parseErrors.length > 0 && (
                <div className="error-messages">
                  <h5>Errors:</h5>
                  <ul>
                    {parseErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="step-actions">
                <button
                  onClick={handleFileRead}
                  disabled={!selectedFile || parseErrors.length > 0}
                  className="btn-primary"
                >
                  Parse File
                </button>
              </div>
            </div>
          )}

          {step === 'options' && (
            <div className="import-step options">
              <div className="step-header">
                <h4>Step 2: Import Options</h4>
                <p>Found {parsedData.length} bookmark(s) to import</p>
              </div>

              <div className="options-section">
                <div className="option-group">
                  <label>Duplicate Handling</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="skip"
                        checked={importOptions.duplicateHandling === 'skip'}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            duplicateHandling: e.target.value as any,
                          }))
                        }
                      />
                      <div className="option-info">
                        <strong>Skip</strong>
                        <span>Keep existing bookmarks, skip duplicates</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="replace"
                        checked={importOptions.duplicateHandling === 'replace'}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            duplicateHandling: e.target.value as any,
                          }))
                        }
                      />
                      <div className="option-info">
                        <strong>Replace</strong>
                        <span>Replace existing bookmarks with imported data</span>
                      </div>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="merge"
                        checked={importOptions.duplicateHandling === 'merge'}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            duplicateHandling: e.target.value as any,
                          }))
                        }
                      />
                      <div className="option-info">
                        <strong>Merge</strong>
                        <span>Merge tags and update metadata while preserving bookmarks</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="option-group">
                  <label>Additional Options</label>
                  <div className="checkbox-options">
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={importOptions.validateData}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            validateData: e.target.checked,
                          }))
                        }
                      />
                      Validate bookmark data before import
                    </label>
                    <label className="checkbox-option">
                      <input
                        type="checkbox"
                        checked={importOptions.preserveIds}
                        onChange={(e) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            preserveIds: e.target.checked,
                          }))
                        }
                      />
                      Preserve original bookmark IDs
                    </label>
                  </div>
                </div>
              </div>

              <div className="preview-section">
                <h5>
                  Preview ({Math.min(parsedData.length, 3)} of {parsedData.length})
                </h5>
                <div className="bookmark-preview">
                  {parsedData.slice(0, 3).map((bookmark, index) => (
                    <div key={index} className="preview-item">
                      <strong>{bookmark.title}</strong>
                      <div className="preview-details">
                        <span>File: {bookmark.filepath}</span>
                        <span>
                          Time: {Math.floor(bookmark.timestamp / 60)}:
                          {(bookmark.timestamp % 60).toFixed(0).padStart(2, '0')}
                        </span>
                        {bookmark.tags && bookmark.tags.length > 0 && (
                          <span>Tags: {bookmark.tags.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="step-actions">
                <button onClick={() => setStep('file-selection')} className="btn-secondary">
                  Back
                </button>
                <button onClick={handleImport} className="btn-primary">
                  Import Bookmarks
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="import-step processing">
              <div className="loading-indicator">
                <div className="spinner"></div>
                <h4>Importing Bookmarks...</h4>
                <p>Processing {parsedData.length} bookmark(s)</p>
              </div>
            </div>
          )}

          {step === 'results' && importResult && (
            <div className="import-step results">
              <div className="result-header">
                {importResult.success ? (
                  <div className="success-icon">✅</div>
                ) : (
                  <div className="error-icon">❌</div>
                )}
                <h4>{importResult.success ? 'Import Completed!' : 'Import Failed'}</h4>
              </div>

              <div className="result-stats">
                <div className="stat-item">
                  <strong>Imported:</strong> {importResult.importedCount}
                </div>
                <div className="stat-item">
                  <strong>Skipped:</strong> {importResult.skippedCount}
                </div>
                <div className="stat-item">
                  <strong>Errors:</strong> {importResult.errorCount}
                </div>
                {importResult.duplicates !== undefined && (
                  <div className="stat-item">
                    <strong>Duplicates:</strong> {importResult.duplicates}
                  </div>
                )}
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="error-details">
                  <h5>Errors:</h5>
                  <ul>
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="step-actions">
                <button onClick={handleRetry} className="btn-secondary">
                  Import Another File
                </button>
                <button onClick={handleClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDialog;
