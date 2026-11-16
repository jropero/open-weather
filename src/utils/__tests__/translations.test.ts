import { describe, it, expect } from 'vite-plus/test';
import { translations } from '../../constants/translations';

// All component/hook/util sources as raw text (Vite glob import), to find literal t('…') keys
const sources = import.meta.glob(['../../**/*.{ts,tsx}', '!../../**/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const es = Object.keys(translations.es);
const en = Object.keys(translations.en);

describe('translations', () => {
  it('es and en define exactly the same keys', () => {
    expect(es.filter((k) => !(k in translations.en))).toEqual([]);
    expect(en.filter((k) => !(k in translations.es))).toEqual([]);
  });

  it('no translation is empty', () => {
    const empty = [
      ...es.filter((k) => !translations.es[k].trim()).map((k) => `es:${k}`),
      ...en.filter((k) => !translations.en[k].trim()).map((k) => `en:${k}`),
    ];
    expect(empty).toEqual([]);
  });

  // eslint-disable-next-line sonarjs/cognitive-complexity
  it('every literal t("…") key used in the code exists', () => {
    // Only plain literals: t('a.b'). Built keys like t(`x.${v}`) or t('x.' + v) are skipped.
    const literal = /\bt\(\s*'([^'\n]+)'\s*\)/g;
    const missing: string[] = [];
    let checked = 0;
    for (const [file, code] of Object.entries(sources)) {
      for (const m of code.matchAll(literal)) {
        checked++;
        if (!(m[1] in translations.es))
          missing.push(`${file.replace('../../', 'src/')}: ${m[1]}`);
      }
    }
    // Guards against the glob or regex silently matching nothing
    expect(Object.keys(sources).length).toBeGreaterThan(10);
    expect(checked).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });
});
