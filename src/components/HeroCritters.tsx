import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../hooks/useLanguage';

type Kind = 'penguin' | 'shrimp';

interface CritterState {
  n: number;
  fx: boolean;
}

const COUNT = 4;
const WAVE_STAGGER_MS = 90;

const CONFIG: Record<
  Kind,
  { emoji: string; particle: string; labelKey: string; count: number }
> = {
  penguin: { emoji: '🐧', particle: '❄️', labelKey: 'hero.critter.penguin', count: 1 },
  shrimp: { emoji: '🦐', particle: '🫧', labelKey: 'hero.critter.shrimp', count: 3 },
};

function Particles({ kind, onEnd }: { kind: Kind; onEnd: () => void }) {
  const { particle, count } = CONFIG[kind];
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`critter-particle critter-particle-${kind} pointer-events-none absolute left-1/2 top-1`}
          style={
            {
              '--cx': `${(i - (count - 1) / 2) * 14}px`,
              animationDelay: `${i * 90}ms`,
            } as React.CSSProperties
          }
          onAnimationEnd={i === count - 1 ? onEnd : undefined}
        >
          {particle}
        </span>
      ))}
    </>
  );
}

interface CritterProps {
  kind: Kind;
  active: boolean;
  state: CritterState;
  onTap: () => void;
  onFxEnd: () => void;
}

function Critter({ kind, active, state, onTap, onFxEnd }: CritterProps) {
  const { t } = useLanguage();
  const { emoji, labelKey } = CONFIG[kind];
  const tone = active ? 'opacity-100 scale-100' : 'opacity-20 scale-90';
  return (
    <button
      type="button"
      aria-label={t(labelKey)}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      className={`relative min-h-10 min-w-10 cursor-pointer text-5xl leading-none transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 rounded-full ${tone}`}
    >
      <span
        key={state.n}
        aria-hidden="true"
        className={`inline-block ${state.n > 0 ? `critter-${kind}` : ''}`}
      >
        {emoji}
      </span>
      {state.fx && <Particles kind={kind} onEnd={onFxEnd} />}
    </button>
  );
}

function useCritterWave() {
  const [states, setStates] = useState<CritterState[]>(() =>
    Array.from({ length: COUNT }, () => ({ n: 0, fx: false })),
  );
  const timers = useRef<number[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);
  const play = useCallback((idx: number) => {
    setStates((s) => s.map((c, i) => (i === idx ? { n: c.n + 1, fx: true } : c)));
  }, []);
  const stop = useCallback((idx: number) => {
    setStates((s) => s.map((c, i) => (i === idx ? { ...c, fx: false } : c)));
  }, []);
  const wave = useCallback(() => {
    // A new wave replaces a running one; keep the array (the unmount cleanup holds its reference)
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current.length = 0;
    for (let i = 0; i < COUNT; i++) {
      timers.current.push(window.setTimeout(() => play(i), i * WAVE_STAGGER_MS));
    }
  }, [play]);
  return { states, play, stop, wave };
}

interface HeroCrittersProps {
  kind: Kind;
  activeCount: number;
}

export function HeroCritters({ kind, activeCount }: HeroCrittersProps) {
  const { states, play, stop, wave } = useCritterWave();
  return (
    <div
      role="presentation"
      onClick={wave}
      className="flex justify-center items-center h-12 gap-1 p-3 border border-white/10 bg-white/5 rounded-full backdrop-blur-sm"
    >
      {states.map((state, idx) => (
        <Critter
          key={idx}
          kind={kind}
          active={idx < activeCount}
          state={state}
          onTap={() => play(idx)}
          onFxEnd={() => stop(idx)}
        />
      ))}
    </div>
  );
}
