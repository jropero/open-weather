import type { ComponentType } from 'react';
import { Cloud, Moon, type LucideProps } from 'lucide-react';

interface HeroIconProps {
  icon: ComponentType<LucideProps>;
  className: string;
  nightCloudy: boolean;
}

const SIZE = 56;
const MOON_SIZE = 24;
const STROKE = 1.25;

/** Inline weather icon shown to the right of the hero temperature. */
export function HeroIcon({ icon: Icon, className, nightCloudy }: Readonly<HeroIconProps>) {
  return (
    <div className="relative shrink-0 drop-shadow-lg" aria-hidden="true">
      {nightCloudy ? (
        <>
          <Moon
            size={MOON_SIZE}
            className="text-indigo-200 fill-indigo-200 absolute -top-1 -right-1 animate-moon drop-shadow-lg"
            strokeWidth={STROKE}
          />
          <Cloud size={SIZE} className={className} strokeWidth={STROKE} />
        </>
      ) : (
        <Icon size={SIZE} className={className} strokeWidth={STROKE} />
      )}
    </div>
  );
}
