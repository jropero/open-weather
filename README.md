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
    *   **Thom's Discomfort Index (Thermal Fatigue):** Evaluates thermal stress by combining ambient temperature with relative humidity to warn users about cardiovascular strain and fatigue levels ("muggy air").
    *   **Bilingual Selector (ES / EN):** A glassmorphic top-right dropdown toggle that instantly translates the entire application's interface, metrics, graphs, and clinical breakdown texts in real-time.
*   **🎨 Dynamic Context-Aware Backgrounds [NEW]**
    *   **Weather-Based Color Themes:** The background gradient adapts beautifully to the current weather condition (e.g. warm sunny skies for clear days, slate blue for light rain, dark slate/navy for showers to guarantee high-contrast icon visibility, and deep electric purple for thunderstorms).
    *   **Smooth Cinematic Transitions:** Employs a smooth 1000ms CSS color transition when switching coordinates or loading a new city, providing a premium, highly responsive user experience.
*   **📖 Interactive Help & Science Portal [NEW]**
    *   **Clinical & Etymological Database:** Access a dedicated, glassmorphic modal detailing the Greek etymological origin of **Meteoropathy** (*meteoros* meaning "high in the sky" and *pathos* meaning "illness").
    *   **Mathematical Formulas:** Explains mathematical derivations for Thom's Discomfort Index and 24h pressure delta thresholds.
    *   **Clinical Paper Link:** Direct integration of the peer-reviewed Headache Journal research study, including an interactive link to the DOI paper.
*   **💾 Location State Persistence [NEW]**
    *   **Automatic Restores:** The app implements smart, lazy state initialization from the browser's `localStorage` (saved under `last_location`).
    *   **Seamless Persistence:** Remembers and restores the exact last selected predefined city, custom search coordinates, or GPS location across page reloads.
*   **📊 Pressure & Humidity Highlight Card**
    *   **Double-Slider Interface:** A highly compact, high-density layout that presents both surface pressure and relative humidity side-by-side (e.g., `1013 hPa, 55% RH`).
    *   **Environmental Assessment Phrase:** Generates a smart, localized summary description of current atmospheric conditions (e.g., `"normal pressure and comfortable humidity"`).
    *   **Stacked Visual Range Bars:** Features two high-fidelity visual range sliders:
        1.  **Pressure range** (980–1050 hPa) with a customized green-orange-red color gradient.
        2.  **Relative humidity range** (0%–100%) with a dry-wet blue-green-orange gradient.
*   **📈 7-Day Temporal Window (Evolution & Forecast)**
    *   An immersive, borderless multi-layer chart mathematically centered on "**TODAY**", showing 3 days of historical records on the left and 3 days of forecast predictions on the right.
    *   Overlaying essential variables cleanly: atmospheric pressure (represented by a red gradient area mountain), temperature (yellow line), and rain volume (indigo vertical bar charts with gap dividers).
    *   **Optimized Layout Padding:** Spacing in the main grid has been mathematically reduced to ensure high-density biometric metrics fit perfectly on compact screens without overflow, while keeping a generous dedicated padding specifically around the bottom *"How to interpret this chart"* legend to maintain a pristine aesthetic.
    *   **Aurora Heatmap background:** The chart's background uses a CSS parametric heatmap to seamlessly reflect high humidity risk (Yellow = Dry/Comfortable, Purple = Extreme humidity).
*   **🔮 Clinical Diagnostic Breakdowns**
    *   Beyond simple alert chips, the system provides a clear, mathematical breakdown detailing exactly which environmental factors (pressure drops, rainfall, absolute pressure, etc.) are contributing risk points to help users plan their week safely.
*   **🌤️ Next 3 Days Section**
    *   Displays forecast cards for upcoming days. Weather condition icons are unified to use the exact same color palette as the current weather card for visual consistency. Includes pre-configured Spanish locations: **Torrevieja** and **Santiago de Compostela**.
