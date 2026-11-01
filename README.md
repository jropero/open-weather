# 🌤️ Open-Weather: Biometeorological Tracker

[![Live Demo](https://img.shields.io/badge/Try%20the%20Live%20App-ekult.co.uk%2Ft%2F-blue?style=for-the-badge&logo=vercel)](https://ekult.co.uk/t/)

[🇪🇸 Leer en Español](#-open-weather-seguimiento-biometeorológico)

A high-fidelity medical-weather application designed to monitor and predict the impact of atmospheric variables on human health, with a specific focus on **meteoropathy**, **migraines**, and **thermal fatigue**.

---

## 🎯 Project Goal

The human brain and cardiovascular system are highly sensitive to sudden changes in atmospheric pressure and humidity. This project was built as a personal biometeorological dashboard to cross-reference empirical weather variables—such as barometric pressure, wind, precipitation, temperature, and humidity—with physical symptoms like muscle fatigue, tension headaches, and migraines.

---

## ✨ Core Features

*   **🚨 Real-Time Biomedical Alerts**
    *   **ΔP (24h Pressure Delta):** Instantly calculates sudden atmospheric pressure drops ($\le$ -3 hPa and $\le$ -5 hPa) relative to the previous day's average. It features a **visual gradient pressure gauge** that positions the current pressure in a realistic meteorological spectrum (980 hPa to 1050 hPa) for instant clinical context.
    *   **Seasonal Index Bar:** The right-hand hero bar adapts to the season. Above 10 °C it shows **FAT.** (Thom's Discomfort Index) with a warm colour scale. Below 10 °C it switches to **POLAR / WCI** (Wind Chill Index), filling upward as the felt temperature drops, colour-coded emerald → sky → blue → purple. [NEW]
    *   **Thom's Discomfort Index (Thermal Fatigue):** Evaluates thermal stress by combining ambient temperature with relative humidity to warn users about cardiovascular strain and fatigue levels ("muggy air"). When discomfort is high, a **Shrimp Fatigue bar** (🦐 × 1–4) appears below the hero. [NEW]
    *   **Wind Chill Index (Índice Polar):** In winter (< 10 °C), a standalone **penguin section** (🐧 × 1–4) shows the calculated felt temperature and severity level. [NEW]
    *   **Frost & Ice Risk:** Overnight minimum temperature and dew point are monitored; alerts surface when frost (≤ 2 °C) or ice (≤ 0 °C) conditions are expected. [NEW]
    *   **Tropical Night Alerts:** If overnight minimums exceed 20 °C (tropical), 25 °C (torrida), or 25 °C+ (ecuatorial), a contextual badge is displayed. [NEW]
    *   **Bilingual Selector (ES / EN):** A glassmorphic top-right dropdown toggle that instantly translates the entire application's interface, metrics, graphs, and clinical breakdown texts in real-time.
*   **🌙 Day / Night Awareness [NEW]**
    *   Fetches real sunrise and sunset times for the current location from Open-Meteo daily data.
    *   When it is night at the selected location the hero switches to a dark indigo palette: **clear sky** shows a `Moon` icon with a cool moonlit SVG glow; **cloudy night** shows a composed `Cloud + Moon` layered icon (moon peeking from upper-right behind the cloud) with a gentle pulse animation — no rotation.
    *   Each hourly forecast card independently detects night based on its own timestamp vs the day's sunrise/sunset, so a single scroll from evening to morning shows the correct day/night icons per card.
*   **🎨 Dynamic Context-Aware Backgrounds [NEW]**
    *   **Weather-Based Color Themes:** The background gradient adapts beautifully to the current weather condition (e.g. warm sunny skies for clear days, slate blue for light rain, dark slate/navy for showers to guarantee high-contrast icon visibility, and deep electric purple for thunderstorms).
    *   **Clear Night SVG Effect:** A cool indigo radial glow replaces the warm sun haze when the sky is clear and it is night at the location.
    *   **Smooth Cinematic Transitions:** Employs a smooth 1000ms CSS color transition when switching coordinates or loading a new city, providing a premium, highly responsive user experience.
*   **📖 Interactive Help & Science Portal [NEW]**
    *   **Clinical & Etymological Database:** Access a dedicated, glassmorphic modal detailing the Greek etymological origin of **Meteoropathy** (*meteoros* meaning "high in the sky" and *pathos* meaning "illness").
    *   **Mathematical Formulas:** Explains mathematical derivations for Thom's Discomfort Index and 24h pressure delta thresholds.
    *   **Clinical Paper Link:** Direct integration of the peer-reviewed Headache Journal research study, including an interactive link to the DOI paper.
*   **💾 Location Search & Management [NEW]**
    *   **Geocoding Search:** Type any city name (≥ 2 chars) in the location selector to search the Open-Meteo Geocoding API in real time (debounced, results in Spanish). Hit **+** to save a result to your personal list.
    *   **My Locations:** Saved locations persist under `custom_locations` in `localStorage` and appear in a dedicated section with a **trash** delete button. Deleting the active location falls back to the default.
    *   **Automatic Restores:** The last active location is saved under `last_location` and restored on page reload — works for GPS, predefined, and custom locations alike.
*   **📊 Pressure & Humidity / Air Quality — 2-Column Widget Layout [NEW]**
    *   On mobile the **Presión y Humedad** and **Calidad del Aire** cards sit side-by-side in a 2-column grid. If air-quality data is unavailable, the pressure card stretches full-width.
    *   Each card has a subtle directional gradient background: indigo tint for pressure, emerald tint for air quality.
    *   **Air Quality card:** AQI value, unit, and colour-coded badge on one line; PM2.5 / PM10 with μg/m³ units and a green/yellow/orange/red dot per WHO thresholds; allergen names printed inside each pollen badge.
    *   **Double-Slider Interface:** A highly compact, high-density layout that presents both surface pressure and relative humidity side-by-side (e.g., `1013 hPa, 55% RH`).
    *   **Environmental Assessment Phrase:** Generates a smart, localized summary description of current atmospheric conditions (e.g., `"normal pressure and comfortable humidity"`).
    *   **Hourly Pressure Velocity (3h & 6h Trends) [NEW]:** Shows real-time barometric rate of change. Delta 6h acts as a critical scientific trigger matching Katsuki et al. (2023)'s highest AI gain parameter (11.7), alerting users with a warning icon (⚡) during rapid pressure drops.
    *   **Temperature Velocity (3h & 6h Trends) [NEW]:** Paired badges show short-term temperature change alongside the pressure trend, flagging sharp rises (🔥) that compound heat stress.
    *   **Precipitation Onset Badge [NEW]:** Detects the next rain, snow, or freezing-rain event within the 25-hour hourly window and shows a live countdown ("in 10 min", "in 2h") plus 3h / 6h / 12h accumulated rain totals.
    *   **Grouped Alert Badges [NEW]:** Hero-section badges are organised into semantic rows — pressure+temperature trends, precipitation, wind, and conditions — using horizontal flex-wrap per group to maximise density without vertical sprawl.
    *   **Stacked Visual Range Bars:** Features two high-fidelity visual range sliders:
        1.  **Pressure range** (980–1050 hPa) with a customized green-orange-red color gradient.
        2.  **Relative humidity range** (0%–100%) with a dry-wet blue-green-orange gradient.
*   **📈 Forecast Chart — Daily & Hourly Modes [NEW]**
    *   A toggle switches between a **7-day daily** view (centred on TODAY, 3 days past + 3 days ahead) and a **25-hour hourly** view of the next day.
    *   The **hourly scrollable card row** shows per-hour: local time (DST-safe UTC parsing), weather icon, temperature, humidity, **wind speed** (teal), and precipitation / snowfall.
    *   The multi-layer chart overlays: atmospheric pressure (red gradient area), temperature (yellow line), **wind speed (dashed blue line)** [NEW], and rain volume (indigo bars).
    *   **Aurora Heatmap background:** The chart background reflects humidity risk as a horizontal gradient (yellow = dry, purple = extreme humidity).
    *   **DST-safe timestamps [NEW]:** The API is queried with `timezone=UTC`; times are parsed with a `+Z` suffix so the autumn clock-change hour (e.g. two consecutive 02:00 cards) displays correctly.
*   **🔮 Clinical Diagnostic Breakdowns**
    *   Beyond simple alert chips, the system provides a clear, mathematical breakdown detailing exactly which environmental factors (pressure drops, rainfall, absolute pressure, etc.) are contributing risk points to help users plan their week safely.
*   **🌍 Other Locations Panel [NEW]**
    *   A live comparison panel fetches current temperature and pressure for a set of predefined global cities: **Granada**, **Torrevieja**, **Santiago de Compostela**, **Basel**, **Reykjavik**, and **Taipei**. Cards highlight the currently selected location. Data is cached in `localStorage` for 1 hour — on repeat visits the panel loads instantly with no network requests.
*   **🕰️ Atmospheric Memory (Historical Archive)**
    *   A comparative history module that fetches exact historical meteorological records for today's date in **1949**, **1973**, and **2003**. Records are cached for the full calendar day and auto-purged at midnight, eliminating 3 API calls on repeat loads.
*   **☀️ Daily Sunshine & Precipitation Hours [NEW]**
    *   Each day in the 3-day forecast shows **sunshine hours** (☀️ amber) and **precipitation hours** (🌧 sky-blue) directly next to the day name — sourced from `sunshine_duration` and `precipitation_hours` in the Open-Meteo daily API.
    *   **Premium Visual Polishing:** Icon animations have been disabled and replaced by a subtle, glowing color aura (`icon-glow` drop shadow filter) to provide a premium feel without visual clutter or animation noise.
*   **🔮 Long-Range Outlook — Drill-Down Views [NEW]**
    *   The Long-Range Outlook widget (EC46 weekly + SEAS5 monthly/seasonal heatmap) now supports interactive drill-downs on every cell.
    *   **Ensemble fan chart (weeks 1–2):** Tapping a cell opens a full-screen overlay showing all 50 ECMWF IFS ensemble members as individual spaghetti lines, a shaded probability fan (p10–p90 / p25–p75), and the ensemble mean. A plain-language spread badge classifies whether members agree (✓), diverge (⚡), or split into two clusters (⑂). Variable switcher covers temperature, precipitation, pressure, and wind.
    *   **Climate history comparison (months + seasons):** Tapping a monthly or seasonal cell compares the SEAS5 forecast against the last 10 years of ERA5 observed history. Shows the 3 most analogous past years, and a compact bar chart per variable displaying each year's value alongside the S5 bias-corrected forecast. The adjusted forecast is computed as *ERA5 10-year mean + SEAS5 anomaly* to correct for SEAS5's known cold bias (~3 °C for Alpine winters). A methodological footnote discloses that the SEAS5 anomaly baseline (1993–2016 hindcast) differs from the ERA5 baseline (2016–2025), which may introduce ~0.5–1.5 °C of overestimation.

---

## 🔬 Scientific Validation (AI & Big Data)

Our medical alert algorithms are rooted in recent peer-reviewed clinical research. The compound **Migraine Risk Index** is based on the key risk factors identified by the large-scale empirical study:
> *"Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence: A retrospective observational cross-sectional study"* — Katsuki et al. (DOI: [10.1111/head.14482](https://doi.org/10.1111/head.14482)), published in *Headache: The Journal of Head and Face Pain* (2023).

The study analyzed **336,951 hourly headache events** from **4,375 smartphone app users** using gradient-boosted tree models and deep learning (R² = 53.7%). The researchers identified these atmospheric variables as the strongest predictors of headache occurrence, ranked by feature importance ("gain"):

| Factor | Gain | Our Weight |
|---|---|---|
| Barometric pressure drop (6h before event) | **11.7** | +3 pts (≤ −5 hPa) / +1 pt (≤ −3 hPa) |
| Higher relative humidity | **7.1** | +1 pt (> 70%) |
| Low absolute barometric pressure | **3.9** | +1 pt (< 1010 hPa) |
| Active precipitation | **3.1** | +1 pt (> 0 mm) |

The application evaluates these 4 parameters in real time to calculate a combined **Migraine Risk Index** (Minimal, Low, Moderate, High, Extreme).

> **Transparency note:** The original paper reports continuous feature importances from an AI regression model, not binary thresholds. Our threshold-based scoring system (−5 hPa, 1010 hPa, 70% humidity) is calibrated from broader peer-reviewed clinical literature (NIH studies citing 5–6 hPa/24h drops and 6–10 hPa absolute deviations from 1013 hPa as clinically significant). The algorithm requires convergence of multiple factors to avoid alert fatigue.

---

## 🚀 Architecture and Technology Stack

This application is built for high-performance network requests and an immersive user interface (*dark glassmorphism* and A11y high contrast), leveraging the latest tools in the React ecosystem:

*   **Core:** React 19, TypeScript, Vite.
*   **Styles:** Tailwind CSS v4, Lucide Icons.
*   **PWA:** `vite-plugin-pwa` — installable on desktop and mobile, offline-capable via Workbox service worker.
*   **Mobile-First Responsive Design:** Seamless layout scales and dynamic paddings to maximize tactile and visual space on smaller screens.
*   **Charts:** Recharts.
*   **Data API Source:** [Open-Meteo](https://open-meteo.com/).
*   **Client-side caching (localStorage):** The 12-city comparison panel is cached for 1 hour; historical records (1949/1973/2003) are cached for the full calendar day and auto-purged at midnight. On repeat visits, the app drops from 18 API requests to 5.

---

## 🧠 Why Open-Meteo?

Traditional commercial APIs (like OpenWeatherMap or WeatherAPI) were bypassed in favor of Open-Meteo for a critical scientific reason:
The application requires bulk historical data (Atmospheric Memory) and precise interday pressure delta calculations. Open-Meteo provides free, unrestricted access to the **Copernicus ERA5** database (European Centre for Medium-Range Weather Forecasts). ERA5 uses global atmospheric models and supercomputers to reconstruct historical pressure and climate records at any coordinate since 1940. This provides the most scientific, reliable backing possible for tracking meteoropathic symptoms.

Additionally, for locations within Switzerland, the app automatically switches to the **MeteoSwiss ICON-CH2-E** model (`models=meteoswiss_icon_ch2`) — a high-resolution (~1 km grid) NWP model operated by MeteoSwiss that captures Alpine terrain effects (Foehn winds, valley inversions) that global models miss.

---

## 📱 PWA — Install on Your Device [NEW]

The app is installable as a Progressive Web App directly from [ekult.co.uk/t](https://ekult.co.uk/t/):

*   **Desktop (Chrome/Edge):** Click the install icon in the address bar.
*   **iOS (Safari):** Share → Add to Home Screen.
*   **Android (Chrome):** Tap the banner or ⋮ menu → Add to Home Screen.

Once installed, the app works **offline** — the last fetched weather data is served from cache, and new data loads automatically when connectivity is restored.

## 🛠️ Installation & Local Development

1.  Clone the repository to your local machine.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the ultra-fast Vite development server (HMR):
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:5173/` in your browser.

---
---

# 🌤️ Open-Weather: Seguimiento Biometeorológico

[🇺🇸 Read in English](#🌤️-open-weather-biometeorological-tracker)

Una aplicación meteorológica médica de alta fidelidad diseñada específicamente para registrar y predecir el impacto de las variables atmosféricas en la salud humana, enfocándose en la **meteoropatía**, las **migrañas** y la **fatiga térmica**.

---

## 🎯 Objetivo del Proyecto

El cerebro humano y el sistema cardiovascular son altamente sensibles a los cambios de presión atmosférica y humedad. Este proyecto fue concebido como un panel de control biometeorológico personal para cruzar datos empíricos de presión, viento, lluvia, temperatura y humedad con episodios físicos (cansancio, dolores de cabeza tensionales y migrañas).

---

## ✨ Características Principales

*   **🚨 Alertas Biomédicas en Tiempo Real**
    *   **ΔP (Variación Interdiaria de Presión):** Calcula instantáneamente caídas de presión atmosférica bruscas ($\le$ -3 hPa y $\le$ -5 hPa) respecto a la media del día anterior. Incluye un **manómetro visual degradado** que posiciona la presión actual dentro de un rango realista (980 hPa a 1050 hPa) para dar contexto instantáneo.
    *   **Barra de Índice Estacional:** La barra derecha del héroe se adapta a la estación. Por encima de 10 °C muestra **FAT.** (Índice de Incomodidad de Thom). Por debajo de 10 °C cambia a **POLAR / WCI** (Índice de Sensación Térmica), cuyo relleno sube cuanto más baja la sensación, con escala de color esmeralda → azul cielo → azul → morado. [NUEVO]
    *   **Índice de Incomodidad Térmica (Thom):** Analiza el estrés térmico combinando la temperatura ambiente con la humedad relativa. Cuando la incomodidad es alta aparece el **Índice Gamba** (🦐 × 1–4) bajo el héroe. [NUEVO]
    *   **Índice Polar (Sensación Térmica por Viento):** En invierno (< 10 °C), una sección independiente de **pingüinos** (🐧 × 1–4) muestra la temperatura sentida y el nivel de frío. [NUEVO]
    *   **Alerta de Helada y Hielo:** Se monitoriza la temperatura mínima nocturna y el punto de rocío; se activan alertas cuando se prevé helada (≤ 2 °C) o hielo (≤ 0 °C). [NUEVO]
    *   **Noches Tropicales:** Si las mínimas nocturnas superan 20 °C (tropical), 25 °C (tórrida) o más (ecuatorial), se muestra una insignia contextual. [NUEVO]
    *   **Selector de Idioma Bilingüe (ES / EN):** Un control desplegable de estilo glassmorphic arriba a la derecha que traduce toda la interfaz, métricas, gráficas y desgloses de riesgo clínico en tiempo real.
*   **🌙 Detección Día / Noche [NUEVO]**
    *   Obtiene la hora exacta de amanecer y anochecer para la ubicación actual desde los datos diarios de Open-Meteo.
    *   Por la noche el héroe cambia a paleta índigo oscura: **cielo despejado** muestra el icono `Luna` con un resplandor SVG frío plateado; **noche nublada** compone `Nube + Luna` como dos iconos apilados (la luna asomando por la parte superior derecha detrás de la nube) con animación de pulso suave — sin rotación.
    *   Cada tarjeta horaria detecta noche de forma independiente en función de su propio timestamp frente al amanecer/anochecer del día, mostrando el icono correcto al desplazarse de tarde a madrugada.
*   **🎨 Fondos Dinámicos en Tiempo Real [NUEVO]**
    *   **Colores Adaptados al Clima:** El gradiente de fondo de la app se adapta estéticamente al tiempo actual (ej. azul cielo radiante para despejado, gris/plomo para nublado, slate/azul oscuro para chubascos garantizando un contraste del 100% en los iconos, y púrpura tormenta para tempestades).
    *   **Efecto SVG Noche Despejada:** Un resplandor radial índigo frío reemplaza el halo solar cálido cuando el cielo está despejado y es de noche en la ubicación.
    *   **Transiciones Cinematográficas:** Suave efecto de transición CSS de 1000ms al conmutar entre ubicaciones o cargar ciudades, proporcionando un aspecto vivo y premium.
*   **📖 Portal de Ayuda y Ciencia Interactivo [NUEVO]**
    *   **Base Médica y Etimológica:** Modal de documentación de estilo glassmorphic que detalla el origen griego de la palabra **Meteoropatía** (*meteoros* que significa "alto en el cielo" y *pathos* "enfermedad/sufrimiento").
    *   **Fórmulas Clínicas:** Muestra el desglose matemático del Índice de Thom y la escala de variación de presión barométrica 24h.
    *   **Enlace al Paper Científico:** Integración directa del estudio de la revista Headache Journal (2023), con botón directo para abrir el paper a través de su DOI oficial.
*   **💾 Búsqueda y Gestión de Ubicaciones [NUEVO]**
    *   **Búsqueda Geocodificada:** Escribe cualquier nombre de ciudad (≥ 2 caracteres) en el selector de ubicación para consultar la API de Geocodificación de Open-Meteo en tiempo real (con debounce, resultados en español). Pulsa **+** para guardar una ubicación en tu lista personal.
    *   **Mis Ubicaciones:** Las ubicaciones guardadas se persisten bajo `custom_locations` en `localStorage` y aparecen en una sección propia con botón de **papelera** para eliminarlas. Si se elimina la ubicación activa, se vuelve a la predeterminada.
    *   **Restauración Automática:** La última ubicación activa se guarda bajo `last_location` y se restaura al recargar la página — funciona con GPS, predefinidas y ubicaciones personalizadas.
*   **📊 Widgets de Presión/Humedad y Calidad del Aire — Diseño en 2 Columnas [NUEVO]**
    *   En móvil las tarjetas **Presión y Humedad** y **Calidad del Aire** se muestran en cuadrícula de 2 columnas. Si no hay datos de calidad del aire, la tarjeta de presión ocupa el ancho completo.
    *   Cada tarjeta tiene un degradado de fondo suave: tono índigo para presión, tono esmeralda para calidad del aire.
    *   **Tarjeta de Calidad del Aire:** valor AQI, unidad e insignia con color en la misma línea; PM2,5 / PM10 con unidades μg/m³ y punto verde/amarillo/naranja/rojo según umbrales OMS; nombres de alérgenos impresos dentro de cada insignia de polino.
    *   **Interfaz de Doble Barra:** Sección compacta y de alta densidad que muestra la presión barométrica y la humedad relativa en la misma línea (ej. `1013 hPa, 55% HR`).
    *   **Frase de Diagnóstico Ambiental:** Genera una frase descriptiva del estado climático actual de forma inteligente y localizada (ej. *«presión normal y humedad confortable»*).
    *   **Velocidad de Presión Horaria (Tendencias 3h y 6h) [NUEVO]:** Muestra el ritmo de cambio barométrico a corto plazo. El Delta 6h actúa como disparador de riesgo crítico, alineándose directamente con el parámetro de mayor ganancia de IA (11,7) del estudio de Katsuki et al. (2023), alertando con un icono de advertencia (⚡) en caídas rápidas.
    *   **Velocidad de Temperatura (3h y 6h) [NUEVO]:** Insignias gemelas muestran la variación de temperatura a corto plazo junto a la tendencia de presión, marcando subidas bruscas (🔥) que agravan el estrés térmico.
    *   **Insignia de Inicio de Precipitación [NUEVO]:** Detecta el próximo evento de lluvia, nieve o lluvia helada en la ventana de 25 horas y muestra una cuenta atrás en vivo ("en 10 min", "en 2h") más los totales acumulados a 3h / 6h / 12h.
    *   **Insignias de Alerta Agrupadas [NUEVO]:** Las insignias del héroe se organizan en filas semánticas — tendencias de presión+temperatura, precipitación, viento y condiciones — con flex-wrap horizontal por grupo para maximizar la densidad sin apilar verticalmente.
    *   **Barras de Rango Apiladas:** Cuenta con dos barras de rango visual de alta fidelidad:
        1.  **Rango de presión** (980–1050 hPa) con un degradado de color personalizado verde-naranja-rojo.
        2.  **Rango de humedad** (0%–100%) con un degradado para niveles seco-húmedo.
*   **📈 Gráfico de Pronóstico — Modos Diario y Por Horas [NUEVO]**
    *   Un selector alterna entre la vista **diaria de 7 días** (centrada en HOY, 3 días pasados + 3 futuros) y la vista **horaria de 25 horas**.
    *   La **fila desplazable de tarjetas horarias** muestra por hora: hora local (parseada como UTC para compatibilidad con el cambio horario), icono del tiempo, temperatura, humedad, **velocidad del viento** (turquesa) [NUEVO] y precipitación / nieve.
    *   La gráfica multicapa superpone: presión (área roja), temperatura (línea amarilla), **velocidad del viento (línea azul discontinua)** [NUEVO] y lluvia (barras índigo).
    *   **Fondo de Aurora (Heatmap):** El fondo refleja el nivel de humedad como degradado horizontal (amarillo = seco, morado = humedad extrema).
    *   **Timestamps compatibles con el cambio horario [NUEVO]:** La API se consulta con `timezone=UTC` y los tiempos se parsean con el sufijo `+Z` para mostrar correctamente la hora repetida en el cambio de horario de otoño.
*   **🔮 Desglose de Diagnóstico Clínico**
    *   Además de mostrar "píldoras de riesgo", el sistema ofrece un desglose matemático de qué factores exactos (caída de hPa, mm de lluvia, etc.) están sumando puntos de riesgo para el paciente, ofreciendo transparencia total a la hora de organizar su semana.
*   **🌍 Panel de Otras Ubicaciones [NUEVO]**
    *   Panel de comparativa en tiempo real que obtiene la temperatura y la presión actuales de un conjunto de ciudades predefinidas: **Granada**, **Torrevieja**, **Santiago de Compostela**, **Basilea**, **Reikiavik** y **Taipéi**. La tarjeta de la ciudad seleccionada actualmente aparece destacada. Los datos se cachean en `localStorage` durante 1 hora — en recargas sucesivas el panel aparece al instante sin peticiones de red.
*   **🕰️ Memoria Atmosférica (Archivo Histórico)**
    *   Un módulo nostálgico/comparativo que analiza el clima exacto del día de hoy en retrospectiva, viajando hasta los años **1949**, **1973** y **2003**. Los registros se cachean durante todo el día natural y se purgan automáticamente a medianoche, eliminando 3 peticiones API en recargas sucesivas.
    *   **Pulido Visual de Alta Calidad:** Se han eliminado las animaciones repetitivas de los iconos históricos, sustituyéndolas por un efecto de resplandor sutil (`icon-glow` vía filtro CSS drop-shadow) que proporciona presencia y coherencia premium sin ruido visual de movimiento.
*   **☀️ Horas de Sol y Precipitación Diarias [NUEVO]**
    *   Cada día del pronóstico de 3 días muestra las **horas de sol** (☀️ ámbar) y las **horas de precipitación** (🌧 azul cielo) directamente junto al nombre del día — obtenidas de `sunshine_duration` y `precipitation_hours` de la API diaria de Open-Meteo.
*   **🔮 Perspectiva a Largo Plazo — Vistas de Detalle [NUEVO]**
    *   El widget de Perspectiva a Largo Plazo (mapa de calor EC46 semanal + SEAS5 mensual/estacional) ahora permite explorar cada celda en profundidad.
    *   **Gráfico de abanico ensemble (semanas 1–2):** Al pulsar una celda se abre una vista a pantalla completa con los 50 miembros individuales del conjunto ECMWF IFS como líneas espagueti, una banda de probabilidad sombreada (p10–p90 / p25–p75) y la media del conjunto. Una etiqueta en lenguaje llano clasifica si los modelos coinciden (✓), divergen (⚡) o se dividen en dos grupos (⑂). Selector de variable: temperatura, precipitación, presión y viento.
    *   **Comparativa histórica (meses + estaciones):** Al pulsar una celda mensual o estacional se compara la previsión SEAS5 con los últimos 10 años de ERA5. Muestra los 3 años más análogos y un gráfico de barras por variable con los valores de cada año junto a la previsión S5 ajustada. El valor ajustado se calcula como *media ERA5 10 años + anomalía SEAS5*, corrigiendo el sesgo frío conocido de SEAS5 (~3 °C en inviernos alpinos). Una nota metodológica advierte que la referencia de anomalía SEAS5 (hindcast 1993–2016) difiere de la base ERA5 (2016–2025), lo que puede suponer una sobreestimación de ~0,5–1,5 °C.

---

## 🔬 Validación Científica (IA y Big Data)

Nuestros algoritmos de alerta médica se basan en evidencia clínica reciente. El sistema compuesto de **Riesgo de Migraña** está basado en los factores de riesgo clave identificados por el estudio empírico a gran escala:
> *"Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence: A retrospective observational cross-sectional study"* — Katsuki et al. (DOI: [10.1111/head.14482](https://doi.org/10.1111/head.14482)), publicado en *Headache: The Journal of Head and Face Pain* (2023).

El estudio analizó **336.951 eventos de dolor de cabeza por hora** de **4.375 usuarios de app móvil** mediante modelos de gradient boosting y deep learning (R² = 53,7%). Los investigadores identificaron estas variables atmosféricas como los predictores más fuertes de cefaleas, clasificados por importancia de ganancia ("gain"):

| Factor | Gain | Nuestro Peso |
|---|---|---|
| Caída de presión barométrica (6h antes del evento) | **11,7** | +3 pts (≤ −5 hPa) / +1 pt (≤ −3 hPa) |
| Humedad relativa alta | **7,1** | +1 pt (> 70%) |
| Presión barométrica absoluta baja | **3,9** | +1 pt (< 1010 hPa) |
| Precipitación activa | **3,1** | +1 pt (> 0 mm) |

La aplicación cruza estos 4 parámetros en tiempo real para emitir un **Índice de Riesgo de Migraña** compuesto (Mínimo, Bajo, Moderado, Alto, Extremo).

> **Nota de transparencia:** El paper original reporta importancias continuas de un modelo de regresión de IA, no umbrales binarios. Nuestro sistema de puntuación basado en umbrales (−5 hPa, 1010 hPa, 70% humedad) está calibrado a partir de literatura clínica revisada por pares más amplia (estudios NIH que citan caídas de 5–6 hPa/24h y desviaciones absolutas de 6–10 hPa respecto a 1013 hPa como clínicamente significativas). El algoritmo exige la convergencia de múltiples factores para evitar la fatiga de alertas.

---

## 🚀 Arquitectura y Tecnologías

Esta aplicación destaca por su alto rendimiento en red y su UI inmersiva (*Glassmorphism* oscuro y alto contraste A11y), construida sobre la pila más moderna del ecosistema React.

*   **Core:** React 19, TypeScript, Vite.
*   **Estilos:** Tailwind CSS v4, Lucide Icons.
*   **PWA:** `vite-plugin-pwa` — instalable en escritorio y móvil, funciona sin conexión mediante service worker Workbox.
*   **Diseño Fluido (Mobile-First):** Escalabilidad de componentes sin bordes y paddings dinámicos para maximizar la superficie táctil y visual en pantallas pequeñas.
*   **Gráficos:** Recharts.
*   **Fuente de Datos:** [Open-Meteo](https://open-meteo.com/).
*   **Caché en cliente (localStorage):** El panel de comparativa de 12 ciudades se cachea 1 hora; los registros históricos (1949/1973/2003) se cachean durante el día natural y se purgan a medianoche. En recargas sucesivas la app pasa de 18 a 5 peticiones API.

---

## 🧠 ¿Por qué Open-Meteo?

Se han descartado deliberadamente APIs comerciales tradicionales (OpenWeatherMap, WeatherAPI) a favor de Open-Meteo por una razón científica:
La aplicación necesita extraer masivamente datos retrospectivos (Memoria Atmosférica) y calcular variaciones interdiarias precisas. Open-Meteo proporciona acceso instantáneo y gratuito a la base de datos **Copernicus ERA5** (European Centre for Medium-Range Weather Forecasts), que utiliza supercomputadoras para cruzar millones de registros históricos globales y calcular la presión atmosférica exacta en cualquier coordenada desde 1940. Es la arquitectura perfecta y más fiable para la meteoropatía.

Además, para ubicaciones dentro de Suiza la app cambia automáticamente al modelo **MeteoSwiss ICON-CH2-E** (`models=meteoswiss_icon_ch2`) — un modelo PNT de alta resolución (~1 km de malla) operado por MeteoSwiss que captura efectos del terreno alpino (viento Foehn, inversiones de valle) que los modelos globales no reproducen.

---

## 📱 PWA — Instalar en tu Dispositivo [NUEVO]

La aplicación se puede instalar como Progressive Web App directamente desde [ekult.co.uk/t](https://ekult.co.uk/t/):

*   **Escritorio (Chrome/Edge):** Haz clic en el icono de instalación en la barra de direcciones.
*   **iOS (Safari):** Compartir → Añadir a la pantalla de inicio.
*   **Android (Chrome):** Pulsa el banner o ⋮ menú → Añadir a la pantalla de inicio.

Una vez instalada, la app funciona **sin conexión** — los últimos datos meteorológicos quedan en caché y los nuevos se cargan automáticamente al recuperar la conexión.

## 🛠️ Instalación y Desarrollo Local

1.  Clona el repositorio en tu máquina.
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Arranca el servidor de desarrollo ultrarrápido (HMR):
    ```bash
    npm run dev
    ```
4.  Abre `http://localhost:5173/` en tu navegador.
