import { X, BookOpen, Activity, FileText, Database, ExternalLink, Brain, Thermometer, Gauge, BarChart3, AlertTriangle, Wind, Leaf, Bell } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const { language } = useLanguage();

  if (!isOpen) return null;

  const isEn = language === 'en';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white text-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-8 duration-300">

        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <BookOpen size={24} className="text-blue-400" />
            <div>
              <h2 className="text-lg font-bold leading-tight">
                {isEn ? 'Scientific Documentation & Info' : 'Documentación Científica e Info'}
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">
                {isEn ? 'Biometeorology & Health' : 'Biometeorología y Salud'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
            aria-label={isEn ? 'Close' : 'Cerrar'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-sm leading-relaxed text-slate-600">

          {/* Section 1: Intro */}
          <section className="space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Activity size={18} className="text-emerald-500" />
              {isEn ? 'What is Meteoropathy?' : '¿Qué es la Meteoropatía?'}
            </h3>
            <p>
              {isEn
                ? 'Meteoropathy is a word derived from the Greek meteoros ("high in the sky") and pathos ("suffering/illness"), which indicates any pathology triggered or aggravated by specific meteorological conditions. The science dealing with harmful effects on human health caused by variations in meteorological phenomena is called meteoropathology or medical biometeorology. Some authors use the term to refer to any psycho-organic disorder that can be related to meteorological factors.'
                : 'Meteoropatía es una palabra derivada del griego meteoros («alto en el cielo») y pathos («enfermedad»), que indica cualquier patología que se desencadena o se agrava ante unas condiciones meteorológicas concretas. La ciencia que se ocupa de los efectos nocivos sobre la salud humana, provocados por las variaciones de los fenómenos meteorológicos, se denomina meteoropatología o biometeorología médica. Algunos autores utilizan el término para referirse a cualquier trastorno psico-orgánico que pueda relacionarse con factores meteorológicos.'}
            </p>
          </section>

          {/* Section 2: Clinical Indices */}
          <section className="space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Brain size={18} className="text-indigo-500" />
              {isEn ? 'Clinical & Mathematical Calculations' : 'Cálculos Clínicos y Matemáticos'}
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">

              {/* Thom's Index */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Thermometer size={14} className="text-amber-500" />
                  {isEn ? "Thom's Discomfort Index (FAT.)" : "Índice de Disconfort de Thom (FAT.)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? 'Evaluates heat stress on the cardiovascular system by combining air temperature (T) and relative humidity (RH). Shown as the right bar above 10 °C. Formula:'
                    : 'Evalúa el estrés térmico en el sistema cardiovascular combinando temperatura (T) y humedad relativa (HR). Se muestra como barra derecha por encima de 10 °C. Fórmula:'}
                </p>
                <div className="bg-white/80 p-2 rounded-lg font-mono text-[10px] text-center border border-slate-200">
                  DI = T - (0.55 - 0.0055 * RH) * (T - 14.5)
                </div>
                <ul className="text-[10px] space-y-1 text-slate-600 mt-1">
                  <li><strong>&lt; 21:</strong> {isEn ? 'Comfortable (No stress)' : 'Confortable (Sin estrés)'}</li>
                  <li><strong>21 - 24:</strong> {isEn ? 'Under 50% feel discomfort' : 'Menos del 50% siente disconfort'}</li>
                  <li><strong>24 - 27:</strong> {isEn ? 'Over 50% feel discomfort' : 'Más del 50% siente disconfort'}</li>
                  <li><strong>&gt; 27:</strong> {isEn ? 'Severe cardiovascular stress' : 'Estrés cardiovascular severo'}</li>
                </ul>
              </div>

              {/* Wind Chill Index */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Wind size={14} className="text-sky-500" />
                  {isEn ? "Wind Chill Index (WCI / POLAR)" : "Índice de Frío Polar (WCI / POLAR)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? 'Replaces the FAT. bar when temperature falls below 10 °C. Measures the perceived temperature felt by exposed skin due to wind. Environment Canada/NOAA formula:'
                    : 'Reemplaza la barra FAT. cuando la temperatura cae por debajo de 10 °C. Mide la temperatura percibida por la piel expuesta al viento. Fórmula Env. Canada/NOAA:'}
                </p>
                <div className="bg-white/80 p-2 rounded-lg font-mono text-[10px] text-center border border-slate-200">
                  WCI = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
                </div>
                <ul className="text-[10px] space-y-1 text-slate-600 mt-1">
                  <li><strong>&gt; 0°C:</strong> {isEn ? 'Cool' : 'Fresco'}</li>
                  <li><strong>0 → −10°C:</strong> {isEn ? 'Cold' : 'Frío'}</li>
                  <li><strong>−10 → −25°C:</strong> {isEn ? 'Very Cold' : 'Muy Frío'}</li>
                  <li><strong>−25 → −40°C:</strong> {isEn ? 'Severe Cold' : 'Frío Severo'}</li>
                  <li><strong>&lt; −40°C:</strong> {isEn ? 'Extreme Cold' : 'Frío Extremo'}</li>
                </ul>
              </div>

              {/* 24h Delta P */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Gauge size={14} className="text-red-500" />
                  {isEn ? "24h Pressure Delta (ΔP)" : "Variación de Presión 24h (ΔP)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? "Calculates the difference between today's pressure and yesterday's mean pressure. Rapid changes squeeze or expand gases in blood vessels and tissues."
                    : 'Calcula la diferencia de presión absoluta respecto a la media del día anterior. Cambios rápidos comprimen o expanden los gases en los tejidos.'}
                </p>
                <ul className="text-[10px] space-y-1 text-slate-600 mt-2">
                  <li>
                    <strong className="text-blue-600">ΔP &le; -3 hPa:</strong> {isEn ? 'Moderate Drop. Minor headache risk.' : 'Caída Moderada. Riesgo leve de dolores.'}
                  </li>
                  <li>
                    <strong className="text-red-600">ΔP &le; -5 hPa:</strong> {isEn ? 'Severe Drop. High meteoropathic risk (joints, headaches).' : 'Caída Severa. Riesgo alto (dolor articular, migraña).'}
                  </li>
                  <li>
                    <strong className="text-amber-600">ΔP &ge; +3 hPa:</strong> {isEn ? 'Rapid Rise. Can compress inner ear fluids.' : 'Subida Rápida. Puede comprimir fluidos del oído interno.'}
                  </li>
                </ul>
              </div>

              {/* Storm Potential (CAPE) */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <AlertTriangle size={14} className="text-orange-500" />
                  {isEn ? "Storm Potential (CAPE)" : "Potencial de Tormenta (CAPE)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? 'Convective Available Potential Energy (J/kg) measures atmospheric buoyancy available for thunderstorm development. High CAPE also amplifies migraine triggers (+1 pt when > 1000 J/kg).'
                    : 'La Energía Potencial Convectiva Disponible (J/kg) mide la flotabilidad atmosférica para el desarrollo de tormentas. Un CAPE alto amplifica los factores de migraña (+1 pt cuando > 1000 J/kg).'}
                </p>
                <ul className="text-[10px] space-y-1 text-slate-600 mt-1">
                  <li><strong>50–300 J/kg:</strong> {isEn ? 'Slight (isolated storms possible)' : 'Leve (tormentas aisladas posibles)'}</li>
                  <li><strong>300–1000 J/kg:</strong> {isEn ? 'Moderate' : 'Moderado'}</li>
                  <li><strong>1000–2500 J/kg:</strong> {isEn ? 'Strong (organized storms)' : 'Fuerte (tormentas organizadas)'}</li>
                  <li><strong>&gt; 2500 J/kg:</strong> {isEn ? 'Extreme (severe storm risk)' : 'Extremo (riesgo de tormentas severas)'}</li>
                </ul>
              </div>

              {/* Hourly Pressure Velocity */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-2 sm:col-span-2">
                <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <Activity size={14} className="text-purple-500" />
                  {isEn ? "Short-term Trends (3h & 6h — Pressure & Temperature)" : "Tendencias a Corto Plazo (3h y 6h — Presión y Temperatura)"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? "Two sets of pills are shown: pressure deltas and temperature deltas over the next 3 and 6 hours. The 6-hour pressure drop is highlighted by Katsuki et al. (2023) as the single strongest predictor of headache onset."
                    : 'Se muestran dos conjuntos de pastillas: deltas de presión y deltas de temperatura a 3 y 6 horas. La caída de presión en 6h fue identificada por Katsuki et al. (2023) como el factor predictivo individual más potente para el inicio de cefaleas.'}
                </p>
                <ul className="text-[10px] space-y-1.5 text-slate-600 mt-1">
                  <li>
                    <strong>{isEn ? "Pressure 3h:" : "Presión 3h:"}</strong> {isEn ? "Immediate barometric change. Drop ≤ -2 hPa = rapid change warning (orange)." : "Cambio barométrico inmediato. Caída ≤ -2 hPa = aviso de cambio rápido (naranja)."}
                  </li>
                  <li>
                    <strong className="text-amber-600">{isEn ? "Pressure 6h ⚡ (Critical):" : "Presión 6h ⚡ (Crítico):"}</strong> {isEn ? "Drops ≤ -3 hPa trigger the ⚡ warning; ≤ -5 hPa = red alert (severe barometric collapse)." : "Caídas ≤ -3 hPa activan la alerta ⚡; ≤ -5 hPa = alerta roja (colapso barométrico severo)."}
                  </li>
                  <li>
                    <strong>{isEn ? "Temperature 3h / 6h:" : "Temperatura 3h / 6h:"}</strong> {isEn ? "Forecasted temperature variation. A rise ≥ +3 °C in 6h triggers the 🔥 heat surge alert." : "Variación de temperatura prevista. Una subida ≥ +3 °C en 6h activa la alerta 🔥 de pico de calor."}
                  </li>
                </ul>
              </div>

            </div>
          </section>

          {/* Section 3: Active Alert Types */}
          <section className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Bell size={18} className="text-rose-500" />
              {isEn ? 'Active Alert Types' : 'Tipos de Alertas Activas'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'The hero section shows contextual alerts when atmospheric or thermal conditions exceed clinically relevant thresholds. Multiple alerts can appear simultaneously.'
                : 'La sección principal muestra alertas contextuales cuando las condiciones atmosféricas o térmicas superan umbrales clínicamente relevantes. Pueden aparecer varias alertas a la vez.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">🌙 {isEn ? 'Warm Night Alert' : 'Alerta de Noche Cálida'}</span>
                <ul className="text-[10px] text-slate-600 space-y-1">
                  <li><strong>{isEn ? 'Tropical (🌙):' : 'Tropical (🌙):'}</strong> {isEn ? 'Min. overnight ≥ 20 °C. Impairs sleep.' : 'Mín. nocturna ≥ 20 °C. Dificulta el sueño.'}</li>
                  <li><strong>{isEn ? 'Tórrida (🔥):' : 'Tórrida (🔥):'}</strong> {isEn ? 'Min. ≥ 25 °C. Extreme heat stress.' : 'Mín. ≥ 25 °C. Estrés térmico extremo.'}</li>
                  <li><strong>{isEn ? 'Ecuatorial (🌊):' : 'Ecuatorial (🌊):'}</strong> {isEn ? 'Min. > 25 °C. Clinical heat hazard.' : 'Mín. > 25 °C. Peligro clínico de calor.'}</li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-700">🧊 {isEn ? 'Frost / Ice Alert' : 'Alerta de Helada / Hielo'}</span>
                <ul className="text-[10px] text-slate-600 space-y-1">
                  <li><strong>{isEn ? 'Frost (🌨️):' : 'Helada (🌨️):'}</strong> {isEn ? 'Min. overnight ≤ 2 °C or dew point ≤ 0 °C. Surface freezing risk.' : 'Mín. nocturna ≤ 2 °C o punto de rocío ≤ 0 °C. Riesgo de congelación superficial.'}</li>
                  <li><strong>{isEn ? 'Ice (🧊):' : 'Hielo (🧊):'}</strong> {isEn ? 'Min. overnight ≤ 0 °C. Sub-zero temperatures confirmed.' : 'Mín. nocturna ≤ 0 °C. Temperaturas bajo cero confirmadas.'}</li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">🌧️ {isEn ? 'Precipitation Onset Alert' : 'Alerta de Inicio de Precipitación'}</span>
                <p className="text-[10px] text-slate-600">
                  {isEn
                    ? 'Detects the next hourly slot with ≥ 0.1 mm precipitation and shows type (rain 🌧️ / freezing rain 🌨️ / snow ❄️), time to onset, and rain intensity label (light/moderate/heavy/violent based on mm/h rate). Below the onset pill, three accumulation badges show forecast rain for the next 3h, 6h, and 24h.'
                    : 'Detecta el próximo intervalo horario con ≥ 0,1 mm de precipitación y muestra tipo (lluvia 🌧️ / lluvia helada 🌨️ / nieve ❄️), tiempo hasta el inicio e intensidad (leve/moderada/fuerte/torrencial según mm/h). Bajo la pastilla de inicio, tres badges muestran la acumulación prevista a 3h, 6h y 24h.'}
                </p>
              </div>

            </div>
          </section>

          {/* Section 4: Air Quality & Pollen */}
          <section className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Leaf size={18} className="text-green-500" />
              {isEn ? 'Air Quality & Pollen' : 'Calidad del Aire y Polen'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Data from Open-Meteo Air Quality API (CAMS European model). Shown only when AQI data is available for your location.'
                : 'Datos de la API de Calidad del Aire de Open-Meteo (modelo europeo CAMS). Se muestra solo cuando hay datos AQI disponibles para tu ubicación.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">AQI — {isEn ? 'Air Quality Index' : 'Índice de Calidad del Aire'}</span>
                <p className="text-[10px] text-slate-600">
                  {isEn
                    ? 'European AQI (0–100+). Combines PM2.5, PM10, NO₂, O₃, SO₂, CO concentrations. PM2.5 and PM10 particulate values (μg/m³) are shown separately.'
                    : 'ICA europeo (0–100+). Combina concentraciones de PM2.5, PM10, NO₂, O₃, SO₂, CO. Los valores de partículas PM2.5 y PM10 (μg/m³) se muestran por separado.'}
                </p>
                <ul className="text-[10px] text-slate-600 space-y-0.5 mt-1">
                  <li><strong className="text-emerald-600">0–20:</strong> {isEn ? 'Good' : 'Bueno'}</li>
                  <li><strong className="text-yellow-600">21–40:</strong> {isEn ? 'Fair' : 'Aceptable'}</li>
                  <li><strong className="text-orange-500">41–60:</strong> {isEn ? 'Moderate' : 'Moderado'}</li>
                  <li><strong className="text-red-600">61–80:</strong> {isEn ? 'Poor' : 'Malo'}</li>
                  <li><strong className="text-purple-600">81–100:</strong> {isEn ? 'Very Poor' : 'Muy Malo'}</li>
                  <li><strong className="text-rose-900">100+:</strong> {isEn ? 'Extreme' : 'Extremo'}</li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-green-700">🌿 {isEn ? 'Pollen Levels' : 'Niveles de Polen'}</span>
                <p className="text-[10px] text-slate-600">
                  {isEn
                    ? 'Six pollen species tracked: Grass 🌿, Birch 🌳, Alder 🌸, Mugwort 🌾, Olive 🫒, Ragweed 🌻. Only species with values > 0 are shown.'
                    : 'Se monitorizan seis especies: Gramíneas 🌿, Abedul 🌳, Aliso 🌸, Artemisa 🌾, Olivo 🫒, Ambrosía 🌻. Solo se muestran las especies con valores > 0.'}
                </p>
                <ul className="text-[10px] text-slate-600 space-y-0.5 mt-1">
                  <li><strong className="text-emerald-600">≤ 10:</strong> {isEn ? 'Low' : 'Bajo'}</li>
                  <li><strong className="text-yellow-600">11–50:</strong> {isEn ? 'Moderate' : 'Moderado'}</li>
                  <li><strong className="text-orange-500">51–200:</strong> {isEn ? 'High' : 'Alto'}</li>
                  <li><strong className="text-red-600">&gt; 200:</strong> {isEn ? 'Very High' : 'Muy Alto'}</li>
                </ul>
              </div>

            </div>
          </section>

          {/* Section 5: The Scientific Paper */}
          <section className="bg-blue-50 border border-blue-100/50 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-2.5">
              <FileText size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  {isEn ? 'Scientific Basis: Katsuki et al. (2023)' : 'Base Científica: Katsuki et al. (2023)'}
                </h4>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                  DOI: 10.1111/head.14482
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              {isEn
                ? 'Our Migraine Risk Index is based on the key risk factors identified by this peer-reviewed study published in Headache: The Journal of Head and Face Pain (2023):'
                : 'Nuestro Índice de Riesgo de Migraña está basado en los factores de riesgo identificados por este estudio revisado por pares publicado en Headache: The Journal of Head and Face Pain (2023):'}
            </p>

            <blockquote className="border-l-4 border-blue-500 pl-3.5 my-2 italic text-xs text-slate-600">
              {isEn
                ? '"Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence: A retrospective observational cross-sectional study."'
                : '«Investigating the effects of weather on headache occurrence using a smartphone application and artificial intelligence: A retrospective observational cross-sectional study.»'}
            </blockquote>

            {/* Study methodology */}
            <div className="bg-white/70 rounded-xl p-3 border border-blue-100">
              <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <BarChart3 size={13} className="text-blue-500" />
                {isEn ? 'Methodology & Dataset' : 'Metodología y Dataset'}
              </h5>
              <p className="text-[11px] text-slate-600">
                {isEn
                  ? 'Researchers analyzed 336,951 hourly headache events from 4,375 smartphone app users (Dec 2020 – Nov 2021). They used gradient-boosted tree models and deep learning to calculate predictive "gain" values for each atmospheric variable — the higher the gain, the stronger the statistical association with headache onset.'
                  : 'Los investigadores analizaron 336.951 eventos de dolor de cabeza por hora de 4.375 usuarios de app móvil (dic 2020 – nov 2021). Utilizaron modelos de gradient boosting y deep learning para calcular valores de «ganancia» predictiva para cada variable atmosférica: a mayor ganancia, mayor asociación estadística con el inicio de la cefalea.'}
              </p>
            </div>

            {/* Gain table */}
            <div className="bg-white/70 rounded-xl p-3 border border-blue-100">
              <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
                {isEn ? 'Key Risk Factors (Feature Importance)' : 'Factores de Riesgo Clave (Importancia)'}
              </h5>
              <div className="space-y-1.5">
                {[
                  { factor: isEn ? 'Pressure drop 6h before event' : 'Caída de presión 6h antes', gain: 11.7, barWidth: '100%', color: 'bg-red-500' },
                  { factor: isEn ? 'Higher humidity' : 'Humedad relativa alta', gain: 7.1, barWidth: '61%', color: 'bg-sky-500' },
                  { factor: isEn ? 'Low pressure (next day)' : 'Presión baja (día siguiente)', gain: 6.7, barWidth: '57%', color: 'bg-indigo-400' },
                  { factor: isEn ? 'High AM pressure (pre-drop)' : 'Presión alta matinal (pre-caída)', gain: 4.6, barWidth: '39%', color: 'bg-amber-400' },
                  { factor: isEn ? 'Low absolute pressure' : 'Presión absoluta baja', gain: 3.9, barWidth: '33%', color: 'bg-purple-400' },
                  { factor: isEn ? 'More rainfall' : 'Mayor precipitación', gain: 3.1, barWidth: '26%', color: 'bg-emerald-400' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-700 w-[55%] truncate font-medium">{item.factor}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: item.barWidth }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-800 w-7 text-right">{item.gain}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 italic">
                {isEn ? 'Gain = relative contribution of each feature in predicting headache occurrence (p < 0.001).' : 'Gain = contribución relativa de cada factor en la predicción de cefaleas (p < 0,001).'}
              </p>
            </div>

            {/* How we apply it */}
            <div className="bg-white/70 rounded-xl p-3 border border-blue-100">
              <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <AlertTriangle size={13} className="text-amber-500" />
                {isEn ? 'How We Apply This in Our Scoring (0–6 pts)' : 'Cómo Aplicamos Esto en Nuestra Puntuación (0–6 pts)'}
              </h5>
              <p className="text-[11px] text-slate-600 mb-2">
                {isEn
                  ? 'The original study used a continuous AI regression model (R² = 53.7%). Our app translates those findings into a practical, threshold-based heuristic scoring system for consumer use:'
                  : 'El estudio original utilizó un modelo de regresión de IA continuo (R² = 53,7%). Nuestra app traduce esas conclusiones en un sistema de puntuación heurístico basado en umbrales, práctico para uso personal:'}
              </p>
              <ul className="text-[10px] space-y-1.5 text-slate-600">
                <li>
                  <strong className="text-red-600">{isEn ? 'Pressure drop' : 'Caída de presión'} (ΔP):</strong> {isEn ? 'Weighted highest (+3 pts for ≤ −5 hPa, +1 for ≤ −3 hPa), reflecting the paper\'s top gain of 11.7.' : 'Peso más alto (+3 pts para ≤ −5 hPa, +1 para ≤ −3 hPa), reflejando la ganancia máxima del paper (11,7).'}
                </li>
                <li>
                  <strong className="text-sky-600">{isEn ? 'Humidity' : 'Humedad'} (&gt; 70%):</strong> {isEn ? '+1 pt. Reflects gain of 7.1. Threshold of 70% is a standard clinical convention for "high humidity".' : '+1 pt. Refleja ganancia de 7,1. El umbral de 70% es una convención clínica estándar para «humedad alta».'}
                </li>
                <li>
                  <strong className="text-purple-600">{isEn ? 'Low pressure' : 'Presión baja'} (&lt; 1010 hPa):</strong> {isEn ? '+1 pt. Reflects gain of 3.9. NIH literature associates 1003–1007 hPa with peak migraine frequency.' : '+1 pt. Refleja ganancia de 3,9. La literatura NIH asocia 1003–1007 hPa con la máxima frecuencia de migrañas.'}
                </li>
                <li>
                  <strong className="text-emerald-600">{isEn ? 'Precipitation' : 'Precipitación'} (&gt; 0 mm):</strong> {isEn ? '+1 pt. Reflects gain of 3.1. Any active rainfall counts as a trigger factor.' : '+1 pt. Refleja ganancia de 3,1. Cualquier lluvia activa se considera factor desencadenante.'}
                </li>
                <li>
                  <strong className="text-orange-500">{isEn ? 'Storm instability' : 'Inestabilidad convectiva'} (CAPE &gt; 1000 J/kg):</strong> {isEn ? '+1 pt. Extended criterion: convective systems generate rapid pressure oscillations that compound headache triggers.' : '+1 pt. Criterio extendido: los sistemas convectivos generan oscilaciones de presión rápidas que amplifican los desencadenantes de migraña.'}
                </li>
              </ul>
              <p className="text-[10px] text-slate-500 mt-2.5 italic">
                {isEn
                  ? 'The thresholds (−5 hPa, 1010 hPa, 70%) are calibrated from broader peer-reviewed literature (NIH, multiple clinical studies citing 5–6 hPa/24h drops and 6–10 hPa absolute deviations from 1013 hPa as significant). The algorithm requires convergence of multiple factors to avoid alert fatigue.'
                  : 'Los umbrales (−5 hPa, 1010 hPa, 70%) están calibrados a partir de literatura clínica revisada por pares más amplia (NIH, múltiples estudios que citan caídas de 5–6 hPa/24h y desviaciones absolutas de 6–10 hPa respecto a 1013 hPa como significativas). El algoritmo exige convergencia de múltiples factores para evitar fatiga de alertas.'}
              </p>
            </div>

            <div className="pt-1">
              <a
                href="https://doi.org/10.1111/head.14482"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-sm"
              >
                <span>{isEn ? 'Access Full Paper (DOI)' : 'Ver Artículo Completo (DOI)'}</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </section>

          {/* Section 6: ERA5 Reanalysis */}
          <section className="space-y-2">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Database size={18} className="text-sky-500" />
              {isEn ? 'Atmospheric Memory & Copernicus ERA5' : 'Memoria Atmosférica y Copernicus ERA5'}
            </h3>
            <p>
              {isEn
                ? 'To retrieve weather logs from 1949, 1973, and 2003, we fetch global reanalysis data from Copernicus ERA5 (European Centre for Medium-Range Weather Forecasts). By leveraging historical weather models and satellite/station observations, ERA5 maps global surface barometric pressure and temperature at any coordinate from 1940 to the present day.'
                : 'Para retroceder a los años 1949, 1973 y 2003, la aplicación consulta el reanálisis global Copernicus ERA5 (Centro Europeo de Previsiones Meteorológicas a Plazo Medio). Mediante modelos físicos avanzados y lecturas de satélites/estaciones, ERA5 reconstruye la presión y temperatura exactas en cualquier coordenada desde 1940.'}
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-gray-100 text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
          <span>🌤️ Open-Weather Biometeorological Tracker &copy; 2026</span>
        </div>

      </div>
    </div>
  );
}
