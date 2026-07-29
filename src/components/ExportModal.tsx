import React, { useState } from 'react';
import type { BloodPressureSession, DateFilterPreset, DateRange, BloodPressureReading, AppSettings, ExportReportOptions, AuthUser } from '../types/bloodPressure';
import { exportToCSV } from '../utils/exportCsv';
import { downloadPDFReport, calculateAge } from '../utils/pdfGenerator';
import { parseCSVData } from '../utils/importCsv';
import { FileSpreadsheet, Printer, X, Calendar, User, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

import { Share } from '@capacitor/share';

export interface ToastNotification {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: BloodPressureSession[];
  settings: AppSettings;
  currentUser?: AuthUser | null;
  onImportReadings: (readings: Omit<BloodPressureReading, 'id'>[]) => void;
  onNotify?: (toast: string | ToastNotification) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sessions,
  settings,
  currentUser,
  onImportReadings,
  onNotify,
}) => {
  const { t, language } = useLanguage();
  const [preset, setPreset] = useState<DateFilterPreset>('30days');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [hidePatientData, setHidePatientData] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getCurrentRange = (): DateRange => ({
    preset,
  });

  const getExportOptions = (): ExportReportOptions => {
    const nameVal = currentUser?.name || settings.patientName;
    const sexVal = currentUser?.sex || settings.patientSex;
    const birthDateVal = currentUser?.birth_date || settings.patientBirthDate;
    const ageVal = birthDateVal ? calculateAge(birthDateVal) : (settings.patientAge || '');

    return {
      patientName: nameVal,
      patientSex: sexVal,
      patientAge: ageVal,
      patientBirthDate: birthDateVal,
      takesAntihypertensiveMedication: settings.takesAntihypertensiveMedication,
      reportNotes: reportNotes.trim() ? reportNotes.trim() : undefined,
      hidePatientData,
    };
  };

  const handleExportCSV = () => {
    exportToCSV(sessions, getCurrentRange(), 'tension_arterial', getExportOptions(), language);
    onClose();
    if (onNotify) {
      onNotify(t('toast.manualBackupSuccess'));
    }
  };

  const handlePrintPDF = async () => {
    onClose();
    if (onNotify) {
      onNotify(t('toast.pdfDownloadStarting'));
    }
    const result = await downloadPDFReport(sessions, getCurrentRange(), getExportOptions(), language);
    if (result.success && onNotify) {
      const actionLabel = language === 'en' ? 'View / Share' : 'Ver / Compartir';

      onNotify({
        message: t('toast.pdfDownloadSuccess'),
        actionLabel,
        onAction: async () => {
          if (result.isNative && result.fileUri) {
            try {
              await Share.share({
                title: result.filename,
                text: language === 'en' ? 'Blood Pressure Clinical Report' : 'Informe Clínico de Tensión Arterial',
                url: result.fileUri,
                dialogTitle: language === 'en' ? 'Open or Share PDF' : 'Abrir o Compartir PDF',
              });
            } catch (err) {
              console.error('Error al abrir/compartir archivo en Android:', err);
            }
          } else if (result.blobUrl) {
            const win = window.open(result.blobUrl, '_blank');
            if (!win) {
              window.location.href = result.blobUrl;
            }
          }
        },
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseCSVData(text);
        if (parsed.length === 0) {
          setImportStatus(language === 'en' ? 'No valid blood pressure records found in CSV.' : 'No se encontraron registros de tensión válidos en el archivo CSV.');
        } else {
          onImportReadings(parsed);
          setImportStatus(t('toast.importedCount', { count: parsed.length }));
        }
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const currentOpts = getExportOptions();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Printer size={26} className="modal-icon legal-icon-main" />
            <h2 className="legal-modal-title">{t('export.title')}</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label={t('settings.close')}>
            <X size={20} />
          </button>
        </div>

        {/* Pestañas Exportar / Importar */}
        <div className="modal-tabs">
          <button
            type="button"
            className={`modal-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            {t('export.tabPdf').split(' ')[0]}
          </button>
          <button
            type="button"
            className={`modal-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            {language === 'en' ? 'Import' : 'Importar'}
          </button>
        </div>

        <div className="modal-body">
          {activeTab === 'export' ? (
            <>
              {/* Resumen del perfil de paciente */}
              <div className="modal-field export-patient-card">
                <div className="field-label" style={{ margin: 0 }}>
                  <User size={20} className="export-field-icon" />
                  <span>
                    {language === 'en' ? 'Patient Profile: ' : 'Paciente (Perfil): '}
                    <span style={{ fontWeight: 600 }}>
                      {currentOpts.patientName || (language === 'en' ? 'Unnamed' : 'Sin nombre')}
                    </span>
                    {currentOpts.patientSex ? ` (${currentOpts.patientSex})` : ''}
                  </span>
                </div>

                {/* Interruptor para Ocultar datos del paciente */}
                <label style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={hidePatientData}
                    onChange={(e) => setHidePatientData(e.target.checked)}
                  />
                  <span>{t('export.hidePatientData')}</span>
                </label>
              </div>

              {/* Rango de Fechas */}
              <div className="modal-field">
                <label className="field-label">
                  <Calendar size={20} className="export-field-icon" />
                  <span>{t('export.filterRangeLabel')}</span>
                </label>

                <div className="range-options-grid">
                  <button
                    type="button"
                    className={`range-option ${preset === '7days' ? 'selected' : ''}`}
                    onClick={() => setPreset('7days')}
                  >
                    {t('list.preset7Days')}
                  </button>
                  <button
                    type="button"
                    className={`range-option ${preset === '30days' ? 'selected' : ''}`}
                    onClick={() => setPreset('30days')}
                  >
                    {t('list.preset30Days')}
                  </button>
                  <button
                    type="button"
                    className={`range-option ${preset === '90days' ? 'selected' : ''}`}
                    onClick={() => setPreset('90days')}
                  >
                    {t('list.preset90Days')}
                  </button>
                  <button
                    type="button"
                    className={`range-option ${preset === 'all' ? 'selected' : ''}`}
                    onClick={() => setPreset('all')}
                  >
                    {t('list.presetAll')}
                  </button>
                </div>
              </div>

              {/* Campo opcional de Observaciones / Nota del informe */}
              <div className="modal-field">
                <label className="field-label">
                  <FileText size={20} className="export-field-icon" />
                  <span>{t('export.clinicalNotesLabel')}</span>
                </label>
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder={t('export.clinicalNotesPlaceholder')}
                  className="modal-input"
                  rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '13px' }}
                />
              </div>

              {/* Acciones de exportación */}
              <div className="export-actions-container">
                <button type="button" className="btn-export-csv" onClick={handleExportCSV}>
                  <FileSpreadsheet size={20} />
                  <span>{t('export.downloadCsv')}</span>
                </button>

                <button type="button" className="btn-export-pdf" onClick={handlePrintPDF}>
                  <Printer size={22} />
                  <span>{t('export.downloadPdf')}</span>
                </button>
              </div>
            </>
          ) : (
            /* Pestaña Importar CSV */
            <div className="import-tab-content">
              <div className="import-dropzone" onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} className="dropzone-icon" />
                <h3>{t('export.selectCsv')}</h3>
                <p className="dropzone-sub">
                  {t('export.csvImportDesc')}
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {importStatus && (
                <div className={`import-status-box ${importStatus.includes('✓') || importStatus.includes('Éxito') ? 'success' : 'error'}`}>
                  {importStatus.includes('✓') || importStatus.includes('Éxito') ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{importStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
