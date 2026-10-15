// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageContext';
import { DEFAULT_SETTINGS } from '../services/storageService';
import { ReadingForm } from './ReadingForm';

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
  vi.useRealTimers();
});

function input(selector: string) {
  return container.querySelector<HTMLInputElement>(selector)!;
}

const validationDialog = () => document.body.querySelector<HTMLElement>('.form-alert-dialog');
const pulsePressureDialog = () => document.body.querySelector<HTMLElement>('.pulse-pressure-dialog');

function setInput(selector: string, value: string) {
  const element = input(selector);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

function submit() {
  container.querySelector<HTMLFormElement>('form')!.requestSubmit();
}

function renderForm(
  onAddReading = vi.fn(),
  sessionResetToken = 0,
  settings = DEFAULT_SETTINGS
) {
  return act(async () => root.render(
    <LanguageProvider language="es">
      <ReadingForm
        settings={settings}
        readings={[]}
        onAddReading={onAddReading}
        sessionResetToken={sessionResetToken}
      />
    </LanguageProvider>
  ));
}

function deferredSave() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ReadingForm defensivo', () => {
  it('rotula la acción principal como Guardar medición', async () => {
    await renderForm();

    expect(container.querySelector<HTMLButtonElement>('.btn-submit-reading')?.textContent).toContain(
      'Guardar medición'
    );
  });

  it('inicia vacío, muestra referencias como placeholders y rechaza el envío vacío', async () => {
    const onAddReading = vi.fn();
    await renderForm(onAddReading);

    expect(input('#systolic-input').value).toBe('');
    expect(input('#systolic-input').placeholder).toBe('115');
    expect(input('#diastolic-input').value).toBe('');
    expect(input('#diastolic-input').placeholder).toBe('65');
    expect(input('#pulse-input').value).toBe('');
    expect(input('#pulse-input').placeholder).toBe('60');

    await act(async () => submit());

    expect(onAddReading).not.toHaveBeenCalled();
    expect(container.querySelector('.alert-danger')).toBeNull();
    expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
      'Introduce valores Sistólica, Diastólica y Pulso'
    );
  });

  it('cierra el diálogo de datos incompletos con su botón y con Escape', async () => {
    await renderForm();

    await act(async () => submit());
    expect(validationDialog()!.contains(document.activeElement)).toBe(true);
    await act(async () => {
      validationDialog()!.querySelector<HTMLButtonElement>('.btn-alert-accept')!.click();
    });
    expect(validationDialog()).toBeNull();

    await act(async () => submit());
    expect(validationDialog()!.contains(document.activeElement)).toBe(true);
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(validationDialog()).toBeNull();
  });

  it('cierra el diálogo de datos incompletos pulsando fuera de su contenido', async () => {
    await renderForm();

    await act(async () => submit());
    await act(async () => {
      validationDialog()!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(validationDialog()).toBeNull();
  });

  it('deja inerte el formulario de fondo mientras hay un diálogo abierto', async () => {
    await renderForm();
    const form = container.querySelector('form')!;
    expect(form.hasAttribute('inert')).toBe(false);

    await act(async () => submit());
    expect(form.hasAttribute('inert')).toBe(true);

    await act(async () => {
      validationDialog()!.querySelector<HTMLButtonElement>('.btn-alert-accept')!.click();
    });
    expect(form.hasAttribute('inert')).toBe(false);
  });

  it('lleva el foco al diálogo del manguito y lo cierra con Escape', async () => {
    await renderForm();
    setInput('#systolic-input', '180');
    setInput('#diastolic-input', '60');
    setInput('#pulse-input', '70');

    await act(async () => submit());
    expect(pulsePressureDialog()!.contains(document.activeElement)).toBe(true);

    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(pulsePressureDialog()).toBeNull();
    expect(input('#systolic-input').value).toBe('180');
  });

  it('no cierra el diálogo del manguito al pulsar fuera durante un guardado', async () => {
    const save = deferredSave();
    await renderForm(vi.fn(() => save.promise));
    setInput('#systolic-input', '180');
    setInput('#diastolic-input', '60');
    setInput('#pulse-input', '70');

    await act(async () => submit());
    await act(async () => pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.click());
    await act(async () => {
      pulsePressureDialog()!.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(pulsePressureDialog()).not.toBeNull();

    await act(async () => {
      save.resolve();
      await save.promise;
    });
  });

  it('explica en el diálogo una diastólica que no es menor que la sistólica', async () => {
    const onAddReading = vi.fn();
    await renderForm(onAddReading);
    setInput('#systolic-input', '80');
    setInput('#diastolic-input', '90');
    setInput('#pulse-input', '70');

    await act(async () => submit());

    expect(onAddReading).not.toHaveBeenCalled();
    expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
      'La presión diastólica debe ser menor que la sistólica. Revisa los valores: esta medición no se puede guardar.'
    );
  });

  it('etiqueta una lectura muy alta con el nombre llano de hipertensión grave', async () => {
    await renderForm();
    await act(async () => {
      setInput('#systolic-input', '200');
      setInput('#diastolic-input', '120');
      setInput('#pulse-input', '70');
    });

    const pill = container.querySelector('.reading-alerts-row .clinical-alert-pill');
    expect(pill?.getAttribute('data-alert-key')).toBe('extremeHighPressure');
    expect(pill?.querySelector('.health-alert-name')?.textContent).toBe('Hipertensión grave (200/120)');
    // El aviso de urgencia no cabe en un desplegable que caduca: la etiqueta queda
    // sin texto propio y, por tanto, sin capa desplegable.
    expect(pill?.closest('details')).toBeNull();
    expect(container.querySelector('.clinical-alert-popover')).toBeNull();
    expect(container.querySelector('.reading-info-area')?.textContent).not.toContain('112');
  });

  it('conserva la evaluación anterior mientras se escribe un valor parcial y la actualiza al ser plausible', async () => {
    await renderForm();
    await act(async () => {
      setInput('#systolic-input', '200');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '70');
    });

    const alertKey = () => container.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#systolic-input', '2'));
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#systolic-input', '20'));
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#systolic-input', '120'));
    expect(alertKey()).not.toBe('extremeHighPressure');
  });

  it('conserva la última evaluación válida hasta que la combinación completa vuelve a ser válida', async () => {
    await renderForm();
    await act(async () => {
      setInput('#systolic-input', '200');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '70');
    });

    const alertKey = () => container.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#systolic-input', '70'));
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#diastolic-input', '50'));
    expect(alertKey()).not.toBe('extremeHighPressure');
  });

  it('no trunca decimales ni los usa para actualizar la evaluación', async () => {
    await renderForm();
    await act(async () => {
      setInput('#systolic-input', '200');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '70');
    });

    const alertKey = () => container.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key');

    await act(async () => setInput('#systolic-input', '49.5'));

    expect(input('#systolic-input').value).toBe('49.5');
    expect(alertKey()).toBe('extremeHighPressure');

    await act(async () => setInput('#systolic-input', '120'));
    expect(alertKey()).not.toBe('extremeHighPressure');
  });

  it('vacía los valores después de guardar correctamente', async () => {
    const onAddReading = vi.fn().mockResolvedValue(undefined);
    await renderForm(onAddReading);

    await act(async () => {
      setInput('#systolic-input', '121');
      setInput('#diastolic-input', '79');
      setInput('#pulse-input', '61');
      submit();
      await Promise.resolve();
    });

    expect(onAddReading).toHaveBeenCalledWith({
      systolic: 121,
      diastolic: 79,
      heartRate: 61,
      arm: 'left',
      notes: undefined,
      pulsePressureWarningConfirmed: false,
    });
    expect(input('#systolic-input').value).toBe('');
    expect(input('#diastolic-input').value).toBe('');
    expect(input('#pulse-input').value).toBe('');
  });

  it('bloquea el borrador mientras el guardado está pendiente', async () => {
    const save = deferredSave();
    await renderForm(vi.fn(() => save.promise));
    await act(async () => {
      setInput('#systolic-input', '120');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '60');
      submit();
    });

    expect(input('#systolic-input').disabled).toBe(true);
    await act(async () => setInput('#systolic-input', '130'));
    expect(input('#systolic-input').value).toBe('120');

    await act(async () => {
      save.resolve();
      await save.promise;
    });
    expect(input('#systolic-input').value).toBe('');
  });

  it('conserva un guardado fallido más allá del plazo de inactividad', async () => {
    vi.useFakeTimers();
    const save = deferredSave();
    await renderForm(vi.fn(() => save.promise));
    await act(async () => {
      setInput('#systolic-input', '120');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '60');
      submit();
    });
    await act(async () => setInput('#systolic-input', '130'));
    await act(async () => {
      save.reject(new Error('offline'));
      await save.promise.catch(() => undefined);
    });
    await act(async () => vi.advanceTimersByTime(5000));

    expect(input('#systolic-input').value).toBe('120');
    expect(container.querySelector('.alert-danger')).not.toBeNull();

    await act(async () => setInput('#systolic-input', '131'));
    await act(async () => vi.advanceTimersByTime(5000));
    expect(input('#systolic-input').value).toBe('');
  });

  it('vacía valores y errores cuando cambia sessionResetToken', async () => {
    const onAddReading = vi.fn();
    await renderForm(onAddReading, 1);

    await act(async () => {
      setInput('#systolic-input', '135');
      setInput('#diastolic-input', '85');
      setInput('#pulse-input', '70');
      setInput('.input-notes', 'sesión anterior');
    });
    // El diálogo de validación abierto también pertenece a la sesión anterior.
    await act(async () => {
      setInput('#systolic-input', '');
      submit();
    });
    expect(validationDialog()).not.toBeNull();

    await renderForm(onAddReading, 2);

    expect(input('#systolic-input').value).toBe('');
    expect(input('#diastolic-input').value).toBe('');
    expect(input('#pulse-input').value).toBe('');
    expect(input('.input-notes').value).toBe('');
    expect(validationDialog()).toBeNull();
  });

  it('ignora la respuesta tardía de un guardado de la sesión anterior', async () => {
    const save = deferredSave();
    const onAddReading = vi.fn(() => save.promise);
    await renderForm(onAddReading, 1);
    await act(async () => {
      setInput('#systolic-input', '120');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '60');
      submit();
    });

    await renderForm(onAddReading, 2);
    await act(async () => {
      setInput('#systolic-input', '130');
      setInput('#diastolic-input', '85');
      setInput('#pulse-input', '70');
    });
    await act(async () => {
      save.resolve();
      await save.promise;
    });

    expect(input('#systolic-input').value).toBe('130');
    expect(input('#diastolic-input').value).toBe('85');
    expect(input('#pulse-input').value).toBe('70');
  });

  it('ignora el fallo tardío de un guardado de la sesión anterior sin avisar al usuario nuevo', async () => {
    const save = deferredSave();
    const onAddReading = vi.fn(() => save.promise);
    await renderForm(onAddReading, 1);
    await act(async () => {
      setInput('#systolic-input', '120');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '60');
      submit();
    });

    await renderForm(onAddReading, 2);
    await act(async () => {
      setInput('#systolic-input', '130');
      save.reject(new Error('offline'));
      await save.promise.catch(() => undefined);
    });

    expect(input('#systolic-input').value).toBe('130');
    expect(container.querySelector('.alert-danger')).toBeNull();
  });

  it('vacía un borrador parcial tras cinco segundos sin cambios y reinicia el plazo al editar', async () => {
    vi.useFakeTimers();
    await renderForm();

    await act(async () => {
      setInput('#systolic-input', '128');
      setInput('.input-notes', 'no guardar');
      vi.advanceTimersByTime(4000);
    });
    expect(input('#systolic-input').value).toBe('128');
    expect(input('.input-notes').value).toBe('no guardar');

    await act(async () => {
      setInput('#diastolic-input', '82');
      vi.advanceTimersByTime(4999);
    });
    expect(input('#diastolic-input').value).toBe('82');

    await act(async () => vi.advanceTimersByTime(1));
    expect(input('#systolic-input').value).toBe('');
    expect(input('#diastolic-input').value).toBe('');
    expect(input('.input-notes').value).toBe('');
  });

  it('vacía una selección de rueda no guardada tras cinco segundos', async () => {
    vi.useFakeTimers();
    await renderForm(vi.fn(), 0, { ...DEFAULT_SETTINGS, preferredInputMode: 'wheel' });

    await act(async () => container.querySelector<HTMLDivElement>('.wheel-item.selected')!.click());
    expect(container.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(2);

    await act(async () => vi.advanceTimersByTime(5000));
    expect(container.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(3);
  });

  it('no desbloquea el formulario por el temporizador del guardado anterior', async () => {
    vi.useFakeTimers();
    const first = deferredSave();
    const second = deferredSave();
    const onAddReading = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await renderForm(onAddReading, 1);
    await act(async () => {
      setInput('#systolic-input', '120');
      setInput('#diastolic-input', '80');
      setInput('#pulse-input', '60');
      submit();
    });
    await act(async () => {
      first.resolve();
      await first.promise;
    });

    await renderForm(onAddReading, 2);
    await act(async () => {
      setInput('#systolic-input', '130');
      setInput('#diastolic-input', '85');
      setInput('#pulse-input', '70');
      submit();
    });

    await act(async () => vi.advanceTimersByTime(1100));

    expect(input('#systolic-input').disabled).toBe(true);
    await act(async () => setInput('#systolic-input', '140'));
    expect(input('#systolic-input').value).toBe('130');

    await act(async () => {
      second.resolve();
      await second.promise;
    });
  });

  it('mantiene el diálogo del manguito y los valores mientras el usuario decide', async () => {
    vi.useFakeTimers();
    await renderForm();
    setInput('#systolic-input', '180');
    setInput('#diastolic-input', '60');
    setInput('#pulse-input', '70');

    await act(async () => submit());
    expect(pulsePressureDialog()).not.toBeNull();

    await act(async () => vi.advanceTimersByTime(30000));

    expect(pulsePressureDialog()).not.toBeNull();
    expect([
      input('#systolic-input').value,
      input('#diastolic-input').value,
      input('#pulse-input').value,
    ]).toEqual(['180', '60', '70']);
  });

  it('reinicia el borrado por inactividad al cerrar el diálogo del manguito', async () => {
    vi.useFakeTimers();
    await renderForm();
    setInput('#systolic-input', '180');
    setInput('#diastolic-input', '60');
    setInput('#pulse-input', '70');

    await act(async () => submit());
    await act(async () => {
      pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-cancel-warning')!.click();
    });

    expect(pulsePressureDialog()).toBeNull();
    expect(input('#systolic-input').value).toBe('180');

    await act(async () => vi.advanceTimersByTime(5000));
    expect(input('#systolic-input').value).toBe('');
  });

  it('bloquea los botones de la confirmación mientras el guardado está pendiente', async () => {
    const save = deferredSave();
    await renderForm(vi.fn(() => save.promise));
    await act(async () => {
      setInput('#systolic-input', '180');
      setInput('#diastolic-input', '60');
      setInput('#pulse-input', '70');
      submit();
    });
    await act(async () => pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.click());

    expect(pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-force-save')!.disabled).toBe(true);
    expect(pulsePressureDialog()!.querySelector<HTMLButtonElement>('.btn-cancel-warning')!.disabled).toBe(true);

    await act(async () => {
      save.resolve();
      await save.promise;
    });
  });

  it('mantiene un aviso principal en la fila reservada y resume los adicionales', async () => {
    await renderForm(vi.fn(), 0, { ...DEFAULT_SETTINGS, showInformationalLabels: true });
    await act(async () => {
      setInput('#systolic-input', '80');
      setInput('#diastolic-input', '65');
      setInput('#pulse-input', '70');
    });

    expect(container.querySelectorAll('.reading-alerts-row .clinical-alert-pill')).toHaveLength(1);
    expect(container.querySelector('.health-alert-count')).toBeNull();

    await act(async () => {
      setInput('#systolic-input', '85');
      setInput('#diastolic-input', '55');
      setInput('#pulse-input', '105');
    });

    expect(container.querySelectorAll('.reading-alerts-row .clinical-alert-pill')).toHaveLength(1);
    expect(container.querySelector('.reading-alerts-row .clinical-alert-pill')?.getAttribute('data-alert-key')).toBe('hypotensionTachycardia');
    expect(container.querySelector('.health-alert-count')?.textContent).toBe('+2');
    expect(container.querySelector('.reading-info-area')?.contains(container.querySelector('.reading-alerts-row'))).toBe(true);
    const details = container.querySelector<HTMLDetailsElement>('.clinical-alert-details');
    expect(details).not.toBeNull();
    expect(details!.querySelector('.clinical-alert-popover')?.textContent).toContain('repite la medición');
  });

  it('agrupa los bloques de la cabecera reservando dos etiquetas y dos botones', async () => {
    await renderForm(vi.fn(), 0, { ...DEFAULT_SETTINGS, showInformationalLabels: true });

    const badges = Array.from(container.querySelectorAll('.classification-badges > *'));
    expect(badges).toHaveLength(2);
    expect(badges[1].classList.contains('is-placeholder')).toBe(true);
    expect(badges[1].getAttribute('aria-hidden')).toBe('true');

    expect(container.querySelectorAll('.form-controls-wrapper .btn-switch')).toHaveLength(2);
  });

  it('mantiene controles compactos en el título y una sola fila informativa bajo guardar', async () => {
    await renderForm(vi.fn(), 0, { ...DEFAULT_SETTINGS, showInformationalLabels: true });
    const header = container.querySelector('.form-header')!;
    expect(header.querySelector('.form-title-left')).not.toBeNull();
    expect(header.querySelector('.form-controls-wrapper')).not.toBeNull();
    expect(header.querySelector('.classification-badges')).toBeNull();
    expect(header.querySelector<HTMLButtonElement>('.arm-chip')!.textContent).toBe('Izq.');
    expect(header.querySelector<HTMLButtonElement>('.btn-mode-chip')!.textContent).toBe('');
    expect(header.querySelector('.btn-mode-chip svg')).not.toBeNull();
    const infoArea = container.querySelector('.reading-info-area')!;
    // Una sola fila con los dos grupos; los avisos van antes que las etiquetas, así
    // que al no caber el bloque de etiquetas cae debajo del aviso.
    expect(Array.from(infoArea.children).map((child) => child.className.split(' ')[0])).toEqual([
      'reading-alerts-row',
      'reading-labels-row',
    ]);
    expect(infoArea.querySelector('.reading-info-row')).toBeNull();
    expect(infoArea.previousElementSibling?.classList.contains('reading-submit-row')).toBe(true);
  });

  it('no reserva el hueco del objetivo cuando sí se muestra', async () => {
    await renderForm(vi.fn(), 0, {
      ...DEFAULT_SETTINGS,
      showInformationalLabels: true,
      takesAntihypertensiveMedication: true,
    });

    const badges = Array.from(container.querySelectorAll('.classification-badges > *'));
    expect(badges).toHaveLength(2);
    expect(badges.some((badge) => badge.classList.contains('is-placeholder'))).toBe(false);
  });

  it('no guarda las referencias visuales de la rueda si no se han seleccionado las tres columnas', async () => {
    const onAddReading = vi.fn();
    await renderForm(onAddReading, 0, { ...DEFAULT_SETTINGS, preferredInputMode: 'wheel' });

    expect(container.querySelectorAll('.wheel-item.selected')).toHaveLength(3);
    expect(container.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(3);

    await act(async () => {
      container.querySelector<HTMLDivElement>('.wheel-item.selected')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      submit();
    });

    expect(onAddReading).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.wheel-item.selected.reference')).toHaveLength(2);
    expect(validationDialog()!.querySelector('.form-alert-message')?.textContent).toBe(
      'Introduce valores Sistólica, Diastólica y Pulso'
    );
  });
});
