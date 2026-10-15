import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PlusCircle, Activity, FileText, Info, X, ClipboardCheck, Keyboard, CircleDot, Repeat2, AlertTriangle } from 'lucide-react';
import type { ArmPosition, AppSettings, BloodPressureReading, InputMode } from '../types/bloodPressure';
import { getHealthAssessment } from '../utils/healthClassification';
import {
  getReadingValidationError,
  hasSimilarConfirmedReadingToday,
  isReadingMetricPlausible,
  needsPulsePressureConfirmation,
  READING_LIMITS,
  type ReadingValues,
} from '../utils/readingValidation';
import { WheelPicker } from './WheelPicker';
import { useLanguage } from '../i18n/useLanguage';
import { assessTreatmentTarget } from '../utils/treatmentTarget';
import { TreatmentTargetBadge } from './TreatmentTargetBadge';

interface ReadingFormProps {
  onAddReading: (reading: {
    systolic: number;
    diastolic: number;
    heartRate: number;
    arm: ArmPosition;
    notes?: string;
    pulsePressureWarningConfirmed?: boolean;
  }) => void | Promise<void>;
  settings: AppSettings;
  onUpdateInputMode?: (mode: InputMode) => void;
  readings: BloodPressureReading[];
  // Cambia con cada transición de sesión (acceso, cierre o invalidación): al
  // cambiar reinicia los valores tecleados y la confirmación de presión de pulso
  // del usuario anterior, que no pueden quedar visibles para el siguiente.
  sessionResetToken?: number;
}

const DRAFT_RESET_DELAY_MS = 5000;
const ALERT_LEVEL_PRIORITY = { info: 0, caution: 1, warning: 2, urgent: 3 } as const;
const REFERENCE_READING: ReadingValues = { systolic: 115, diastolic: 65, heartRate: 60 };

