import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getTranslation } from '../i18n/translations';

describe('section presentation', () => {
  it('uses compact guideline labels in settings and section headers', () => {
    expect(getTranslation('es', 'guidelines.ahaAcc2025.name')).toBe('USA AHA/ACC 2025');
    expect(getTranslation('es', 'guidelines.ish2020.name')).toBe('Int. ISH 2020');
    expect(getTranslation('es', 'settings.guidelineAha')).toBe('USA AHA/ACC 2025');
    expect(getTranslation('es', 'settings.guidelineIsh')).toBe('Int. ISH 2020');
    expect(getTranslation('en', 'guidelines.ish2020.name')).toBe('Int. ISH 2020');
    expect(getTranslation('en', 'settings.guidelineIsh')).toBe('Int. ISH 2020');
  });

  it('uses the New reading title typography for every main section', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.form-title-left h2,\s*\.chart-title h2,\s*\.trend-insights-heading h2,\s*\.list-title h2\s*\{[^}]*font-family: var\(--font-display\);[^}]*font-size: 18px;[^}]*font-weight: 500;/s);
  });

  it('reduces the vertical gap between cards on mobile', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const mobileRules = css.slice(css.indexOf('@media (max-width: 640px)'));
    expect(mobileRules).toMatch(/\.app-container > \.card\s*\{[^}]*margin-bottom: 12px;/s);
    expect(mobileRules).toMatch(/\.trend-insights-card\s*\{[^}]*margin-top: 0;/s);
    expect(mobileRules).toMatch(/\.chart-title\s*\{[^}]*gap: 4px;/s);
    expect(mobileRules).toMatch(/\.trend-guideline-badge\s*\{[^}]*padding-inline: 5px;[^}]*font-size: 10px;/s);
    expect(mobileRules).toMatch(/\.app-header\s*\{[^}]*margin-bottom: 12px;/s);
    expect(mobileRules).toMatch(/\.app-footer\s*\{[^}]*margin-top: 0;/s);
    expect(mobileRules).toMatch(/\.chart-title\s*\{[^}]*flex-wrap: wrap;/s);
    expect(css).toMatch(/\.section-count-toggle\s*\{[^}]*display: inline-flex;/s);
  });

  it('merges the count and the disclosure control into a single button', () => {
    const trendChart = readFileSync(new URL('../components/TrendChart.tsx', import.meta.url), 'utf8');
    const readingList = readFileSync(new URL('../components/ReadingList.tsx', import.meta.url), 'utf8');
    const chartTitle = trendChart.slice(
      trendChart.indexOf('<div className="chart-title">'),
      trendChart.indexOf('<div className="trend-header-controls">')
    );
    const chartToggle = chartTitle.slice(
      chartTitle.indexOf('section-count-toggle trend-section-toggle'),
      chartTitle.indexOf('</button>', chartTitle.indexOf('section-count-toggle trend-section-toggle'))
    );

    // El contador vive dentro del propio botón: no queda ningún control suelto a su lado.
    expect(chartToggle).toContain('readings-count-text');
    expect(chartToggle).toContain('trend-section-toggle');
    expect(readingList).toContain('className="section-count-toggle history-toggle-button"');
    expect(chartTitle).not.toContain('readings-count-badge');
    expect(readingList).not.toContain('readings-count-badge');
  });

  it('styles the unified count toggle as a button that grows with its content', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
    const mobileRules = css.slice(css.indexOf('@media (max-width: 640px)'));

    expect(css).toMatch(
      /\.section-count-toggle\s*\{[^}]*display: inline-flex;[^}]*align-items: center;[^}]*gap: 6px;[^}]*min-width: 30px;[^}]*height: 30px;[^}]*padding: 0 9px;/s
    );
    expect(css).toMatch(/\.readings-count-text\s*\{[^}]*white-space: nowrap;/s);
    // Guarda: ningún control de sección vuelve a ser un cuadrado de ancho fijo.
    expect(css).not.toMatch(/\.(trend-section-toggle|history-toggle-button)\s*\{[^}]*width: 30px;/s);
    expect(css).not.toContain('.readings-count-badge');
    expect(mobileRules).toMatch(/\.section-count-toggle\s*\{[^}]*padding-inline: 7px;/s);
    expect(mobileRules).toMatch(/\.trend-section-toggle\s*\{[^}]*margin-left: auto;/s);
  });
});
