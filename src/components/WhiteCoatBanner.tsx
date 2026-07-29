import React, { useState } from 'react';
import { ShieldAlert, ChevronDown, ChevronUp, Info, Settings } from 'lucide-react';
import type { AppSettings } from '../types/bloodPressure';
import { useLanguage } from '../i18n/useLanguage';

interface WhiteCoatBannerProps {
  settings: AppSettings;
  onOpenSettings: () => void;
}

export const WhiteCoatBanner: React.FC<WhiteCoatBannerProps> = ({ settings, onOpenSettings }) => {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  // Si el filtro de bata blanca está inactivo por configuración, no mostrar el banner en la interfaz
  if (!settings.enableWhiteCoatFilter) {
    return null;
  }

  return (
    <div className="white-coat-banner">
      <div className="banner-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="banner-title">
          <ShieldAlert className="banner-icon" size={18} />
          <span>
            {t('whiteCoatBanner.activeTitle')}:{' '}
            <strong className="text-green">({settings.whiteCoatIntervalMinutes} min)</strong>
          </span>
        </div>
        <div className="banner-actions-group" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-subtle-settings"
            onClick={onOpenSettings}
            title={t('whiteCoatBanner.configure')}
          >
            <Settings size={14} /> {t('whiteCoatBanner.configure')}
          </button>
          <button
            type="button"
            className="btn-banner-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label="Toggle details"
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="banner-content">
          <p>
            <Info size={14} className="inline-icon" />
            {t('whiteCoatBanner.activeDesc', { mins: settings.whiteCoatIntervalMinutes })}
          </p>
        </div>
      )}
    </div>
  );
};
