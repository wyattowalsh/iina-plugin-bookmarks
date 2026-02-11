import React, { useState, useEffect } from 'react';

interface ExportOptions {
  format: 'json' | 'csv';
  includeMetadata: boolean;
  compressOutput?: boolean;
  filePath?: string;
  filter?: {
    tags?: string[];
    dateRange?: { start: string; end: string };
    mediaType?: string;
  };
}

interface CSVOptions extends ExportOptions {
  selectedFields: string[];
  delimiter: ',' | ';' | '\t';
  includeHeaders: boolean;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];
  postMessage?: (type: string, data?: any) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  availableTags,
  postMessage,
}) => {
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);

  // CSV specific options
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'id',
    'title',
    'timestamp',
    'filepath',
    'description',
    'createdAt',
    'tags',
  ]);
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(',');
  const [includeHeaders, setIncludeHeaders] = useState(true);

  // Filtering options
  const [useFilters, setUseFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [mediaType, setMediaType] = useState('');

  const availableFields = [
    'id',
    'title',
    'timestamp',
    'filepath',
    'description',
    'createdAt',
    'tags',
  ];

  const mediaTypes = ['Video', 'Audio', 'Movie', 'TV Show', 'Documentary'];

  // Listen for export results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'EXPORT_RESULT') {
        setIsExporting(false);
        setExportResult(event.data.data);

        // If successful and data is included, trigger download
        if (event.data.data.success && event.data.data.data) {
          downloadFile(event.data.data.data, event.data.data.filePath || 'export.txt');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], {
      type: format === 'json' ? 'application/json' : 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleExport = () => {
    if (isExporting) return;

    setIsExporting(true);
    setExportResult(null);

    const exportOptions: ExportOptions | CSVOptions = {
      format,
      includeMetadata,
      ...(format === 'csv' && {
        selectedFields,
        delimiter,
        includeHeaders,
      }),
      ...(useFilters && {
        filter: {
          ...(selectedTags.length > 0 && { tags: selectedTags }),
          ...(dateRange.start && dateRange.end && { dateRange }),
          ...(mediaType && { mediaType }),
        },
      }),
    };

    postMessage?.('EXPORT_BOOKMARKS', exportOptions);
  };

  const handleClose = () => {
    if (isExporting) return;
    setExportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
      aria-describedby="export-dialog-description"
    >
      <div className="dialog-content export-dialog">
        <div className="dialog-header">
          <h3 id="export-dialog-title">Export Bookmarks</h3>
          <p id="export-dialog-description" className="dialog-subtitle">
            Choose format and options for exporting your bookmarks
          </p>
          <button
            onClick={handleClose}
            className="close-btn"
            disabled={isExporting}
            aria-label="Close export dialog"
            title="Close export dialog"
          >
            &times;
          </button>
        </div>

        <div className="dialog-body">
          {exportResult ? (
            <div className="export-result">
              {exportResult.success ? (
                <div className="success-message">
                  <div className="result-icon">✅</div>
                  <h4>Export Successful!</h4>
                  <p>Exported {exportResult.recordCount} bookmarks</p>
                  <p>File: {exportResult.filePath}</p>
                  <button onClick={() => setExportResult(null)} className="btn-primary">
                    Export Another
                  </button>
                </div>
              ) : (
                <div className="error-message">
                  <div className="result-icon">❌</div>
                  <h4>Export Failed</h4>
                  <p>{exportResult.error}</p>
                  <button onClick={() => setExportResult(null)} className="btn-primary">
                    Try Again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExport();
              }}
            >
              {/* Format Selection */}
              <div className="form-section">
                <h4 id="format-section-heading">Export Format</h4>
                <div
                  className="format-options"
                  role="radiogroup"
                  aria-labelledby="format-section-heading"
                >
                  <label className="format-option">
                    <input
                      type="radio"
                      name="export-format"
                      value="json"
                      checked={format === 'json'}
                      onChange={(e) => setFormat(e.target.value as 'json')}
                      disabled={isExporting}
                      aria-describedby="json-format-description"
                    />
                    <div className="format-info">
                      <strong>JSON</strong>
                      <span id="json-format-description">
                        Complete data with metadata, ideal for backup/restore
                      </span>
                    </div>
                  </label>
                  <label className="format-option">
                    <input
                      type="radio"
                      name="export-format"
                      value="csv"
                      checked={format === 'csv'}
                      onChange={(e) => setFormat(e.target.value as 'csv')}
                      disabled={isExporting}
                    />
                    <div className="format-info">
                      <strong>CSV</strong>
                      <span>Tabular format for spreadsheet analysis</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* CSV Options */}
              {format === 'csv' && (
                <div className="form-section">
                  <h4>CSV Options</h4>

                  <div className="form-field">
                    <label>Delimiter</label>
                    <select
                      value={delimiter}
                      onChange={(e) => setDelimiter(e.target.value as ',' | ';' | '\t')}
                      disabled={isExporting}
                    >
                      <option value=",">Comma (,)</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="\t">Tab</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>
                      <input
                        type="checkbox"
                        checked={includeHeaders}
                        onChange={(e) => setIncludeHeaders(e.target.checked)}
                        disabled={isExporting}
                      />
                      Include column headers
                    </label>
                  </div>

                  <div className="form-field">
                    <label>Fields to Export</label>
                    <div className="field-checkboxes">
                      {availableFields.map((field) => (
                        <label key={field} className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedFields.includes(field)}
                            onChange={() => handleFieldToggle(field)}
                            disabled={isExporting}
                          />
                          {field}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* General Options */}
              <div className="form-section">
                <h4>Export Options</h4>
                <div className="form-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                      disabled={isExporting}
                    />
                    Include export metadata
                  </label>
                </div>
              </div>

              {/* Filtering Options */}
              <div className="form-section">
                <h4>Filtering</h4>
                <div className="form-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={useFilters}
                      onChange={(e) => setUseFilters(e.target.checked)}
                      disabled={isExporting}
                    />
                    Apply filters to export
                  </label>
                </div>

                {useFilters && (
                  <>
                    {/* Tag Filter */}
                    {availableTags.length > 0 && (
                      <div className="form-field">
                        <label>Filter by Tags</label>
                        <div className="tag-checkboxes">
                          {availableTags.map((tag) => (
                            <label key={tag} className="tag-checkbox">
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag)}
                                onChange={() => handleTagToggle(tag)}
                                disabled={isExporting}
                              />
                              {tag}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Date Range Filter */}
                    <div className="form-field">
                      <label>Date Range</label>
                      <div className="date-range">
                        <input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) =>
                            setDateRange((prev) => ({ ...prev, start: e.target.value }))
                          }
                          disabled={isExporting}
                          placeholder="Start date"
                        />
                        <span>to</span>
                        <input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) =>
                            setDateRange((prev) => ({ ...prev, end: e.target.value }))
                          }
                          disabled={isExporting}
                          placeholder="End date"
                        />
                      </div>
                    </div>

                    {/* Media Type Filter */}
                    <div className="form-field">
                      <label>Media Type</label>
                      <select
                        value={mediaType}
                        onChange={(e) => setMediaType(e.target.value)}
                        disabled={isExporting}
                      >
                        <option value="">All types</option>
                        {mediaTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="dialog-actions">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn-secondary"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isExporting || (format === 'csv' && selectedFields.length === 0)}
                >
                  {isExporting ? 'Exporting...' : 'Export Bookmarks'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
