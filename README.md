# 🌤️ Open-Weather: Biometeorological Tracker

Una aplicación meteorológica médica de alta fidelidad diseñada específicamente para registrar y predecir el impacto de las variables atmosféricas en la salud humana, enfocándose en la **meteoropatía**, las **migrañas** y la **fatiga térmica**.

## 🎯 Objetivo del Proyecto

El cerebro humano y el sistema cardiovascular son altamente sensibles a los cambios de presión atmosférica y humedad. Este proyecto fue concebido como un panel de control biometeorológico personal para cruzar datos empíricos de presión, viento, lluvia, temperatura y humedad con episodios físicos (cansancio, dolores de cabeza tensionales y migrañas).

## ✨ Características Principales

*   **🚨 Alertas Biomédicas en Tiempo Real**
    *   **ΔP (Variación Interdiaria de Presión):** Calcula instantáneamente caídas de presión atmosférica bruscas ($\le$ -5 hPa) respecto a la media del día anterior, un detonante científicamente documentado de las migrañas por descompresión de los vasos cerebrales y senos paranasales.
    *   **Índice de Incomodidad Térmica (Thom):** Analiza el estrés térmico combinando la temperatura ambiente con la humedad relativa para advertir sobre altos niveles de fatiga cardiovascular ("bochorno").
*   **📈 Evolución Clínica de 7 Días**
    *   Gráfica multicapa interactiva que superpone 5 variables clave (Presión, Temperatura, Humedad, Viento y Precipitaciones), permitiendo encontrar patrones causales de los episodios a lo largo de la semana, junto a un informe diario de los índices de riesgo médico.
*   **🔮 Previsión Médica a 3 Días**
    *   Planificador a corto plazo que muestra con antelación las "píldoras de riesgo" (Migraña o Fatiga) para organizar la semana en base al estrés atmosférico pronosticado.
*   **🕰️ Memoria Atmosférica (Archivo Histórico)**
    *   Un módulo nostálgico/comparativo que analiza el clima exacto del día de hoy en retrospectiva, viajando hasta los años **1949**, **1973** y **2003**.

## 🔬 Validación Científica (IA y Big Data)

Nuestros algoritmos de alerta médica se basan en evidencia clínica reciente. Específicamente, el sistema compuesto de **Riesgo de Migraña** implementa directamente las conclusiones del estudio empírico *"Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence"* (DOI: [10.1111/head.14482](https://doi.org/10.1111/head.14482)), publicado en *Headache Journal* (2023).

Dicho estudio, tras analizar más de 330.000 eventos de dolor de cabeza con modelos predictivos, demostró que la incidencia de migrañas aumenta drásticamente cuando convergen de forma simultánea:
1. **Caídas significativas de presión barométrica** (evaluado en la app mediante el cálculo del *Delta P* en 24h).
2. **Presión barométrica absoluta baja**.
3. **Alta humedad relativa**.
4. **Incremento de precipitaciones**.

La aplicación cruza estas 4 variables atmosféricas en tiempo real para emitir un **Índice de Riesgo de Migraña** compuesto (Bajo, Moderado, Alto, Extremo).

## 🚀 Arquitectura y Tecnologías

Esta aplicación destaca por su alto rendimiento en red y su UI inmersiva (*Glassmorphism* oscuro y alto contraste A11y), construida sobre la pila más moderna del ecosistema React.

*   **Core:** React 19, TypeScript, Vite.
*   **Estilos:** Tailwind CSS v4, Lucide Icons.
*   **Gráficos:** Recharts.
*   **Fuente de Datos:** [Open-Meteo](https://open-meteo.com/). 

## 🧠 ¿Por qué Open-Meteo?

Se han descartado deliberadamente APIs comerciales tradicionales (OpenWeatherMap, WeatherAPI) a favor de Open-Meteo por una razón científica:
La aplicación necesita extraer masivamente datos retrospectivos (Memoria Atmosférica) y calcular variaciones interdiarias precisas. Open-Meteo proporciona acceso instantáneo y gratuito a la base de datos **Copernicus ERA5** (European Centre for Medium-Range Weather Forecasts), que utiliza supercomputadoras para cruzar millones de registros históricos globales y calcular la presión atmosférica exacta en cualquier coordenada desde 1940. Es la arquitectura perfecta y más fiable para la meteoropatía.

## 🛠️ Instalación y Desarrollo Local

1. Clona el repositorio en tu máquina.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Arranca el servidor de desarrollo ultrarrápido (HMR):
   ```bash
   npm run dev
   ```
4. Abre `http://localhost:5173/` en tu navegador.
