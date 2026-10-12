// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import type { BloodPressureReading } from '../types/bloodPressure';
import { ReadingForm } from './ReadingForm';
import { EditReadingModal } from './EditReadingModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function clickText(label: string) {
  const button = [...container.querySelectorAll('button')].find((item) => item.textContent === label);
  if (!button) throw new Error(`Botón no encontrado: ${label}`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function setInput(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const reading: BloodPressureReading = {
  id: 'reading-1',
  timestamp: '2026-10-11T08:00:00.000Z',
  systolic: 120,
  diastolic: 80,
  heartRate: 60,
  arm: 'left',
  notes: 'original',
};

describe('formularios ante fallos de storage', () => {
  it('conserva la entrada del alta y muestra aviso si el guardado falla', async () => {
    const onAddReading = vi.fn().mockRejectedValue(new Error('offline'));
    await act(async () => root.render(
      <LanguageProvider language="es">
        <ReadingForm settings={DEFAULT_SETTINGS} readings={[]} onAddReading={onAddReading} />
      </LanguageProvider>
    ));

    await act(async () => {
      setInput('#systolic-input', '131');
      setInput('#diastolic-input', '84');
      setInput('#pulse-input', '67');
      setInput('.input-notes', 'conservar esto');
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(container.querySelector<HTMLInputElement>('#systolic-input')!.value).toBe('131');
    expect(container.querySelector<HTMLInputElement>('.input-notes')!.value).toBe('conservar esto');
    expect(container.textContent).toContain('No se pudo guardar la medición');
  });

  it('mantiene abierto el modal de edición con sus cambios si falla el guardado', async () => {
    const onClose = vi.fn();
    const onSaveReading = vi.fn().mockRejectedValue(new Error('offline'));
    await act(async () => root.render(
      <LanguageProvider language="es">
        <EditReadingModal
          isOpen
          reading={reading}
          settings={DEFAULT_SETTINGS}
          readings={[reading]}
          onClose={onClose}
          onSaveReading={onSaveReading}
        />
      </LanguageProvider>
    ));

    await act(async () => {
      setInput('#edit-systolic', '132');
      setInput('#edit-notes', 'edición pendiente');
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>('#edit-systolic')!.value).toBe('132');
    expect(container.querySelector<HTMLTextAreaElement>('#edit-notes')!.value).toBe('edición pendiente');
    expect(container.textContent).toContain('No se pudo guardar la medición');
  });

  it('usa un mensaje específico cuando falla el borrado de una medición', async () => {
    const onDeleteReading = vi.fn().mockRejectedValue(new Error('offline'));
    await act(async () => root.render(
      <LanguageProvider language="es">
        <EditReadingModal
          isOpen
          reading={reading}
          settings={DEFAULT_SETTINGS}
          readings={[reading]}
          onClose={() => {}}
          onSaveReading={() => true}
          onDeleteReading={onDeleteReading}
        />
      </LanguageProvider>
    ));

    await act(async () => clickText('Eliminar'));
    await act(async () => { clickText('Sí, eliminar'); await Promise.resolve(); });

    expect(container.textContent).toContain('No se pudo eliminar la medición');
    expect(container.textContent).not.toContain('No se pudo guardar la medición');
  });
});
