import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PlusCircle, Activity, FileText, AlertCircle, Info, X, ClipboardCheck, Repeat2 } from 'lucide-react';
import type { ArmPosition, AppSettings, BloodPressureReading, InputMode } from '../types/bloodPressure';
import { getHealthAssessment } from '../utils/healthClassification';
import {
  getReadingValidationError,
  hasSimilarConfirmedReadingToday,
  needsPulsePressureConfirmation,
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
  lastReading?: BloodPressureReading | null;
  readings: BloodPressureReading[];
}

export const ReadingForm: React.FC<ReadingFormProps> = ({
  onAddReading,
  settings,
  onUpdateInputMode,
  lastReading,
  readings,
}) => {
  const { t, language } = useLanguage();
  const [inputMode, setInputMode] = useState<InputMode>(settings.preferredInputMode || 'keyboard');

  // Inicializar los valores centrados en la última medición realizada o en valores medios por defecto (120 / 80 / 72)
  const initialSys = lastReading ? lastReading.systolic : 120;
  const initialDia = lastReading ? lastReading.diastolic : 80;
  const initialPulse = lastReading ? lastReading.heartRate : 72;

  const [systolic, setSystolic] = useState<number | ''>(initialSys);
  const [diastolic, setDiastolic] = useState<number | ''>(initialDia);
  const [heartRate, setHeartRate] = useState<number | ''>(initialPulse);
  const [arm, setArm] = useState<ArmPosition>(settings.defaultArm || 'left');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMeasurementGuideOpen, setIsMeasurementGuideOpen] = useState(false);
  const [pendingReading, setPendingReading] = useState<(ReadingValues & {
    arm: ArmPosition;
    notes?: string;
  }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const activeInputMode = settings.preferredInputMode || inputMode;

  // Sincronizar brazo y modo de entrada predeterminado si cambia la configuración
  useEffect(() => {
    setArm(settings.defaultArm || 'left');
    if (settings.preferredInputMode) {
      setInputMode(settings.preferredInputMode);
    }
  }, [settings.defaultArm, settings.preferredInputMode]);

  const liveSystolic = typeof systolic === 'number' ? systolic : 120;
  const liveDiastolic = typeof diastolic === 'number' ? diastolic : 80;
  const liveHeartRate = typeof heartRate === 'number' ? heartRate : 72;
  const { category, alerts: healthAlerts, safetyAlerts } = getHealthAssessment(
    liveSystolic,
    liveDiastolic,
    liveHeartRate,
    language,
    settings.guidelineProfile
  );
  const treatmentTargetAssessment = settings.takesAntihypertensiveMedication
    ? assessTreatmentTarget(liveSystolic, liveDiastolic, settings)
    : null;

  // Auto-seleccionar todo el texto al tocar/enfocar un campo numérico
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleToggleInputMode = (newMode: InputMode) => {
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
    setIsSaving(true);
    try {
      await Promise.resolve(onAddReading({
        ...reading,
        pulsePressureWarningConfirmed,
      }));
      setSystolic(120);
      setDiastolic(80);
      setHeartRate(60);
      setNotes('');
      setPendingReading(null);
      setJustSaved(true);
      window.setTimeout(() => {
        setJustSaved(false);
        setIsSaving(false);
      }, 1100);
    } catch (error) {
      setIsSaving(false);
      throw error;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPendingReading(null);

    const values: ReadingValues = {
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      heartRate: Number(heartRate),
    };
    const validationError = getReadingValidationError(values);
    if (validationError) {
      setErrorMsg(t(validationError === 'diastolicNotLower' ? 'form.diastolicMustBeLower' : 'form.validationAlert'));
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
    saveReading(candidate, false);
  };

  return (
    <div className="card form-card">
      <div className="form-header">
        <div className="form-title-group">
          <div className="form-title-left">
            <Activity className="icon-pulse" size={20} />
            <h2>{t('form.title')}</h2>
          </div>

          {/* Badge de clasificación en tiempo real */}
          <div className="classification-badges">
            <div
              className="live-category-badge"
              style={{ backgroundColor: category.badgeBg, color: category.badgeText }}
              title={category.description}
            >
              <span className="dot" style={{ backgroundColor: category.colorHex }}></span>
              {category.name}
            </div>
            {treatmentTargetAssessment && <TreatmentTargetBadge assessment={treatmentTargetAssessment} live />}
          </div>
        </div>

        <div className="form-controls-wrapper">
          {/* Selector de Brazo (Switch) */}
          <button
            type="button"
            className="arm-chip active btn-switch"
            onClick={() => setArm((prev) => (prev === 'left' ? 'right' : 'left'))}
            title={t('form.armLabel')}
          >
            <span>{arm === 'left' ? t('form.armLeft') : t('form.armRight')}</span>
            <Repeat2 size={14} className="switch-icon" />
          </button>

          {/* Conmutador Modo Entrada (Switch) */}
          <button
            type="button"
            className="btn-mode-chip active btn-switch"
            onClick={() => handleToggleInputMode(activeInputMode === 'keyboard' ? 'wheel' : 'keyboard')}
            title="Cambiar modo de entrada"
          >
            <span>{activeInputMode === 'keyboard' ? t('form.modeKeyboard') : t('form.modeWheel')}</span>
            <Repeat2 size={14} className="switch-icon" />
          </button>
        </div>
      </div>

      {errorMsg && <div className="alert-danger">{errorMsg}</div>}

      {safetyAlerts.map((alert) => (
        <div key={alert.key} className="safety-alert-card" role="alert" aria-live="assertive">
          <div className="safety-alert-title">
            <AlertCircle size={18} />
            <strong>{alert.name}</strong>
          </div>
          <p>{alert.description}</p>
        </div>
      ))}

      {healthAlerts.length > 0 && (
        <div className="health-alerts-strip" aria-live="polite">
          <div className="health-alerts-heading">
            <AlertCircle size={16} />
            <span>{t('healthAlerts.title')}</span>
          </div>
          <div className="health-alerts-badges">
            {healthAlerts.map((alert) => (
              <span
                key={alert.key}
                className="clinical-alert-pill"
                style={{ backgroundColor: alert.badgeBg, color: alert.badgeText }}
                title={alert.description}
              >
                <span className="dot" style={{ backgroundColor: alert.colorHex }}></span>
                {alert.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bp-form">
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
                  min={50}
                  max={260}
                  value={systolic}
                  onChange={(e) => {
                    setPendingReading(null);
                    setSystolic(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  }}
                  onFocus={handleFocus}
                  className="input-number input-sys"
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
                  min={30}
                  max={160}
                  value={diastolic}
                  onChange={(e) => {
                    setPendingReading(null);
                    setDiastolic(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  }}
                  onFocus={handleFocus}
                  className="input-number input-dia"
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
                  min={30}
                  max={220}
                  value={heartRate}
                  onChange={(e) => {
                    setPendingReading(null);
                    setHeartRate(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                  }}
                  onFocus={handleFocus}
                  className="input-number input-pulse"
                  required
                />
              </div>
            </div>
          </div>
        ) : (
          /* Modo 2: Ruleta Táctil de Selección Rápida */
          <div className="wheel-mode-container">
            <WheelPicker
              systolic={typeof systolic === 'number' ? systolic : 120}
              diastolic={typeof diastolic === 'number' ? diastolic : 80}
              heartRate={typeof heartRate === 'number' ? heartRate : 72}
              onChangeSystolic={(value) => { setPendingReading(null); setSystolic(value); }}
              onChangeDiastolic={(value) => { setPendingReading(null); setDiastolic(value); }}
              onChangeHeartRate={(value) => { setPendingReading(null); setHeartRate(value); }}
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
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              className="input-notes"
            />
          </div>
        </div>

        {pendingReading && (
          <div className="pulse-pressure-confirmation" role="alert" aria-live="assertive">
            <div>
              <strong>{t('form.pulsePressureTitle')}</strong>
              <p>{t('form.pulsePressureWarning', {
                value: pendingReading.systolic - pendingReading.diastolic,
              })}</p>
            </div>
            <div className="pulse-pressure-actions">
              <button type="button" className="btn-cancel-warning" onClick={() => setPendingReading(null)}>
                {t('form.cancel')}
              </button>
              <button type="button" className="btn-force-save" onClick={() => saveReading(pendingReading, true)}>
                {t('form.forceSave')}
              </button>
            </div>
          </div>
        )}

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
      </form>
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
