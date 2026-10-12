import { useState, useEffect, useMemo, useRef } from 'react';
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
  previewBackupMergeOnServer,
  mergeBackupOnServer,
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
import { EditReadingModal, type DeleteReadingOutcome } from './components/EditReadingModal';
import { ExportModal, type ToastNotification } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { LegalNoticeModal } from './components/LegalNoticeModal';
import { LoginModal } from './components/LoginModal';
import { TotpSetupModal } from './components/TotpSetupModal';
import { UserManagementModal } from './components/UserManagementModal';
import { LanguageProvider } from './i18n/LanguageContext';
import { getTranslation } from './i18n/translations';

export type SettingsSaveOutcome =
  // El servidor confirmó esta intención: tal cual, o incluida en otra que la
  // absorbió (en ese caso su delta también quedó persistido).
  | 'saved'
  // Se descartó porque el contexto de ajustes cambió (restauración, cierre o
  // invalidación de sesión) y sus valores ya no describen la sesión actual.
  | 'discarded'
  // El servidor rechazó (o no pudo confirmarse) la intención vigente: se revirtió
  // a lo confirmado.
  | 'failed';

// Escritura de ajustes encolada. `changes` son los campos que la intención del
// usuario modifica respecto al estado sobre el que se compuso, no una copia
// completa: al enviar se reconstruye el payload sobre el estado vigente para no
// revertir confirmaciones ajenas (por ejemplo un recálculo de medicación) al
// reenviar campos que esta intención no toca.
interface QueuedSettingsWrite {
  changes: Partial<AppSettings>;
  request: (payload: AppSettings) => Promise<void>;
  // Acción que acompaña a la confirmación (p. ej. propagar la medicación a las
  // mediciones ya guardadas).
  onConfirmed?: () => void;
  failureMessageKey: string;
  // Las intenciones de guardado completo se pueden agrupar (la última contiene
  // todo lo que el usuario quiere guardar). Las operaciones que no son un
  // guardado completo nunca se descartan.
  coalescable: boolean;
  // Intenciones coalescibles que esta absorbió: sus cambios viajan ya dentro de
  // `changes` y del payload que se enviará, así que comparten su desenlace (si
  // se confirma, su delta quedó persistido; si falla o se descarta, no). No se
  // resuelven al absorberlas para no suprimir su confirmación real.
  absorbed?: QueuedSettingsWrite[];
  resolve: (outcome: SettingsSaveOutcome) => void;
}

// Cola de un solo vuelo por generación de sesión: a lo sumo una petición de
// ajustes en curso y, si llegan varias intenciones, se envía la última al
// terminar la anterior. La generación aumenta cada vez que cambia el contexto
// (restauración, cierre o invalidación de sesión) para que una respuesta tardía
// (o un timeout) de la sesión anterior no toque la cola de la siguiente.
interface InFlightSettingsWrite {
  write: QueuedSettingsWrite;
  generation: number;
}

// Plazo máximo que una escritura de ajustes puede quedar en vuelo antes de
// abandonarse, para que una petición colgada no bloquee la cola indefinidamente.
// DECISIÓN: abandonar por plazo NO equivale a un rechazo del servidor. La
// petición abandonada puede completarse después y aplicarse, así que al agotarse
// el plazo no se afirma sin más que no se guardó: se relee el estado del
// servidor (solo lectura y en silencio si la relectura falla) y lo que devuelva
// pasa a ser lo confirmado, avisando solo si el delta no quedó persistido.
const SETTINGS_WRITE_TIMEOUT_MS = 15000;

// Distingue el abandono por plazo de un rechazo real del servidor, para decidir
// si procede la relectura de reconciliación.
const SETTINGS_WRITE_TIMEOUT_ERROR = 'settings-write-timeout';

export interface AppProps {
  // Permite a las pruebas acortar el plazo de abandono de una escritura colgada.
  settingsWriteTimeoutMs?: number;
}

