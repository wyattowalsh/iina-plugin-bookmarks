import React, { memo, useMemo } from 'react';

interface TextHighlighterProps {
  text: string;
  searchTerms: string | string[];
  className?: string;
  highlightClassName?: string;
  caseSensitive?: boolean;
}

/**
 * TextHighlighter component for highlighting search terms within text
 * Optimized for performance with memoization
 */
const TextHighlighter: React.FC<TextHighlighterProps> = memo(
  ({
    text,
    searchTerms,
    className = '',
    highlightClassName = 'text-highlight',
    caseSensitive = false,
  }) => {
    const highlightedText = useMemo(() => {
      if (!text || !searchTerms) {
        return <span className={className}>{text}</span>;
      }

      // Normalize search terms to array
      const terms = Array.isArray(searchTerms)
        ? searchTerms.filter((term) => term.trim().length > 0)
        : [searchTerms].filter((term) => term.trim().length > 0);

      if (terms.length === 0) {
        return <span className={className}>{text}</span>;
      }

      // Escape special regex characters and create pattern
      const escapedTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      const pattern = new RegExp(`(${escapedTerms.join('|')})`, caseSensitive ? 'g' : 'gi');

      // Split text by matches and create highlighted segments
      const parts = text.split(pattern);

      return (
        <span className={className}>
          {parts.map((part, index) => {
            // Check if this part matches any search term
            const isMatch = terms.some((term) =>
              caseSensitive ? part === term : part.toLowerCase() === term.toLowerCase(),
            );

            return isMatch ? (
              <mark key={index} className={highlightClassName}>
                {part}
              </mark>
            ) : (
              <span key={index}>{part}</span>
            );
          })}
        </span>
      );
    }, [text, searchTerms, className, highlightClassName, caseSensitive]);

    return highlightedText;
  },
);

TextHighlighter.displayName = 'TextHighlighter';

export default TextHighlighter;
