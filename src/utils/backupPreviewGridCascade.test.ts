import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * El grid de «Revisar antes de importar» (clase `import-summary-grid
 * backup-preview-grid`) debe mostrar sus 5 contadores en DOS filas: 3+3 en la
 * primera y 2+2+2 en la segunda.
 *
 * Ambas reglas declaran `grid-template-columns` con la misma especificidad
 * (0,1,0), por lo que gana la última del archivo. Si `.backup-preview-grid`
 * queda antes de `.import-summary-grid`, el grid vuelve a 2 columnas, cada
 * `span 3` se recorta a la fila completa y la previsualización acaba en 5
 * filas. Esta prueba bloquea esa regresión.
 */
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function topLevelRuleIndex(selector: string): number {
  const marker = `\n${selector} {`;
  const index = css.indexOf(marker);
  if (index === -1) throw new Error(`No se encontró la regla de nivel superior ${selector}`);
  return index;
}

describe('grid de la previsualización de copia', () => {
  it('declara .backup-preview-grid después de .import-summary-grid', () => {
    expect(topLevelRuleIndex('.backup-preview-grid')).toBeGreaterThan(
      topLevelRuleIndex('.import-summary-grid')
    );
  });

  it('reparte los 5 contadores en dos filas (3+3 y 2+2+2)', () => {
    expect(css).toMatch(/\.backup-preview-grid \{\s*grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.backup-preview-grid \.import-summary-item \{\s*grid-column: span 3;/);
    expect(css).toMatch(/\.backup-preview-grid \.import-summary-item\.merge-count \{\s*grid-column: span 2;/);
  });

  it('apila en una columna en pantallas estrechas', () => {
    expect(css).toMatch(/\.backup-preview-grid \.import-summary-item \{\s*grid-column: auto;/);
  });
});
