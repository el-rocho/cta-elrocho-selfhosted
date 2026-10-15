import React, { useRef, useEffect, useId, useMemo } from 'react';
import { useLanguage } from '../i18n/useLanguage';

interface WheelColumnProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number | '';
  referenceValue: number;
  onChange: (val: number) => void;
  accentClass: string;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  label,
  unit,
  min,
  max,
  value,
  referenceValue,
  onChange,
  accentClass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const programmaticScrollTargetRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const scrollEndTimerRef = useRef<number | null>(null);
  const listboxId = useId();
  const ITEM_HEIGHT = 40; // Altura de cada ítem en píxeles
  const SCROLL_END_DEBOUNCE = 120;

  // Generar array de valores válidos
  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [min, max]
  );
  const displayedValue = value === '' ? referenceValue : value;

  const alignToIndex = (targetIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const targetScrollTop = targetIndex * ITEM_HEIGHT;
    if (container.scrollTop === targetScrollTop) return;
    programmaticScrollTargetRef.current = targetScrollTop;
    container.scrollTop = targetScrollTop;
  };

  // Centrar inicialmente y aceptar cambios externos solo cuando el usuario no está desplazando.
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    const targetIndex = values.indexOf(displayedValue);
    if (targetIndex !== -1) alignToIndex(targetIndex);
  }, [displayedValue, values]);

  useEffect(() => () => {
    if (scrollEndTimerRef.current !== null) window.clearTimeout(scrollEndTimerRef.current);
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const programmaticTarget = programmaticScrollTargetRef.current;
    if (programmaticTarget !== null) {
      programmaticScrollTargetRef.current = null;
      if (Math.abs(event.currentTarget.scrollTop - programmaticTarget) < 0.5) return;
    }

    isUserScrollingRef.current = true;
    if (scrollEndTimerRef.current !== null) {
      window.clearTimeout(scrollEndTimerRef.current);
    }
    scrollEndTimerRef.current = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const selectedIndex = Math.max(0, Math.min(values.length - 1, Math.round(container.scrollTop / ITEM_HEIGHT)));
      const selectedVal = values[selectedIndex];
      alignToIndex(selectedIndex);
      isUserScrollingRef.current = false;
      scrollEndTimerRef.current = null;
      if (selectedVal !== value) onChange(selectedVal);
    }, SCROLL_END_DEBOUNCE);
  };

  const commitValue = (nextValue: number, force = false) => {
    if (scrollEndTimerRef.current !== null) {
      window.clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
    isUserScrollingRef.current = false;
    alignToIndex(values.indexOf(nextValue));
    if (force || nextValue !== value) onChange(nextValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = values.indexOf(displayedValue);
    const targetIndex = event.key === 'ArrowDown'
      ? Math.min(values.length - 1, currentIndex + 1)
      : event.key === 'ArrowUp'
        ? Math.max(0, currentIndex - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? values.length - 1
            : null;
    if (targetIndex === null) return;
    event.preventDefault();
    commitValue(values[targetIndex]);
  };

  return (
    <div className="wheel-column-card">
      <div className="wheel-column-header">
        <span className="wheel-label">{label}</span>
        <span className="wheel-unit">({unit})</span>
      </div>

      {/* Tambor Deslizable */}
      <div
        className="wheel-tumbler-container"
        ref={containerRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        role="listbox"
        tabIndex={0}
        aria-label={`${label} (${unit})`}
        aria-activedescendant={`${listboxId}-${displayedValue}`}
        style={{ height: ITEM_HEIGHT * 3 }}
      >
        <div className="wheel-spacer" style={{ height: ITEM_HEIGHT }} />
        {values.map((v) => {
          const isSelected = v === displayedValue;
          const isReference = isSelected && value === '';
          return (
            <div
              key={v}
              id={`${listboxId}-${v}`}
              role="option"
              aria-selected={isSelected}
              className={`wheel-item ${isSelected ? `selected ${isReference ? 'reference' : accentClass}` : ''}`}
              style={{ height: ITEM_HEIGHT }}
              onClick={() => commitValue(v, true)}
            >
              {v}
            </div>
          );
        })}
        <div className="wheel-spacer" style={{ height: ITEM_HEIGHT }} />
      </div>
    </div>
  );
};

interface WheelPickerProps {
  systolic: number | '';
  diastolic: number | '';
  heartRate: number | '';
  onChangeSystolic: (val: number) => void;
  onChangeDiastolic: (val: number) => void;
  onChangeHeartRate: (val: number) => void;
}

export const WheelPicker: React.FC<WheelPickerProps> = ({
  systolic,
  diastolic,
  heartRate,
  onChangeSystolic,
  onChangeDiastolic,
  onChangeHeartRate,
}) => {
  const { language } = useLanguage();

  return (
    <div className="wheel-picker-grid">
      <WheelColumn
        label={language === 'en' ? 'Systolic' : 'Sistólica'}
        unit="mmHg"
        min={60}
        max={240}
        value={systolic}
        referenceValue={115}
        onChange={onChangeSystolic}
        accentClass="acc-sys"
      />
      <WheelColumn
        label={language === 'en' ? 'Diastolic' : 'Diastólica'}
        unit="mmHg"
        min={40}
        max={160}
        value={diastolic}
        referenceValue={65}
        onChange={onChangeDiastolic}
        accentClass="acc-dia"
      />
      <WheelColumn
        label={language === 'en' ? 'Pulse' : 'Pulsaciones'}
        unit={language === 'en' ? 'BPM' : 'ppm'}
        min={40}
        max={200}
        value={heartRate}
        referenceValue={60}
        onChange={onChangeHeartRate}
        accentClass="acc-pulse"
      />
    </div>
  );
};