import React, { useState, useEffect } from 'react';
import type { BloodPressureReading, AppSettings, InputMode } from '../types/bloodPressure';
import { Edit3, X, Save, CalendarDays, AlertCircle, Repeat2, Trash2 } from 'lucide-react';
import { WheelPicker } from './WheelPicker';
import { useLanguage } from '../i18n/useLanguage';
import { getReadingValidationError, hasSimilarConfirmedReadingToday, needsPulsePressureConfirmation, type ReadingValues } from '../utils/readingValidation';

const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeInputValue = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const parseLocalDateTime = (dateValue: string, timeValue: string): Date | null => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);

  if (![year, month, day, hours, minutes].every(Number.isFinite)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const matchesInput =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day &&
    parsed.getHours() === hours &&
    parsed.getMinutes() === minutes;

  return matchesInput ? parsed : null;
};

interface EditReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  reading: BloodPressureReading | null;
  settings: AppSettings;
  onUpdateInputMode?: (mode: InputMode) => void;
  onSaveReading: (updatedReading: BloodPressureReading) => void;
  onDeleteReading?: (readingId: string) => void;
  readings: BloodPressureReading[];
}

export const EditReadingModal: React.FC<EditReadingModalProps> = ({
  isOpen,
  onClose,
  reading,
  settings,
  onUpdateInputMode,
  onSaveReading,
  onDeleteReading,
  readings,
}) => {
  const { t, language } = useLanguage();

  const [inputMode, setInputMode] = useState<InputMode>(settings.preferredInputMode || 'keyboard');
  const [systolic, setSystolic] = useState<number | ''>('');
  const [diastolic, setDiastolic] = useState<number | ''>('');
  const [heartRate, setHeartRate] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [readingDate, setReadingDate] = useState<string>('');
  const [readingTime, setReadingTime] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingReading, setPendingReading] = useState<BloodPressureReading | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activeInputMode = settings.preferredInputMode || inputMode;

  useEffect(() => {
    if (reading) {
      const timestamp = new Date(reading.timestamp);
      setSystolic(reading.systolic);
      setDiastolic(reading.diastolic);
      setHeartRate(reading.heartRate);
      setNotes(reading.notes || '');
      setReadingDate(formatDateInputValue(timestamp));
      setReadingTime(formatTimeInputValue(timestamp));
      setErrorMsg(null);
      setPendingReading(null);
      setShowDeleteConfirm(false);
    }
  }, [reading]);

  useEffect(() => {
    if (settings.preferredInputMode) {
      setInputMode(settings.preferredInputMode);
    }
  }, [settings.preferredInputMode]);

  if (!isOpen || !reading) return null;

  const dateObj = new Date(reading.timestamp);
  const originalDateValue = formatDateInputValue(dateObj);
  const originalTimeValue = formatTimeInputValue(dateObj);
  const maxDate = formatDateInputValue(new Date());

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleToggleInputMode = (newMode: InputMode) => {
    setInputMode(newMode);
    if (onUpdateInputMode) {
      onUpdateInputMode(newMode);
    }
  };

  const saveReading = (updated: BloodPressureReading, pulsePressureWarningConfirmed: boolean) => {
    onSaveReading({ ...updated, pulsePressureWarningConfirmed });
    setPendingReading(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sysNum = Number(systolic);
    const diaNum = Number(diastolic);
    const hrNum = Number(heartRate);
    const editedDateTime = parseLocalDateTime(readingDate, readingTime);

    if (!editedDateTime) {
      setErrorMsg(t('editModal.dateTimeRequired'));
      return;
    }

    if (editedDateTime.getTime() > Date.now()) {
      setErrorMsg(t('editModal.dateTimeFuture'));
      return;
    }

    const values: ReadingValues = { systolic: sysNum, diastolic: diaNum, heartRate: hrNum };
    const validationError = getReadingValidationError(values);
    if (validationError) {
      setErrorMsg(t(validationError === 'diastolicNotLower' ? 'form.diastolicMustBeLower' : 'form.validationAlert'));
      return;
    }

    const timestampChanged = readingDate !== originalDateValue || readingTime !== originalTimeValue;
    const updated: BloodPressureReading = {
      ...reading,
      timestamp: timestampChanged ? editedDateTime.toISOString() : reading.timestamp,
      systolic: sysNum,
      diastolic: diaNum,
      heartRate: hrNum,
      notes: notes.trim() ? notes.trim() : undefined,
      sessionId: timestampChanged ? undefined : reading.sessionId,
    };

    if (needsPulsePressureConfirmation(values)) {
      const valuesUnchanged = reading.systolic === sysNum && reading.diastolic === diaNum && reading.heartRate === hrNum;
      if ((valuesUnchanged && reading.pulsePressureWarningConfirmed === true) || hasSimilarConfirmedReadingToday(readings, values, editedDateTime, reading.id)) saveReading(updated, true);
      else setPendingReading(updated);
      return;
    }
    saveReading(updated, false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-reading-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado del Modal */}
        <div className="modal-header edit-modal-header">
          <div className="modal-title-row">
            <Edit3 size={24} className="modal-header-icon" />
            <h2>{t('editModal.title')}</h2>
          </div>

          <button
            type="button"
            className="btn-mode-chip active btn-switch edit-header-toggle"
            onClick={() => handleToggleInputMode(activeInputMode === 'keyboard' ? 'wheel' : 'keyboard')}
            aria-label={activeInputMode === 'keyboard' ? t('form.modeKeyboard') : t('form.modeWheel')}
          >
            <span>{activeInputMode === 'keyboard' ? t('form.modeKeyboard') : t('form.modeWheel')}</span>
            <Repeat2 size={14} className="switch-icon" />
          </button>

          <button
            type="button"
            className="btn-icon-close"
            onClick={onClose}
            aria-label={t('settings.close')}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-modal-body">
          {/* Fecha y hora editables */}
          <div className="timestamp-editor">
            <div className="timestamp-editor-header">
              <CalendarDays size={17} />
              <strong>{t('editModal.dateTimeTitle')}</strong>
            </div>
            <div className="timestamp-fields-grid">
              <div className="timestamp-field">
                <input
                  id="edit-reading-date"
                  type="date"
                  aria-label={t('editModal.date')}
                  value={readingDate}
                  max={maxDate}
                  onChange={(e) => { setPendingReading(null); setReadingDate(e.target.value); }}
                  className="edit-input timestamp-input"
                  required
                />
              </div>
              <div className="timestamp-field">
                <input
                  id="edit-reading-time"
                  type="time"
                  aria-label={t('editModal.time')}
                  value={readingTime}
                  step="60"
                  onChange={(e) => { setPendingReading(null); setReadingTime(e.target.value); }}
                  className="edit-input timestamp-input"
                  required
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="form-error-banner">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulario de Campos Editables */}
          {activeInputMode === 'keyboard' ? (
            <div className="edit-fields-grid">
              {/* Sistólica */}
              <div className="edit-field-group">
                <label htmlFor="edit-systolic">
                  <span className="dot dot-sys"></span>
                  <span className="edit-label-full">{t('editModal.systolic')}</span>
                  <span className="edit-label-compact">{t('form.systolicShort')}</span>
                  <span className="unit-label">(mmHg)</span>
                </label>
                <input
                  id="edit-systolic"
                  type="number"
                  inputMode="numeric"
                  min="50"
                  max="260"
                  value={systolic}
                  onChange={(e) => { setPendingReading(null); setSystolic(e.target.value === '' ? '' : Number(e.target.value)); }}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>

              {/* Diastólica */}
              <div className="edit-field-group">
                <label htmlFor="edit-diastolic">
                  <span className="dot dot-dia"></span>
                  <span className="edit-label-full">{t('editModal.diastolic')}</span>
                  <span className="edit-label-compact">{t('form.diastolicShort')}</span>
                  <span className="unit-label">(mmHg)</span>
                </label>
                <input
                  id="edit-diastolic"
                  type="number"
                  inputMode="numeric"
                  min="30"
                  max="160"
                  value={diastolic}
                  onChange={(e) => { setPendingReading(null); setDiastolic(e.target.value === '' ? '' : Number(e.target.value)); }}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>

              {/* Pulsaciones */}
              <div className="edit-field-group">
                <label htmlFor="edit-heartRate">
                  <span className="dot dot-bpm"></span>
                  <span className="edit-label-full">{t('editModal.heartRate')}</span>
                  <span className="edit-label-compact">{t('form.heartRateShort')}</span>
                  <span className="unit-label">({language === 'en' ? 'BPM' : 'ppm'})</span>
                </label>
                <input
                  id="edit-heartRate"
                  type="number"
                  inputMode="numeric"
                  min="30"
                  max="220"
                  value={heartRate}
                  onChange={(e) => { setPendingReading(null); setHeartRate(e.target.value === '' ? '' : Number(e.target.value)); }}
                  onFocus={handleFocus}
                  className="edit-input num-input"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="wheel-mode-container" style={{ marginBottom: '16px' }}>
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

          {/* Notas */}
          <div className="edit-field-group notes-group">
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('editModal.notesPlaceholder')}
              rows={3}
              className="edit-input notes-textarea"
            />
          </div>

          {/* Acciones */}
          {pendingReading && (
            <div className="pulse-pressure-confirmation" role="alert" aria-live="assertive">
              <div><strong>{t('form.pulsePressureTitle')}</strong><p>{t('form.pulsePressureWarning', { value: pendingReading.systolic - pendingReading.diastolic })}</p></div>
              <div className="pulse-pressure-actions">
                <button type="button" className="btn-cancel-warning" onClick={() => setPendingReading(null)}>{t('form.cancel')}</button>
                <button type="button" className="btn-force-save" onClick={() => saveReading(pendingReading, true)}>{t('form.forceSave')}</button>
              </div>
            </div>
          )}
          {showDeleteConfirm ? (
            <div className="pulse-pressure-confirmation modal-delete-confirmation" role="alert">
              <div>
                <strong>{t('editModal.deleteConfirm')}</strong>
              </div>
              <div className="pulse-pressure-actions">
                <button
                  type="button"
                  className="btn-cancel-warning"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  {t('editModal.cancel')}
                </button>
                <button
                  type="button"
                  className="btn-danger-confirm"
                  onClick={() => {
                    if (reading && onDeleteReading) {
                      onDeleteReading(reading.id);
                      onClose();
                    }
                  }}
                >
                  {t('editModal.confirmDeleteBtn')}
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-actions-row">
              {onDeleteReading && (
                <button
                  type="button"
                  className="btn-delete-modal"
                  onClick={() => setShowDeleteConfirm(true)}
                  title={t('editModal.delete')}
                >
                  <Trash2 size={18} />
                  <span>{t('editModal.delete')}</span>
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-secondary-large" onClick={onClose} aria-label={t('editModal.cancel')} title={t('editModal.cancel')}>
                  <X size={20} />
                  <span>{t('editModal.cancel')}</span>
                </button>
                <button type="submit" className="btn-primary-large" aria-label={t('editModal.save')} title={t('editModal.save')}>
                  <Save size={20} />
                  <span>{t('editModal.save')}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
