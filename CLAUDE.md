# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Overview
This repository is a high-fidelity, data-intensive biometeorological dashboard designed to monitor and predict the impact of atmospheric variables on human health. The core functionality is the scientific cross-referencing of real-time weather data (pressure, humidity, wind, temp) with physiological metrics, particularly focusing on **meteoropathy** and **migraine risk**.

The application is structured as a single-page, React/TypeScript application built with Vite, emphasizing a premium, highly responsive, and aesthetically complex user experience (dark glassmorphism, cinematic transitions).

## 🏗️ High-Level Architecture
The architecture is driven by sophisticated data presentation and scientific validation, requiring coordination across several distinct modules:

1.  **Data Ingestion Layer:**
    *   **Source:** Primary data source is **Open-Meteo**, which provides access to the **Copernicus ERA5** database. This choice is critical as it enables the retrieval of extensive historical data (e.g., 1949, 1973, 2003 records) and accurate interday pressure delta calculations, necessary for scientific rigor (Atmospheric Memory module).
    *   **Timezone handling:** The forecast API is called with `timezone=UTC`. Hourly timestamps are stored as UTC strings (e.g. `"2026-10-25T01:00"`) and must be parsed with a `+Z` suffix (`new Date(h.time + 'Z')`) to avoid ambiguity. The hourly window is **25 entries** (not 24) to correctly cover DST fallback days where a local day has 25 hours.
    *   **Daily variables fetched:** `weather_code, temperature_2m_max, temperature_2m_min, pressure_msl_mean, relative_humidity_2m_mean, precipitation_sum, precipitation_probability_max, wind_speed_10m_max, sunrise, sunset`. The `sunrise` and `sunset` fields (UTC strings, parse with `+Z`) drive the day/night detection logic.
2.  **State Management & Persistence:**
    *   The application utilizes the browser's `localStorage` for persistent state. Two keys are used: `last_location` (the active location) and `custom_locations` (user-saved locations from geocoding search). Custom locations survive page reloads and can be deleted from the UI.
3.  **Core Logic & Components:**
    *   The `src/` directory houses all main components. Components are generally pure, rendering complex views based on derived biometeorological metrics (e.g., `PressureGauge.tsx`, `SevenDayChart.tsx`).
    *   The logic for calculating the **Migraine Risk Index** and **Thom's Discomfort Index** resides in dedicated scientific utility files (expected within `src/utils` or similar organizational structure).
4.  **Styling & Theming:**
    *   The entire UI is built using **Tailwind CSS v4** with a strong focus on accessibility (A11y high contrast) and cinematic, context-aware visual transitions (e.g., dynamic background gradients, glow effects).

## 📦 PWA (Progressive Web App)
The app is deployed at `ekult.co.uk/t` and is fully installable as a PWA on desktop and mobile (iOS/Android Chrome).

