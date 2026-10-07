import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { PhotoHostingProvider } from './photos/Hosting';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhotoHostingProvider>
      <App />
    </PhotoHostingProvider>
  </StrictMode>,
);
