import React, { useState, useRef } from 'react';
import type { AppSettings, BloodPressureReading, BloodPressureSession, DateRange, LanguageOption } from '../types/bloodPressure';
import { getConfirmedPulsePressureAlerts, getCulpritLabel, getHealthAssessment, getReadingMedicationContext, getSessionMedicationContext } from '../utils/healthClassification';
import { getEffectiveSessionReadings } from '../utils/whiteCoatAlgorithm';
import { filterSessionsByDateRange } from '../utils/exportCsv';
import { History, ChevronDown, ChevronUp, Clock, Armchair, ShieldCheck, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { assessTreatmentTarget } from '../utils/treatmentTarget';
import { TreatmentTargetBadge } from './TreatmentTargetBadge';

interface ReadingListProps {
  sessions: BloodPressureSession[];
  onDeleteSession: (session: BloodPressureSession) => void;
  onDeleteSingleReading: (readingId: string) => void;
  onEditReading: (reading: BloodPressureReading) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  settings: AppSettings;
}

// Subcomponente con useRef para manejar tomas individuales en tabla desglosada
const BreakdownRow: React.FC<{
  reading: BloodPressureReading;
  index: number;
  isDiscarded: boolean;
  rTime: string;
  language: LanguageOption;
  settings: AppSettings;
  onEditReading: (reading: BloodPressureReading) => void;
  onDeleteSingleReading: (id: string) => void;
}> = ({ reading, index, isDiscarded, rTime, language, settings, onEditReading, onDeleteSingleReading }) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const readingAssessment = getHealthAssessment(
    reading.systolic,
    reading.diastolic,
    reading.heartRate,
    language,
    settings.guidelineProfile,
    reading.pulsePressureWarningConfirmed === true
  );
  const {
    category: readingCategory,
    alerts: readingAlerts,
    safetyAlerts: readingSafetyAlerts,
    culprit: readingCulprit,
  } = readingAssessment;
  const treatmentTargetAssessment = getReadingMedicationContext(reading, settings.takesAntihypertensiveMedication) ? assessTreatmentTarget(reading.systolic, reading.diastolic, settings) : null;

  const startTimer = (x: number, y: number) => {
    touchStartPosRef.current = { x, y };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onEditReading(reading);
    }, 450);
  };

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startTimer(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        cancelTimer();
      }
    }
  };

  return (
    <tr
      className={isDiscarded ? 'row-discarded' : 'row-used'}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={cancelTimer}
      onTouchCancel={cancelTimer}
      onMouseDown={(e) => { if (e.button === 0) startTimer(e.clientX, e.clientY); }}
      onMouseUp={cancelTimer}
      onMouseLeave={cancelTimer}
      onDoubleClick={() => { cancelTimer(); onEditReading(reading); }}
      onContextMenu={(e) => { e.preventDefault(); cancelTimer(); onEditReading(reading); }}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <td data-label="#">#{index + 1}</td>
      <td data-label={language === 'en' ? 'Time' : 'Hora'}>{rTime}</td>
      <td data-label={language === 'en' ? 'Values' : 'Medición'}>
        <strong>{reading.systolic}</strong> / <strong>{reading.diastolic}</strong> / <strong>{reading.heartRate}</strong>
        <div className="breakdown-classification">
          <span className="category-pill compact" style={{ backgroundColor: readingCategory.badgeBg, color: readingCategory.badgeText }}>
            {readingCategory.name}
          </span>
          {readingCulprit !== 'none' && (
            <span className="breakdown-info-text">{getCulpritLabel(readingCulprit, readingCategory.direction, language)}</span>
          )}
          {treatmentTargetAssessment && <TreatmentTargetBadge assessment={treatmentTargetAssessment} compact />}
        </div>
        {(readingSafetyAlerts.length > 0 || readingAlerts.length > 0) && (
          <div className="breakdown-alerts">
            {[...readingSafetyAlerts, ...readingAlerts].map((alert) => (
              <span
                key={alert.key}
                className="breakdown-info-text"
                title={alert.description}
              >
                {alert.name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td data-label={language === 'en' ? 'Status' : 'Estado'}>
        {isDiscarded ? (
          <span className="status-discarded">
            {language === 'en' ? 'Discarded' : 'Descartada'}
          </span>
        ) : (
          <span className="status-used">
            {language === 'en' ? 'Used' : 'Utilizada'}
          </span>
        )}
      </td>
      <td data-label={language === 'en' ? 'Actions' : 'Acciones'}>
        <div className="table-actions-cell" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-text-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSingleReading(reading.id);
            }}
          >
            {language === 'en' ? 'Delete' : 'Eliminar'}
          </button>
        </div>
      </td>
    </tr>
  );
};

// Subcomponente de Tarjeta de Sesión
const SessionCardItem: React.FC<{
  session: BloodPressureSession;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEditReading: (reading: BloodPressureReading) => void;
  onDeleteSession: (session: BloodPressureSession) => void;
  onDeleteSingleReading: (readingId: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
  language: LanguageOption;
  locale: string;
  settings: AppSettings;
}> = ({
  session,
  isExpanded,
  onToggleExpand,
  onEditReading,
  onDeleteSingleReading,
  t,
  language,
  locale,
  settings,
}) => {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const isLongPressRef = useRef<boolean>(false);

  const primaryReading = session.readings[0];
  const effectiveReadings = getEffectiveSessionReadings(session);
  const isMulti = session.readings.length > 1;
  const sessionAssessment = getHealthAssessment(
    session.averageSystolic,
    session.averageDiastolic,
    session.averageHeartRate,
    language,
    settings.guidelineProfile
  );
  const treatmentTargetAssessment = getSessionMedicationContext(session.readings, settings.takesAntihypertensiveMedication) ? assessTreatmentTarget(session.averageSystolic, session.averageDiastolic, settings) : null;
  const { category, culprit, safetyAlerts } = sessionAssessment;
  const healthAlerts = [
    ...sessionAssessment.alerts,
    ...getConfirmedPulsePressureAlerts(effectiveReadings, language),
  ];

  const dateObj = new Date(session.timestamp);
  const shortDateStr = dateObj.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const longDateStr = dateObj.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = dateObj.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const startTimer = (x: number, y: number) => {
    touchStartPosRef.current = { x, y };
    pressStartTimeRef.current = Date.now();
    isLongPressRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onEditReading(primaryReading);
    }, 450);
  };

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    cancelTimer();
    if (!isLongPressRef.current) {
      const duration = Date.now() - pressStartTimeRef.current;
      if (duration < 380) {
        setIsDetailsExpanded((prev) => !prev);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startTimer(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartPosRef.current && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - touchStartPosRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartPosRef.current.y);
      if (dx > 10 || dy > 10) {
        cancelTimer();
        isLongPressRef.current = true;
      }
    }
  };

  return (
    <div
      className={`session-item ${isMulti ? 'session-multi' : ''} ${isDetailsExpanded ? 'session-details-expanded' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handlePointerUp}
      onTouchCancel={cancelTimer}
      onMouseDown={(e) => { if (e.button === 0) startTimer(e.clientX, e.clientY); }}
      onMouseUp={handlePointerUp}
      onMouseLeave={cancelTimer}
      onDoubleClick={() => { cancelTimer(); onEditReading(primaryReading); }}
      onContextMenu={(e) => { e.preventDefault(); cancelTimer(); onEditReading(primaryReading); }}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', cursor: 'pointer' }}
    >
      <div className="session-main-row">
        {/* Fila principal unexpanded: Fecha/Hora - Datos - Nota - Etiqueta Gris */}
        <div className="session-unexpanded-row">
          <div className="session-time-col">
            <div className="session-date">
              <span className="session-date-long">{longDateStr}</span>
              <span className="session-date-short">{shortDateStr}</span>
            </div>
            <div className="session-time"><Clock size={12} /> {timeStr}</div>
          </div>

          <div className="session-metrics-col">
            <div className="bp-reading-display">
              <span className="sys-num">{session.averageSystolic}</span><span className="slash">/</span><span className="dia-num">{session.averageDiastolic}</span><span className="slash">/</span><span className="pulse-num">{session.averageHeartRate}</span>
            </div>
          </div>

          {session.notes && (
            <div className="session-notes-col">
              <span className="notes-preview">"{session.notes}"</span>
            </div>
          )}

          {isMulti && (
            <div className="session-multi-toggle-block" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggleExpand(session.id); }} className="session-readings-toggle" title={isExpanded ? t('list.collapseReadings') : t('list.expandReadings')}>
                <ShieldCheck size={12} /><span>{session.readings.length}</span>{isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            </div>
          )}
        </div>

        {/* Fila secundaria desplegable mediante clic corto (detalles extendidos) */}
        {isDetailsExpanded && (
          <div className="session-details-expanded-row">
            <div className="session-block session-guideline-block">
              <span
                className="category-pill"
                style={{ backgroundColor: category.badgeBg, color: category.badgeText }}
                title={category.description}
              >
                <span className="dot" style={{ backgroundColor: category.colorHex }}></span>
                {category.name}
              </span>
              {(culprit !== 'none' || healthAlerts.length > 0 || safetyAlerts.length > 0) && (
                <div className="session-info-lines">
                  {culprit !== 'none' && <span className="session-info-line">{getCulpritLabel(culprit, category.direction, language)}</span>}
                  {healthAlerts.map((alert) => (
                    <span key={alert.key} className="session-info-line" title={alert.description}>{alert.name}</span>
                  ))}
                  {safetyAlerts.map((alert) => (
                    <span key={alert.key} className="session-info-line session-safety-text" role="alert"><strong>{alert.name}</strong><span>{alert.description}</span></span>
                  ))}
                </div>
              )}
            </div>

            {treatmentTargetAssessment && <div className="session-block session-target-block"><TreatmentTargetBadge assessment={treatmentTargetAssessment} /></div>}

            <div className="session-block session-details-col">
              <span className="arm-badge">
                <Armchair size={12} /> {t('list.arm')}: {session.arm === 'left' ? t('form.armLeft') : t('form.armRight')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Desglose desplegable de tomas de la sesión de bata blanca */}
      {isExpanded && isMulti && (
        <div className="session-expanded-details" onClick={(e) => e.stopPropagation()}>
          <div className="expanded-banner-info">
            <AlertCircle size={14} />
            <span>
              {t('list.readingsCount', { count: session.readings.length })}{' '}
              {session.discardedCount > 0 &&
                `(${t('list.whiteCoatDiscarded', { count: session.discardedCount })})`}
            </span>
          </div>

          <table className="expanded-readings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{language === 'en' ? 'Time' : 'Hora'}</th>
                <th>{language === 'en' ? 'Values' : 'Medición'}</th>
                <th>{language === 'en' ? 'Status' : 'Estado'}</th>
                <th>{language === 'en' ? 'Actions' : 'Acciones'}</th>
              </tr>
            </thead>
            <tbody>
              {session.readings.map((r, index) => {
                const rTime = new Date(r.timestamp).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                const isDiscarded = index < session.discardedCount;

                return (
                  <BreakdownRow
                    key={r.id}
                    reading={r}
                    index={index}
                    isDiscarded={isDiscarded}
                    rTime={rTime}
                    language={language}
                    settings={settings}
                    onEditReading={onEditReading}
                    onDeleteSingleReading={onDeleteSingleReading}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const ReadingList: React.FC<ReadingListProps> = ({
  sessions,
  onDeleteSession,
  onDeleteSingleReading,
  onEditReading,
  dateRange,
  onDateRangeChange,
  settings,
}) => {
  const { t, language } = useLanguage();
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const filteredSessions = filterSessionsByDateRange(sessions, dateRange);

  const toggleExpand = (id: string) => {
    setExpandedSessionId(expandedSessionId === id ? null : id);
  };

  const toggleHistory = () => {
    if (isHistoryExpanded) setExpandedSessionId(null);
    setIsHistoryExpanded(!isHistoryExpanded);
  };

  const locale = language === 'en' ? 'en-US' : 'es-ES';

  return (
    <div className="card list-card">
      <div className={`list-header${isHistoryExpanded ? '' : ' collapsed'}`}>
        <div className="list-title-container">
          <div className="list-title">
            <History size={20} className="icon-history" />
            <h2>{t('list.title')}</h2>
            <span className="count-badge">{filteredSessions.length}</span>
            <button
              type="button"
              className="history-toggle-button"
              aria-expanded={isHistoryExpanded}
              aria-controls="history-measurement-details"
              aria-label={t(isHistoryExpanded ? 'list.collapseHistory' : 'list.expandHistory')}
              title={t(isHistoryExpanded ? 'list.collapseHistory' : 'list.expandHistory')}
              onClick={toggleHistory}
            >
              {isHistoryExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {isHistoryExpanded && <p className="list-edit-hint">{t('list.editHint')}</p>}
        </div>

        {/* Filtros de Rango de Fecha */}
        <div className="filter-chips">
          <button
            type="button"
            className={`chip ${dateRange.preset === '7days' ? 'active' : ''}`}
            onClick={() => onDateRangeChange({ preset: '7days' })}
          >
            {t('list.preset7Days')}
          </button>
          <button
            type="button"
            className={`chip ${dateRange.preset === '1month' ? 'active' : ''}`}
            onClick={() => onDateRangeChange({ preset: '1month' })}
          >
            {t('list.preset1Month')}
          </button>
          <button
            type="button"
            className={`chip ${dateRange.preset === '3months' ? 'active' : ''}`}
            onClick={() => onDateRangeChange({ preset: '3months' })}
          >
            {t('list.preset3Months')}
          </button>
          <button
            type="button"
            className={`chip ${dateRange.preset === 'all' ? 'active' : ''}`}
            onClick={() => onDateRangeChange({ preset: 'all' })}
          >
            {t('list.presetAll')}
          </button>
        </div>
      </div>

      {isHistoryExpanded && (
        <div id="history-measurement-details">
          {filteredSessions.length === 0 ? (
            <div className="empty-state">
              <p>{t('list.emptyState')}</p>
            </div>
          ) : (
            <div className="sessions-list">
              {filteredSessions.map((session) => (
                <SessionCardItem
                  key={session.id}
                  session={session}
                  isExpanded={expandedSessionId === session.id}
                  onToggleExpand={toggleExpand}
                  onEditReading={onEditReading}
                  onDeleteSession={onDeleteSession}
                  onDeleteSingleReading={onDeleteSingleReading}
                  t={t}
                  language={language}
                  locale={locale}
                  settings={settings}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
