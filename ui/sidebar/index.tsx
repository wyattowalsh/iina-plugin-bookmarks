import '../shared.scss';
import './sidebar.scss';

import React from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from '../components/ErrorBoundary';
import App from './app';

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}
