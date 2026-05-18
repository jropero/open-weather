import { X, BookOpen, Activity, FileText, Database, ExternalLink, Brain, Thermometer, Gauge, BarChart3, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

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
                  {isEn ? "Thom's Discomfort Index" : "Índice de Disconfort de Thom"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isEn 
                    ? 'Evaluates heat stress on the cardiovascular system by combining air temperature (T) and relative humidity (RH). Formula:'
                    : 'Evalúa el estrés térmico en el sistema cardiovascular combinando temperatura (T) y humedad relativa (HR). Fórmula:'}
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

            </div>
          </section>

          {/* Section 3: The Scientific Paper */}
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
                {isEn ? 'How We Apply This in Our Scoring' : 'Cómo Aplicamos Esto en Nuestra Puntuación'}
              </h5>
              <p className="text-[11px] text-slate-600 mb-2">
                {isEn 
                  ? 'The original study used a continuous AI regression model (R² = 53.7%). Our app translates those findings into a practical, threshold-based heuristic scoring system for consumer use:'
                  : 'El estudio original utilizó un modelo de regresión de IA continuo (R² = 53,7%). Nuestra app traduce esas conclusiones en un sistema de puntuación heurístico basado en umbrales, práctico para uso personal:'}
              </p>
              <ul className="text-[10px] space-y-1.5 text-slate-600">
                <li>
                  <strong className="text-red-600">{isEn ? 'Pressure drop' : 'Caída de presión'} (ΔP):</strong> {isEn ? 'Weighted highest (+3 pts for ≤ −5 hPa, +1 for ≤ −3 hPa), reflecting the paper\'s top gain of 11.7. Our 24h window approximates the paper\'s 6h signal using daily mean comparison.' : 'Peso más alto (+3 pts para ≤ −5 hPa, +1 para ≤ −3 hPa), reflejando la ganancia máxima del paper (11,7). Nuestra ventana de 24h aproxima la señal de 6h del paper usando la media diaria.'}
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

          {/* Section 4: ERA5 Reanalysis */}
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
