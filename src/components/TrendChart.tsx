import React, { useMemo, useState } from 'react';
import type { BloodPressureSession, GuidelineProfile } from '../types/bloodPressure';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import {
  buildDailyTrendSeries,
  type DailyAverage,
  type LongTermTrendRange,
} from '../utils/trendAnalysis';

interface TrendChartProps {
  sessions: BloodPressureSession[];
  guidelineProfile: GuidelineProfile;
}

const RANGE_TRANSLATION_KEYS: Record<LongTermTrendRange, string> = {
  '28days': 'trend.range28Days',
  '3months': 'trend.range3Months',
  '6months': 'trend.range6Months',
  '1year': 'trend.range1Year',
};

export const TrendChart: React.FC<TrendChartProps> = ({
  sessions,
  guidelineProfile,
}) => {
  const { t, language } = useLanguage();
  const [range, setRange] = useState<LongTermTrendRange>('28days');
  const [activeTooltip, setActiveTooltip] = useState<DailyAverage | null>(null);
  const series = useMemo(
    () => buildDailyTrendSeries(sessions, range),
    [sessions, range]
  );
  const dailyAverages = series.dailyAverages;
  const locale = language === 'en' ? 'en-US' : 'es-ES';

  const selectRange = (nextRange: LongTermTrendRange) => {
    setRange(nextRange);
    setActiveTooltip(null);
  };

  if (dailyAverages.length === 0) {
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

  const width = 700;
  const height = 260;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const minVal = 40;
  const maxVal = 200;
  const rangeStartTime = new Date(
    series.rangeStart ?? dailyAverages[0].timestamp
  ).getTime();
  const rangeEndTime = new Date(
    series.rangeEnd ?? dailyAverages[dailyAverages.length - 1].timestamp
  ).getTime();
  const timeSpan = Math.max(1, rangeEndTime - rangeStartTime);
  const systolicThreshold = guidelineProfile === 'aha-acc-2025' ? 130 : 135;
  const diastolicThreshold = guidelineProfile === 'aha-acc-2025' ? 80 : 85;

  const getY = (value: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, value));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return height - paddingBottom - ratio * chartHeight;
  };

  const getX = (timestamp: string) => {
    if (dailyAverages.length === 1) return paddingLeft + chartWidth / 2;
    const ratio = (new Date(timestamp).getTime() - rangeStartTime) / timeSpan;
    return paddingLeft + Math.max(0, Math.min(1, ratio)) * chartWidth;
  };

  const sysPoints = dailyAverages.map((day) => ({
    x: getX(day.timestamp),
    y: getY(day.averageSystolic),
  }));
  const diaPoints = dailyAverages.map((day) => ({
    x: getX(day.timestamp),
    y: getY(day.averageDiastolic),
  }));
  const pulsePoints = dailyAverages.map((day) => ({
    x: getX(day.timestamp),
    y: getY(day.averageHeartRate),
  }));
  const buildPath = (points: { x: number; y: number }[]) =>
    points.reduce(
      (path, point, index) =>
        index === 0
          ? `M ${point.x} ${point.y}`
          : `${path} L ${point.x} ${point.y}`,
      ''
    );
  const axisTickCount = range === '28days' ? 5 : 6;
  const axisTicks = Array.from({ length: axisTickCount }, (_, index) => {
    const ratio = index / (axisTickCount - 1);
    const timestamp = rangeStartTime + timeSpan * ratio;
    return {
      x: paddingLeft + chartWidth * ratio,
      label: new Date(timestamp).toLocaleDateString(
        locale,
        range === '28days'
          ? { day: '2-digit', month: '2-digit' }
          : { month: 'short', year: '2-digit' }
      ),
    };
  });

  return (
    <div className="card chart-card">
      <div className="chart-header">
        <div className="chart-title">
          <TrendingUp size={24} className="icon-chart" />
          <h2>{t('trend.title')}</h2>
        </div>

        <div className="filter-chips">
          {(Object.keys(RANGE_TRANSLATION_KEYS) as LongTermTrendRange[]).map(
            (option) => (
              <button
                key={option}
                type="button"
                className={`chip ${range === option ? 'active' : ''}`}
                onClick={() => selectRange(option)}
              >
                {t(RANGE_TRANSLATION_KEYS[option])}
              </button>
            )
          )}
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
        <span className="daily-average-caption">
          {t('trend.dailyAveragesCount', { days: dailyAverages.length })}
        </span>
      </div>

      <div className="svg-container">
        <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
          {[60, 90, 120, 150, 180].map((value) => {
            const y = getY(value);
            return (
              <g key={value}>
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
                  {value}
                </text>
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            y1={getY(systolicThreshold)}
            x2={width - paddingRight}
            y2={getY(systolicThreshold)}
            stroke="#ef4444"
            strokeDasharray="5 5"
            opacity={0.22}
          />
          <line
            x1={paddingLeft}
            y1={getY(diastolicThreshold)}
            x2={width - paddingRight}
            y2={getY(diastolicThreshold)}
            stroke="#3b82f6"
            strokeDasharray="5 5"
            opacity={0.22}
          />

          <path
            d={buildPath(pulsePoints)}
            fill="none"
            stroke="var(--accent-pulse)"
            strokeWidth="1.3"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity={0.7}
          />
          <path
            d={buildPath(sysPoints)}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={buildPath(diaPoints)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {dailyAverages.map((day, index) => {
            const sysPoint = sysPoints[index];
            const diaPoint = diaPoints[index];
            const pulsePoint = pulsePoints[index];
            const activate = () => setActiveTooltip(day);

            return (
              <g key={day.dayKey} className="chart-point-group">
                <line
                  x1={sysPoint.x}
                  y1={sysPoint.y}
                  x2={diaPoint.x}
                  y2={diaPoint.y}
                  stroke="var(--text-muted)"
                  strokeWidth="1"
                  opacity={0.25}
                />
                <circle
                  cx={pulsePoint.x}
                  cy={pulsePoint.y}
                  r="3"
                  fill="var(--accent-pulse)"
                  opacity={0.8}
                  onMouseEnter={activate}
                  onClick={activate}
                  className="point-interactive"
                />
                <circle
                  cx={sysPoint.x}
                  cy={sysPoint.y}
                  r="3.5"
                  fill="#ef4444"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  onMouseEnter={activate}
                  onClick={activate}
                  className="point-interactive"
                />
                <circle
                  cx={diaPoint.x}
                  cy={diaPoint.y}
                  r="3.5"
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  onMouseEnter={activate}
                  onClick={activate}
                  className="point-interactive"
                />
              </g>
            );
          })}

          {axisTicks.map((tick) => (
            <text
              key={`${tick.x}-${tick.label}`}
              x={tick.x}
              y={height - 12}
              textAnchor="middle"
              className="axis-text"
            >
              {tick.label}
            </text>
          ))}
        </svg>
      </div>

      {activeTooltip && (
        <div className="chart-tooltip-detail">
          <div className="tooltip-header">
            <strong>
              {new Date(activeTooltip.timestamp).toLocaleDateString(locale, {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </strong>
            <button
              className="btn-close-tooltip"
              onClick={() => setActiveTooltip(null)}
              aria-label={t('settings.close')}
            >
              ×
            </button>
          </div>
          <div className="tooltip-body">
            <div className="tooltip-metric">
              <span className="label">{t('trend.dailyAverage')}:</span>
              <span className="val-sys">{activeTooltip.averageSystolic}</span> /{' '}
              <span className="val-dia">{activeTooltip.averageDiastolic}</span>{' '}
              <span className="unit">mmHg</span>
            </div>
            <div className="tooltip-metric">
              <span className="label">{t('form.heartRate')}:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeTooltip.averageHeartRate} {language === 'en' ? 'BPM' : 'ppm'}
              </span>
            </div>
            <div className="tooltip-badge-session">
              {t('trend.sessionsOnDay', { count: activeTooltip.sessionCount })}
            </div>
            {activeTooltip.notes && (
              <div className="tooltip-notes">"{activeTooltip.notes}"</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
