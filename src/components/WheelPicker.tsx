import React, { useRef, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface WheelColumnProps {
  label: string;
  unit: string;
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  accentClass: string;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  label,
  unit,
  min,
  max,
  value,
  onChange,
  accentClass,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);
  const ITEM_HEIGHT = 40; // Altura de cada ítem en píxeles

  // Generar array de valores válidos
  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [min, max]
  );

  // Centrar el scroll de la ruleta inicialmente y cuando cambie 'value' externamente
  useEffect(() => {
    if (containerRef.current) {
      const targetIndex = values.indexOf(value);
      if (targetIndex !== -1) {
        const targetScrollTop = targetIndex * ITEM_HEIGHT;
        if (Math.abs(containerRef.current.scrollTop - targetScrollTop) > 2) {
          isProgrammaticScrollRef.current = true;
          containerRef.current.scrollTop = targetScrollTop;
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 50);
        }
      }
    }
  }, [value, values]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;

    const scrollTop = e.currentTarget.scrollTop;
    const selectedIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const selectedVal = values[selectedIndex];
    if (selectedVal !== undefined && selectedVal !== value) {
      onChange(selectedVal);
    }
  };

  const handleStep = (delta: number) => {
    const nextVal = Math.max(min, Math.min(max, value + delta));
    onChange(nextVal);
    if (containerRef.current) {
      const targetIndex = values.indexOf(nextVal);
      if (targetIndex !== -1) {
        isProgrammaticScrollRef.current = true;
        containerRef.current.scrollTo({
          top: targetIndex * ITEM_HEIGHT,
          behavior: 'smooth',
        });
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 150);
      }
    }
  };

  return (
    <div className="wheel-column-card">
      <div className="wheel-column-header">
        <span className="wheel-label">{label}</span>
        <span className="wheel-unit">({unit})</span>
      </div>

      {/* Botón Incrementar (+) */}
      <button
        type="button"
        className="btn-wheel-step"
        onClick={() => handleStep(1)}
        title={`+1 ${label}`}
      >
        <ChevronUp size={18} />
      </button>

      {/* Tambor Deslizable */}
      <div
        className="wheel-tumbler-container"
        ref={containerRef}
        onScroll={handleScroll}
        style={{ height: ITEM_HEIGHT * 3 }}
      >
        <div className="wheel-spacer" style={{ height: ITEM_HEIGHT }} />
        {values.map((v) => {
          const isSelected = v === value;
          return (
            <div
              key={v}
              className={`wheel-item ${isSelected ? 'selected ' + accentClass : ''}`}
              style={{ height: ITEM_HEIGHT }}
              onClick={() => {
                onChange(v);
                if (containerRef.current) {
                  const targetIndex = values.indexOf(v);
                  containerRef.current.scrollTo({
                    top: targetIndex * ITEM_HEIGHT,
                    behavior: 'smooth',
                  });
                }
              }}
            >
              {v}
            </div>
          );
        })}
        <div className="wheel-spacer" style={{ height: ITEM_HEIGHT }} />
      </div>

      {/* Botón Decrementar (-) */}
      <button
        type="button"
        className="btn-wheel-step"
        onClick={() => handleStep(-1)}
        title={`-1 ${label}`}
      >
        <ChevronDown size={18} />
      </button>
    </div>
  );
};

interface WheelPickerProps {
  systolic: number;
  diastolic: number;
  heartRate: number;
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
        onChange={onChangeSystolic}
        accentClass="acc-sys"
      />
      <WheelColumn
        label={language === 'en' ? 'Diastolic' : 'Diastólica'}
        unit="mmHg"
        min={40}
        max={160}
        value={diastolic}
        onChange={onChangeDiastolic}
        accentClass="acc-dia"
      />
      <WheelColumn
        label={language === 'en' ? 'Pulse' : 'Pulsaciones'}
        unit={language === 'en' ? 'BPM' : 'ppm'}
        min={40}
        max={200}
        value={heartRate}
        onChange={onChangeHeartRate}
        accentClass="acc-pulse"
      />
    </div>
  );
};
