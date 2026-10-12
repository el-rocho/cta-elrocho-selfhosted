import React, { useState } from 'react';
import type {
  AppSettings,
  BackupFrequency,
  BloodPressureReading,
  BloodPressureSession,
  DateFilterPreset,
  DateRange,
  ExportReportOptions,
  AuthUser,
} from '../types/bloodPressure';
import { exportToCSV } from '../utils/exportCsv';
import { downloadPDFReport, calculateAge } from '../utils/pdfGenerator';
import { analyzeCSVImport, type CSVImportResult } from '../utils/importCsv';
import { parseBackupContent, type AppBackupSnapshot } from '../utils/backupService';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  FileSpreadsheet,
  FileText,
  Printer,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { Share } from '@capacitor/share';
import type { BackupMergeCounts, BackupMergePreview } from '../services/storageService';

export interface ToastNotification {
  message?: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  cancelLabel?: string;
  variant?: 'neutral' | 'soft-blue';
}

type DataTab = 'backup' | 'import' | 'report';
type PendingImport =
  | { kind: 'backup'; snapshot: AppBackupSnapshot }
  | { kind: 'csv'; result: CSVImportResult };

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: BloodPressureSession[];
  readings: BloodPressureReading[];
  settings: AppSettings;
  currentUser?: AuthUser | null;
  onImportReadings: (readings: Omit<BloodPressureReading, 'id'>[]) => number | Promise<number>;
  onPreviewBackupMerge?: (snapshot: AppBackupSnapshot) => Promise<BackupMergePreview>;
  onRestoreBackup: (snapshot: AppBackupSnapshot, mode: 'merge' | 'replace', previewToken?: string) => number | BackupMergeCounts | Promise<number | BackupMergeCounts>;
  onUpdateSettings: (settings: AppSettings) => void;
  onTriggerManualBackup: () => void;
  onNotify?: (toast: string | ToastNotification) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sessions,
  readings,
  settings,
  currentUser,
  onImportReadings,
  onPreviewBackupMerge,
  onRestoreBackup,
  onUpdateSettings,
  onTriggerManualBackup,
  onNotify,
}) => {
  const { t, language } = useLanguage();
  const [preset, setPreset] = useState<DateFilterPreset>('1month');
  const [reportNotes, setReportNotes] = useState('');
  const [hidePatientData, setHidePatientData] = useState(false);
  const [activeTab, setActiveTab] = useState<DataTab>('backup');
  const [importStatus, setImportStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [mergePreview, setMergePreview] = useState<BackupMergePreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [restoreBusy, setRestoreBusy] = useState(false);
  const restoreBusyRef = React.useRef(false);
  const previewSeqRef = React.useRef(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const lastBackup = settings.lastFullBackupTimestamp
    ? new Date(settings.lastFullBackupTimestamp).toLocaleString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : t('data.backupNever');

  const getCurrentRange = (): DateRange => ({ preset });
  const getExportOptions = (): ExportReportOptions => {
    const patientBirthDate = currentUser?.birth_date || settings.patientBirthDate;
    return {
      patientName: currentUser?.name || settings.patientName,
      patientSex: currentUser?.sex || settings.patientSex,
      patientAge: patientBirthDate ? calculateAge(patientBirthDate) : settings.patientAge,
      patientBirthDate,
    takesAntihypertensiveMedication: settings.takesAntihypertensiveMedication,
    guidelineProfile: settings.guidelineProfile,
    showInformationalLabels: settings.showInformationalLabels,
    treatmentTargetMode: settings.treatmentTargetMode,
    customTargetSystolicMin: settings.customTargetSystolicMin,
    customTargetSystolicMax: settings.customTargetSystolicMax,
    customTargetDiastolicMin: settings.customTargetDiastolicMin,
    customTargetDiastolicMax: settings.customTargetDiastolicMax,
    reportNotes: reportNotes.trim() || undefined,
      hidePatientData,
    };
  };

  const handleBackupFrequency = (backupFrequency: BackupFrequency) => {
    onUpdateSettings({ ...settings, backupFrequency });
  };

  const handleExportCSV = () => {
    const filename = exportToCSV(sessions, getCurrentRange(), 'tension_arterial_informe', getExportOptions(), language);
    onClose();
    onNotify?.({ message: t('toast.csvReportSuccess'), detail: filename, variant: 'soft-blue' });
  };

  const handlePrintPDF = async () => {
    onClose();
    onNotify?.({ message: t('toast.pdfDownloadStarting'), variant: 'soft-blue' });
    const result = await downloadPDFReport(sessions, getCurrentRange(), getExportOptions(), language);
    if (!result.success || !onNotify) return;

    onNotify({
      message: t('toast.pdfDownloadSuccess'),
      detail: result.filename,
      actionLabel: language === 'en' ? 'Share report' : 'Compartir informe',
      variant: 'soft-blue',
      onAction: async () => {
        if (result.isNative && result.fileUri) {
          try {
            await Share.share({
              title: result.filename,
              text: language === 'en' ? 'Home Blood Pressure Report' : 'Informe Tensión Arterial domiciliaria',
              url: result.fileUri,
              dialogTitle: language === 'en' ? 'Share report' : 'Compartir informe',
            });
          } catch (error) {
            console.error('Error al abrir/compartir archivo en Android:', error);
          }
        } else if (result.blobUrl) {
          const win = window.open(result.blobUrl, '_blank');
          if (!win) window.location.href = result.blobUrl;
        }
      },
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (restoreBusyRef.current) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus(null);
    setPendingImport(null);
    setMergePreview(null);
    setPreviewStatus('idle');
    previewSeqRef.current += 1;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      if (restoreBusyRef.current) return;
      const content = loadEvent.target?.result;
      if (typeof content !== 'string') return;

      const backupResult = parseBackupContent(content);
      if (backupResult.status === 'valid') {
        setPendingImport({ kind: 'backup', snapshot: backupResult.snapshot });
        void runPreview(backupResult.snapshot);
      } else if (backupResult.status === 'invalid') {
        setImportStatus({
          kind: 'error',
          message: backupResult.reason === 'unsupported-version'
            ? t('data.backupUnsupported')
            : t('data.backupInvalid'),
        });
      } else {
        const result = analyzeCSVImport(content, { defaultArm: settings.defaultArm });
        if (result.format === 'unknown' || result.readings.length === 0) {
          setImportStatus({ kind: 'error', message: t('export.importNoValidReadings') });
        } else {
          setPendingImport({ kind: 'csv', result });
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setImportStatus({ kind: 'error', message: t('export.importReadError') });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  const confirmCSVImport = async () => {
    if (!pendingImport || pendingImport.kind !== 'csv' || restoreBusyRef.current) return;
    restoreBusyRef.current = true;
    setRestoreBusy(true);
    try {
      const addedCount = await onImportReadings(pendingImport.result.readings);
      setImportStatus({ kind: 'success', message: t('toast.importedCount', { count: addedCount }) });
      setPendingImport(null);
    } catch (error) {
      console.error('Error al importar CSV:', error);
      setImportStatus({
        kind: 'error',
        message: error instanceof Error && error.message === 'SESSION_TOKEN_REQUIRED'
          ? t('data.restoreSignInAgain') : t('data.restoreFailed'),
      });
    } finally {
      restoreBusyRef.current = false;
      setRestoreBusy(false);
    }
  };

  const runPreview = async (snapshot: AppBackupSnapshot): Promise<BackupMergePreview | null> => {
    if (!onPreviewBackupMerge) return null;
    const seq = previewSeqRef.current;
    setPreviewStatus('checking');
    try {
      const preview = await onPreviewBackupMerge(snapshot);
      if (seq !== previewSeqRef.current) return null;
      setMergePreview(preview);
      setPreviewStatus('ready');
      return preview;
    } catch (error) {
      if (seq !== previewSeqRef.current) return null;
      console.error('Error al previsualizar la combinación:', error);
      setMergePreview(null);
      setPreviewStatus('error');
      setImportStatus({ kind: 'error', message: restoreErrorMessage(error) });
      return null;
    }
  };

  const restoreErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message === 'SESSION_TOKEN_REQUIRED'
      ? t('data.restoreSignInAgain')
      : error instanceof Error && error.message === 'MERGE_PREVIEW_STALE'
        ? t('data.mergePreviewStale')
        : t('data.restoreFailed');

  const confirmBackupRestore = async (mode: 'merge' | 'replace') => {
    if (restoreBusyRef.current || !pendingImport || pendingImport.kind !== 'backup') return;
    if (mode === 'replace' && !window.confirm(t('data.replaceConfirm'))) return;
    restoreBusyRef.current = true;
    setRestoreBusy(true);
    setImportStatus(null);
    try {
      if (mode === 'merge') {
        if (!onPreviewBackupMerge) throw new Error('Previsualización no disponible');
        if (!mergePreview) {
          await runPreview(pendingImport.snapshot);
          return; // Let the user inspect refreshed counts before any write.
        }
        const restored = await onRestoreBackup(pendingImport.snapshot, mode, mergePreview.previewToken);
        setImportStatus({
          kind: 'success',
          message: t('data.restoreMergeSummary', {
            added: (restored as BackupMergeCounts).addedCount,
            duplicates: (restored as BackupMergeCounts).duplicateCount,
            conflicts: (restored as BackupMergeCounts).conflictCount,
          }),
        });
      } else {
        setMergePreview(null);
        const restored = await onRestoreBackup(pendingImport.snapshot, mode);
        setImportStatus({
          kind: 'success',
          message: t('data.restoreReplaceSuccess', { count: restored as number }),
        });
      }
      setPendingImport(null);
    } catch (error) {
      console.error('Error al restaurar la copia:', error);
      if (error instanceof Error && error.message === 'MERGE_PREVIEW_STALE' && mode === 'merge') {
        setMergePreview(null);
        setImportStatus({ kind: 'error', message: t('data.mergePreviewStale') });
        await runPreview(pendingImport.snapshot);
      } else {
        setImportStatus({
          kind: 'error',
          message: restoreErrorMessage(error),
        });
      }
    } finally {
      restoreBusyRef.current = false;
      setRestoreBusy(false);
    }
  };

  const openFilePicker = () => { if (!restoreBusyRef.current) fileInputRef.current?.click(); };

  return (
    <div className="modal-overlay" onClick={() => { if (!restoreBusyRef.current) onClose(); }}>
      <div className="modal-content data-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <DatabaseBackup size={26} className="modal-icon legal-icon-main" />
            <h2 className="legal-modal-title">{t('data.title')}</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} disabled={restoreBusy} aria-label={t('settings.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-tabs data-tabs">
          {(['backup', 'import', 'report'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`modal-tab ${activeTab === tab ? 'active' : ''}`}
              disabled={restoreBusy}
              onClick={() => setActiveTab(tab)}
            >
              {t(`data.tab.${tab}`)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === 'backup' && (
            <div className="data-panel">
              <section className="backup-action-card">
                <div className="backup-create-row">
                  <button type="button" className="btn-create-backup" onClick={onTriggerManualBackup} disabled={readings.length === 0}>
                    <DatabaseBackup size={20} />
                    {t('data.createBackupNow')}
                  </button>
                  <div className="backup-last-backup">
                    <span>{t('data.lastBackup')}</span>
                    <strong>{lastBackup}</strong>
                  </div>
                </div>

                <div className="modal-field backup-schedule-card">
                  <label className="field-label">
                    <Clock3 size={20} className="export-field-icon" />
                    <span>{t('data.scheduleTitle')}</span>
                  </label>
                  <div className="chip-options-row backup-frequency-options">
                    {(['disabled', 'daily', 'weekly', 'monthly'] as const).map((frequency) => (
                      <button
                        key={frequency}
                        type="button"
                        className={`chip-select ${settings.backupFrequency === frequency ? 'active' : ''}`}
                        onClick={() => handleBackupFrequency(frequency)}
                      >
                        {t(`data.frequency.${frequency}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="backup-action-card restore-backup-card">
                <button type="button" className="btn-select-backup" onClick={() => setActiveTab('import')}>
                  <Upload size={20} />
                  {t('data.restoreBackup')}
                </button>
              </section>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="import-tab-content data-panel">
              <div className="import-dropzone" onClick={openFilePicker}>
                <Upload size={32} className="dropzone-icon" />
                <h3>{t('data.selectFile')}</h3>
                <p className="dropzone-sub">{t('data.importDescription')}</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.json,.cta-backup.json,text/csv,application/json"
                  onChange={handleFileChange}
                  disabled={restoreBusy}
                  style={{ display: 'none' }}
                />
              </div>

              {pendingImport?.kind === 'backup' && (
                <div className="import-preview-card">
                  <div className="import-preview-heading">
                    <DatabaseBackup size={21} />
                    <div>
                      <h3>{t('export.importPreviewTitle')}</h3>
                      <p>{t('data.nativeBackupDetected')}</p>
                    </div>
                  </div>
                  <div className="import-summary-grid backup-preview-grid">
                    <div className="import-summary-item">
                      <strong>{pendingImport.snapshot.readings.length}</strong>
                      <span>{t('export.importReadingsReady')}</span>
                    </div>
                    <div className="import-summary-item">
                      <strong>{new Date(pendingImport.snapshot.createdAt).toLocaleDateString(locale)}</strong>
                      <span>{t('data.backupCreatedAt')}</span>
                    </div>
                    {mergePreview && (
                      <>
                        <div className="import-summary-item merge-count">
                          <strong>{mergePreview.addedCount}</strong>
                          <span>{t('data.mergeSummaryAdded')}</span>
                        </div>
                        <div className="import-summary-item merge-count">
                          <strong>{mergePreview.duplicateCount}</strong>
                          <span>{t('data.mergeSummaryDuplicates')}</span>
                        </div>
                        <div className={`import-summary-item merge-count${mergePreview.conflictCount > 0 ? ' is-conflict' : ''}`}>
                          <strong>{mergePreview.conflictCount}</strong>
                          <span>{t('data.mergeSummaryConflicts')}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {previewStatus === 'checking' && (
                    <div className="import-preview-note merge-checking-note" aria-live="polite">
                      <Clock3 size={17} />
                      <span>{t('data.mergePreviewChecking')}</span>
                    </div>
                  )}
                  <div className="import-preview-actions restore-actions">
                    <button
                      type="button"
                      className="btn-import-confirm"
                      disabled={restoreBusy || previewStatus === 'checking'}
                      onClick={() => confirmBackupRestore('merge')}
                    >
                      <CheckCircle2 size={18} />
                      {t('data.mergeBackup')}
                    </button>
                    <button type="button" className="btn-replace-data" disabled={restoreBusy} onClick={() => confirmBackupRestore('replace')}>
                      {t('data.replaceData')}
                    </button>
                    <button type="button" className="btn-import-reselect" disabled={restoreBusy} onClick={openFilePicker}>
                      {t('data.selectAnotherFile')}
                    </button>
                  </div>
                </div>
              )}

              {pendingImport?.kind === 'csv' && (
                <div className="import-preview-card">
                  <div className="import-preview-heading">
                    <FileSpreadsheet size={21} />
                    <div>
                      <h3>{t('export.importPreviewTitle')}</h3>
                      <p>
                        {pendingImport.result.format === 'mytherapy'
                          ? t('export.importFormatMyTherapy')
                          : t('data.legacyCsvDetected')}
                      </p>
                    </div>
                  </div>
                  <div className="import-summary-grid">
                    <div className="import-summary-item">
                      <strong>{pendingImport.result.readings.length}</strong>
                      <span>{t('export.importReadingsReady')}</span>
                    </div>
                    <div className="import-summary-item">
                      <strong>{pendingImport.result.ignoredRows}</strong>
                      <span>{t('export.importRowsIgnored')}</span>
                    </div>
                    <div className="import-summary-item">
                      <strong>{pendingImport.result.shorthandNormalized}</strong>
                      <span>{t('export.importShorthandNormalized')}</span>
                    </div>
                    <div className="import-summary-item">
                      <strong>{pendingImport.result.invalidReadings}</strong>
                      <span>{t('export.importInvalidReadings')}</span>
                    </div>
                  </div>

                  {pendingImport.result.format === 'native' && (
                    <div className="import-preview-note">
                      <AlertCircle size={17} />
                      <span>{t('data.legacyCsvNotice')}</span>
                    </div>
                  )}
                  {pendingImport.result.format === 'mytherapy' && (
                    <div className="import-preview-note">
                      <AlertCircle size={17} />
                      <span>{t('export.importMyTherapyNotice', {
                        arm: settings.defaultArm === 'right' ? t('form.armRight') : t('form.armLeft'),
                      })}</span>
                    </div>
                  )}
                  {pendingImport.result.shorthandNormalized > 0 && (
                    <div className="import-preview-note warning">
                      <AlertCircle size={17} />
                      <span>{t('export.importShorthandNotice', { count: pendingImport.result.shorthandNormalized })}</span>
                    </div>
                  )}
                  {pendingImport.result.incompleteGroups > 0 && (
                    <div className="import-preview-note warning">
                      <AlertCircle size={17} />
                      <span>{t('export.importIncompleteNotice', { count: pendingImport.result.incompleteGroups })}</span>
                    </div>
                  )}
                  <div className="import-preview-actions">
                    <button type="button" className="btn-import-confirm" disabled={restoreBusy} onClick={confirmCSVImport}>
                      <CheckCircle2 size={18} />
                      {t('export.confirmImport')}
                    </button>
                    <button type="button" className="btn-import-reselect" disabled={restoreBusy} onClick={openFilePicker}>
                      {t('data.selectAnotherFile')}
                    </button>
                  </div>
                </div>
              )}

              {importStatus && (
                <div className={`import-status-box ${importStatus.kind}`}>
                  {importStatus.kind === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{importStatus.message}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="data-panel">
              <div className="modal-field export-patient-card">
                <div className="field-label" style={{ margin: 0 }}>
                  <User size={20} className="export-field-icon" />
                  <span>
                    {t('data.patientLabel')}{' '}
                    <span style={{ fontWeight: 400 }}>{settings.patientName || t('data.unnamedPatient')}</span>
                  </span>
                </div>
                <label className="export-privacy-toggle">
                  <input type="checkbox" checked={hidePatientData} onChange={(event) => setHidePatientData(event.target.checked)} />
                  <span>{t('export.hidePatientData')}</span>
                </label>
              </div>

              <div className="modal-field">
                <label className="field-label">
                  <Calendar size={20} className="export-field-icon" />
                  <span>{t('export.filterRangeLabel')}</span>
                </label>
                <div className="range-options-grid">
                  {(['7days', '1month', '3months', 'all'] as const).map((rangePreset) => (
                    <button
                      key={rangePreset}
                      type="button"
                      className={`range-option ${preset === rangePreset ? 'selected' : ''}`}
                      onClick={() => setPreset(rangePreset)}
                    >
                      {t(`list.preset${rangePreset === 'all' ? 'All' : rangePreset === '7days' ? '7Days' : rangePreset === '1month' ? '1Month' : '3Months'}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-field">
                <label className="field-label">
                  <FileText size={20} className="export-field-icon" />
                  <span>{t('export.clinicalNotesLabel')}</span>
                </label>
                <textarea
                  value={reportNotes}
                  onChange={(event) => setReportNotes(event.target.value)}
                  placeholder={t('export.clinicalNotesPlaceholder')}
                  className="modal-input"
                  rows={2}
                />
              </div>

              <div className="data-caveat report-caveat">
                <AlertCircle size={17} />
                <span>{t('data.reportCsvNotice')}</span>
              </div>
              <div className="export-actions-container">
                <button type="button" className="btn-export-csv" onClick={handleExportCSV}>
                  <FileSpreadsheet size={20} />
                  <span>{t('data.downloadCsvReport')}</span>
                </button>
                <button type="button" className="btn-export-pdf" onClick={handlePrintPDF}>
                  <Printer size={22} />
                  <span>{t('export.downloadPdf')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
