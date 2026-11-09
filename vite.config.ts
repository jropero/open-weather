import { defineConfig, lazyPlugins } from 'vite-plus';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  staged: {
    '*.{ts,tsx,js,mjs}': ['vp lint --fix', 'vp fmt'],
    '*.{json,md,html}': 'vp fmt',
    '*.css': 'stylelint --fix',
  },
  lint: {
    plugins: ['react', 'jsx-a11y', 'typescript'],
    jsPlugins: [
      { name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' },
      { name: 'sonarjs', specifier: './lint/sonarjs.js' },
    ],
    ignorePatterns: ['dist/**', 'node_modules/**', 'public/**', '.claude/**'],
    env: { browser: true, es2022: true, node: true },
    options: { typeAware: true, typeCheck: true },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'react/react-in-jsx-scope': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'sonarjs/cognitive-complexity': ['error', 5],
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 10 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/pseudo-random': 'off',
      'sonarjs/no-ignored-return': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/concise-regex': 'error',
      'sonarjs/slow-regex': 'error',
      'sonarjs/code-eval': 'error',
    },
  },
  fmt: {
    singleQuote: true,
    semi: true,
    printWidth: 96,
    trailingComma: 'all',
    tabWidth: 2,
    endOfLine: 'lf',
    sortPackageJson: false,
    ignorePatterns: ['dist/', 'node_modules/', 'public/', '.claude/', '*.css'],
  },
  base: '/t/',
  plugins: lazyPlugins(() => [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'Open Weather',
        short_name: 'OpenWeather',
        description:
          'Biometeorological dashboard — pressure, humidity, migraine risk, and discomfort index.',
        theme_color: '#0f0a1e',
        background_color: '#0f0a1e',
        display: 'standalone',
        start_url: '/t/',
        scope: '/t/',
        id: '/t/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 30, // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Seasonal outlook: localStorage is the primary cache; this only adds an offline fallback
            urlPattern: /^https:\/\/seasonal-api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-seasonal-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geocoding-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ]),
});
