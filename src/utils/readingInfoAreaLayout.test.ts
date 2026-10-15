import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// La zona informativa bajo el botón reserva una sola línea: el aviso prioritario y las
// etiquetas comparten fila y solo se reparten en dos líneas cuando no caben (avisos
// arriba, etiquetas debajo). jsdom no calcula layout, así que el reparto se comprueba
// sobre el CSS real, igual que el resto de guardas de estructura de la interfaz.
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function escapeSelector(selector: string): string {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cssDeclarations(selector: string): Record<string, string> {
  const match = new RegExp(`${escapeSelector(selector)}\\s*(?:,|\\{)`).exec(css);
  if (!match) throw new Error(`No se encontró el bloque CSS de ${selector}`);
  const open = css.indexOf('{', match.index);
  const end = css.indexOf('}', open);
  const declarations: Record<string, string> = {};
  for (const [, property, value] of css.slice(open + 1, end).matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    declarations[property] = value.trim();
  }
  return declarations;
}

describe('reading info area layout', () => {
  it('reserves a single row for the alert and the labels', () => {
    const area = cssDeclarations('.reading-info-area');
    expect(area.display).toBe('flex');
    expect(area['flex-wrap']).toBe('wrap');
    expect(area['min-height']).toBe('28px');
    expect(area['grid-template-rows']).toBeUndefined();

    expect(css).not.toContain('.reading-info-row');
  });

  it('lets the labels fall below the alert and shrink together on very narrow screens', () => {
    const alerts = cssDeclarations('.reading-alerts-row');
    expect(alerts.flex).toBe('1 1 auto');
    expect(alerts['overflow']).toBe('visible');

    const labels = cssDeclarations('.reading-labels-row');
    expect(labels.flex).toBe('0 1 auto');
    expect(labels['max-width']).toBe('100%');

    const badges = cssDeclarations('.reading-labels-row .classification-badges');
    expect(badges.width).toBe('auto');
    expect(badges['max-width']).toBe('100%');

    const badge = cssDeclarations('.reading-labels-row .classification-badges > .live-category-badge');
    expect(badge.flex).toBe('1 1 140px');
  });
});