*   **Base path:** `base: '/t/'` in `vite.config.ts` — must be an **absolute** path. Using `'./'` breaks the service worker scope registration.
*   **Plugin:** `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Generates `dist/sw.js` + `dist/workbox-*.js` alongside the app bundle.
*   **Manifest:** `start_url`, `scope`, and `id` are all `/t/`. The icon is `favicon.svg` (`type: image/svg+xml`, `purpose: any maskable`).
*   **Caching strategy:**
    *   Open-Meteo forecast API → `NetworkFirst` with 30-minute TTL (fresh data preferred, offline fallback).
    *   Open-Meteo Geocoding API → `CacheFirst` with 7-day TTL (location names rarely change).
*   **Deploy:** copy the entire `dist/` output to the server's `/t/` directory. The SW must be served from the same scope — do not move `sw.js` into a subdirectory.

## 🛠️ Development Workflow & Commands
The project uses a standard Vite/React/TypeScript setup. All development actions should respect the following CLI commands defined in `package.json`:

| Command | Purpose | Description |
| :--- | :--- | :--- |
| `npm run dev` | **Development Server** | Starts the ultra-fast Vite development server with Hot Module Replacement (HMR). Use this for active coding. |
| `npm run build` | **Build Application** | Compiles the TypeScript source code and bundles the assets for production use. |
| `npm run lint` | **Code Quality Check** | Runs ESLint across the project to enforce TypeScript and React best practices. |
| `npm run preview` | **Local Preview** | Serves the output of the `npm run build` command, allowing inspection of the final bundled output locally. |

**Testing:**
*   **Unit/Integration Testing:** Please consult the test suite structure in `src/` for specific test files. If general unit tests are required, use the standard Jest/Testing Library setup as configured by the React/Vite environment.
*   **Single Test:** Run a specific test file or component test using the configured testing runner command (e.g., `npm run test -- <path/to/test-file>`).

## ✨ Key Features & Areas of Focus
*   **Data Visualization:** Expect advanced, multi-layered charts (Recharts) that display historical and forecasted weather data in a single, dense view. `DailyForecast` has a Daily/Hourly toggle; the hourly scrollable row shows per-card: time (UTC→local), weather icon, temperature, humidity, **wind speed**, precipitation/snow, and a comfort badge.
*   **Seasonal index bar (right side of hero):** Above 10 °C shows the **FAT.** bar (Thom's Discomfort Index, 15–30 DI scale). Below 10 °C it switches to **POLAR/WCI** (Wind Chill Index), bar height mapped from +15 °C felt (floor) to −15 °C felt (ceiling), color-coded emerald→sky→blue→purple. The standalone penguin section below the hero is separate and always shown in winter.
*   **Scientific Alerting:** Alerting logic is based on multiple, converging variables (e.g., pressure drop *AND* humidity threshold). Any change to this scientific model requires coordination between the *data layer* and the *UI component* responsible for rendering the alerts. Active alert types: migraine risk (0–6 pts), frost/ice overnight, tropical/torrida/ecuatorial night, precipitation onset.
*   **Day / Night detection:** `isNight` is computed in `App.tsx` by comparing `Date.now()` against today's `sunrise`/`sunset` UTC timestamps (parsed with `+Z`). It is passed to `getWeatherInfo(code, lang, isNight)` in `src/utils/weatherCodes.ts` — WMO code 0 (clear) → `Moon` icon + dark indigo hero; codes 1/2/3 (cloudy) → hero renders `Cloud` + `Moon` as two separate layered elements (Moon absolutely positioned upper-right of Cloud) instead of the single `CloudMoon` icon, which looks poor at 120 px. `WeatherSvgEffects` also receives `isNight` to show a cool indigo glow instead of the warm sun haze for clear nights. Hourly cards in `DailyForecast` compute `isNightHour` per card from a `sunriseSunsetByDate` lookup keyed by `h.time.slice(0,10)`.
*   **2-column widget layout:** `Presión y Humedad` and `Calidad del Aire` are in a `grid grid-cols-2 gap-3`. The pressure card gets `col-span-2` when air quality data is absent. Both cards use fully-opaque gradients (`from-white to-indigo-50` / `from-white to-emerald-50`) — avoid semi-transparent backgrounds that bleed the dark page colour through.
*   **FutureForecast (Próximos 3 Días):** Shows humidity (`💧`) and rain probability (`🌂 X%`) side by side per day. Rain probability comes from `precipitation_probability_max` in the daily API response, stored as `DailyWeather.precipitationProbability`.
*   **Alert badge grouping:** Hero badges are split into semantic `flex flex-wrap` rows — (1) pressure+temperature trends, (2) precipitation onset + rain amounts, (3) wind, (4) night/frost/storm conditions. This prevents long vertical stacks in cities with many active alerts (e.g. Basilea, Taipei).
*   **Predefined locations:** `src/constants/locations.ts` — includes Basilea, Parla, Madrid, Barcelona, Lagartera, Corral de Almaguer, Granada, Torrevieja, Santiago de Compostela, Reikiavik, Santo Domingo, Auckland, Taipéi.
*   **Custom location search:** `LocationSelector` uses `src/hooks/useGeoSearch.ts` to hit the Open-Meteo Geocoding API (`language=es`, debounced 300 ms) when the user types ≥ 2 chars. Results can be saved to `custom_locations` in localStorage (keyed by `custom_${lat}_${lon}`). Saved locations appear in a dedicated "Mis ubicaciones" section with a delete button. Deleting the active custom location falls back to the default (Basel).
*   **Performance:** The UI is optimized for high performance, minimal transitions, and mobile-first design, requiring careful handling of component rendering and CSS performance.

## 🧠 Dependencies and Utilities
*   **Styling:** The component library uses modern Tailwind CSS utility classes extensively. New components should adhere to the existing glassmorphic, minimalist aesthetic.
*   **TypeScript:** Strong typing is enforced throughout the project. Always respect the type definitions found in the shared utility/types files.
*   **External Data:** Be mindful of the asynchronous nature of external data fetching from the Open-Meteo API, ensuring robust loading and error states are implemented across all components.