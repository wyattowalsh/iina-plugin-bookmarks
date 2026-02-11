import React, { useState, useCallback, useRef, useEffect } from 'react';
import useDebounce from '../hooks/useDebounce';

interface SearchSuggestion {
  type: 'field' | 'operator' | 'value' | 'preset';
  label: string;
  value: string;
  description?: string;
}

interface AdvancedSearchProps {
  onSearchChange: (searchTerm: string, parsedQuery: ParsedSearchQuery) => void;
  placeholder?: string;
  availableTags?: string[];
  availableFiles?: string[];
  recentSearches?: string[];
  className?: string;
}

export interface ParsedSearchQuery {
  textSearch: string;
  fieldSearches: {
    title?: string;
    description?: string;
    tags?: string[];
    filepath?: string;
  };
  operators: {
    AND: string[];
    OR: string[];
    NOT: string[];
  };
  dateFilters: {
    created?: {
      operator: 'today' | 'this-week' | 'this-month' | '>' | '<' | '=';
      value?: string;
    };
  };
}

const SEARCH_OPERATORS = ['AND', 'OR', 'NOT'];
const FIELD_OPERATORS = ['title:', 'description:', 'tag:', 'filepath:', 'created:'];
const DATE_SHORTCUTS = ['today', 'this-week', 'this-month', 'yesterday'];

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
  onSearchChange,
  placeholder = 'Search bookmarks... (try: tag:work AND title:meeting)',
  availableTags = [],
  availableFiles = [],
  recentSearches = [],
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [caretPosition, setCaretPosition] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Parse search query into structured format
  const parseSearchQuery = useCallback((query: string): ParsedSearchQuery => {
    const result: ParsedSearchQuery = {
      textSearch: '',
      fieldSearches: {},
      operators: { AND: [], OR: [], NOT: [] },
      dateFilters: {},
    };

    // Remove extra spaces and normalize
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    let remainingQuery = normalizedQuery;

    // Extract field searches (title:"value", tag:value, etc.)
    const fieldRegex = /(title|description|tag|filepath|created):(?:"([^"]+)"|(\S+))/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(normalizedQuery)) !== null) {
      const [fullMatch, field, quotedValue, unquotedValue] = fieldMatch;
      const value = quotedValue || unquotedValue;

      remainingQuery = remainingQuery.replace(fullMatch, '').trim();

      switch (field) {
        case 'title':
          result.fieldSearches.title = value;
          break;
        case 'description':
          result.fieldSearches.description = value;
          break;
        case 'tag':
          result.fieldSearches.tags = [...(result.fieldSearches.tags || []), value];
          break;
        case 'filepath':
          result.fieldSearches.filepath = value;
          break;
        case 'created':
          if (DATE_SHORTCUTS.includes(value)) {
            result.dateFilters.created = { operator: value as any };
          } else if (value.startsWith('>') || value.startsWith('<') || value.startsWith('=')) {
            result.dateFilters.created = {
              operator: value[0] as any,
              value: value.slice(1),
            };
          }
          break;
      }
    }

    // Extract boolean operators and terms
    const operatorRegex = /\b(AND|OR|NOT)\s+(\S+)/g;
    let operatorMatch;

    while ((operatorMatch = operatorRegex.exec(remainingQuery)) !== null) {
      const [fullMatch, operator, term] = operatorMatch;
      result.operators[operator as keyof typeof result.operators].push(term);
      remainingQuery = remainingQuery.replace(fullMatch, '').trim();
    }

    // What's left is general text search
    result.textSearch = remainingQuery.trim();

    return result;
  }, []);

  // Generate search suggestions based on current input
  const generateSuggestions = useCallback(
    (query: string, position: number): SearchSuggestion[] => {
      const suggestions: SearchSuggestion[] = [];
      const beforeCaret = query.slice(0, position);
      const lastWord = beforeCaret.split(/\s+/).pop() || '';

      // Field suggestions
      if (lastWord.length === 0 || FIELD_OPERATORS.some((op) => op.startsWith(lastWord))) {
        FIELD_OPERATORS.forEach((field) => {
          if (field.startsWith(lastWord)) {
            suggestions.push({
              type: 'field',
              label: field,
              value: field,
              description: `Search in ${field.replace(':', '')} field`,
            });
          }
        });
      }

      // Operator suggestions
      if (
        lastWord.length === 0 ||
        SEARCH_OPERATORS.some((op) => op.startsWith(lastWord.toUpperCase()))
      ) {
        SEARCH_OPERATORS.forEach((op) => {
          if (op.startsWith(lastWord.toUpperCase())) {
            suggestions.push({
              type: 'operator',
              label: op,
              value: op + ' ',
              description: `${op} operator for combining terms`,
            });
          }
        });
      }

      // Tag value suggestions (when typing after "tag:")
      if (
        beforeCaret.includes('tag:') &&
        !beforeCaret.includes(' ', beforeCaret.lastIndexOf('tag:'))
      ) {
        const tagPrefix = lastWord.replace('tag:', '');
        availableTags
          .filter((tag) => tag.toLowerCase().includes(tagPrefix.toLowerCase()))
          .slice(0, 5)
          .forEach((tag) => {
            suggestions.push({
              type: 'value',
              label: tag,
              value: tag,
              description: `Filter by tag: ${tag}`,
            });
          });
      }

      // Date shortcuts (when typing after "created:")
      if (
        beforeCaret.includes('created:') &&
        !beforeCaret.includes(' ', beforeCaret.lastIndexOf('created:'))
      ) {
        const datePrefix = lastWord.replace('created:', '');
        DATE_SHORTCUTS.filter((shortcut) => shortcut.includes(datePrefix)).forEach((shortcut) => {
          suggestions.push({
            type: 'value',
            label: shortcut,
            value: shortcut,
            description: `Filter by ${shortcut}`,
          });
        });
      }

      // Recent searches
      if (lastWord.length === 0 && recentSearches.length > 0) {
        recentSearches.slice(0, 3).forEach((search) => {
          suggestions.push({
            type: 'preset',
            label: search,
            value: search,
            description: 'Recent search',
          });
        });
      }

      return suggestions.slice(0, 8); // Limit suggestions
    },
    [availableTags, recentSearches],
  );

  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);

  // Update suggestions when search term or caret position changes
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const newSuggestions = generateSuggestions(searchTerm, caretPosition);
      setSuggestions(newSuggestions);
    }
  }, [searchTerm, caretPosition, showSuggestions, generateSuggestions]);

  // Handle search change and trigger callback
  useEffect(() => {
    if (debouncedSearchTerm !== undefined) {
      const parsedQuery = parseSearchQuery(debouncedSearchTerm);
      onSearchChange(debouncedSearchTerm, parsedQuery);
    }
  }, [debouncedSearchTerm, parseSearchQuery, onSearchChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCaretPosition(e.target.selectionStart || 0);
    setShowSuggestions(true);
    setSelectedSuggestionIndex(-1);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0) {
            applySuggestion(suggestions[selectedSuggestionIndex]);
          } else {
            setShowSuggestions(false);
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
          break;
      }
    },
    [showSuggestions, suggestions, selectedSuggestionIndex],
  );

  const applySuggestion = useCallback(
    (suggestion: SearchSuggestion) => {
      if (!inputRef.current) return;

      const beforeCaret = searchTerm.slice(0, caretPosition);
      const afterCaret = searchTerm.slice(caretPosition);
      const lastWordStart = beforeCaret.lastIndexOf(' ') + 1;

      const newValue =
        beforeCaret.slice(0, lastWordStart) +
        suggestion.value +
        (suggestion.type === 'field' ? '' : ' ') +
        afterCaret;

      setSearchTerm(newValue);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);

      // Set cursor position after the inserted suggestion
      setTimeout(() => {
        if (inputRef.current) {
          const newPosition =
            lastWordStart + suggestion.value.length + (suggestion.type === 'field' ? 0 : 1);
          inputRef.current.setSelectionRange(newPosition, newPosition);
          setCaretPosition(newPosition);
        }
      }, 0);
    },
    [searchTerm, caretPosition],
  );

  const handleFocus = useCallback(() => {
    setShowSuggestions(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay hiding to allow suggestion clicks
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  return (
    <div className={`advanced-search ${className}`} role="combobox" aria-expanded={showSuggestions}>
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          className="advanced-search-input"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={(e) => setCaretPosition((e.target as HTMLInputElement).selectionStart || 0)}
          onKeyUp={(e) => setCaretPosition((e.target as HTMLInputElement).selectionStart || 0)}
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-activedescendant={
            selectedSuggestionIndex >= 0 ? `suggestion-${selectedSuggestionIndex}` : undefined
          }
          role="textbox"
          aria-label="Advanced search for bookmarks with filters and operators"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            id="search-suggestions"
            className="search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.value}`}
                id={`suggestion-${index}`}
                className={`suggestion-item ${index === selectedSuggestionIndex ? 'selected' : ''}`}
                onMouseDown={() => applySuggestion(suggestion)}
                role="option"
                aria-selected={index === selectedSuggestionIndex}
                aria-describedby={suggestion.description ? `suggestion-desc-${index}` : undefined}
              >
                <span className={`suggestion-label ${suggestion.type}`}>{suggestion.label}</span>
                {suggestion.description && (
                  <span id={`suggestion-desc-${index}`} className="suggestion-description">
                    {suggestion.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedSearch;
