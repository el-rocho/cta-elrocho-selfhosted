// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TrendChart } from './TrendChart';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { BloodPressureSession } from '../types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const session: BloodPressureSession = {
  id: 'session-1',
  timestamp: '2026-10-14T08:00:00.000Z',
  readings: [{
    id: 'reading-1',
    timestamp: '2026-10-14T08:00:00.000Z',
    systolic: 128,
    diastolic: 78,
    heartRate: 68,
    arm: 'left',
    takesAntihypertensiveMedication: false,
  }],
  averageSystolic: 128,
  averageDiastolic: 78,
  averageHeartRate: 68,
  discardedCount: 0,
  arm: 'left',
};

let container: HTMLDivElement;
let root: Root;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

async function renderChart() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <TrendChart
        sessions={[session]}
        settings={{ ...DEFAULT_SETTINGS, showInformationalLabels: true }}
      />
    </LanguageProvider>
  ));
}

describe('TrendChart disclosure', () => {
  it('starts collapsed and toggles the evolution details from the header', async () => {
    await renderChart();

    const toggle = container.querySelector<HTMLButtonElement>('.trend-section-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('trend-chart-details');

    const count = toggle?.querySelector('.readings-count-text');
    expect(count).not.toBeNull();
    expect(count?.querySelector('.readings-count-full')?.textContent).toBe('1 medida');
    expect(count?.querySelector('.readings-count-compact')?.textContent).toBe('1');
    expect(toggle?.getAttribute('aria-label')).toBe('1 medida. Mostrar evolución');
    expect(container.querySelector('#trend-chart-details')).toBeNull();
    expect(container.textContent).toContain('ESC 2024');
    expect(container.textContent).toContain('1 mes');

    await act(async () => toggle?.click());

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('#trend-chart-details')).not.toBeNull();
    expect(toggle?.getAttribute('aria-label')).toBe('1 medida. Ocultar evolución');

    await act(async () => toggle?.click());

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#trend-chart-details')).toBeNull();
  });
});

describe('TrendChart chart scroll', () => {
  // jsdom no calcula layout: se simula el desbordamiento medido en el navegador
  // (gráfica de 550 px en un contenedor de 306 px).
  const descriptores = {
    scrollWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth'),
    clientWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
    scrollLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollLeft'),
  };

  const simularDesbordamiento = () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 550 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 306 });
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get(this: { __scrollLeft?: number }) { return this.__scrollLeft ?? 0; },
      set(this: { __scrollLeft?: number }, value: number) { this.__scrollLeft = value; },
    });
  };

  const restaurarLayout = () => {
    for (const [clave, descriptor] of Object.entries(descriptores)) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, clave, descriptor);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[clave];
    }
  };

  afterEach(restaurarLayout);

  it('shows the most recent readings as soon as the section is expanded', async () => {
    simularDesbordamiento();
    await renderChart();

    // La sección arranca plegada: la gráfica todavía no está montada.
    expect(container.querySelector('.svg-container')).toBeNull();

    await act(async () => container.querySelector<HTMLButtonElement>('.trend-section-toggle')?.click());

    const scroller = container.querySelector<HTMLElement>('.svg-container');
    expect(scroller).not.toBeNull();
    expect(scroller?.scrollLeft).toBe(244);
  });

  it('returns to the most recent readings after collapsing and expanding again', async () => {
    simularDesbordamiento();
    await renderChart();

    const toggle = container.querySelector<HTMLButtonElement>('.trend-section-toggle');
    await act(async () => toggle?.click());

    // La persona usuaria desplaza la gráfica hacia el pasado.
    const scroller = container.querySelector<HTMLElement>('.svg-container');
    await act(async () => { if (scroller) scroller.scrollLeft = 0; });
    expect(scroller?.scrollLeft).toBe(0);

    await act(async () => toggle?.click());
    await act(async () => toggle?.click());

    expect(container.querySelector<HTMLElement>('.svg-container')?.scrollLeft).toBe(244);
  });
});
