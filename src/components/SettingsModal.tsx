import React from 'react';
import type { AppSettings, BackupFrequency, PatientSex, LanguageOption } from '../types/bloodPressure';
import { Settings, X, ShieldAlert, Clock, Armchair, RotateCcw, Save, Folder, CalendarCheck, User, Trash2, Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { calculateAge } from '../utils/pdfGenerator';
import { FlagES, FlagGB } from './FlagIcons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  onTriggerManualBackup: () => void;
  onOpenTotpModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetDemoData,
  onClearAllData,
  onTriggerManualBackup,
  onOpenTotpModal,
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const currentWhiteCoatInterval = [3, 5, 10].includes(settings.whiteCoatIntervalMinutes)
    ? settings.whiteCoatIntervalMinutes
    : 5;

  const handleLanguageChange = (lang: LanguageOption) => {
    onUpdateSettings({ ...settings, language: lang });
  };

  const handlePatientNameChange = (name: string) => {
    onUpdateSettings({ ...settings, patientName: name });
  };

  const handlePatientSexChange = (sex: PatientSex) => {
    onUpdateSettings({ ...settings, patientSex: sex });
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
      whiteCoatIntervalMinutes: currentWhiteCoatInterval,
    });
  };

  const handleChangeInterval = (minutes: number) => {
    onUpdateSettings({
      ...settings,
      whiteCoatIntervalMinutes: minutes,
    });
  };

  const handleChangeDefaultArm = (arm: 'left' | 'right') => {
    onUpdateSettings({
      ...settings,
      defaultArm: arm,
    });
  };

  const handleChangeBackupFrequency = (freq: BackupFrequency) => {
    onUpdateSettings({
      ...settings,
      backupFrequency: freq,
    });
  };

  const locale = settings.language === 'en' ? 'en-US' : 'es-ES';
  const lastBackupStr = settings.lastBackupTimestamp
    ? new Date(settings.lastBackupTimestamp).toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('settings.lastBackupNone');

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
              <User size={22} className="text-blue settings-field-icon" />
              <span>{t('settings.patientProfile')}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <div>
                <label className="settings-desc" style={{ display: 'block', marginBottom: '4px' }}>
                  {t('settings.fullName')}
                </label>
                <input
                  type="text"
                  value={settings.patientName || ''}
                  onChange={(e) => handlePatientNameChange(e.target.value)}
                  placeholder={t('settings.fullNamePlaceholder')}
                  className="modal-input"
                  style={{ padding: '8px 10px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="settings-desc" style={{ display: 'block', marginBottom: '4px' }}>
                  {t('settings.birthDate')}
                </label>
                <input
                  type="date"
                  value={settings.patientBirthDate || ''}
                  onChange={(e) => handlePatientBirthDateChange(e.target.value)}
                  className="modal-input"
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div className="chip-options-row">
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'masculino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('masculino')}
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    {t('settings.sexMale')}
                  </button>
                  <button
                    type="button"
                    className={`chip-select ${settings.patientSex === 'femenino' ? 'active' : ''}`}
                    onClick={() => handlePatientSexChange('femenino')}
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    {t('settings.sexFemale')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Opción 2: Copias de Seguridad Automáticas CSV */}
          <div className="settings-section border-top">
            <div className="field-label">
              <Save size={22} className="text-blue settings-field-icon" />
              <span>{t('settings.backupTitle')}</span>
            </div>
            <p className="settings-desc" style={{ marginBottom: '10px' }}>
              {t('settings.backupDesc')}
            </p>

            <div className="chip-options-row" style={{ marginBottom: '12px' }}>
              <button
                type="button"
                className={`chip-select ${settings.backupFrequency === 'daily' ? 'active' : ''}`}
                onClick={() => handleChangeBackupFrequency('daily')}
              >
                {t('settings.backupDaily')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.backupFrequency === 'weekly' ? 'active' : ''}`}
                onClick={() => handleChangeBackupFrequency('weekly')}
              >
                {t('settings.backupWeekly')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.backupFrequency === 'monthly' ? 'active' : ''}`}
                onClick={() => handleChangeBackupFrequency('monthly')}
              >
                {t('settings.backupMonthly')}
              </button>
              <button
                type="button"
                className={`chip-select ${settings.backupFrequency === 'disabled' ? 'active' : ''}`}
                onClick={() => handleChangeBackupFrequency('disabled')}
              >
                {t('settings.backupDisabled')}
              </button>
            </div>

            <div className="settings-subcard">
              <div className="field-label" style={{ fontSize: '12px' }}>
                <Folder size={20} className="text-blue settings-field-icon" />
                <span>{t('settings.storageTitle')}</span>
              </div>
              <p className="settings-desc" style={{ marginTop: '4px', fontSize: '11px', lineHeight: '1.4' }}>
                {t('settings.storageDesc')}
              </p>

              <div className="backup-meta-row" style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>
                  <CalendarCheck size={12} className="inline-icon" /> {t('settings.lastBackup')} <strong>{lastBackupStr}</strong>
                </span>
                <button
                  type="button"
                  className="btn-download-backup"
                  onClick={onTriggerManualBackup}
                  style={{
                    backgroundColor: 'var(--primary-color, #6d28d9)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {t('settings.downloadBackup')}
                </button>
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
                  <p className="settings-desc" style={{ marginTop: '4px', lineHeight: '1.4' }}>
                    {t('settings.whiteCoatDesc')}
                  </p>
                </div>
              </div>

              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableWhiteCoatFilter}
                  onChange={handleToggleWhiteCoat}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {settings.enableWhiteCoatFilter && (
              <div className="settings-subcard">
                <div className="field-label">
                  <Clock size={16} />
                  <span>{t('settings.intervalLabel')}</span>
                </div>
                <div className="chip-options-row">
                  {[3, 5, 10].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`chip-select ${currentWhiteCoatInterval === mins ? 'active' : ''}`}
                      onClick={() => handleChangeInterval(mins)}
                    >
                      {t('settings.minutesText', { mins })}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                <ShieldAlert size={22} className="text-blue settings-field-icon" />
                <span>Seguridad de la Cuenta</span>
              </div>
              <p className="settings-desc" style={{ marginBottom: '10px' }}>
                Protege tu acceso con verificación en dos pasos (Google Authenticator, Aegis, Authy, etc.).
              </p>
              <button
                type="button"
                className="btn-primary-large"
                onClick={onOpenTotpModal}
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
              >
                <ShieldAlert size={18} />
                <span>Configurar 2FA (TOTP)</span>
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
    </div>
  );
};
