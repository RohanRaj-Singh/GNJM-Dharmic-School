import '../css/app.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
  title: (title) =>
    title
      ? `${title} - Guru Nanak Ji Mission Dharmic School`
      : 'Guru Nanak Ji Mission Dharmic School',

  resolve: (name) =>
    resolvePageComponent(
      `./Pages/${name}.jsx`,
      import.meta.glob('./Pages/**/*.jsx')
    ),

  setup({ el, App, props }) {
    const root = createRoot(el);

    root.render(
      <>
        <App {...props} />
        <Toaster
          position="top-right"
          marginTop={80}
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '14px',
            },
          }}
        />
      </>
    );
  },

  progress: {
    color: '#4B5563',
  },
});
