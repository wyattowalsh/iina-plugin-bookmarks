import React from 'react';

interface LoadingProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  size = 'medium',
  overlay = false,
  className = '',
}) => {
  const sizeClasses = {
    small: 'loading-small',
    medium: 'loading-medium',
    large: 'loading-large',
  };

  const content = (
    <div className={`loading ${sizeClasses[size]} ${className}`}>
      <div className="loading-spinner" aria-hidden="true">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
      {message && (
        <div className="loading-message" aria-live="polite">
          {message}
        </div>
      )}
    </div>
  );

  if (overlay) {
    return (
      <div className="loading-overlay" role="status" aria-label={message}>
        {content}
      </div>
    );
  }

  return (
    <div role="status" aria-label={message}>
      {content}
    </div>
  );
};

export default Loading;
