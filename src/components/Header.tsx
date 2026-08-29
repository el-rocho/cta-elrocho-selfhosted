import React from 'react';
import { Server, Download, Moon, Sun, Settings, LogOut, Users } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { AppLogo } from './AppLogo';
import { ServerHealthIndicator } from './ServerHealthIndicator';
import type { AuthUser } from '../types/bloodPressure';

interface HeaderProps {
  currentUser: AuthUser | null;
  onOpenExportModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenUserMgmtModal?: () => void;
  onLogout?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenExportModal,
  onOpenSettingsModal,
  onOpenUserMgmtModal,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const { t } = useLanguage();
  const appVersion = import.meta.env.VITE_APP_VERSION || 'v1.6.1-beta.3';

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">
          <AppLogo className="brand-logo-img" />
        </div>
        <div>
          <h1 className="brand-title">{t('header.title')}</h1>
          <div className="brand-badge">
            <Server size={13} className="shield-icon" />
            <span>
              {currentUser ? currentUser.name : t('header.badgePrivate')} &bull; {appVersion}
            </span>
            <ServerHealthIndicator healthUrl="/api/health" isAdmin={currentUser?.role === 'admin'} />
          </div>
        </div>
      </div>

      <div className="header-actions">
        <button
          onClick={onToggleDarkMode}
          className="btn-icon"
          title={isDarkMode ? t('header.lightMode') : t('header.darkMode')}
        >
          {isDarkMode ? <Sun size={25} /> : <Moon size={25} />}
        </button>

        {currentUser && currentUser.role === 'admin' && onOpenUserMgmtModal && (
          <button
            type="button"
            onClick={onOpenUserMgmtModal}
            className="btn-icon"
            title="Gestión de usuarios"
          >
            <Users size={25} />
          </button>
        )}

        <button
          onClick={onOpenSettingsModal}
          className="btn-icon"
          title={t('header.settingsTooltip')}
        >
          <Settings size={25} />
        </button>

        <button
          onClick={onOpenExportModal}
          className="btn-icon"
          title={t('header.exportTooltip')}
        >
          <Download size={25} />
        </button>

        {currentUser && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="btn-icon"
            style={{ color: '#ef4444' }}
            title="Cerrar Sesión"
          >
            <LogOut size={25} />
          </button>
        )}
      </div>
    </header>
  );
};