function settingsChanges(base: AppSettings, next: AppSettings): Partial<AppSettings> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(next) as Array<keyof AppSettings>) {
    if (next[key] !== base[key]) changes[key] = next[key];
  }
  return changes as Partial<AppSettings>;
}

function rebaseSettings(changes: Partial<AppSettings>, current: AppSettings): AppSettings {
  return { ...current, ...changes };
}

// Resuelve una intención y todas las que absorbió con el mismo desenlace: al
// compartir payload comparten resultado (un rechazo o un descarte también las
// afecta; una confirmación implica que su delta quedó persistido).
function settleWrite(write: QueuedSettingsWrite, outcome: SettingsSaveOutcome) {
  for (const absorbed of write.absorbed ?? []) settleWrite(absorbed, outcome);
  write.resolve(outcome);
}

// ¿El delta de una intención está ya presente en el estado leído del servidor?
function settingsDeltaPersisted(changes: Partial<AppSettings>, settings: AppSettings): boolean {
  return (Object.keys(changes) as Array<keyof AppSettings>).every((key) => settings[key] === changes[key]);
}

export function App({ settingsWriteTimeoutMs = SETTINGS_WRITE_TIMEOUT_MS }: AppProps = {}) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [hasAdmin, setHasAdmin] = useState<boolean>(true);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authStartupFailed, setAuthStartupFailed] = useState<boolean>(false);

  const [readings, setReadings] = useState<BloodPressureReading[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  // Autoridad sincrónica del estado visible (con las escrituras optimistas ya
  // aplicadas) y del último estado confirmado por el servidor: permiten revertir
  // un rechazo sin depender de un cierre obsoleto ni del momento en que React
  // re-renderiza.
  const settingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  const confirmedSettingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  // Único indicador de que los ajustes del usuario de la sesión se cargaron bien.
  // Mientras sea falso no se inicia ninguna escritura de ajustes (ni desde el
  // modal, ni desde el modo de entrada del formulario o del modal de edición, ni
  // desde la frecuencia de copias): el estado visible son valores por defecto y
  // persistirlos borraría los ajustes reales del usuario.
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const settingsLoadedRef = useRef<boolean>(false);
  // Estado de error de la carga, para que la ausencia de datos no quede
  // silenciosa y el usuario pueda reintentar.
  const [dataLoadFailed, setDataLoadFailed] = useState<boolean>(false);
  // Cola de un solo vuelo de las escrituras de ajustes: a lo sumo una petición
  // en curso y, si llegan varias intenciones, se envía la última al terminar la
  // anterior.
  const settingsQueueRef = useRef<{ inFlight: InFlightSettingsWrite | null; generation: number; pending: QueuedSettingsWrite[] }>({
    inFlight: null,
    generation: 0,
    pending: [],
  });
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
  // Cambia con cada transición de sesión (acceso, cierre o invalidación) para
  // forzar el reinicio de los valores de formulario ligados a la sesión anterior
  // (los tecleados y la confirmación de presión de pulso) que, de otro modo,
  // sobrevivirían en componentes que permanecen montados, como el formulario.
  const [sessionResetToken, setSessionResetToken] = useState(0);

  function applySettings(next: AppSettings) {
    settingsRef.current = next;
    setSettings(next);
  }

  // Fija los ajustes confirmados por el servidor (carga, restauración o
  // escritura aceptada): son la referencia a la que se revierte un rechazo.
  function applyConfirmedSettings(next: AppSettings) {
    confirmedSettingsRef.current = next;
    applySettings(next);
  }

  // Descarta todo lo pendiente y en vuelo de ajustes: el contexto cambió
  // (restauración, cierre o invalidación de sesión), así que ninguna respuesta
  // tardía puede reaplicar los valores anteriores. Se libera además el turno
  // único (la cola es por generación), de modo que una petición colgada de la
  // sesión anterior no bloquea las escrituras de la siguiente; su resultado
  // tardío (o su timeout) se ignora porque ya no pertenece a esta generación.
  function discardPendingSettingsWrites(): boolean {
    const queue = settingsQueueRef.current;
    queue.generation += 1;
    const dropped = queue.pending;
    queue.pending = [];
    dropped.forEach((write) => settleWrite(write, 'discarded'));
    const orphaned = queue.inFlight;
    queue.inFlight = null;
    if (orphaned) settleWrite(orphaned.write, 'discarded');
    const discarded = dropped.length > 0 || orphaned !== null;
    if (discarded) {
      setNotificationMsg(getTranslation(settingsRef.current.language, 'toast.settingsWriteDiscarded'));
    }
    return discarded;
  }

  // Contexto nuevo sin ajustes cargados (acceso, cierre o invalidación de
  // sesión): los escritores quedan inactivos hasta una carga correcta.
  function resetSettingsContext() {
    discardPendingSettingsWrites();
    settingsLoadedRef.current = false;
    setSettingsLoaded(false);
    setDataLoadFailed(false);
    confirmedSettingsRef.current = DEFAULT_SETTINGS;
    applySettings(DEFAULT_SETTINGS);
  }

  // Estado de interfaz ligado a la sesión: al cerrar, invalidar o cambiar de
  // usuario no puede quedar visible ningún modal con datos del anterior (por
  // ejemplo el de edición con una medición del usuario que salió).
  function resetSessionBoundUi() {
    setReadingToEdit(null);
    setIsExportModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsUserMgmtModalOpen(false);
    setIsTotpModalOpen(false);
    setIsTotpRecoveryCodesVisible(false);
    // Un aviso transitorio (p. ej. el de descarte o el de error de guardado) es
    // de la sesión que se abandona: no puede quedar sobre la pantalla de acceso
    // ni sobre el usuario siguiente.
    setNotificationMsg(null);
    // Reinicia los valores de formulario ligados a la sesión anterior (los
    // tecleados y la confirmación de presión de pulso) en los componentes que
    // permanecen montados entre sesiones.
    setSessionResetToken((token) => token + 1);
  }

  // Una petición de ajustes colgada no puede bloquear la cola para siempre. Al
  // agotarse el plazo se abandona, pero NO se da por rechazada: como la petición
  // abandonada puede completarse después y aplicarse en el servidor, se relee su
  // estado (solo lectura y en silencio si la relectura falla) y se reconcilia con
  // él (ver `SETTINGS_WRITE_TIMEOUT_ERROR` y `reconcileAbandonedSettingsWrite`).
  function withSettingsTimeout(promise: Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(SETTINGS_WRITE_TIMEOUT_ERROR)), settingsWriteTimeoutMs);
      promise.then(
        () => { clearTimeout(timer); resolve(); },
        (error) => { clearTimeout(timer); reject(error); },
      );
    });
  }

  function startSettingsWrite(write: QueuedSettingsWrite) {
    const queue = settingsQueueRef.current;
    queue.inFlight = { write, generation: queue.generation };
    void runSettingsWrite(write);
  }

  function enqueueSettingsWrite(write: QueuedSettingsWrite) {
    const queue = settingsQueueRef.current;
    if (!queue.inFlight) {
      startSettingsWrite(write);
      return;
    }
    if (write.coalescable) {
      // La última intención de guardado contiene ya todo lo que el usuario
      // quiere guardar, así que las anteriores se descartan sin enviarse. Sus
      // campos se fusionan en la intención que las absorbe: el payload que se
      // enviará lleva también esos cambios y el libro de confirmados debe
      // registrar ese mismo delta al aceptarse (si no, una intención parcial
      // desaparecería del libro y un rechazo posterior revertiría de más).
      const replaced = queue.pending.filter((item) => item.coalescable && item.request === write.request);
      if (replaced.length > 0) {
        queue.pending = queue.pending.filter((item) => !replaced.includes(item));
        write.changes = replaced.reduce(
          (changes, item) => ({ ...item.changes, ...changes }),
          write.changes
        );
        // Se absorben en lugar de resolverse como sustituidas: sus cambios ya
        // viajan dentro del payload de esta escritura, así que su desenlace es
        // el de esta. Así quien inició la intención conoce el fallo real y el
        // libro de confirmados conserva también sus campos cuando se guarda.
        write.absorbed = [...(write.absorbed ?? []), ...replaced];
      }
    }
    queue.pending.push(write);
  }

  // Tras abandonar una escritura por plazo agotado, la petición puede completarse
  // después en el servidor y aplicarse. En lugar de dar por hecho que no se
  // guardó, se relee el estado del servidor (solo lectura y en silencio si la
  // relectura falla) y se toma como confirmado lo que devuelva: así lo visible y
  // el libro de confirmados coinciden con la realidad del servidor. Devuelve true
  // si resolvió la intención (como 'saved' si su delta quedó persistido, o como
  // 'failed' con aviso si no) y false si la relectura falló, para que el llamante
  // aplique entonces la reversión con aviso de siempre.
  async function reconcileAbandonedSettingsWrite(
    write: QueuedSettingsWrite,
    generation: number
  ): Promise<boolean> {
    let fetched: AppSettings;
    try {
      fetched = await fetchSettingsFromServer();
    } catch {
      // Silencioso: sin relectura disponible se mantiene la reversión normal.
      return false;
    }
    const queue = settingsQueueRef.current;
    if (generation !== queue.generation || queue.inFlight?.write !== write) {
      // El contexto cambió mientras se releía: la intención ya quedó descartada.
      return true;
    }
    // El servidor es la autoridad: lo releído pasa a ser lo confirmado y lo
    // visible se compone sobre ello conservando los cambios aún en cola.
    confirmedSettingsRef.current = fetched;
    applySettings(queue.pending.reduce((state, item) => rebaseSettings(item.changes, state), fetched));
    queue.inFlight = null;
    if (settingsDeltaPersisted(write.changes, fetched)) {
      // La petición abandonada sí se aplicó: queda confirmada, sin aviso de error.
      write.onConfirmed?.();
      settleWrite(write, 'saved');
    } else {
      setNotificationMsg(getTranslation(settingsRef.current.language, write.failureMessageKey));
      settleWrite(write, 'failed');
    }
    finishSettingsWrite();
    return true;
  }

  async function runSettingsWrite(write: QueuedSettingsWrite) {
    const queue = settingsQueueRef.current;
    const generation = queue.generation;
    // El payload se reconstruye sobre el estado vigente: la intención aporta sus
    // campos y el resto sigue a lo ya confirmado o mostrado.
    const payload = rebaseSettings(write.changes, settingsRef.current);
    let failure: 'timeout' | 'rejected' | null = null;
    try {
      await withSettingsTimeout(write.request(payload));
    } catch (error) {
      failure = error instanceof Error && error.message === SETTINGS_WRITE_TIMEOUT_ERROR ? 'timeout' : 'rejected';
    }
    // El contexto cambió (restauración, cierre o invalidación de sesión) o el
    // turno ya se liberó (timeout o descarte): esta respuesta es obsoleta y no
    // debe reaplicar valores ni tocar la cola de la generación nueva.
    if (generation !== queue.generation || queue.inFlight?.write !== write) {
      settleWrite(write, 'discarded');
      return;
    }
    if (failure) {
      // Un plazo agotado no es un rechazo: si la petición abandonada pudo
      // aplicarse, la relectura de reconciliación fija el estado real y resuelve
      // la intención sin esta reversión.
      if (failure === 'timeout' && await reconcileAbandonedSettingsWrite(write, generation)) {
        return;
      }
      // La relectura pudo disparar una invalidación de sesión (401): si el
      // contexto cambió durante ella, la intención ya quedó descartada y no debe
      // revertir ni avisar sobre la sesión nueva.
      if (generation !== queue.generation || queue.inFlight?.write !== write) {
        settleWrite(write, 'discarded');
        return;
      }
      queue.inFlight = null;
      // El servidor rechazó (o no pudo confirmarse) la intención vigente: se
      // revierte a los ajustes confirmados conservando las intenciones que aún
      // están en cola, y se avisa en lugar de dejar el cambio como guardado.
      const { pending } = queue;
      const rolledBack = pending.reduce((state, item) => rebaseSettings(item.changes, state), confirmedSettingsRef.current);
      applySettings(rolledBack);
      setNotificationMsg(getTranslation(settingsRef.current.language, write.failureMessageKey));
      settleWrite(write, 'failed');
      finishSettingsWrite();
      return;
    }
    queue.inFlight = null;
    // El delta realmente aceptado por el servidor es el de esta intención (con
    // los de las intenciones que absorbió): se registra tal cual para que un
    // rechazo posterior revierta exactamente a lo confirmado.
    confirmedSettingsRef.current = rebaseSettings(write.changes, confirmedSettingsRef.current);
    applySettings(rebaseSettings(write.changes, settingsRef.current));
    write.onConfirmed?.();
    settleWrite(write, 'saved');
    finishSettingsWrite();
  }

  function finishSettingsWrite() {
    const queue = settingsQueueRef.current;
    const next = queue.pending.shift();
    if (next) {
      startSettingsWrite(next);
      return;
    }
    queue.inFlight = null;
  }

  // Escritura de ajustes con aplicación optimista y serializada en la cola.
  function handleUpdateSettings(
    newSettings: AppSettings,
    options: { failureMessageKey?: string } = {}
  ): Promise<SettingsSaveOutcome> {
    if (!settingsLoadedRef.current) {
      setNotificationMsg(getTranslation(settingsRef.current.language, 'toast.settingsUnavailable'));
      return Promise.resolve('discarded');
    }
    const changes = settingsChanges(settingsRef.current, newSettings);
    applySettings(newSettings);
    return new Promise<SettingsSaveOutcome>((resolve) => {
      enqueueSettingsWrite({
        changes,
        request: saveSettingsToServer,
        failureMessageKey: options.failureMessageKey ?? 'toast.settingsSaveError',
        coalescable: true,
        resolve,
      });
    });
  }

  async function handleMedicationContextChange(
    takesMedication: boolean,
    recalculateHistory: boolean
  ): Promise<boolean> {
    if (!settingsLoadedRef.current) {
      setNotificationMsg(getTranslation(settingsRef.current.language, 'toast.settingsUnavailable'));
      return false;
    }
    // La intención se compone desde los ajustes confirmados (no desde un estado
    // paralelo del modal) y se aplica de forma optimista; si el servidor la
    // rechaza, la cola revierte a lo confirmado y avisa.
    const changes: Partial<AppSettings> = { takesAntihypertensiveMedication: takesMedication };
    applySettings(rebaseSettings(changes, settingsRef.current));
    const outcome = await new Promise<SettingsSaveOutcome>((resolve) => {
      enqueueSettingsWrite({
        changes,
        request: recalculateHistory
          ? () => updateMedicationContextForAllReadings(takesMedication)
          : saveSettingsToServer,
        onConfirmed: recalculateHistory
          ? () => setReadings((current) => current.map((reading) => ({
              ...reading,
              takesAntihypertensiveMedication: takesMedication,
            })))
          : undefined,
        failureMessageKey: 'settings.medicationChangeFailed',
        // El recálculo no es un guardado completo: no puede descartarse al
        // agrupar intenciones de guardado.
        coalescable: !recalculateHistory,
        resolve,
      });
    });
    return outcome === 'saved';
  }

  const { sessions } = useMemo(
    () => processReadingsIntoSessions(readings, settings),
    [readings, settings]
  );

  async function checkAuth() {
    setAuthChecking(true);
    setAuthStartupFailed(false);
    try {
      const status = await getAuthStatus();
      setHasAdmin(status.hasAdmin);
      if (status.user) {
        const loadVersion = ++dataLoadVersionRef.current;
        setCurrentUser(status.user);
        await loadUserData(loadVersion);
      } else {
        ++dataLoadVersionRef.current;
        setCurrentUser(null);
        setReadings([]);
        resetSettingsContext();
      }
    } catch (error) {
      console.error('No se pudo consultar el estado de autenticación:', error);
      setAuthStartupFailed(true);
    } finally {
      setAuthChecking(false);
    }
  }

  // 1. Verificar sesión del servidor al arrancar. Un fallo de transporte,
  // HTTP o parseo no equivale a un servidor nuevo sin administrador: se muestra
  // un estado propio y solo una respuesta válida decide entre sesión y acceso.
  useEffect(() => {
    void checkAuth();
  }, []);

  // 2. Volver al acceso en cuanto el servidor rechace la sesión (por ejemplo,
  //    tras restablecer la contraseña desde otro dispositivo).
  useEffect(() => {
    return onSessionInvalid((showNotification) => {
      ++dataLoadVersionRef.current;
      const language = settingsRef.current.language;
      // Toda la interfaz ligada a la sesión invalidada se limpia: los cambios
      // en curso pertenecen a esa sesión y no pueden quedar visibles ni
      // guardarse con el siguiente usuario.
      resetSessionBoundUi();
      setCurrentUser(null);
      setReadings([]);
      resetSettingsContext();
      setNotificationMsg(showNotification ? getTranslation(language, 'toast.sessionExpired') : null);
    });
  }, []);

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
    try {
      const [fetchedReadings, fetchedSettings] = await Promise.all([
        fetchReadingsFromServer(),
        fetchSettingsFromServer(),
      ]);
      if (loadVersion !== dataLoadVersionRef.current) return;
      setReadings(fetchedReadings);
      // Los ajustes del usuario de la sesión pasan a ser los confirmados: desde
      // aquí ya se pueden persistir cambios.
      applyConfirmedSettings(fetchedSettings);
      settingsLoadedRef.current = true;
      setSettingsLoaded(true);
      setDataLoadFailed(false);
    } catch {
      if (loadVersion !== dataLoadVersionRef.current) return;
      // No se aplica nada parcial. Los escritores quedan inactivos hasta una
      // recarga correcta y se muestra el estado de error para que la falta de
      // datos no pase inadvertida.
      settingsLoadedRef.current = false;
      setSettingsLoaded(false);
      setDataLoadFailed(true);
      setNotificationMsg(getTranslation(settingsRef.current.language, 'toast.dataLoadError'));
    }
  }

  function retryDataLoad() {
    if (!currentUser) return;
    const loadVersion = ++dataLoadVersionRef.current;
    void loadUserData(loadVersion);
  }

  const handleLoginSuccess = async (user: AuthUser) => {
    const loadVersion = ++dataLoadVersionRef.current;
    resetSessionBoundUi();
    setCurrentUser(user);
    setHasAdmin(true);
    setReadings([]);
    // Contexto nuevo: nada pendiente del usuario anterior y ninguna escritura
    // hasta que lleguen los ajustes reales de este usuario.
    resetSettingsContext();
    await loadUserData(loadVersion);
  };

  const handleLogout = async () => {
    ++dataLoadVersionRef.current;
    resetSessionBoundUi();
    setReadings([]);
    resetSettingsContext();
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
    // Se compone desde los ajustes vigentes (admite cambios ya aplicados de
    // forma optimista y no depende de un cierre obsoleto del render).
    handleUpdateSettings({ ...settingsRef.current, preferredInputMode: mode });
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
        onAction: async () => {
          const updatedSettings = {
            ...settingsRef.current,
            lastBackupTimestamp: now.toISOString(),
            lastFullBackupTimestamp: now.toISOString(),
          };
          await handleUpdateSettings(updatedSettings);
        },
      });
    } catch (error) {
      console.error('Error al solicitar la descarga de la copia:', error);
      setNotificationMsg(getTranslation(settings.language, 'toast.manualBackupError'));
      setTimeout(() => setNotificationMsg(null), 5000);
    }
  };

  const handlePreviewBackupMerge = async (snapshot: AppBackupSnapshot) => {
    if (!currentUser) throw new Error('No hay una sesión activa para importar');
    const generation = dataLoadVersionRef.current;
    const userId = currentUser.id;
    const preview = await previewBackupMergeOnServer(snapshot);
    if (!isRestoreSessionCurrent(generation, dataLoadVersionRef.current, userId, currentUser.id)) {
      throw new Error('La sesión cambió durante la previsualización');
    }
    return preview;
  };

  const handleRestoreBackup = async (snapshot: AppBackupSnapshot, mode: 'merge' | 'replace', previewToken?: string) => {
    if (mode === 'replace') {
      if (!currentUser) throw new Error('No hay una sesión activa para restaurar');
      const restoreGeneration = dataLoadVersionRef.current;
      const restoreUserId = currentUser.id;
      const result = await restoreBackupOnServer(snapshot);
      if (!isRestoreSessionCurrent(restoreGeneration, dataLoadVersionRef.current, restoreUserId, currentUser.id)) {
        throw new Error('La sesión cambió durante la restauración');
      }
      setReadings(result.readings);
      // La restauración sustituye los ajustes por completo: se descarta todo lo
      // pendiente y en vuelo y los ajustes restaurados pasan a ser los
      // confirmados, de modo que ninguna respuesta tardía pueda reaplicar los
      // valores anteriores.
      discardPendingSettingsWrites();
      applyConfirmedSettings(result.settings);
      settingsLoadedRef.current = true;
      setSettingsLoaded(true);
      setDataLoadFailed(false);
      setCurrentUser((user) => user?.id === restoreUserId ? {
        ...user,
        name: result.settings.patientName ?? '',
        sex: result.settings.patientSex,
        birth_date: result.settings.patientBirthDate,
      } : user);
      return result.readings.length;
    }

    if (!currentUser || !previewToken) throw new Error('Se requiere previsualización y sesión activa');
    const importGeneration = dataLoadVersionRef.current;
    const importUserId = currentUser.id;
    const result = await mergeBackupOnServer(snapshot, previewToken);
    if (!isRestoreSessionCurrent(importGeneration, dataLoadVersionRef.current, importUserId, currentUser.id)) {
      throw new Error('La sesión cambió durante la importación');
    }
    setReadings(result.readings);
    return { addedCount: result.addedCount, duplicateCount: result.duplicateCount, conflictCount: result.conflictCount };
  };

  const handleResetDemoData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.resetDemoConfirm'))) {
      try {
        const demoReadings = await resetDemoDataOnServer();
        setReadings(demoReadings);
        setIsSettingsModalOpen(false);
        setNotificationMsg(getTranslation(settings.language, 'toast.resetDemoSuccess'));
        setTimeout(() => setNotificationMsg(null), 4000);
      } catch {
        setNotificationMsg(getTranslation(settings.language, 'toast.storageOperationError'));
      }
    }
  };

  const handleClearAllData = async () => {
    if (window.confirm(getTranslation(settings.language, 'toast.clearAllConfirm'))) {
      try {
        await clearAllReadingsOnServer();
        setReadings([]);
        setIsSettingsModalOpen(false);
        setNotificationMsg(getTranslation(settings.language, 'toast.clearAllSuccess'));
        setTimeout(() => setNotificationMsg(null), 4000);
      } catch {
        setNotificationMsg(getTranslation(settings.language, 'toast.storageOperationError'));
      }
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
    setReadings((prev) => [created, ...prev]);
  };

  const handleDeleteSession = async (sessionToDelete: any) => {
    if (window.confirm(getTranslation(settings.language, 'list.deleteSessionConfirm'))) {
      const ids = sessionToDelete.readings.map((r: any) => r.id);
      try {
        await deleteSessionFromServer(ids);
        setReadings((prev) => prev.filter((r) => !ids.includes(r.id)));
      } catch {
        setNotificationMsg(getTranslation(settings.language, 'toast.storageOperationError'));
      }
    }
  };

  const handleDeleteSingleReading = async (readingId: string): Promise<DeleteReadingOutcome> => {
    // Cancelar no es un error: se distingue del fallo real para que el modal de
    // edición no muestre un aviso cuando el usuario simplemente descartó.
    if (!window.confirm(getTranslation(settings.language, 'list.deleteReadingConfirm'))) {
      return 'cancelled';
    }
    try {
      await deleteReadingFromServer(readingId);
      setReadings((prev) => prev.filter((r) => r.id !== readingId));
      return 'deleted';
    } catch {
      setNotificationMsg(getTranslation(settings.language, 'toast.storageOperationError'));
      return 'failed';
    }
  };

  const handleSaveReadingEdit = async (updatedReading: BloodPressureReading) => {
    try {
      await updateReadingOnServer(updatedReading);
      setReadings((prev) => prev.map((r) => (r.id === updatedReading.id ? updatedReading : r)));
      return true;
    } catch {
      setNotificationMsg(getTranslation(settings.language, 'toast.storageOperationError'));
      return false;
    }
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
        <p>Cargando servidor...</p>
      </div>
    );
  }

  if (authStartupFailed) {
    return (
      <div
        data-testid="auth-startup-error"
        role="alert"
        style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', gap: '16px', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
      >
        <p>No se pudo conectar con el servidor.</p>
        <button type="button" className="btn-secondary-large" onClick={() => void checkAuth()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <LanguageProvider
      language={settings.language}
      onLanguageChange={(lang) => handleUpdateSettings({ ...settingsRef.current, language: lang })}
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

        {/* Mientras no se hayan cargado correctamente los ajustes de la sesión no
            se persiste nada y el usuario ve el motivo (y puede reintentar): así
            no quedan datos vacíos silenciosos ni se guardan valores por defecto
            sobre los ajustes reales. */}
        {currentUser && !settingsLoaded && (
          <div
            className={`app-data-load-state ${dataLoadFailed ? 'alert-danger is-error' : 'is-loading'}`}
            role="alert"
            data-testid={dataLoadFailed ? 'data-load-error' : 'data-loading'}
          >
            <span>
              {dataLoadFailed
                ? getTranslation(settings.language, 'toast.dataLoadError')
                : getTranslation(settings.language, 'toast.dataLoading')}
            </span>
            {dataLoadFailed && (
              <button type="button" className="btn-secondary-large" onClick={retryDataLoad}>
                {getTranslation(settings.language, 'toast.retryDataLoad')}
              </button>
            )}
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
          sessionResetToken={sessionResetToken}
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
          onPreviewBackupMerge={handlePreviewBackupMerge}
          onRestoreBackup={handleRestoreBackup}
          onUpdateSettings={handleUpdateSettings}
          onTriggerManualBackup={handleTriggerManualBackup}
          onNotify={(msg) => setNotificationMsg(msg)}
        />}

        {/* Igual que el modal de exportación, solo existe con sesión activa. No
            necesita `key`: sin borrador propio está enlazado en vivo a los
            ajustes confirmados y refleja cualquier cambio confirmado. */}
        {currentUser && isSettingsModalOpen && <SettingsModal
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
        />}

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
