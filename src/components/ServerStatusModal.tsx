import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Clock3, Database, HardDrive, MemoryStick, Network, RefreshCw, ServerCog, X } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { getAdminServerStatus, ServerStatusRequestError, type ServerStatusErrorCode, type ServerSystemStatus } from '../services/serverStatusService';

const REFRESH_INTERVAL_MS = 5_000;

interface ServerStatusModalProps { isOpen: boolean; healthUrl: string; onClose: () => void }
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  percentage?: number | null;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, detail, percentage }) => (
  <div className="server-status-metric-card">
    <div className="server-status-metric-heading">{icon}<span>{label}</span></div>
    <strong className="server-status-metric-value">{value}</strong>
    {percentage !== null && percentage !== undefined && (
      <div className="server-status-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}>
        <span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
      </div>
    )}
    {detail && <span className="server-status-metric-detail">{detail}</span>}
  </div>
);

export const ServerStatusModal: React.FC<ServerStatusModalProps> = ({ isOpen, healthUrl, onClose }) => {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<ServerSystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ServerStatusErrorCode | null>(null);
  const requestInProgress = useRef(false);

  const loadStatus = useCallback(async () => {
    if (!healthUrl || document.visibilityState !== 'visible' || requestInProgress.current) return;
    requestInProgress.current = true;
    setIsLoading(true);
    try {
      const nextStatus = await getAdminServerStatus(healthUrl);
      setStatus(nextStatus);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof ServerStatusRequestError ? caughtError.code : 'unavailable');
    } finally {
      requestInProgress.current = false;
      setIsLoading(false);
    }
  }, [healthUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setError(null);
    void loadStatus();
    const intervalId = window.setInterval(() => void loadStatus(), REFRESH_INTERVAL_MS);
    const handleVisibility = () => { if (document.visibilityState === 'visible') void loadStatus(); };
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loadStatus, onClose]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return t('header.serverStatus.notAvailable');
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = Math.max(0, bytes);
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) { value /= 1024; unitIndex += 1; }
    return `${new Intl.NumberFormat(language, { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
  };
  const formatDuration = (seconds: number) => {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    const minutes = Math.floor((seconds % 3_600) / 60);
    return [days ? `${days} d` : '', hours ? `${hours} h` : '', `${minutes} min`].filter(Boolean).join(' ');
  };
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : t('header.serverStatus.never');

  const memoryValue = status?.memory
    ? status.memory.usagePercent === null ? formatBytes(status.memory.usedBytes) : `${status.memory.usagePercent.toFixed(1)} %`
    : t('header.serverStatus.notAvailable');
  const memoryDetail = status?.memory
    ? status.memory.limitBytes
      ? t('header.serverStatus.usedOf', { used: formatBytes(status.memory.usedBytes), total: formatBytes(status.memory.limitBytes) })
      : t('header.serverStatus.processUsed', { used: formatBytes(status.memory.usedBytes) })
    : undefined;

  return createPortal(
    <div className="modal-overlay server-status-overlay" onClick={onClose}>
      <div className="modal-content server-status-dialog" role="dialog" aria-modal="true" aria-labelledby="server-status-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header server-status-header">
          <div className="modal-title-group">
            <ServerCog size={24} className="modal-icon text-blue" />
            <div><h2 id="server-status-title">{t('header.serverStatus.title')}</h2><span className="server-status-auto-refresh">v1.6.1-beta.3</span></div>
          </div>
          <div className="server-status-header-actions">
            <button type="button" className="server-status-refresh-button" title={t('header.serverStatus.refresh')} aria-label={t('header.serverStatus.refresh')} onClick={() => void loadStatus()} disabled={isLoading}>
              <RefreshCw size={18} className={isLoading ? 'is-spinning' : ''} />
            </button>
            <button type="button" className="btn-close-modal" aria-label={t('header.serverStatus.close')} onClick={onClose}><X size={20} /></button>
          </div>
        </div>
        {error && <div className="server-status-error" role="alert">{t(`header.serverStatus.${error}`)}</div>}
        {!status && isLoading && <div className="server-status-loading"><RefreshCw size={22} className="is-spinning" /><span>{t('header.serverStatus.loading')}</span></div>}
        {status && (
          <div className="server-status-body">
            <div className="server-status-overview">
              <div className="server-status-service-state"><span className="server-status-online-dot" aria-hidden="true" /><div><strong>{t('header.serverStatus.serviceAvailable')}</strong><span>{t('header.serverStatus.databaseAvailable')}</span></div></div>
              <dl className="server-status-facts">
                <div><dt>{t('header.serverStatus.version')}</dt><dd>{status.version}</dd></div>
                <div><dt>{t('header.serverStatus.uptime')}</dt><dd>{formatDuration(status.uptimeSeconds)}</dd></div>
                <div><dt>{t('header.serverStatus.latency')}</dt><dd>{status.connectionLatencyMs} ms</dd></div>
              </dl>
            </div>
            <div className="server-status-metrics-grid">
              <MetricCard icon={<Activity size={18} />} label={t('header.serverStatus.cpuProcess')} value={status.cpu?.usagePercent === null || !status.cpu ? t('header.serverStatus.calculating') : `${status.cpu.usagePercent.toFixed(1)} %`} percentage={status.cpu?.usagePercent} detail={status.cpu ? t('header.serverStatus.logicalCores', { count: status.cpu.logicalCores }) : undefined} />
              <MetricCard icon={<MemoryStick size={18} />} label={status.memory?.scope === 'container' ? t('header.serverStatus.memoryContainer') : t('header.serverStatus.memoryProcess')} value={memoryValue} percentage={status.memory?.usagePercent} detail={memoryDetail} />
              <MetricCard icon={<HardDrive size={18} />} label={t('header.serverStatus.diskData')} value={status.disk?.usagePercent === null || !status.disk ? t('header.serverStatus.notAvailable') : `${status.disk.usagePercent.toFixed(1)} %`} percentage={status.disk?.usagePercent} detail={status.disk ? t('header.serverStatus.freeSpace', { free: formatBytes(status.disk.freeBytes) }) : undefined} />
            </div>
            <div className="server-status-detail-grid">
              <section className="server-status-detail-card">
                <div className="server-status-section-title"><Database size={18} /><strong>{t('header.serverStatus.database')}</strong></div>
                <dl>
                  <div><dt>{t('header.serverStatus.databaseSize')}</dt><dd>{formatBytes(status.database.sizeBytes)}</dd></div>
                  <div><dt>{t('header.serverStatus.databaseResponse')}</dt><dd>{status.database.responseTimeMs.toFixed(1)} ms</dd></div>
                  <div><dt><Clock3 size={14} />{t('header.serverStatus.lastBackup')}</dt><dd>{formatDate(status.backup.lastAt)}</dd></div>
                  <div><dt>{t('header.serverStatus.lastFullBackup')}</dt><dd>{formatDate(status.backup.lastFullAt)}</dd></div>
                </dl>
              </section>
              <section className="server-status-detail-card">
                <div className="server-status-section-title"><Network size={18} /><strong>{t('header.serverStatus.apiActivity')}</strong></div>
                <dl>
                  <div><dt>{t('header.serverStatus.requestsLastMinute')}</dt><dd>{status.api.requestsLastMinute}</dd></div>
                  <div><dt>{t('header.serverStatus.averageResponse')}</dt><dd>{status.api.averageResponseTimeMs.toFixed(1)} ms</dd></div>
                  <div><dt>{t('header.serverStatus.received')}</dt><dd>{formatBytes(status.api.receivedBytesLastMinute)}</dd></div>
                  <div><dt>{t('header.serverStatus.sent')}</dt><dd>{formatBytes(status.api.sentBytesLastMinute)}</dd></div>
                </dl>
              </section>
            </div>
            <p className="server-status-scope-note">{t('header.serverStatus.scopeNote')}</p>
            <p className="server-status-updated">{t('header.serverStatus.updatedAt', { date: formatDate(status.checkedAt) })}</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
