import { useState, useEffect } from 'react';
import type { BloodPressureReading, ArmPosition, DateRange, AppSettings, InputMode, AuthUser } from './types/bloodPressure';
import {
  fetchReadingsFromServer,
  addReadingToServer,
  updateReadingOnServer,
  deleteReadingFromServer,
  deleteSessionFromServer,
  clearAllReadingsOnServer,
  importReadingsToServer,
  fetchSettingsFromServer,
  saveSettingsToServer,
  DEFAULT_SETTINGS,
} from './services/storageService';
import { getAuthStatus, logout } from './services/authService';
import { processReadingsIntoSessions } from './utils/whiteCoatAlgorithm';
import { checkAndExecuteAutoBackup } from './utils/backupScheduler';
import { exportToCSV } from './utils/exportCsv';
import { Header } from './components/Header';
import { ReadingForm } from './components/ReadingForm';
import { WhiteCoatBanner } from './components/WhiteCoatBanner';
import { TrendChart } from './components/TrendChart';
import { ReadingList } from './components/ReadingList';
import { EditReadingModal } from './components/EditReadingModal';
import { ExportModal, type ToastNotification } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { LegalNoticeModal } from './components/LegalNoticeModal';
import { LoginModal } from './components/LoginModal';
import { TotpSetupModal } from './components/TotpSetupModal';
import { UserManagementModal } from './components/UserManagementModal';
import { LanguageProvider } from './i18n/LanguageContext';
import { getTranslation } from './i18n/translations';

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isLegalNoticeOpen, setIsLegalNoticeOpen] = useState<boolean>(false);
  const [isTotpModalOpen, setIsTotpModalOpen] = useState<boolean>(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState<boolean>(false);

  const [dateRange, setDateRange] = useState<DateRange>({ preset: '30days' });
  const [readingToEdit, setReadingToEdit] = useState<BloodPressureReading | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | ToastNotification | null>(null);

  const { sessions } = processReadingsIntoSessions(readings, settings);

  // 1. Verificar sesión del servidor al arrancar
  useEffect(() => {
    async function checkAuth() {
      setAuthChecking(true);
      const status = await getAuthStatus();
      setHasAdmin(status.hasAdmin);
      if (status.user) {
        setCurrentUser(status.user);
        await loadUserData();
      }
      setAuthChecking(false);
    }
    checkAuth();
  }, []);

  async function loadUserData() {
    const [fetchedReadings, fetchedSettings] = await Promise.all([
      fetchReadingsFromServer(),
      fetchSettingsFromServer(),
    ]);
    setReadings(fetchedReadings);
    setSettings(fetchedSettings);
  }

  const handleLoginSuccess = async (user: AuthUser) => {
    setCurrentUser(user);
    setHasAdmin(true);
    await loadUserData();
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setReadings([]);
  };

  useEffect(() => {
    if (currentUser && sessions.length > 0) {
      const result = checkAndExecuteAutoBackup(sessions, settings, handleUpdateSettings);
      if (result.backupExecuted) {
        setNotificationMsg(getTranslation(settings.language, 'toast.autoBackup', { date: result.dateStr ?? '' }));
        setTimeout(() => setNotificationMsg(null), 6000);
      }
    }
  }, [readings.length, settings.backupFrequency, currentUser]);

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettingsToServer(newSettings);
  };

  const handleUpdateInputMode = (mode: InputMode) => {
    const updated = { ...settings, preferredInputMode: mode };
    handleUpdateSettings(updated);
  };

  const handleImportReadings = async (imported: Omit<BloodPressureReading, 'id'>[]) => {
    const result = await importReadingsToServer(imported);
    setReadings(result.readings);
    setNotificationMsg(getTranslation(settings.language, 'toast.importedCount', { count: result.addedCount }));
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  const handleTriggerManualBackup = () => {
    if (sessions.length === 0) {
      alert(getTranslation(settings.language, 'toast.noDataToExport'));
      return;
    }
    const now = new Date();
    exportToCSV(sessions, { preset: 'all' }, 'tension_arterial', {
      patientName: settings.patientName,
      patientSex: settings.patientSex,
      patientAge: settings.patientAge,
    }, settings.language);

    const updatedSettings = {
      ...settings,
      lastBackupTimestamp: now.toISOString(),
    };
    handleUpdateSettings(updatedSettings);
    setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupSuccess'));
    setTimeout(() => setNotificationMsg(null), 5000);
  };

  const handleResetDemoData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.resetDemoConfirm'))) {
      await clearAllReadingsOnServer();
      setReadings([]);
      setIsSettingsModalOpen(false);
      setNotificationMsg(getTranslation(settings.language, 'toast.resetDemoSuccess'));
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.clearAllConfirm'))) {
      await clearAllReadingsOnServer();
      setReadings([]);
      setIsSettingsModalOpen(false);
      setNotificationMsg(getTranslation(settings.language, 'toast.clearAllSuccess'));
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  const handleToggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const handleAddReading = async (data: {
    systolic: number;
    diastolic: number;
    heartRate: number;
    arm: ArmPosition;
    notes?: string;
  }) => {
    const created = await addReadingToServer({
      timestamp: new Date().toISOString(),
      systolic: data.systolic,
      diastolic: data.diastolic,
      heartRate: data.heartRate,
      arm: data.arm,
      notes: data.notes,
    });
    if (created) {
      setReadings((prev) => [created, ...prev]);
    }
  };

  const handleDeleteSession = async (sessionToDelete: any) => {
    if (window.confirm(getTranslation(settings.language, 'list.deleteSessionConfirm'))) {
      const ids = sessionToDelete.readings.map((r: any) => r.id);
      const ok = await deleteSessionFromServer(ids);
      if (ok) {
        setReadings((prev) => prev.filter((r) => !ids.includes(r.id)));
      }
    }
  };

  const handleDeleteSingleReading = async (readingId: string) => {
    if (window.confirm(getTranslation(settings.language, 'list.deleteReadingConfirm'))) {
      const ok = await deleteReadingFromServer(readingId);
      if (ok) {
        setReadings((prev) => prev.filter((r) => r.id !== readingId));
      }
    }
  };

  const handleSaveReadingEdit = async (updatedReading: BloodPressureReading) => {
    const ok = await updateReadingOnServer(updatedReading);
    if (ok) {
      setReadings((prev) => prev.map((r) => (r.id === updatedReading.id ? updatedReading : r)));
    }
  };

  const lastReading = readings.length > 0 ? readings[0] : null;

  if (authChecking) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <p>Cargando servidor...</p>
      </div>
    );
  }

  return (
    <LanguageProvider
      language={settings.language}
      onLanguageChange={(lang) => handleUpdateSettings({ ...settings, language: lang })}
    >
      <div className="app-container">
        {!currentUser && (
          <LoginModal
            hasAdmin={hasAdmin}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {notificationMsg && (
          <div className="toast-modal-overlay" onClick={() => setNotificationMsg(null)}>
            <div className="toast-notification" onClick={(e) => e.stopPropagation()}>
              <div className="toast-top-row">
                <span className="toast-message-text">
                  {typeof notificationMsg === 'string' ? notificationMsg : notificationMsg.message}
                </span>
                <button
                  type="button"
                  className="toast-close-btn"
                  onClick={() => setNotificationMsg(null)}
                  aria-label="Cerrar notificación"
                >
                  ×
                </button>
              </div>

              {typeof notificationMsg === 'object' && notificationMsg.actionLabel && notificationMsg.onAction && (
                <div className="toast-bottom-row">
                  <button
                    type="button"
                    className="toast-action-btn"
                    onClick={() => {
                      notificationMsg.onAction?.();
                      setNotificationMsg(null);
                    }}
                  >
                    {notificationMsg.actionLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <Header
          currentUser={currentUser}
          onOpenExportModal={() => setIsExportModalOpen(true)}
          onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
          onOpenUserMgmtModal={() => setIsUserMgmtModalOpen(true)}
          onLogout={handleLogout}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
        />

        <ReadingForm
          onAddReading={handleAddReading}
          settings={settings}
          onUpdateInputMode={handleUpdateInputMode}
          lastReading={lastReading}
        />

        <WhiteCoatBanner settings={settings} onOpenSettings={() => setIsSettingsModalOpen(true)} />

        <TrendChart sessions={sessions} />

        <ReadingList
          sessions={sessions}
          onDeleteSession={handleDeleteSession}
          onDeleteSingleReading={handleDeleteSingleReading}
          onEditReading={(reading) => setReadingToEdit(reading)}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <footer className="app-footer">
          <span>{getTranslation(settings.language, 'header.title')}</span>
          <span> &bull; </span>
          <button
            type="button"
            className="btn-footer-link"
            onClick={() => setIsLegalNoticeOpen(true)}
          >
            {getTranslation(settings.language, 'legal.footerLink')}
          </button>
        </footer>

        <EditReadingModal
          isOpen={Boolean(readingToEdit)}
          reading={readingToEdit}
          settings={settings}
          onUpdateInputMode={handleUpdateInputMode}
          onClose={() => setReadingToEdit(null)}
          onSaveReading={handleSaveReadingEdit}
        />

        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          sessions={sessions}
          settings={settings}
          currentUser={currentUser}
          onImportReadings={handleImportReadings}
          onNotify={(msg) => setNotificationMsg(msg)}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetDemoData={handleResetDemoData}
          onClearAllData={handleClearAllData}
          onTriggerManualBackup={handleTriggerManualBackup}
          onOpenTotpModal={() => {
            setIsSettingsModalOpen(false);
            setIsTotpModalOpen(true);
          }}
        />

        <TotpSetupModal
          isOpen={isTotpModalOpen}
          onClose={() => setIsTotpModalOpen(false)}
          isTotpEnabled={Boolean(currentUser?.totp_enabled)}
          onTotpStatusChanged={(enabled) => {
            if (currentUser) {
              setCurrentUser({ ...currentUser, totp_enabled: enabled });
            }
          }}
        />

        {currentUser && currentUser.role === 'admin' && (
          <UserManagementModal
            isOpen={isUserMgmtModalOpen}
            onClose={() => setIsUserMgmtModalOpen(false)}
            currentUser={currentUser}
          />
        )}

        <LegalNoticeModal
          isOpen={isLegalNoticeOpen}
          onClose={() => setIsLegalNoticeOpen(false)}
        />
      </div>
    </LanguageProvider>
  );
}

export default App;