*   **🕰️ Atmospheric Memory (Historical Archive)**
    *   A comparative history module that fetches exact historical meteorological records for today's date in **1949**, **1973**, and **2003**.
    *   **Premium Visual Polishing:** Icon animations have been disabled and replaced by a subtle, glowing color aura (`icon-glow` drop shadow filter) to provide a premium feel without visual clutter or animation noise.

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
*   **Mobile-First Responsive Design:** Seamless layout scales and dynamic paddings to maximize tactile and visual space on smaller screens.
*   **Charts:** Recharts.
*   **Data API Source:** [Open-Meteo](https://open-meteo.com/).

---

## 🧠 Why Open-Meteo?

Traditional commercial APIs (like OpenWeatherMap or WeatherAPI) were bypassed in favor of Open-Meteo for a critical scientific reason:
The application requires bulk historical data (Atmospheric Memory) and precise interday pressure delta calculations. Open-Meteo provides free, unrestricted access to the **Copernicus ERA5** database (European Centre for Medium-Range Weather Forecasts). ERA5 uses global atmospheric models and supercomputers to reconstruct historical pressure and climate records at any coordinate since 1940. This provides the most scientific, reliable backing possible for tracking meteoropathic symptoms.

---

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
    *   **Índice de Incomodidad Térmica (Thom):** Analiza el estrés térmico combinando la temperatura ambiente con la humedad relativa para advertir sobre altos niveles de fatiga cardiovascular ("bochorno").
    *   **Selector de Idioma Bilingüe (ES / EN):** Un control desplegable de estilo glassmorphic arriba a la derecha que traduce toda la interfaz, métricas, gráficas y desgloses de riesgo clínico en tiempo real.
*   **🎨 Fondos Dinámicos en Tiempo Real [NUEVO]**
    *   **Colores Adaptados al Clima:** El gradiente de fondo de la app se adapta estéticamente al tiempo actual (ej. azul cielo radiante para despejado, gris/plomo para nublado, slate/azul oscuro para chubascos garantizando un contraste del 100% en los iconos, y púrpura tormenta para tempestades).
    *   **Transiciones Cinematográficas:** Suave efecto de transición CSS de 1000ms al conmutar entre ubicaciones o cargar ciudades, proporcionando un aspecto vivo y premium.
*   **📖 Portal de Ayuda y Ciencia Interactivo [NUEVO]**
    *   **Base Médica y Etimológica:** Modal de documentación de estilo glassmorphic que detalla el origen griego de la palabra **Meteoropatía** (*meteoros* que significa "alto en el cielo" y *pathos* "enfermedad/sufrimiento").
    *   **Fórmulas Clínicas:** Muestra el desglose matemático del Índice de Thom y la escala de variación de presión barométrica 24h.
    *   **Enlace al Paper Científico:** Integración directa del estudio de la revista Headache Journal (2023), con botón directo para abrir el paper a través de su DOI oficial.
*   **💾 Persistencia de Localización [NUEVO]**
    *   **Restauración Automática:** Inicialización perezosa de estado mediante el almacenamiento del navegador `localStorage` (bajo la clave `last_location`).
    *   **Experiencia Continua:** Recuerda y recupera al instante la última ciudad predefinida, coordenadas de búsqueda o localización GPS tras recargar la página.
*   **📊 Tarjeta de Presión y Humedad Destacada**
    *   **Interfaz de Doble Barra:** Sección compacta y de alta densidad que muestra la presión barométrica y la humedad relativa en la misma línea (ej. `1013 hPa, 55% HR`).
    *   **Frase de Diagnóstico Ambiental:** Genera una frase descriptiva del estado climático actual de forma inteligente y localizada (ej. *«presión normal y humedad confortable»*).
    *   **Barras de Rango Apiladas:** Cuenta con dos barras de rango visual de alta fidelidad:
        1.  **Rango de presión** (980–1050 hPa) con un degradado de color personalizado verde-naranja-rojo.
        2.  **Rango de humedad** (0%–100%) con un degradado para niveles seco-húmedo.
*   **📈 Ventana Temporal de 7 Días (Evolución y Pronóstico)**
    *   Gráfica multicapa con diseño inmersivo "sin ejes" (*borderless*). Se centra matemáticamente en el "**HOY**", mostrando 3 días de histórico empírico a la izquierda y 3 días de previsión a la derecha. 
    *   Superpone de forma limpia las variables climáticas fundamentales: la presión (montaña roja), la temperatura (línea amarilla) y la lluvia (histograma con brechas divisorias diarias).
    *   **Padding Optimizado:** El espaciado de la cuadrícula principal ha sido reducido matemáticamente para que todos los datos biométricos quepan en pantallas pequeñas sin desbordamiento, mientras se mantiene un margen exclusivo y cómodo alrededor de la leyenda de lectura inferior (*«Cómo interpretar este gráfico»*).
    *   **Fondo de Aurora (Heatmap):** El fondo del gráfico actúa como un mapa de calor visual inmersivo que delata el nivel de humedad ambiental y su riesgo (Amarillo = Seco, Morado = Riesgo extremo de humedad).
*   **🔮 Desglose de Diagnóstico Clínico**
    *   Además de mostrar "píldoras de riesgo", el sistema ofrece un desglose matemático de qué factores exactos (caída de hPa, mm de lluvia, etc.) están sumando puntos de riesgo para el paciente, ofreciendo transparencia total a la hora de organizar su semana.
*   **🌤️ Sección Próximos 3 Días**
    *   Tarjetas con previsiones diarias detalladas. Los iconos del estado del clima han sido unificados para utilizar exactamente la misma paleta de colores vibrantes que la tarjeta de clima actual para mantener la consistencia visual. Incluye las nuevas ciudades de **Torrevieja** y **Santiago de Compostela**.
*   **🕰️ Memoria Atmosférica (Archivo Histórico)**
    *   Un módulo nostálgico/comparativo que analiza el clima exacto del día de hoy en retrospectiva, viajando hasta los años **1949**, **1973** y **2003**.
    *   **Pulido Visual de Alta Calidad:** Se han eliminado las animaciones repetitivas de los iconos históricos, sustituyéndolas por un efecto de resplandor sutil (`icon-glow` vía filtro CSS drop-shadow) que proporciona presencia y coherencia premium sin ruido visual de movimiento.

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
*   **Diseño Fluido (Mobile-First):** Escalabilidad de componentes sin bordes y paddings dinámicos para maximizar la superficie táctil y visual en pantallas pequeñas.
*   **Gráficos:** Recharts.
*   **Fuente de Datos:** [Open-Meteo](https://open-meteo.com/). 

---

## 🧠 ¿Por qué Open-Meteo?

Se han descartado deliberadamente APIs comerciales tradicionales (OpenWeatherMap, WeatherAPI) a favor de Open-Meteo por una razón científica:
La aplicación necesita extraer masivamente datos retrospectivos (Memoria Atmosférica) y calcular variaciones interdiarias precisas. Open-Meteo proporciona acceso instantáneo y gratuito a la base de datos **Copernicus ERA5** (European Centre for Medium-Range Weather Forecasts), que utiliza supercomputadoras para cruzar millones de registros históricos globales y calcular la presión atmosférica exacta en cualquier coordenada desde 1940. Es la arquitectura perfecta y más fiable para la meteoropatía.

---

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
