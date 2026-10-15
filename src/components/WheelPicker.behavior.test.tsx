// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageContext';
import { WheelPicker } from './WheelPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function renderWheel(onChangeSystolic = vi.fn()) {
  return act(async () => root.render(
    <LanguageProvider language="es">
      <WheelPicker
        systolic={120}
        diastolic={80}
        heartRate={60}
        onChangeSystolic={onChangeSystolic}
        onChangeDiastolic={() => {}}
        onChangeHeartRate={() => {}}
      />
    </LanguageProvider>
  ));
}

function systolicColumn() {
  return container.querySelectorAll<HTMLDivElement>('.wheel-tumbler-container')[0]!;
}

describe('WheelPicker preciso', () => {
  it('espera a que termine el desplazamiento, alinea el ítem más cercano y emite una sola vez', async () => {
    const onChange = vi.fn();
    await renderWheel(onChange);
    const column = systolicColumn();
    await act(async () => {
      vi.advanceTimersByTime(60);
    });

    await act(async () => {
      column.scrollTop = 84;
      column.dispatchEvent(new Event('scroll', { bubbles: true }));
      column.scrollTop = 104;
      column.dispatchEvent(new Event('scroll', { bubbles: true }));
    });

    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(150);
    });

    expect(column.scrollTop).toBe(120);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(63);
  });

  it('muestra la referencia vacía sin emitirla hasta que el usuario toca el ítem', async () => {
    const onChange = vi.fn();
    await act(async () => root.render(
      <LanguageProvider language="es">
        <WheelPicker
          systolic=""
          diastolic=""
          heartRate=""
          onChangeSystolic={onChange}
          onChangeDiastolic={() => {}}
          onChangeHeartRate={() => {}}
        />
      </LanguageProvider>
    ));

    expect(onChange).not.toHaveBeenCalled();
    const reference = [...container.querySelectorAll<HTMLDivElement>('.wheel-item')]
      .find((item) => item.textContent === '115')!;

    await act(async () => reference.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(systolicColumn().scrollTop).toBe((115 - 60) * 40);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(115);
  });

  it('al pulsar un ítem lo alinea exactamente y emite una sola vez', async () => {
    const onChange = vi.fn();
    await renderWheel(onChange);
    const target = [...container.querySelectorAll<HTMLDivElement>('.wheel-item')]
      .find((item) => item.textContent === '123')!;

    await act(async () => target.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(systolicColumn().scrollTop).toBe((123 - 60) * 40);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(123);
  });

  it('expone la columna como selector operable mediante teclado', async () => {
    const onChange = vi.fn();
    await renderWheel(onChange);
    const column = systolicColumn();

    expect(column.getAttribute('role')).toBe('listbox');
    expect(column.tabIndex).toBe(0);
    expect(column.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe('120');

    await act(async () => column.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(121);
    expect(column.scrollTop).toBe((121 - 60) * 40);
  });
});