export const ReadingForm: React.FC<ReadingFormProps> = ({
  onAddReading,
  settings,
  onUpdateInputMode,
  readings,
  sessionResetToken,
}) => {
  const { t, language } = useLanguage();
  const [inputMode, setInputMode] = useState<InputMode>(settings.preferredInputMode || 'keyboard');

  const [systolic, setSystolic] = useState<number | ''>('');
  const [diastolic, setDiastolic] = useState<number | ''>('');
  const [heartRate, setHeartRate] = useState<number | ''>('');
  const [plausibleReading, setPlausibleReading] = useState<ReadingValues>({ ...REFERENCE_READING });
  const [assessedReading, setAssessedReading] = useState<ReadingValues>({ ...REFERENCE_READING });
  const [arm, setArm] = useState<ArmPosition>(settings.defaultArm || 'left');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);
  const [isMeasurementGuideOpen, setIsMeasurementGuideOpen] = useState(false);
  const [pendingReading, setPendingReading] = useState<(ReadingValues & {
    arm: ArmPosition;
    notes?: string;
  }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const draftResetTimerRef = useRef<number | null>(null);
  const sessionGenerationRef = useRef(0);
  const saveFeedbackTimerRef = useRef<number | null>(null);

  const activeInputMode = settings.preferredInputMode || inputMode;

  // Sincronizar brazo y modo de entrada predeterminado si cambia la configuración
  useEffect(() => {
    setArm(settings.defaultArm || 'left');
    if (settings.preferredInputMode) {
      setInputMode(settings.preferredInputMode);
    }
  }, [settings.defaultArm, settings.preferredInputMode]);

  useEffect(() => () => {
    if (draftResetTimerRef.current !== null) {
      window.clearTimeout(draftResetTimerRef.current);
    }
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (getReadingValidationError(plausibleReading) === null) {
      setAssessedReading(plausibleReading);
    }
  }, [plausibleReading]);

  const clearDraftResetTimer = () => {
    if (draftResetTimerRef.current !== null) {
      window.clearTimeout(draftResetTimerRef.current);
      draftResetTimerRef.current = null;
    }
  };

  const scheduleDraftReset = () => {
    clearDraftResetTimer();
    draftResetTimerRef.current = window.setTimeout(() => {
      setSystolic('');
      setDiastolic('');
      setHeartRate('');
      setPlausibleReading({ ...REFERENCE_READING });
      setAssessedReading({ ...REFERENCE_READING });
      setNotes('');
      setPendingReading(null);
      setErrorMsg(null);
      setValidationNotice(null);
      draftResetTimerRef.current = null;
    }, DRAFT_RESET_DELAY_MS);
  };

  const clearSaveFeedbackTimer = () => {
    if (saveFeedbackTimerRef.current !== null) {
      window.clearTimeout(saveFeedbackTimerRef.current);
      saveFeedbackTimerRef.current = null;
    }
  };

  // Cerrar un diálogo devuelve el formulario a su estado normal, así que el
  // borrador vuelve a caducar por inactividad.
  const dismissValidationNotice = () => {
    setValidationNotice(null);
    scheduleDraftReset();
  };

  const cancelPendingReading = () => {
    setPendingReading(null);
    scheduleDraftReset();
  };

  // Cambio de sesión: los valores tecleados y la confirmación de presión de pulso
  // pertenecen al usuario anterior. El formulario permanece montado entre
  // sesiones, así que hay que reiniciarlos con el mismo criterio de sesión que el
  // resto de la interfaz ligada a la sesión.
  useEffect(() => {
    sessionGenerationRef.current += 1;
    clearDraftResetTimer();
    clearSaveFeedbackTimer();
    setSystolic('');
    setDiastolic('');
    setHeartRate('');
    setPlausibleReading({ ...REFERENCE_READING });
    setAssessedReading({ ...REFERENCE_READING });
    setNotes('');
    setPendingReading(null);
    setErrorMsg(null);
    setValidationNotice(null);
    setJustSaved(false);
    setIsSaving(false);
  }, [sessionResetToken]);

  const { systolic: liveSystolic, diastolic: liveDiastolic, heartRate: liveHeartRate } = assessedReading;
  const { category, alerts: healthAlerts, safetyAlerts } = getHealthAssessment(
    liveSystolic,
    liveDiastolic,
    liveHeartRate,
    language,
    settings.guidelineProfile
  );
  const formAlerts = settings.showInformationalLabels
    ? [...safetyAlerts, ...healthAlerts]
    : safetyAlerts;
  const primaryFormAlert = formAlerts.reduce(
    (primary, alert) => ALERT_LEVEL_PRIORITY[alert.level] > ALERT_LEVEL_PRIORITY[primary.level] ? alert : primary,
    formAlerts[0]
  );
  // Un aviso sin texto propio (por ejemplo, «Hipertensión grave») no tiene nada que
  // desplegar: se muestra como etiqueta simple, sin capa superpuesta.
  const alertText = (alert: (typeof formAlerts)[number]) =>
    alert.description.trim() ? `${alert.name}: ${alert.description}` : alert.name;
  const alertsWithDescription = formAlerts.filter((alert) => alert.description.trim() !== '');
  const treatmentTargetAssessment = settings.takesAntihypertensiveMedication
    ? assessTreatmentTarget(liveSystolic, liveDiastolic, settings)
    : null;
  // Mientras hay un diálogo abierto, el formulario de fondo queda inerte: no
  // recibe foco ni clics, así que no puede alterar el borrador que el usuario
  // está confirmando.
  const isDialogOpen = Boolean(validationNotice || pendingReading);

  // Auto-seleccionar todo el texto al tocar/enfocar un campo numérico
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleToggleInputMode = (newMode: InputMode) => {
    if (isSaving) return;
    setInputMode(newMode);
    if (onUpdateInputMode) {
      onUpdateInputMode(newMode);
    }
  };

  const saveReading = async (
    reading: ReadingValues & { arm: ArmPosition; notes?: string },
    pulsePressureWarningConfirmed: boolean
  ) => {
    if (isSaving) return;
    const sessionGeneration = sessionGenerationRef.current;
    clearDraftResetTimer();
    clearSaveFeedbackTimer();
    setIsSaving(true);
    try {
      await Promise.resolve(onAddReading({
        ...reading,
        pulsePressureWarningConfirmed,
      }));
      if (sessionGeneration !== sessionGenerationRef.current) return;
      setSystolic('');
      setDiastolic('');
      setHeartRate('');
      setPlausibleReading({ ...REFERENCE_READING });
      setAssessedReading({ ...REFERENCE_READING });
      setNotes('');
      setPendingReading(null);
      setValidationNotice(null);
      setJustSaved(true);
      saveFeedbackTimerRef.current = window.setTimeout(() => {
        setJustSaved(false);
        setIsSaving(false);
        saveFeedbackTimerRef.current = null;
      }, 1100);
    } catch (error) {
      if (sessionGeneration !== sessionGenerationRef.current) return;
      setIsSaving(false);
      setErrorMsg(t('form.saveError'));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearDraftResetTimer();
    setErrorMsg(null);
    setValidationNotice(null);
    setPendingReading(null);

    const values: ReadingValues = {
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
    };
    const validationError = getReadingValidationError(values);
    if (validationError) {
      setValidationNotice(t(validationError === 'diastolicNotLower' ? 'form.diastolicMustBeLower' : 'form.validationAlert'));
      return;
    }

    const candidate = {
      ...values,
      arm,
      notes: notes.trim() ? notes.trim() : undefined,
    };
    if (needsPulsePressureConfirmation(values)) {
      if (hasSimilarConfirmedReadingToday(readings, values)) {
        saveReading(candidate, true);
      } else {
        setPendingReading(candidate);
      }
      return;
    }
    void saveReading(candidate, false);
  };

  return (
    <div className="card form-card">
      <div className="form-header">
        <div className="form-title-left">
          <Activity className="icon-pulse" size={20} />
          <h2>{t('form.title')}</h2>
        </div>

        <div className="form-controls-wrapper">
          {/* Selector de Brazo (Switch) */}
          <button
            type="button"
            className="arm-chip active btn-switch"
            onClick={() => {
              if (isSaving) return;
              setArm((prev) => (prev === 'left' ? 'right' : 'left'));
              scheduleDraftReset();
            }}
            disabled={isSaving}
            title={t('form.armLabel')}
          >
            <span>{language === 'en' ? (arm === 'left' ? 'L' : 'R') : (arm === 'left' ? 'Izq.' : 'Dcho.')}</span>
          </button>

          {/* Conmutador Modo Entrada (Switch) */}
          <button
            type="button"
            className="btn-mode-chip active btn-switch"
            onClick={() => handleToggleInputMode(activeInputMode === 'keyboard' ? 'wheel' : 'keyboard')}
            disabled={isSaving}
            title={activeInputMode === 'keyboard' ? t('form.modeKeyboard') : t('form.modeWheel')}
            aria-label={activeInputMode === 'keyboard' ? t('form.modeKeyboard') : t('form.modeWheel')}
          >
            {activeInputMode === 'keyboard' ? <Keyboard size={17} /> : <CircleDot size={17} />}
          </button>
        </div>
      </div>

      {errorMsg && <div className="alert-danger">{errorMsg}</div>}

      <form onSubmit={handleSubmit} className="bp-form" noValidate aria-busy={isSaving} inert={isDialogOpen}>
        {activeInputMode === 'keyboard' ? (
          /* Modo 1: Introducción mediante Teclado Numérico */
          <div className="metrics-inputs-grid">
            <div className="input-group">
              <label htmlFor="systolic-input">
                <span className="metric-label-full">{t('form.systolic')}</span>
                <span className="metric-label-compact">{t('form.systolicShort')}</span>
                <span className="unit">(mmHg)</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="systolic-input"
                  type="number"
                  min={READING_LIMITS.systolic.min}
                  max={READING_LIMITS.systolic.max}
                  value={systolic}
                  placeholder="115"
                  onChange={(e) => {
                    if (isSaving) return;
                    setPendingReading(null);
                    const nextValue = e.target.value === '' ? '' : Number(e.target.value);
                    setSystolic(nextValue);
                    if (isReadingMetricPlausible('systolic', nextValue)) {
                      setPlausibleReading((current) => ({ ...current, systolic: nextValue }));
                    }
                    scheduleDraftReset();
                  }}
                  onFocus={handleFocus}
                  className="input-number input-sys"
                  disabled={isSaving}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="diastolic-input">
                <span className="metric-label-full">{t('form.diastolic')}</span>
                <span className="metric-label-compact">{t('form.diastolicShort')}</span>
                <span className="unit">(mmHg)</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="diastolic-input"
                  type="number"
                  min={READING_LIMITS.diastolic.min}
                  max={READING_LIMITS.diastolic.max}
                  value={diastolic}
                  placeholder="65"
                  onChange={(e) => {
                    if (isSaving) return;
                    setPendingReading(null);
                    const nextValue = e.target.value === '' ? '' : Number(e.target.value);
                    setDiastolic(nextValue);
                    if (isReadingMetricPlausible('diastolic', nextValue)) {
                      setPlausibleReading((current) => ({ ...current, diastolic: nextValue }));
                    }
                    scheduleDraftReset();
                  }}
                  onFocus={handleFocus}
                  className="input-number input-dia"
                  disabled={isSaving}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="pulse-input">
                <span className="metric-label-full">{t('form.heartRate')}</span>
                <span className="metric-label-compact">{t('form.heartRateShort')}</span>
                <span className="unit">({language === 'en' ? 'BPM' : 'ppm'})</span>
              </label>
              <div className="input-wrapper">
                <input
                  id="pulse-input"
                  type="number"
                  min={READING_LIMITS.heartRate.min}
                  max={READING_LIMITS.heartRate.max}
                  value={heartRate}
                  placeholder="60"
                  onChange={(e) => {
                    if (isSaving) return;
                    setPendingReading(null);
                    const nextValue = e.target.value === '' ? '' : Number(e.target.value);
                    setHeartRate(nextValue);
                    if (isReadingMetricPlausible('heartRate', nextValue)) {
                      setPlausibleReading((current) => ({ ...current, heartRate: nextValue }));
                    }
                    scheduleDraftReset();
                  }}
                  onFocus={handleFocus}
                  className="input-number input-pulse"
                  disabled={isSaving}
                  required
                />
              </div>
            </div>
          </div>
        ) : (
          /* Modo 2: Ruleta Táctil de Selección Rápida */
          <div className={`wheel-mode-container ${isSaving ? 'is-saving' : ''}`}>
            <WheelPicker
              systolic={systolic}
              diastolic={diastolic}
              heartRate={heartRate}
              onChangeSystolic={(value) => { if (isSaving) return; setPendingReading(null); setSystolic(value); setPlausibleReading((current) => ({ ...current, systolic: value })); scheduleDraftReset(); }}
              onChangeDiastolic={(value) => { if (isSaving) return; setPendingReading(null); setDiastolic(value); setPlausibleReading((current) => ({ ...current, diastolic: value })); scheduleDraftReset(); }}
              onChangeHeartRate={(value) => { if (isSaving) return; setPendingReading(null); setHeartRate(value); setPlausibleReading((current) => ({ ...current, heartRate: value })); scheduleDraftReset(); }}
            />
          </div>
        )}

        {/* Campo de Nota Opcional a todo el ancho disponible */}
        <div className="form-notes-fullwidth" style={{ marginBottom: '20px' }}>
          <div className="input-wrapper-notes">
            <FileText size={16} className="notes-icon" />
            <input
              type="text"
              value={notes}
              onChange={(e) => { if (isSaving) return; setNotes(e.target.value); scheduleDraftReset(); }}
              placeholder={t('form.notesPlaceholder')}
              className="input-notes"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="reading-submit-row">
          <button type="submit" className={`btn-submit-reading ${justSaved ? 'is-saved' : ''}`} disabled={isSaving}>
            {justSaved ? <ClipboardCheck size={20} /> : <PlusCircle size={20} />}
            <span className="submit-reading-label">
              <span>{t('form.submit')}</span>
              {settings.enableWhiteCoatFilter && (
                <small>{t('form.whiteCoatFilterActive')}</small>
              )}
            </span>
          </button>
          <button
            type="button"
            className="btn-measurement-guide"
            title={t('form.measurementGuideTooltip')}
            aria-label={t('form.measurementGuideTooltip')}
            onClick={() => setIsMeasurementGuideOpen(true)}
          >
            <Info size={22} />
          </button>
        </div>

        <div className="reading-info-area">
          <div
            className={`reading-alerts-row ${primaryFormAlert?.level === 'urgent' ? 'is-urgent' : ''}`}
            aria-live={primaryFormAlert?.level === 'urgent' ? 'assertive' : 'polite'}
            aria-label={formAlerts.map(alertText).join('. ') || undefined}
            title={formAlerts.map(alertText).join('\n') || undefined}
          >
            {primaryFormAlert && (
              <>
                {alertsWithDescription.length > 0 ? (
                  <details className="clinical-alert-details">
                    <summary
                      className="clinical-alert-pill"
                      data-alert-key={primaryFormAlert.key}
                      style={{ backgroundColor: primaryFormAlert.badgeBg, color: primaryFormAlert.badgeText }}
                    >
                      <span className="dot" style={{ backgroundColor: primaryFormAlert.colorHex }}></span>
                      <span className="health-alert-name">{primaryFormAlert.name}</span>
                    </summary>
                    <div className="clinical-alert-popover">
                      {alertsWithDescription.map((alert) => (
                        <div className="clinical-alert-detail" key={alert.key}>
                          <strong>{alert.name}</strong>
                          <span>{alert.description}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : (
                  <span
                    className="clinical-alert-pill"
                    data-alert-key={primaryFormAlert.key}
                    style={{ backgroundColor: primaryFormAlert.badgeBg, color: primaryFormAlert.badgeText }}
                  >
                    <span className="dot" style={{ backgroundColor: primaryFormAlert.colorHex }}></span>
                    <span className="health-alert-name">{primaryFormAlert.name}</span>
                  </span>
                )}
                {formAlerts.length > 1 && (
                  <span className="health-alert-count" aria-hidden="true">+{formAlerts.length - 1}</span>
                )}
              </>
            )}
          </div>
          <div className="reading-labels-row">
            {settings.showInformationalLabels && <div className="classification-badges">
              <div className="live-category-badge" style={{ backgroundColor: category.badgeBg, color: category.badgeText }} title={category.description}>
                <span className="dot" style={{ backgroundColor: category.colorHex }}></span>{category.name}
              </div>
              {treatmentTargetAssessment && <TreatmentTargetBadge assessment={treatmentTargetAssessment} live />}
              {!treatmentTargetAssessment && <span className="live-category-badge is-placeholder" aria-hidden="true"><span className="dot"></span>{category.name}</span>}
            </div>}
          </div>
        </div>
      </form>
      {validationNotice && createPortal(
        <div
          className="modal-overlay form-alert-overlay"
          onClick={dismissValidationNotice}
          onKeyDown={(event) => {
            if (event.key === 'Escape') dismissValidationNotice();
          }}
        >
          <div
            className="modal-content form-alert-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="form-alert-title"
            aria-describedby="form-alert-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <AlertTriangle size={26} className="modal-icon form-alert-icon" />
                <h2 id="form-alert-title" className="legal-modal-title">
                  {t('form.validationTitle')}
                </h2>
              </div>
            </div>
            <div className="modal-body">
              <p id="form-alert-message" className="form-alert-message">{validationNotice}</p>
            </div>
            <div className="modal-actions-row">
              <div className="modal-actions-right">
                <button type="button" className="btn-alert-accept" autoFocus onClick={dismissValidationNotice}>
                  {t('form.validationAccept')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingReading && createPortal(
        <div
          className="modal-overlay pulse-pressure-overlay"
          onClick={() => {
            if (!isSaving) cancelPendingReading();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !isSaving) cancelPendingReading();
          }}
        >
          <div
            className="modal-content pulse-pressure-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pulse-pressure-title"
            aria-describedby="pulse-pressure-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <Repeat2 size={26} className="modal-icon pulse-pressure-icon" />
                <h2 id="pulse-pressure-title" className="legal-modal-title">
                  {t('form.pulsePressureTitle')}
                </h2>
              </div>
            </div>
            <div className="modal-body">
              <p id="pulse-pressure-message">
                {t('form.pulsePressureWarning', {
                  value: pendingReading.systolic - pendingReading.diastolic,
                })}
              </p>
            </div>
            <div className="modal-actions-row">
              <button type="button" className="btn-cancel-warning" autoFocus onClick={cancelPendingReading} disabled={isSaving}>
                {t('form.cancel')}
              </button>
              <div className="modal-actions-right">
                <button type="button" className="btn-force-save" onClick={() => saveReading(pendingReading, true)} disabled={isSaving}>
                  {t('form.forceSave')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {isMeasurementGuideOpen && createPortal(
        <div className="modal-overlay measurement-guide-overlay" onClick={() => setIsMeasurementGuideOpen(false)}>
          <div
            className="modal-content measurement-guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="measurement-guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <Info size={26} className="modal-icon text-blue legal-icon-main" />
                <h2 id="measurement-guide-title" className="legal-modal-title">
                  {t('form.measurementGuideTitle')}
                </h2>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                aria-label={t('form.measurementGuideClose')}
                onClick={() => setIsMeasurementGuideOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body measurement-guide-body">
              <div className="settings-subcard measurement-guide-main-card">
                <div className="field-label measurement-guide-section-title">
                  <ClipboardCheck size={22} className="legal-icon-block" />
                  <span>{t('form.measurementGuideEssentialsTitle')}</span>
                </div>
                <p className="measurement-guide-intro">
                  {t('form.measurementGuideIntro')}{' '}
                  <strong>{t('form.measurementGuideIntroStrong')}</strong>:
                </p>
                <ul className="measurement-guide-list">
                  <li>{t('form.measurementGuideSameArm')}</li>
                  <li><strong>{t('form.measurementGuidePreparationTitle')}</strong> {t('form.measurementGuidePreparation')}</li>
                  <li><strong>{t('form.measurementGuideRestTitle')}</strong> {t('form.measurementGuideRest')}</li>
                  <li><strong>{t('form.measurementGuidePostureTitle')}</strong> {t('form.measurementGuidePosture')}</li>
                  <li><strong>{t('form.measurementGuideArmTitle')}</strong> {t('form.measurementGuideArm')}</li>
                  <li><strong>{t('form.measurementGuideDuringTitle')}</strong> {t('form.measurementGuideDuring')}</li>
                </ul>
              </div>
              <div className="settings-subcard measurement-guide-advice-card">
                <div className="field-label measurement-guide-advice-title">
                  <Repeat2 size={22} className="legal-icon-block" />
                  <span>{t('form.measurementGuideAdviceTitle')}</span>
                </div>
                <ul className="measurement-guide-list measurement-guide-advice-list">
                  <li>{t('form.measurementGuideMorningEvening')}</li>
                  <li>
                    {t('form.measurementGuideAdviceStart')}{' '}
                    <strong>{t('form.measurementGuideAdviceStrong')}</strong>, {t('form.measurementGuideAdviceEnd')}{' '}
                    ({t('form.measurementGuideAdviceAlternative')} <em>{t('form.measurementGuideFilter')}</em>{' '}
                    {t('form.measurementGuideFilterEnd')})
                  </li>
                  <li><strong>{t('form.measurementGuideFollowUpTitle')}</strong> {t('form.measurementGuideFollowUp')}</li>
                  <li><strong>{t('form.measurementGuideAssessmentTitle')}</strong> {t('form.measurementGuideAssessment')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
