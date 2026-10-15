// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReadingList } from './ReadingList';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { BloodPressureSession } from '../types/bloodPressure';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const makeSession = (id: string, hour: string): BloodPressureSession => ({
  id,
  timestamp: `2026-10-14T${hour}:00:00.000Z`,
  readings: [{
    id: `${id}-reading`,
    timestamp: `2026-10-14T${hour}:00:00.000Z`,
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
});

const sessions: BloodPressureSession[] = [
  makeSession('session-1', '08'),
  makeSession('session-2', '13'),
  makeSession('session-3', '21'),
];

let container: HTMLDivElement;
let root: Root;

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

async function renderList() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingList
        sessions={sessions}
        onDeleteSession={() => {}}
        onDeleteSingleReading={() => {}}
        onEditReading={() => {}}
        dateRange={{ preset: 'all' }}
        onDateRangeChange={() => {}}
        settings={{ ...DEFAULT_SETTINGS, showInformationalLabels: true }}
      />
    </LanguageProvider>
  ));
}

describe('ReadingList disclosure', () => {
  it('merges the period count and the disclosure control into a single history button', async () => {
    await renderList();

    const toggle = container.querySelector<HTMLButtonElement>('.history-toggle-button');
    expect(toggle).not.toBeNull();
    expect(toggle?.classList.contains('section-count-toggle')).toBe(true);
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('history-measurement-details');
    expect(toggle?.querySelector('.readings-count-text')?.textContent).toBe('3');
    expect(toggle?.getAttribute('aria-label')).toBe('3 mediciones. Mostrar historial');
    expect(container.querySelector('#history-measurement-details')).toBeNull();
    // Un solo control de plegado en toda la tarjeta.
    expect(container.querySelectorAll('.history-toggle-button').length).toBe(1);
    expect(container.querySelector('.readings-count-badge')).toBeNull();
  });

  it('keeps the history details toggle working from the unified button', async () => {
    await renderList();

    const toggle = container.querySelector<HTMLButtonElement>('.history-toggle-button');

    await act(async () => toggle?.click());

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('3 mediciones. Ocultar historial');
    expect(container.querySelector('#history-measurement-details')).not.toBeNull();
    expect(container.querySelectorAll('.session-item').length).toBe(3);

    await act(async () => toggle?.click());

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('#history-measurement-details')).toBeNull();
  });
});
