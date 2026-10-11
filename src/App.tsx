import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { BloodPressureReading, ArmPosition, DateRange, AppSettings, InputMode, AuthUser } from './types/bloodPressure';
import {
  fetchReadingsFromServer,
  addReadingToServer,
  updateReadingOnServer,
  updateMedicationContextForAllReadings,
  deleteReadingFromServer,
  deleteSessionFromServer,
  clearAllReadingsOnServer,
  resetDemoDataOnServer,
  importReadingsToServer,
  restoreBackupOnServer,
  fetchSettingsFromServer,
  saveSettingsToServer,
  DEFAULT_SETTINGS,
} from './services/storageService';
import { checkCurrentSession, getAuthStatus, logout } from './services/authService';
import {
  applyTotpStatusIfAuthenticated,
  notifySessionInvalid,
  onSessionInvalid,
  shouldShowSessionNotification,
  shouldShowLoginAfterSessionInvalid,
} from './services/sessionGuard';
import { processReadingsIntoSessions } from './utils/whiteCoatAlgorithm';
import { isBackupDue } from './utils/backupScheduler';
import { downloadBackup, type AppBackupSnapshot } from './utils/backupService';
import { isRestoreSessionCurrent } from './utils/restoreSession';
import { Header } from './components/Header';
import { ReadingForm } from './components/ReadingForm';
import { TrendChart } from './components/TrendChart';
import { TrendInsights } from './components/TrendInsights';
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
  const [isTotpRecoveryCodesVisible, setIsTotpRecoveryCodesVisible] = useState<boolean>(false);
  const [isUserMgmtModalOpen, setIsUserMgmtModalOpen] = useState<boolean>(false);

  const [dateRange, setDateRange] = useState<DateRange>({ preset: '1month' });
  const [readingToEdit, setReadingToEdit] = useState<BloodPressureReading | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | ToastNotification | null>(null);
  const backupReminderKeyRef = useRef<string | null>(null);
  const dataLoadVersionRef = useRef(0);

  const handleUpdateSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await saveSettingsToServer(newSettings);
  }, []);

  const handleMedicationContextChange = async (
    takesMedication: boolean,
    recalculateHistory: boolean
  ): Promise<boolean> => {
    const updatedSettings = {
      ...settings,
      takesAntihypertensiveMedication: takesMedication,
    };
    if (recalculateHistory) {
      const updated = await updateMedicationContextForAllReadings(takesMedication);
      if (!updated) {
        setNotificationMsg(getTranslation(settings.language, 'settings.medicationChangeFailed'));
        return false;
      }
      setSettings(updatedSettings);
      setReadings((current) =>
        current.map((reading) => ({
          ...reading,
          takesAntihypertensiveMedication: takesMedication,
        }))
      );
      return true;
    }
    const saved = await saveSettingsToServer(updatedSettings);
    if (!saved) {
      setNotificationMsg(getTranslation(settings.language, 'settings.medicationChangeFailed'));
      return false;
    }
    setSettings(updatedSettings);
    return true;
  };

  const { sessions } = useMemo(
    () => processReadingsIntoSessions(readings, settings),
    [readings, settings]
  );

  // 1. Verificar sesión del servidor al arrancar
  useEffect(() => {
    async function checkAuth() {
      setAuthChecking(true);
      const status = await getAuthStatus();
      setHasAdmin(status.hasAdmin);
      if (status.user) {
        const loadVersion = ++dataLoadVersionRef.current;
        setReadings([]);
        setSettings(DEFAULT_SETTINGS);
        setCurrentUser(status.user);
        await loadUserData(loadVersion);
      } else {
        ++dataLoadVersionRef.current;
        setCurrentUser(null);
        setReadings([]);
        setSettings(DEFAULT_SETTINGS);
      }
      setAuthChecking(false);
    }
    checkAuth();
  }, []);

  // 2. Volver al acceso en cuanto el servidor rechace la sesión (por ejemplo,
  //    tras restablecer la contraseña desde otro dispositivo).
  useEffect(() => {
    return onSessionInvalid((showNotification) => {
      ++dataLoadVersionRef.current;
      setIsExportModalOpen(false);
      setCurrentUser(null);
      setReadings([]);
      setSettings(DEFAULT_SETTINGS);
      setNotificationMsg(showNotification ? getTranslation(settings.language, 'toast.sessionExpired') : null);
    });
  }, [settings.language]);

  // 3. Revalidar la sesión al recuperar el foco y periódicamente, porque una
  //    pestaña abierta no recibe aviso cuando la sesión se revoca.
  useEffect(() => {
    if (!currentUser) return undefined;

    let active = true;
    const revalidate = async () => {
      const { reachable, user } = await checkCurrentSession();
      if (!active || !reachable) return;
      if (!user) notifySessionInvalid();
    };

    const handleFocus = () => {
      if (document.visibilityState === 'visible') revalidate();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    const intervalId = window.setInterval(revalidate, 5 * 60 * 1000);

    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [currentUser]);

  async function loadUserData(loadVersion: number) {
    const [fetchedReadings, fetchedSettings] = await Promise.all([
      fetchReadingsFromServer(),
      fetchSettingsFromServer(),
    ]);
    if (loadVersion !== dataLoadVersionRef.current) return;
    setReadings(fetchedReadings);
    setSettings(fetchedSettings);
  }

  const handleLoginSuccess = async (user: AuthUser) => {
    const loadVersion = ++dataLoadVersionRef.current;
    setIsExportModalOpen(false);
    setReadings([]);
    setSettings(DEFAULT_SETTINGS);
    setCurrentUser(user);
    setHasAdmin(true);
    await loadUserData(loadVersion);
  };

  const handleLogout = async () => {
    ++dataLoadVersionRef.current;
    setIsExportModalOpen(false);
    setReadings([]);
    setSettings(DEFAULT_SETTINGS);
    await logout();
    setCurrentUser(null);
  };

  useEffect(() => {
    const showBackupReminderIfDue = () => {
      if (!currentUser || !isBackupDue(readings, settings)) return;
      const reminderKey = `${settings.backupFrequency}:${settings.lastFullBackupTimestamp ?? 'never'}:${new Date().toDateString()}`;
      if (backupReminderKeyRef.current === reminderKey) return;
      backupReminderKeyRef.current = reminderKey;
      setNotificationMsg({
        message: getTranslation(settings.language, 'toast.backupDue'),
        actionLabel: getTranslation(settings.language, 'toast.openBackups'),
        variant: 'soft-blue',
        onAction: () => setIsExportModalOpen(true),
      });
    };

    showBackupReminderIfDue();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') showBackupReminderIfDue();
    };
    const intervalId = window.setInterval(showBackupReminderIfDue, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, readings, settings]);

  const handleUpdateInputMode = (mode: InputMode) => {
    const updated = { ...settings, preferredInputMode: mode };
    handleUpdateSettings(updated);
  };

  const handleImportReadings = async (imported: Omit<BloodPressureReading, 'id'>[]) => {
    if (!currentUser) throw new Error('No hay una sesión activa para importar');
    const importGeneration = dataLoadVersionRef.current;
    const importUserId = currentUser.id;
    const result = await importReadingsToServer(imported);
    if (!isRestoreSessionCurrent(importGeneration, dataLoadVersionRef.current, importUserId, currentUser.id)) {
      throw new Error('La sesión cambió durante la importación');
    }
    setReadings(result.readings);
    setNotificationMsg(getTranslation(settings.language, 'toast.importedCount', { count: result.addedCount }));
    setTimeout(() => setNotificationMsg(null), 5000);
    return result.addedCount;
  };

  const handleTriggerManualBackup = () => {
    if (readings.length === 0) {
      alert(getTranslation(settings.language, 'toast.noDataToExport'));
      return;
    }
    const now = new Date();
    try {
      downloadBackup(readings, settings, now);
      setNotificationMsg({
        actionLabel: getTranslation(settings.language, 'toast.confirmBackupSaved'),
        cancelLabel: getTranslation(settings.language, 'toast.backupCancelledAction'),
        variant: 'neutral',
        onAction: () => {
          const updatedSettings = {
            ...settings,
            lastBackupTimestamp: now.toISOString(),
            lastFullBackupTimestamp: now.toISOString(),
          };
          handleUpdateSettings(updatedSettings);
          setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupSuccess'));
          setTimeout(() => setNotificationMsg(null), 5000);
        },
      });
    } catch (error) {
      console.error('Error al solicitar la descarga de la copia:', error);
      setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupError'));
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handleRestoreBackup = async (snapshot: AppBackupSnapshot, mode: 'merge' | 'replace') => {
    const imported = snapshot.readings.map(({ id: _id, ...reading }) => reading);
    if (mode === 'replace') {
      if (!currentUser) throw new Error('No hay una sesión activa para restaurar');
      const restoreGeneration = dataLoadVersionRef.current;
      const restoreUserId = currentUser.id;
      const result = await restoreBackupOnServer(snapshot);
      if (!isRestoreSessionCurrent(restoreGeneration, dataLoadVersionRef.current, restoreUserId, currentUser.id)) {
        throw new Error('La sesión cambió durante la restauración');
      }
      setReadings(result.readings);
      setSettings(result.settings);
      setCurrentUser((user) => user?.id === restoreUserId ? {
        ...user,
        name: result.settings.patientName ?? '',
        sex: result.settings.patientSex,
        birth_date: result.settings.patientBirthDate,
      } : user);
      return result.readings.length;
    }

    if (!currentUser) throw new Error('No hay una sesión activa para importar');
    const importGeneration = dataLoadVersionRef.current;
    const importUserId = currentUser.id;
    const result = await importReadingsToServer(imported);
    if (!isRestoreSessionCurrent(importGeneration, dataLoadVersionRef.current, importUserId, currentUser.id)) {
      throw new Error('La sesión cambió durante la importación');
    }
    setReadings(result.readings);
    return result.addedCount;
  };

  const handleResetDemoData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.resetDemoConfirm'))) {
      const demoReadings = await resetDemoDataOnServer();
      setReadings(demoReadings);
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
    pulsePressureWarningConfirmed?: boolean;
  }) => {
    const created = await addReadingToServer({
      timestamp: new Date().toISOString(),
      systolic: data.systolic,
      diastolic: data.diastolic,
      heartRate: data.heartRate,
      arm: data.arm,
      notes: data.notes,
      pulsePressureWarningConfirmed: data.pulsePressureWarningConfirmed,
      takesAntihypertensiveMedication: settings.takesAntihypertensiveMedication,
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
        {shouldShowLoginAfterSessionInvalid(currentUser, isTotpRecoveryCodesVisible) && (
          <LoginModal
            hasAdmin={hasAdmin}
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {notificationMsg && shouldShowSessionNotification(notificationMsg, isTotpRecoveryCodesVisible) && (
          <div className={`toast-modal-overlay ${typeof notificationMsg === 'object' ? notificationMsg.variant ?? '' : ''}`} onClick={() => setNotificationMsg(null)}>
            <div className={`toast-notification ${typeof notificationMsg === 'object' ? notificationMsg.variant ?? '' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="toast-top-row">
                {(typeof notificationMsg === 'string' || notificationMsg.message) && (
                  <span className="toast-message-text">
                    {typeof notificationMsg === 'string' ? notificationMsg : notificationMsg.message}
                  </span>
                )}
                {(typeof notificationMsg === 'string' || !notificationMsg.cancelLabel) && (
                  <button
                    type="button"
                    className="toast-close-btn"
                    onClick={() => setNotificationMsg(null)}
                    aria-label="Cerrar notificación"
                  >
                    ×
                  </button>
                )}
              </div>

              {typeof notificationMsg === 'object' && notificationMsg.detail && (
                <span className="toast-detail-text">{notificationMsg.detail}</span>
              )}

              {typeof notificationMsg === 'object' && notificationMsg.actionLabel && notificationMsg.onAction && (
                <div className="toast-bottom-row">
                  <button
                    type="button"
                    className="toast-action-btn"
                    onClick={() => {
                      setNotificationMsg(null);
                      notificationMsg.onAction?.();
                    }}
                  >
                    {notificationMsg.actionLabel}
                  </button>
                  {notificationMsg.cancelLabel && (
                    <button type="button" className="toast-cancel-btn" onClick={() => setNotificationMsg(null)}>
                      {notificationMsg.cancelLabel}
                    </button>
                  )}
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
          readings={readings}
        />

        <TrendChart
          sessions={sessions}
          settings={settings}
        />

        <TrendInsights
          sessions={sessions}
          guidelineProfile={settings.guidelineProfile}
          settings={settings}
        />

        <ReadingList
          sessions={sessions}
          onDeleteSession={handleDeleteSession}
          onDeleteSingleReading={handleDeleteSingleReading}
          onEditReading={(reading) => setReadingToEdit(reading)}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          settings={settings}
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
          onDeleteReading={handleDeleteSingleReading}
          readings={readings}
        />

        {currentUser && isExportModalOpen && <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          sessions={sessions}
          readings={readings}
          settings={settings}
          currentUser={currentUser}
          onImportReadings={handleImportReadings}
          onRestoreBackup={handleRestoreBackup}
          onUpdateSettings={handleUpdateSettings}
          onTriggerManualBackup={handleTriggerManualBackup}
          onNotify={(msg) => setNotificationMsg(msg)}
        />}

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onMedicationContextChange={handleMedicationContextChange}
          onResetDemoData={handleResetDemoData}
          onClearAllData={handleClearAllData}
          onOpenTotpModal={() => {
            setIsSettingsModalOpen(false);
            setIsTotpModalOpen(true);
          }}
          isTotpEnabled={Boolean(currentUser?.totp_enabled)}
        />

        <TotpSetupModal
          isOpen={isTotpModalOpen}
          onClose={() => setIsTotpModalOpen(false)}
          isTotpEnabled={Boolean(currentUser?.totp_enabled)}
          onTotpStatusChanged={(enabled) => {
            setCurrentUser((user) => applyTotpStatusIfAuthenticated(user, enabled));
          }}
          onRecoveryCodesVisibilityChange={setIsTotpRecoveryCodesVisible}
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
          guidelineProfile={settings.guidelineProfile}
        />
      </div>
    </LanguageProvider>
  );
}

export default App;
