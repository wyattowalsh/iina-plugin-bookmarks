import React from 'react';

export const BOOKMARK_COLORS = [
  { name: 'red', hex: '#FF3B30' },
  { name: 'orange', hex: '#FF9500' },
  { name: 'yellow', hex: '#FFCC00' },
  { name: 'green', hex: '#34C759' },
  { name: 'blue', hex: '#007AFF' },
  { name: 'purple', hex: '#AF52DE' },
  { name: 'pink', hex: '#FF2D55' },
  { name: 'grey', hex: '#8E8E93' },
] as const;

export function getColorHex(name: string): string {
  const color = BOOKMARK_COLORS.find((c) => c.name === name);
  return color ? color.hex : '#8E8E93';
}

interface BookmarkColorPickerProps {
  selectedColor?: string;
  onColorChange: (color: string | undefined) => void;
  compact?: boolean;
}

const BookmarkColorPicker: React.FC<BookmarkColorPickerProps> = ({
  selectedColor,
  onColorChange,
  compact = false,
}) => {
  const swatchSize = compact ? 16 : 24;
  const gap = compact ? 4 : 6;

  const handleClick = (colorName: string) => {
    if (selectedColor === colorName) {
      onColorChange(undefined);
    } else {
      onColorChange(colorName);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${gap}px`,
        flexWrap: 'wrap',
      }}
      role="radiogroup"
      aria-label="Bookmark color"
    >
      {/* None / clear button */}
      <button
        type="button"
        onClick={() => onColorChange(undefined)}
        title="No color"
        aria-label="No color"
        aria-checked={selectedColor === undefined}
        role="radio"
        style={{
          width: `${swatchSize}px`,
          height: `${swatchSize}px`,
          borderRadius: '50%',
          border: `2px solid ${selectedColor === undefined ? 'var(--text-primary, #333)' : 'var(--border-color, #ccc)'}`,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          fontSize: `${compact ? 9 : 12}px`,
          lineHeight: 1,
          color: 'var(--text-secondary, #666)',
          flexShrink: 0,
        }}
      >
        x
      </button>

      {BOOKMARK_COLORS.map((color) => {
        const isSelected = selectedColor === color.name;
        return (
          <button
            key={color.name}
            type="button"
            onClick={() => handleClick(color.name)}
            title={color.name.charAt(0).toUpperCase() + color.name.slice(1)}
            aria-label={color.name}
            aria-checked={isSelected}
            role="radio"
            style={{
              width: `${swatchSize}px`,
              height: `${swatchSize}px`,
              borderRadius: '50%',
              background: color.hex,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              outline: isSelected ? `2px solid ${color.hex}` : undefined,
              outlineOffset: isSelected ? '2px' : undefined,
              boxShadow: isSelected ? `0 0 0 1px var(--background-primary, #fff)` : undefined,
              opacity: isSelected ? 1 : 0.8,
              transition: 'opacity 0.15s, outline 0.15s',
            }}
          />
        );
      })}
    </div>
  );
};

export default BookmarkColorPicker;
