import React, { useState, useCallback, useRef } from 'react';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  availableTags?: string[];
  maxTags?: number;
  disabled?: boolean;
  className?: string;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  placeholder = "Add tags...",
  availableTags = [],
  maxTags = 10,
  disabled = false,
  className = ""
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = availableTags.filter(tag => 
    !tags.includes(tag) && 
    tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addTag = useCallback((tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onTagsChange([...tags, trimmedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  }, [tags, onTagsChange, maxTags]);

  const removeTag = useCallback((tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  }, [tags, onTagsChange]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.length > 0 && filteredSuggestions.length > 0);
  }, [filteredSuggestions.length]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setInputValue('');
    }
  }, [inputValue, addTag, removeTag, tags]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    addTag(suggestion);
    inputRef.current?.focus();
  }, [addTag]);

  const handleInputFocus = useCallback(() => {
    if (inputValue && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [inputValue, filteredSuggestions.length]);

  const handleInputBlur = useCallback(() => {
    // Delay hiding suggestions to allow clicking on them
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  return (
    <div className={`tag-input-container ${className}`}>
      <div className="tag-input-field">
        {tags.map(tag => (
          <span key={tag} className="tag-chip">
            <span className="tag-text">{tag}</span>
            {!disabled && (
              <button
                type="button"
                className="tag-remove"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="tag-input"
          />
        )}
      </div>
      
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="tag-suggestions">
          {filteredSuggestions.slice(0, 5).map(suggestion => (
            <button
              key={suggestion}
              type="button"
              className="tag-suggestion"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      
      {tags.length >= maxTags && (
        <div className="tag-limit-message">
          Maximum {maxTags} tags allowed
        </div>
      )}
    </div>
  );
};

export default TagInput; 