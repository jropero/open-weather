// Developer tool: forces a weather condition to preview backgrounds/effects (only rendered with ?preview).
const OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['auto', 'auto'],
  ['clear', '☀️ clear'],
  ['partly-cloudy', '⛅ partly'],
  ['cloudy', '☁️ cloudy'],
  ['rain', '🌧️ rain'],
  ['storm', '⛈️ storm'],
  ['snow', '❄️ snow'],
  ['fog', '🌫️ fog'],
  ['aurora', '🌌 aurora'],
];

export function PreviewSelect({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (v: string) => void }>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Preview weather condition"
      className="appearance-none bg-white/25 border-0 text-white rounded-full py-1.5 pl-3.5 pr-7 text-xs font-bold focus:ring-2 focus:ring-white/50 backdrop-blur-md cursor-pointer outline-none hover:bg-white/30 transition-all"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
      }}
    >
      {OPTIONS.map(([v, label]) => (
        <option key={v} value={v} className="text-slate-800 bg-white">
          {label}
        </option>
      ))}
    </select>
  );
}
