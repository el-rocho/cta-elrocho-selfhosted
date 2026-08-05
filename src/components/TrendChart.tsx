import React, { useMemo, useState } from 'react';
import type { AppSettings, BloodPressureSession } from '../types/bloodPressure';
import { Activity, ChevronDown, Gauge, Info, Percent, TrendingUp, X } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { getHealthCategoriesMap } from '../utils/healthClassification';
import { calculatePeriodSummary } from '../utils/summaryStatistics';
import { TreatmentTargetBadge } from './TreatmentTargetBadge';
import {
  buildDailyTrendSeries,
  type DailyAverage,
  type LongTermTrendRange,
} from '../utils/trendAnalysis';

interface TrendChartProps {
  sessions: BloodPressureSession[];
  settings: AppSettings;
}

const RANGE_TRANSLATION_KEYS: Record<LongTermTrendRange, string> = {
  '1month': 'trend.range1Month',
  '3months': 'trend.range3Months',
  '6months': 'trend.range6Months',
  '1year': 'trend.range1Year',
};

type MetricKey = 'systolic' | 'diastolic' | 'heartRate';

export const TrendChart: React.FC<TrendChartProps> = ({
  sessions,
  settings,
}) => {
  const { t, language } = useLanguage();
  const [range, setRange] = useState<LongTermTrendRange>('1month');
  const [activeTooltip, setActiveTooltip] = useState<DailyAverage | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<MetricKey | null>(null);
  const [showCardiovascularInfo, setShowCardiovascularInfo] = useState(false);
  const series = useMemo(
    () => buildDailyTrendSeries(sessions, range),
    [sessions, range]
  );
  const dailyAverages = series.dailyAverages;
  const periodSessions = dailyAverages.flatMap((day) => day.sessions);
  const periodSummary = useMemo(
    () => calculatePeriodSummary(periodSessions, settings),
    [periodSessions, settings]
  );
  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const categories = getHealthCategoriesMap(language, settings.guidelineProfile);

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
  const systolicThreshold = settings.guidelineProfile === 'aha-acc-2025' ? 130 : 135;
  const diastolicThreshold = settings.guidelineProfile === 'aha-acc-2025' ? 80 : 85;
  const periodCategory = periodSummary.categoryMode.value
    ? categories[periodSummary.categoryMode.value]
    : undefined;
  const { estimatedMap, pressureLoad, pulsePressure } = periodSummary.cardiovascular;
  const modeFallback = (status: 'none' | 'tie') => t(
    status === 'tie' ? 'trend.noPredominant' : 'trend.notAvailable'
  );

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
  const axisTickCount = range === '1month' ? 5 : 6;
  const axisTicks = Array.from({ length: axisTickCount }, (_, index) => {
    const ratio = index / (axisTickCount - 1);
    const timestamp = rangeStartTime + timeSpan * ratio;
    return {
      x: paddingLeft + chartWidth * ratio,
      label: new Date(timestamp).toLocaleDateString(
        locale,
        range === '1month'
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

      <div className="trend-summary-row">
        {([
          { key: 'systolic' as const, className: 'systolic', title: t('form.systolic'), unit: 'mmHg', values: periodSummary.systolic },
          { key: 'diastolic' as const, className: 'diastolic', title: t('form.diastolic'), unit: 'mmHg', values: periodSummary.diastolic },
          { key: 'heartRate' as const, className: 'pulse', title: t('form.heartRate'), unit: language === 'en' ? 'BPM' : 'ppm', values: periodSummary.heartRate },
        ]).map((metric) => {
          const expanded = expandedMetric === metric.key;
          return (
            <button
              key={metric.key}
              type="button"
              className={`trend-summary-card metric-summary-card ${metric.className}${expanded ? ' expanded' : ''}`}
              aria-expanded={expanded}
              aria-label={`${metric.title}. ${t('trend.average')}: ${metric.values.average} ${metric.unit}. ${t(expanded ? 'trend.hideDetails' : 'trend.showDetails')}`}
              onClick={() => setExpandedMetric(expanded ? null : metric.key)}
            >
              <div className="trend-average-value">
                <strong>{metric.values.average}</strong>
                <span>{metric.unit}</span>
              </div>
              <span className="trend-details-toggle">
                {t(expanded ? 'trend.hideDetails' : 'trend.showDetails')}
                <ChevronDown size={14} aria-hidden="true" />
              </span>
              {expanded && (
                <div className="trend-stat-list">
                  <span><small>{t('trend.maximum')}</small><strong>{metric.values.maximum}</strong></span>
                  <span><small>{t('trend.minimum')}</small><strong>{metric.values.minimum}</strong></span>
                  <span><small>{t('trend.percentileBelow')}</small><strong>{metric.values.percentile90}</strong></span>
                  <span><small>{t('trend.percentileAbove')}</small><strong>{metric.values.percentile10}</strong></span>
                </div>
              )}
            </button>
          );
        })}
        <div className="trend-summary-card status-card" role="group" aria-label={t('trend.globalStatus')}>
          <div className="trend-mode-block">
            {periodCategory ? (
              <span className="trend-pattern-category" style={{ backgroundColor: periodCategory.badgeBg, color: periodCategory.badgeText }}>{periodCategory.name}</span>
            ) : <span className="trend-pattern-none">{modeFallback(periodSummary.categoryMode.status as 'none' | 'tie')}</span>}
          </div>
          <div className="trend-mode-block">
            {periodSummary.targetMode.value ? (
              <TreatmentTargetBadge assessment={periodSummary.targetMode.value} compact />
            ) : <span className="trend-pattern-none">{modeFallback(periodSummary.targetMode.status as 'none' | 'tie')}</span>}
          </div>
        </div>
      </div>

      <div className="cardiovascular-metrics-strip" role="group" aria-label={t('trend.complementaryMetrics')}>
        <div className="cardiovascular-metric pressure-load-metric"><span><strong>{t('trend.pressureLoadTitle')}:</strong></span><span className="cardiovascular-metric-detail">{t('trend.homePressureLoad')}</span><strong>{pressureLoad.elevatedPercentage} %</strong><small>{t('trend.loadFraction', { elevated: pressureLoad.elevatedSessions, total: pressureLoad.totalSessions })}</small>{!pressureLoad.hasSufficientData && <em>{t('trend.insufficientMetricsData')}</em>}</div>
        <div className="cardiovascular-metric map-metric"><span><strong>{t('trend.estimatedMap')}:</strong></span><strong>{estimatedMap.average} <small>mmHg</small></strong></div>
        <div className="cardiovascular-metric pulse-pressure-metric"><span><strong>{t('trend.averagePulsePressure')}:</strong></span><strong>{pulsePressure.average} <small>mmHg</small></strong></div>
        <button type="button" className="settings-info-button cardiovascular-info-button" onClick={() => setShowCardiovascularInfo(true)} aria-label={t('trend.metricsInfoTooltip')} title={t('trend.metricsInfoTooltip')}><Info size={16} /></button>
      </div>
      {showCardiovascularInfo && (
        <div className="modal-overlay settings-info-overlay" onClick={() => setShowCardiovascularInfo(false)}>
          <div className="modal-content settings-info-dialog cardiovascular-info-dialog" role="dialog" aria-modal="true" aria-labelledby="cardiovascular-info-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div className="modal-title-group"><Info size={24} className="modal-icon text-blue legal-icon-main" /><h2 id="cardiovascular-info-title" className="settings-info-title">{t('trend.metricsInfoTitle')}</h2></div><button type="button" className="btn-close-modal" onClick={() => setShowCardiovascularInfo(false)} aria-label={t('settings.close')}><X size={22} /></button></div>
            <div className="modal-body settings-info-body cardiovascular-info-body">
              <div className="settings-subcard cardiovascular-info-card"><Percent size={22} className="cardiovascular-modal-icon pressure-load-icon" /><div><strong>{t('trend.pressureLoadTitle')}</strong><p>{t('trend.pressureLoadDescription')}</p><p><em>{t('trend.pressureLoadRequirement')}</em></p><div className="cardiovascular-current-values"><span>{t('trend.totalLoad')}: <strong>{pressureLoad.elevatedPercentage} %</strong></span><span>{t('trend.systolicLoad')}: <strong>{pressureLoad.systolicPercentage} %</strong></span><span>{t('trend.diastolicLoad')}: <strong>{pressureLoad.diastolicPercentage} %</strong></span><span>{t('trend.sessionsAndDays', { sessions: pressureLoad.totalSessions, days: pressureLoad.dayCount })}</span></div></div></div>
              <div className="settings-subcard cardiovascular-info-card"><Gauge size={22} className="cardiovascular-modal-icon map-icon" /><div><strong>{t('trend.mapTitle')}</strong><p>{t('trend.mapDescription')}</p><p className="cardiovascular-formula">{t('trend.mapFormula')}</p><div className="cardiovascular-current-values"><span>{t('trend.average')}: <strong>{estimatedMap.average} mmHg</strong></span><span>{t('trend.minimum')}: <strong>{estimatedMap.minimum} mmHg</strong></span><span>{t('trend.maximum')}: <strong>{estimatedMap.maximum} mmHg</strong></span></div></div></div>
              <div className="settings-subcard cardiovascular-info-card"><Activity size={22} className="cardiovascular-modal-icon pulse-pressure-icon" /><div><strong>{t('trend.pulsePressureTitle')}</strong><p>{t('trend.pulsePressureDescription')}</p><p className="cardiovascular-formula">{t('trend.pulsePressureFormula')}</p><p><em>{t('trend.pulsePressureContext')}</em></p><div className="cardiovascular-current-values"><span>{t('trend.average')}: <strong>{pulsePressure.average} mmHg</strong></span><span>{t('trend.includedSessions', { sessions: pressureLoad.totalSessions })}</span></div></div></div>
              <div className="settings-info-note cardiovascular-info-note"><p><em>{t('trend.metricsCaution')}</em></p></div>
            </div>
          </div>
        </div>
      )}

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
          {t(
            dailyAverages.length === 1
              ? 'trend.dailyAveragesCountOne'
              : 'trend.dailyAveragesCountOther',
            { days: dailyAverages.length },
          )}
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
