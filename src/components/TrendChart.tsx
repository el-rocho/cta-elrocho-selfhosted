import React, { useState } from 'react';
import type { BloodPressureSession, DateFilterPreset } from '../types/bloodPressure';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface TrendChartProps {
  sessions: BloodPressureSession[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ sessions }) => {
  const { t, language } = useLanguage();
  const [filter, setFilter] = useState<DateFilterPreset>('30days');
  const [activeTooltip, setActiveTooltip] = useState<BloodPressureSession | null>(null);

  // Ordenar de más antiguo a más reciente para graficar cronológicamente
  const chronological = [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Filtrar según el preset seleccionado
  const now = new Date();
  const filteredSessions = chronological.filter((s) => {
    if (filter === 'all') return true;
    const sDate = new Date(s.timestamp);
    const diffDays = (now.getTime() - sDate.getTime()) / (1000 * 3600 * 24);
    if (filter === '7days') return diffDays <= 7;
    if (filter === '30days') return diffDays <= 30;
    if (filter === '90days') return diffDays <= 90;
    return true;
  });

  if (filteredSessions.length === 0) {
    return (
      <div className="card chart-card">
        <div className="chart-header">
          <h3>
            <TrendingUp size={18} /> {t('trend.title')}
          </h3>
        </div>
        <div className="empty-state">
          <p>{t('trend.noData')}</p>
        </div>
      </div>
    );
  }

  // Dimensiones del canvas SVG
  const width = 700;
  const height = 260;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Escalas (Tensión arterial 40 - 200 mmHg)
  const minVal = 40;
  const maxVal = 200;

  const getY = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return height - paddingBottom - ratio * chartHeight;
  };

  const getX = (index: number) => {
    if (filteredSessions.length === 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (filteredSessions.length - 1)) * chartWidth;
  };

  // Coordenadas de Sistólica, Diastólica y Pulsaciones
  const sysPoints = filteredSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageSystolic), data: s }));
  const diaPoints = filteredSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageDiastolic), data: s }));
  const pulsePoints = filteredSessions.map((s, i) => ({ x: getX(i), y: getY(s.averageHeartRate), data: s }));

  const sysPathD = sysPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const diaPathD = diaPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const pulsePathD = pulsePoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');

  // Área objetivo ideal (Sistólica < 120, Diastólica < 80)
  const idealSysY = getY(120);
  const idealDiaY = getY(80);

  const locale = language === 'en' ? 'en-US' : 'es-ES';

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div className="chart-title">
          <TrendingUp size={24} className="icon-chart" />
          <h2>{t('trend.title')}</h2>
        </div>

        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${filter === '7days' ? 'active' : ''}`}
            onClick={() => setFilter('7days')}
          >
            {t('list.preset7Days')}
          </button>
          <button
            type="button"
            className={`chip ${filter === '30days' ? 'active' : ''}`}
            onClick={() => setFilter('30days')}
          >
            {t('list.preset30Days')}
          </button>
          <button
            type="button"
            className={`chip ${filter === '90days' ? 'active' : ''}`}
            onClick={() => setFilter('90days')}
          >
            {t('list.preset90Days')}
          </button>
          <button
            type="button"
            className={`chip ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('list.presetAll')}
          </button>
        </div>
      </div>

      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-dot sys-dot"></span>
          <span>{t('form.systolic')}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot dia-dot"></span>
          <span>{t('form.diastolic')}</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot pulse-dot"></span>
          <span>{t('form.heartRate')}</span>
        </div>
      </div>

      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
          {/* Banda de rango objetivo óptimo */}
          <rect
            x={paddingLeft}
            y={idealSysY}
            width={chartWidth}
            height={Math.max(0, idealDiaY - idealSysY)}
            fill="rgba(16, 185, 129, 0.08)"
            rx={4}
          />
          <line
            x1={paddingLeft}
            y1={idealSysY}
            x2={width - paddingRight}
            y2={idealSysY}
            stroke="rgba(16, 185, 129, 0.4)"
            strokeDasharray="4 4"
          />

          {/* Líneas horizontales de escala Y */}
          {[60, 90, 120, 150, 180].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="var(--border-color)"
                  strokeDasharray="2 2"
                  opacity={0.5}
                />
                <text x={paddingLeft - 8} y={y + 4} textAnchor="end" className="axis-text">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Línea gris fina punteada de Pulsaciones */}
          <path
            d={pulsePathD}
            fill="none"
            stroke="var(--accent-pulse)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity={0.7}
          />

          {/* Líneas de tendencia principales (Finas) */}
          <path d={sysPathD} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={diaPathD} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Puntos e interactividad */}
          {filteredSessions.map((s, i) => {
            const sysP = sysPoints[i];
            const diaP = diaPoints[i];
            const pulseP = pulsePoints[i];
            const dateStr = new Date(s.timestamp).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

            return (
              <g key={s.id} className="chart-point-group">
                {/* Línea conectora vertical al pasar o tocar */}
                <line
                  x1={sysP.x}
                  y1={sysP.y}
                  x2={diaP.x}
                  y2={diaP.y}
                  stroke="var(--text-muted)"
                  strokeWidth="1"
                  opacity={0.3}
                />

                {/* Punto Pulsaciones */}
                <circle
                  cx={pulseP.x}
                  cy={pulseP.y}
                  r="3"
                  fill="var(--accent-pulse)"
                  opacity={0.8}
                  onMouseEnter={() => setActiveTooltip(s)}
                  onClick={() => setActiveTooltip(s)}
                  className="point-interactive"
                />

                {/* Punto Sistólica */}
                <circle
                  cx={sysP.x}
                  cy={sysP.y}
                  r="3.5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  onMouseEnter={() => setActiveTooltip(s)}
                  onClick={() => setActiveTooltip(s)}
                  className="point-interactive"
                />

                {/* Punto Diastólica */}
                <circle
                  cx={diaP.x}
                  cy={diaP.y}
                  r="3.5"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  onMouseEnter={() => setActiveTooltip(s)}
                  onClick={() => setActiveTooltip(s)}
                  className="point-interactive"
                />

                {/* Etiquetas fecha en eje X */}
                {(filteredSessions.length <= 10 || i % Math.ceil(filteredSessions.length / 8) === 0) && (
                  <text x={sysP.x} y={height - 12} textAnchor="middle" className="axis-text">
                    {dateStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tooltip de detalle al tocar o pulsar un punto */}
      {activeTooltip && (
        <div className="chart-tooltip-detail">
          <div className="tooltip-header">
            <strong>
              {new Date(activeTooltip.timestamp).toLocaleDateString(locale, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
            <button className="btn-close-tooltip" onClick={() => setActiveTooltip(null)}>
              ×
            </button>
          </div>
          <div className="tooltip-body">
            <div className="tooltip-metric">
              <span className="label">{t('form.systolic')} / {t('form.diastolic')}:</span>
              <span className="val-sys">{activeTooltip.averageSystolic}</span> /{' '}
              <span className="val-dia">{activeTooltip.averageDiastolic}</span> <span className="unit">mmHg</span>
            </div>
            <div className="tooltip-metric">
              <span className="label">{t('form.heartRate')}:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeTooltip.averageHeartRate} {language === 'en' ? 'BPM' : 'ppm'}
              </span>
            </div>
            <div className="tooltip-metric">
              <span className="label">{t('list.arm')}:</span>
              <span>{activeTooltip.arm === 'left' ? t('form.armLeft') : t('form.armRight')}</span>
            </div>
            {activeTooltip.readings.length > 1 && (
              <div className="tooltip-badge-session">
                ✓ {t('list.readingsCount', { count: activeTooltip.readings.length })} ({t('whiteCoatBanner.activeTitle')})
              </div>
            )}
            {activeTooltip.notes && <div className="tooltip-notes">"{activeTooltip.notes}"</div>}
          </div>
        </div>
      )}
    </div>
  );
};
