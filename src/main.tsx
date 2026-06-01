import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/theme.css';
import './styles/fonts.css';
import 'animal-island-ui/dist/index.css';
import App from './App';

document.body.classList.add('animal-cursor--force');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
