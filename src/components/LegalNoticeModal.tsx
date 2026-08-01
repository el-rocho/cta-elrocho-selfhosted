import React from 'react';
import { ShieldCheck, X, AlertTriangle, Lock, DatabaseBackup } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import type { GuidelineProfile } from '../types/bloodPressure';
import { getGuidelineName, getGuidelineSourceUrl } from '../utils/healthClassification';

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  guidelineProfile: GuidelineProfile;
}

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({ isOpen, onClose, guidelineProfile }) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  const guidelineName = getGuidelineName(guidelineProfile, language);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ShieldCheck size={26} className="modal-icon text-blue legal-icon-main" />
            <h2 className="legal-modal-title">{t('legal.title')}</h2>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label={t('settings.close')}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div className="settings-subcard" style={{ marginBottom: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <div className="field-label" style={{ color: '#d97706', margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
              <AlertTriangle size={22} className="legal-icon-block" />
              <span>{t('legal.medicalTitle')}</span>
            </div>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              {t('legal.medicalPurpose', { guideline: guidelineName })}
            </p>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              <a href={getGuidelineSourceUrl(guidelineProfile)} target="_blank" rel="noreferrer">
                {t('legal.sourceLink')}
              </a>
            </p>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              {t('legal.medicalLimits')}
            </p>
            <p style={{ margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>
              <strong>{t('legal.medicationWarning')}</strong>{' '}
              {t('legal.emergencyWarning')}
            </p>
          </div>

          <div className="settings-subcard" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div className="field-label" style={{ color: '#059669', margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
              <Lock size={22} className="legal-icon-block" />
              <span>{t('legal.privacyTitle')}</span>
            </div>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              <strong>{t('legal.storageLabel')}</strong>{' '}
              {t('legal.storageText')}
            </p>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              <strong>{t('legal.networkLabel')}</strong>{' '}
              {t('legal.networkText')}
            </p>
            <p style={{ margin: 0, lineHeight: '1.5' }}>
              <strong>{t('legal.controlLabel')}</strong>{' '}
              {t('legal.controlText')}
            </p>
          </div>

          <div className="settings-subcard" style={{ marginTop: '16px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <div className="field-label" style={{ color: '#2563eb', margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
              <DatabaseBackup size={22} className="legal-icon-block" />
              <span>{t('legal.filesTitle')}</span>
            </div>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>{t('legal.filesText')}</p>
            <p style={{ margin: 0, lineHeight: '1.5' }}>{t('legal.restoreText')}</p>
          </div>

          <p style={{ margin: '14px 4px 0', fontStyle: 'italic', fontSize: '12px', lineHeight: '1.4' }}>
            {t('legal.responsibilityNote')} · {t('legal.updated')}
          </p>
        </div>
      </div>
    </div>
  );
};
