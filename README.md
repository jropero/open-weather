# 🌤️ Open-Weather: Biometeorological Tracker

[![Live Demo](https://img.shields.io/badge/Prueba%20la%20App%20en%20Vivo-ekult.co.uk%2Ft%2F-blue?style=for-the-badge&logo=vercel)](https://ekult.co.uk/t/)

Una aplicación meteorológica médica de alta fidelidad diseñada específicamente para registrar y predecir el impacto de las variables atmosféricas en la salud humana, enfocándose en la **meteoropatía**, las **migrañas** y la **fatiga térmica**.

## 🎯 Objetivo del Proyecto

El cerebro humano y el sistema cardiovascular son altamente sensibles a los cambios de presión atmosférica y humedad. Este proyecto fue concebido como un panel de control biometeorológico personal para cruzar datos empíricos de presión, viento, lluvia, temperatura y humedad con episodios físicos (cansancio, dolores de cabeza tensionales y migrañas).

## ✨ Características Principales

*   **🚨 Alertas Biomédicas en Tiempo Real**
    *   **ΔP (Variación Interdiaria de Presión):** Calcula instantáneamente caídas de presión atmosférica bruscas ($\le$ -5 hPa) respecto a la media del día anterior. Incluye un **manómetro visual degradado** que posiciona la presión actual dentro de un rango realista (950 hPa a 1050 hPa) para dar contexto instantáneo.
    *   **Índice de Incomodidad Térmica (Thom):** Analiza el estrés térmico combinando la temperatura ambiente con la humedad relativa para advertir sobre altos niveles de fatiga cardiovascular ("bochorno").
*   **📈 Ventana Temporal de 7 Días (Evolución y Pronóstico)**
    *   Gráfica multicapa con diseño inmersivo "sin ejes" (*borderless*). Se centra matemáticamente en el "**HOY**", mostrando 3 días de histórico empírico a la izquierda y 3 días de previsión a la derecha. 
    *   Superpone de forma limpia las variables climáticas fundamentales: la presión (montaña roja), la temperatura (línea amarilla) y la lluvia (histograma con brechas divisorias diarias).
    *   **Fondo de Aurora (Heatmap):** El fondo del gráfico (CSS background paramétrico) actúa como un mapa de calor visual inmersivo que delata el nivel de humedad ambiental y su riesgo (Amarillo = Seco, Morado = Riesgo extremo de humedad).
*   **🔮 Desglose de Diagnóstico Clínico**
    *   Además de mostrar "píldoras de riesgo", el sistema ofrece un desglose matemático de qué factores exactos (caída de hPa, mm de lluvia, etc.) están sumando puntos de riesgo para el paciente, ofreciendo transparencia total a la hora de organizar su semana.
*   **🕰️ Memoria Atmosférica (Archivo Histórico)**
    *   Un módulo nostálgico/comparativo que analiza el clima exacto del día de hoy en retrospectiva, viajando hasta los años **1949**, **1973** y **2003**.

## 🔬 Validación Científica (IA y Big Data)

Nuestros algoritmos de alerta médica se basan en evidencia clínica reciente. Específicamente, el sistema compuesto de **Riesgo de Migraña** implementa directamente las conclusiones del estudio empírico *"Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence"* (DOI: [10.1111/head.14482](https://doi.org/10.1111/head.14482)), publicado en *Headache Journal* (2023).

Dicho estudio, tras analizar más de 330.000 eventos de dolor de cabeza con modelos predictivos, demostró que la incidencia de migrañas aumenta drásticamente cuando convergen de forma simultánea:
1. **Caídas significativas de presión barométrica** (evaluado en la app mediante el cálculo del *Delta P* en 24h).
2. **Presión barométrica absoluta baja**.
3. **Alta humedad relativa**.
4. **Incremento de precipitaciones**.

La aplicación cruza estas 4 variables atmosféricas en tiempo real para emitir un **Índice de Riesgo de Migraña** compuesto (Mínimo, Bajo, Moderado, Alto, Extremo). 

La sensibilidad del algoritmo ha sido ajustada y calibrada de forma conservadora para evitar la fatiga de alertas. El sistema exige la alineación simultánea de múltiples factores climáticos severos para emitir niveles de alerta preocupantes, actuando de forma fiable.

## 🚀 Arquitectura y Tecnologías

Esta aplicación destaca por su alto rendimiento en red y su UI inmersiva (*Glassmorphism* oscuro y alto contraste A11y), construida sobre la pila más moderna del ecosistema React.

*   **Core:** React 19, TypeScript, Vite.
*   **Estilos:** Tailwind CSS v4, Lucide Icons.
*   **Diseño Fluido (Mobile-First):** Escalabilidad de componentes sin bordes y paddings dinámicos para maximizar la superficie táctil y visual en pantallas pequeñas.
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
