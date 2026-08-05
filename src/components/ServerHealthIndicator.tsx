import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../i18n/useLanguage';
import { checkServerHealth } from '../services/serverHealthService';
import { ServerStatusModal } from './ServerStatusModal';

type ServerHealthState = 'checking' | 'online' | 'offline';

const CHECK_INTERVAL_MS = 30_000;
const FAILURE_CONFIRMATION_DELAY_MS = 1_500;

interface ServerHealthIndicatorProps {
  healthUrl: string;
  isAdmin?: boolean;
}

export const ServerHealthIndicator: React.FC<ServerHealthIndicatorProps> = ({ healthUrl, isAdmin = false }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ServerHealthState>('checking');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const closeDetails = useCallback(() => setIsDetailsOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let intervalId: number | undefined;
    let retryId: number | undefined;

    const check = async () => {
      if (running || document.visibilityState !== 'visible') return;
      if (!healthUrl) {
        setStatus('offline');
        return;
      }

      running = true;
      let healthy = await checkServerHealth(healthUrl);

      if (!healthy && !cancelled && document.visibilityState === 'visible') {
        await new Promise<void>((resolve) => {
          retryId = window.setTimeout(resolve, FAILURE_CONFIRMATION_DELAY_MS);
        });
        if (!cancelled && document.visibilityState === 'visible') {
          healthy = await checkServerHealth(healthUrl);
        }
      }

      if (!cancelled) setStatus(healthy ? 'online' : 'offline');
      running = false;
    };

    const updatePolling = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      intervalId = undefined;

      if (document.visibilityState === 'visible') {
        void check();
        intervalId = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
      }
    };

    setStatus('checking');
    updatePolling();
    document.addEventListener('visibilitychange', updatePolling);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', updatePolling);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      if (retryId !== undefined) window.clearTimeout(retryId);
    };
  }, [healthUrl]);

  const label = t(`header.serverHealth.${status}`);

  const indicator = isAdmin ? (
    <button type="button" className={`server-health-indicator server-health-button status-${status}`} aria-label={`${label}. ${t('header.serverHealth.detailsTooltip')}`} data-tooltip={`${label}. ${t('header.serverHealth.detailsTooltip')}`} onClick={() => setIsDetailsOpen(true)}>
      <span className="server-health-led" aria-hidden="true" />
    </button>
  ) : (
    <span className={`server-health-indicator status-${status}`} role="status" aria-label={label} tabIndex={0} data-tooltip={label}>
      <span className="server-health-led" aria-hidden="true" />
    </span>
  );

  return <>{indicator}{isAdmin && <ServerStatusModal isOpen={isDetailsOpen} healthUrl={healthUrl} onClose={closeDetails} />}</>;
};
