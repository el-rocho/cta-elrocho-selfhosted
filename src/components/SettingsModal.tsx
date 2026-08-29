import React, { useState } from 'react';
import type { AppSettings, GuidelineProfile, PatientSex, LanguageOption } from '../types/bloodPressure';
import { Settings, X, ShieldAlert, ShieldCheck, Armchair, RotateCcw, User, Trash2, Globe, BookOpenCheck, Target, Info, ExternalLink, Repeat2, Gauge } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { calculateAge } from '../utils/pdfGenerator';
import { FlagES, FlagGB } from './FlagIcons';
import { getTreatmentTarget } from '../utils/treatmentTarget';
import { getGuidelineSourceUrl } from '../utils/healthClassification';

type SettingsInfoTopic = GuidelineProfile | 'white-coat';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onMedicationContextChange: (takesMedication: boolean, recalculateHistory: boolean) => boolean | Promise<boolean>;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  onOpenTotpModal?: () => void;
  isTotpEnabled?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onMedicationContextChange,
  onResetDemoData,
  onClearAllData,
  onOpenTotpModal,
  isTotpEnabled = false,
}) => {
  const { t } = useLanguage();
  const [pendingMedicationValue, setPendingMedicationValue] = useState<boolean | null>(null);
  const [isUpdatingMedication, setIsUpdatingMedication] = useState(false);
  const [infoTopic, setInfoTopic] = useState<SettingsInfoTopic | null>(null);

  if (!isOpen) return null;

  const detailedGuideline = infoTopic === 'esc-2024' || infoTopic === 'aha-acc-2025' || infoTopic === 'ish-2020'
    ? infoTopic
    : null;
  const detailedGuidelineRanges = detailedGuideline === 'esc-2024'
    ? [
        { tone: 'normal', labelKey: 'nonElevatedLabel', valueKey: 'nonElevatedValue' },
        { tone: 'elevated', labelKey: 'elevatedLabel', valueKey: 'elevatedValue' },
        { tone: 'stage2', labelKey: 'hypertensionLabel', valueKey: 'hypertensionValue' },
      ]
    : detailedGuideline === 'aha-acc-2025'
      ? [
          { tone: 'normal', labelKey: 'normalLabel', valueKey: 'normalValue' },
          { tone: 'elevated', labelKey: 'elevatedLabel', valueKey: 'elevatedValue' },
          { tone: 'stage1', labelKey: 'stage1Label', valueKey: 'stage1Value' },
          { tone: 'stage2', labelKey: 'stage2Label', valueKey: 'stage2Value' },
        ]
      : detailedGuideline === 'ish-2020'
        ? [
            { tone: 'normal', labelKey: 'belowThresholdLabel', valueKey: 'belowThresholdValue' },
            { tone: 'stage2', labelKey: 'hypertensionLabel', valueKey: 'hypertensionValue' },
          ]
        : null;

  const renderGuidelineDisclaimer = (text: string) => {
    const highlightedTerm = t('settings.guidelineInfo.disclaimerHighlight');
    const termIndex = text.indexOf(highlightedTerm);

    if (termIndex === -1) return text;

    return (
      <>
        {text.slice(0, termIndex)}
        <strong className="guideline-disclaimer-highlight">{highlightedTerm}</strong>
        {text.slice(termIndex + highlightedTerm.length)}
      </>
    );
  };

  const handleLanguageChange = (lang: LanguageOption) => {
    onUpdateSettings({ ...settings, language: lang });
  };

  const handlePatientNameChange = (name: string) => {
    onUpdateSettings({ ...settings, patientName: name });
  };

  const handleGuidelineChange = (guidelineProfile: GuidelineProfile) => {
    onUpdateSettings({ ...settings, guidelineProfile, showInformationalLabels: true });
  };

  const handlePatientSexChange = (sex: PatientSex) => {
    onUpdateSettings({ ...settings, patientSex: sex });
  };

  const handleMedicationChange = (takesMedication: boolean) => {
    if (takesMedication !== settings.takesAntihypertensiveMedication) {
      setPendingMedicationValue(takesMedication);
    }
  };

  const handleResetTreatmentTarget = () => {
    const recommended = getTreatmentTarget({ ...settings, treatmentTargetMode: 'guideline' });
    onUpdateSettings({
      ...settings,
      treatmentTargetMode: 'guideline',
      customTargetSystolicMin: recommended.systolicMin ?? 0,
      customTargetSystolicMax: recommended.systolicMax,
      customTargetDiastolicMin: recommended.diastolicMin ?? 0,
      customTargetDiastolicMax: recommended.diastolicMax,
    });
  };

  const handleCustomTargetChange = (
    field: 'customTargetSystolicMin' | 'customTargetSystolicMax' | 'customTargetDiastolicMin' | 'customTargetDiastolicMax',
    value: string
  ) => {
    const parsed = value === '' ? 0 : Number(value);
    if (!Number.isFinite(parsed)) return;
    const isSystolic = field.includes('Systolic');
    const current = getTreatmentTarget(settings);
    const nextValue = Math.min(isSystolic ? 250 : 150, Math.max(0, Math.round(parsed)));
    const updated = {
      ...settings,
      treatmentTargetMode: 'custom' as const,
      customTargetSystolicMin: settings.treatmentTargetMode === 'custom' ? settings.customTargetSystolicMin : (current.systolicMin ?? 0),
      customTargetSystolicMax: settings.treatmentTargetMode === 'custom' ? settings.customTargetSystolicMax : current.systolicMax,
      customTargetDiastolicMin: settings.treatmentTargetMode === 'custom' ? settings.customTargetDiastolicMin : (current.diastolicMin ?? 0),
      customTargetDiastolicMax: settings.treatmentTargetMode === 'custom' ? settings.customTargetDiastolicMax : current.diastolicMax,
      [field]: nextValue,
    };
    onUpdateSettings(updated);
  };

  const handleCustomTargetBlur = (
    field: 'customTargetSystolicMin' | 'customTargetSystolicMax' | 'customTargetDiastolicMin' | 'customTargetDiastolicMax'
  ) => {
    if (settings.treatmentTargetMode !== 'custom') return;
    const isSystolic = field.includes('Systolic');
    const isMinimum = field.endsWith('Min');
    const lowerLimit = isSystolic ? 70 : 40;
    const upperLimit = isSystolic ? 250 : 150;
    const rawValue = settings[field];
    const nextValue = isMinimum && rawValue === 0
      ? 0
      : Math.min(upperLimit, Math.max(lowerLimit, rawValue));
    const updated = { ...settings, [field]: nextValue };
    if (field === 'customTargetSystolicMin' && nextValue > updated.customTargetSystolicMax) updated.customTargetSystolicMax = nextValue;
    if (field === 'customTargetSystolicMax' && nextValue < updated.customTargetSystolicMin) updated.customTargetSystolicMin = nextValue;
    if (field === 'customTargetDiastolicMin' && nextValue > updated.customTargetDiastolicMax) updated.customTargetDiastolicMax = nextValue;
    if (field === 'customTargetDiastolicMax' && nextValue < updated.customTargetDiastolicMin) updated.customTargetDiastolicMin = nextValue;
    onUpdateSettings(updated);
  };

  const confirmMedicationChange = async (recalculateHistory: boolean) => {
    if (pendingMedicationValue === null || isUpdatingMedication) return;
    setIsUpdatingMedication(true);
    const success = await onMedicationContextChange(pendingMedicationValue, recalculateHistory);
    setIsUpdatingMedication(false);
    if (success) setPendingMedicationValue(null);
  };

  const handlePatientBirthDateChange = (val: string) => {
    const computedAge = val ? calculateAge(val) : '';
    onUpdateSettings({
      ...settings,
      patientBirthDate: val,
      patientAge: computedAge,
    });
  };

  const handleToggleWhiteCoat = () => {
    onUpdateSettings({
      ...settings,
      enableWhiteCoatFilter: !settings.enableWhiteCoatFilter,
      whiteCoatIntervalMinutes: 5,
    });
  };

  const handleChangeDefaultArm = (arm: 'left' | 'right') => {
    onUpdateSettings({
      ...settings,
      defaultArm: arm,
    });
  };

  const activeTreatmentTarget = getTreatmentTarget(settings);
  const targetFieldValues = {
    customTargetSystolicMin: settings.treatmentTargetMode === 'custom' ? (settings.customTargetSystolicMin || '') : (activeTreatmentTarget.systolicMin ?? ''),
    customTargetSystolicMax: settings.treatmentTargetMode === 'custom' ? (settings.customTargetSystolicMax || '') : activeTreatmentTarget.systolicMax,
    customTargetDiastolicMin: settings.treatmentTargetMode === 'custom' ? (settings.customTargetDiastolicMin || '') : (activeTreatmentTarget.diastolicMin ?? ''),
    customTargetDiastolicMax: settings.treatmentTargetMode === 'custom' ? (settings.customTargetDiastolicMax || '') : activeTreatmentTarget.diastolicMax,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Settings size={26} className="modal-icon legal-icon-main" />
            <h2 className="legal-modal-title">{t('settings.title')}</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label={t('settings.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Opción 0: Selector de Idioma / Language */}
          <div className="settings-section">
            <div className="field-label">
              <Globe size={22} className="text-blue settings-field-icon" />
              <span>{t('settings.languageTitle')}</span>
            </div>
            <div className="chip-options-row" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className={`chip-select ${settings.language === 'es' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('es')}
                style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FlagES size={18} /> {t('settings.langSpanish')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.language === 'en' ? 'active' : ''}`}
                onClick={() => handleLanguageChange('en')}
                style={{ padding: '6px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FlagGB size={18} /> {t('settings.langEnglish')}
              </button>
            </div>
          </div>

          {/* Opción 1: Datos del Paciente */}
          <div className="settings-section border-top">
            <div className="field-label">
              <BookOpenCheck size={22} className="text-blue settings-field-icon" />
              <span>{t('settings.guidelineTitle')}</span>
            </div>
            <div className="guideline-options">
              <div className={`guideline-option ${!settings.showInformationalLabels ? 'active' : ''}`}>
                <button
                  type="button"
                  className="guideline-select-button"
                  onClick={() => onUpdateSettings({ ...settings, showInformationalLabels: false })}
                >
                  <strong>{t('settings.guidelineNone')}</strong>
                </button>
              </div>
              {([
                ['esc-2024', 'settings.guidelineEsc'],
                ['aha-acc-2025', 'settings.guidelineAha'],
                ['ish-2020', 'settings.guidelineIsh'],
              ] as const).map(([profile, labelKey]) => (
                <div
                  key={profile}
                  className={`guideline-option ${settings.showInformationalLabels && settings.guidelineProfile === profile ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="guideline-select-button"
                    onClick={() => handleGuidelineChange(profile)}
                  >
                    <strong>{t(labelKey)}</strong>
                  </button>
                  <button
                    type="button"
                    className="settings-info-button"
                    onClick={() => setInfoTopic(profile)}
                    aria-label={`${t('settings.info')} — ${t(labelKey)}`}
                    title={`${t('settings.info')} — ${t(labelKey)}`}
                  >
                    <Info size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-section border-top">
            <div className="field-label">
              <User size={22} className="text-blue settings-field-icon" />
              <span>{t('settings.patientProfile')}</span>
            </div>
            <div className="patient-profile-fields">
              <div className="patient-profile-field">
                <label className="settings-desc">
                  {t('settings.fullName')}
                </label>
                <input
                  type="text"
                  value={settings.patientName || ''}
                  onChange={(e) => handlePatientNameChange(e.target.value)}
                  placeholder={t('settings.fullNamePlaceholder')}
                  className="modal-input patient-profile-input"
                />
              </div>

              <div className="patient-profile-field">
                <label className="settings-desc">
                  {t('settings.birthDate')}
                </label>
                <input
                  type="date"
                  value={settings.patientBirthDate || ''}
                  onChange={(e) => handlePatientBirthDateChange(e.target.value)}
                  className="modal-input patient-profile-input"
                />
              </div>

              <div className="patient-profile-field">
                <div className="chip-options-row patient-sex-options">
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'masculino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('masculino')}
                  >
                    {t('settings.sexMale')}
                  </button>
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'femenino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('femenino')}
                  >
                    {t('settings.sexFemale')}
                  </button>
                </div>
              </div>

              <div className={`medication-target-layout patient-profile-field-wide ${settings.takesAntihypertensiveMedication ? 'has-target' : ''}`}>
                <div className="patient-profile-field medication-setting-card">
                  <label className="settings-desc">{t('settings.medicationLabel')}</label>
                  <div className="chip-options-row medication-options">
                  <button type="button" className={`chip-select medication-yes ${settings.takesAntihypertensiveMedication ? 'active' : ''}`} onClick={() => handleMedicationChange(true)}>
                    {t('settings.medicationYes')}
                  </button>
                  <button type="button" className={`chip-select medication-no ${!settings.takesAntihypertensiveMedication ? 'active' : ''}`} onClick={() => handleMedicationChange(false)}>
                    {t('settings.medicationNo')}
                  </button>
                  </div>
                </div>
                {settings.takesAntihypertensiveMedication && (
                  <div className="treatment-target-settings">
                    <div className="treatment-target-heading"><Target size={18} /><strong>{t('settings.targetTitle')}</strong></div>
                    <div className="chip-options-row treatment-target-modes">
                      <button type="button" className="btn-subtle-reset treatment-target-reset" onClick={handleResetTreatmentTarget}><RotateCcw size={13} /> {t('settings.targetGuideline')}</button>
                    </div>
                    <div className="custom-target-grid">
                      {([['customTargetSystolicMin', 'settings.targetSystolicMin', 70, 250], ['customTargetSystolicMax', 'settings.targetSystolicMax', 70, 250], ['customTargetDiastolicMin', 'settings.targetDiastolicMin', 40, 150], ['customTargetDiastolicMax', 'settings.targetDiastolicMax', 40, 150]] as const).map(([field, labelKey, min, max]) => <label key={field}><span>{t(labelKey)}</span><div className="target-number-input"><input type="number" min={min} max={max} value={targetFieldValues[field]} onChange={(event) => handleCustomTargetChange(field, event.target.value)} onBlur={() => handleCustomTargetBlur(field)} /><small>mmHg</small></div></label>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Opción 3: Filtro de Bata Blanca (On/Off) */}
          <div className="settings-section border-top">
            <div className="settings-row-header">
              <div className="settings-label-group">
                <ShieldAlert size={22} className="text-blue settings-field-icon" />
                <div>
                  <h3 style={{ fontWeight: 400 }}>{t('settings.whiteCoatTitle')}</h3>
                </div>
              </div>

              <div className="settings-toggle-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.enableWhiteCoatFilter}
                    onChange={handleToggleWhiteCoat}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <button
                  type="button"
                  className="settings-info-button"
                  onClick={() => setInfoTopic('white-coat')}
                  aria-label={`${t('settings.info')} — ${t('settings.whiteCoatTitle')}`}
                  title={`${t('settings.info')} — ${t('settings.whiteCoatTitle')}`}
                >
                  <Info size={15} />
                </button>
              </div>
            </div>

          </div>

          {/* Opción 4: Brazo por defecto */}
          <div className="settings-section border-top">
            <div className="field-label">
              <Armchair size={22} className="settings-field-icon" />
              <span>{t('settings.defaultArmTitle')}</span>
            </div>
            <div className="chip-options-row">
              <button
                type="button"
                className={`chip-select ${settings.defaultArm === 'left' ? 'active' : ''}`}
                onClick={() => handleChangeDefaultArm('left')}
              >
                {t('settings.defaultArmLeft')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.defaultArm === 'right' ? 'active' : ''}`}
                onClick={() => handleChangeDefaultArm('right')}
              >
                {t('settings.defaultArmRight')}
              </button>
            </div>
          </div>

          {/* Opción 5: Seguridad y 2FA TOTP */}
          {onOpenTotpModal && (
            <div className="settings-section border-top">
              <div className="field-label">
                {isTotpEnabled
                  ? <ShieldCheck size={22} className="text-green settings-field-icon" />
                  : <ShieldAlert size={22} className="text-blue settings-field-icon" />}
                <span>Seguridad de la Cuenta</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '10px' }}>
                {isTotpEnabled
                  ? 'La autenticación en dos pasos está activa. Puedes desactivarla o vincular una nueva aplicación de autenticación.'
                  : 'Protege tu acceso con verificación en dos pasos (Google Authenticator, Aegis, Authy, etc.).'}
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenTotpModal}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
              >
                {isTotpEnabled ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                <span>{isTotpEnabled ? 'Administrar 2FA (activo)' : 'Configurar 2FA (TOTP)'}</span>
              </button>
            </div>
          )}

          {/* Opción 6: Botones de Gestión */}
          <div className="settings-section border-top">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                className="btn-subtle-reset"
                onClick={onResetDemoData}
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                <RotateCcw size={16} />
                <span>{t('settings.resetDemo')}</span>
              </button>

              <button
                type="button"
                className="btn-danger-reset"
                onClick={onClearAllData}
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                <Trash2 size={16} />
                <span>{t('settings.clearAll')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {pendingMedicationValue !== null && (
        <div className="modal-overlay medication-context-overlay" onClick={(event) => { event.stopPropagation(); if (!isUpdatingMedication) setPendingMedicationValue(null); }}>
          <div className="modal-content medication-context-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="medication-context-heading">
              <ShieldAlert size={24} />
              <h3>{t('settings.medicationChangeTitle')}</h3>
            </div>
            <p className="medication-context-message">
              <strong>{t('settings.medicationChangeValuesUnchanged')}</strong>{' '}
              {t('settings.medicationChangeMessage')}
            </p>
            <div className="medication-context-choice"><strong>{t('settings.medicationKeepHistory')}</strong><span>{t('settings.medicationKeepHistoryDesc')}</span></div>
            <div className="medication-context-choice"><strong>{t('settings.medicationRecalculateHistory')}</strong><span>{t('settings.medicationRecalculateHistoryDesc')}</span></div>
            <div className="medication-context-actions">
              <button type="button" className="btn-secondary-large" disabled={isUpdatingMedication} onClick={() => setPendingMedicationValue(null)}>{t('settings.medicationChangeCancel')}</button>
              <button type="button" className="btn-recalculate-history" disabled={isUpdatingMedication} onClick={() => confirmMedicationChange(true)}>{t('settings.medicationRecalculateButton')}</button>
              <button type="button" className="btn-primary-large" disabled={isUpdatingMedication} onClick={() => confirmMedicationChange(false)}>{t('settings.medicationKeepButton')}</button>
            </div>
          </div>
        </div>
      )}
      {infoTopic !== null && (
        <div
          className="modal-overlay settings-info-overlay"
          onClick={(event) => {
            event.stopPropagation();
            setInfoTopic(null);
          }}
        >
          <div
            className="modal-content settings-info-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-info-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                {infoTopic === 'white-coat'
                  ? <ShieldAlert size={24} className="modal-icon legal-icon-main" />
                  : <BookOpenCheck size={24} className="modal-icon legal-icon-main" />}
                <h2 id="settings-info-title" className="settings-info-title">
                  {infoTopic === 'white-coat'
                    ? t('settings.whiteCoatInfoTitle')
                    : t(`settings.guidelineInfo.${infoTopic}.title`)}
                </h2>
              </div>
              <button className="btn-close-modal" onClick={() => setInfoTopic(null)} aria-label={t('settings.close')}>
                <X size={20} />
              </button>
            </div>
            <div className={`modal-body settings-info-body ${infoTopic === 'white-coat' ? 'measurement-guide-body white-coat-info-body' : detailedGuideline ? 'measurement-guide-body guideline-detail-body' : ''}`}>
              {infoTopic === 'white-coat' ? (
                <>
                  <div className="settings-subcard measurement-guide-main-card white-coat-info-card">
                    <ShieldAlert size={22} className="legal-icon-block white-coat-info-icon" />
                    <p>{t('settings.whiteCoatInfoIntro')}</p>
                  </div>
                  <div className="settings-subcard measurement-guide-advice-card white-coat-info-card">
                    <Repeat2 size={22} className="legal-icon-block white-coat-info-icon" />
                    <div>
                      <p>{t('settings.whiteCoatInfoMechanism')}</p>
                      <p>{t('settings.whiteCoatInfoResult')}</p>
                    </div>
                  </div>
                </>
              ) : detailedGuideline && detailedGuidelineRanges ? (
                <>
                  <div className="settings-subcard measurement-guide-main-card guideline-ranges-card">
                    <div className="field-label guideline-info-section-title">
                      <Gauge size={22} className="legal-icon-block" />
                      <span>{t(`settings.guidelineInfo.${detailedGuideline}.homeIntro`)}</span>
                    </div>
                    <ul className="guideline-range-list">
                      {detailedGuidelineRanges.map((range) => (
                        <li key={range.labelKey} className={range.tone}>
                          <span className="guideline-range-dot" aria-hidden="true" />
                          <span>
                            <strong>{t(`settings.guidelineInfo.${detailedGuideline}.${range.labelKey}`)}</strong>{' '}
                            {t(`settings.guidelineInfo.${detailedGuideline}.${range.valueKey}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="settings-subcard measurement-guide-advice-card guideline-target-card">
                    <Target size={22} className="legal-icon-block" />
                    {detailedGuideline === 'ish-2020' ? (
                      <div className="guideline-target-content">
                        <p>{t('settings.guidelineInfo.ish-2020.targetIntro')}</p>
                        <ul className="guideline-target-list">
                          <li>
                            <strong>{t('settings.guidelineInfo.ish-2020.under65Label')}</strong>{' '}
                            {t('settings.guidelineInfo.ish-2020.under65Value')}
                          </li>
                          <li>
                            <strong>{t('settings.guidelineInfo.ish-2020.from65Label')}</strong>{' '}
                            {t('settings.guidelineInfo.ish-2020.from65Value')}
                          </li>
                        </ul>
                        <p className="guideline-fragility-note">
                          {t('settings.guidelineInfo.ish-2020.fragility')}
                        </p>
                      </div>
                    ) : (
                      <p>{t(`settings.guidelineInfo.${detailedGuideline}.target`)}</p>
                    )}
                  </div>
                  <div className="settings-info-note guideline-info-disclaimer">
                    <Info size={18} />
                    <p>
                      {renderGuidelineDisclaimer(t(`settings.guidelineInfo.${detailedGuideline}.disclaimer`))}
                    </p>
                  </div>
                  <a
                    className="settings-info-source"
                    href={getGuidelineSourceUrl(infoTopic)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('settings.guidelineSource')} <ExternalLink size={14} />
                  </a>
                </>
              ) : (
                <>
                  <p>{t(`settings.guidelineInfo.${infoTopic}.classification`)}</p>
                  <p>{t(`settings.guidelineInfo.${infoTopic}.target`)}</p>
                  <p className="settings-info-note">{t('settings.guidelineInfoDisclaimer')}</p>
                  <a
                    className="settings-info-source"
                    href={getGuidelineSourceUrl(infoTopic)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('settings.guidelineSource')} <ExternalLink size={14} />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
