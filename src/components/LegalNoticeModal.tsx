import React from 'react';
import { ShieldCheck, X, AlertTriangle, Lock } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({ isOpen, onClose }) => {
  const { t, language } = useLanguage();

  if (!isOpen) return null;

  const isEn = language === 'en';

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
          {/* Exención de responsabilidad médica */}
          <div className="settings-subcard" style={{ marginBottom: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <div className="field-label" style={{ color: '#d97706', margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
              <AlertTriangle size={22} className="legal-icon-block" />
              <span>{isEn ? 'Medical Disclaimer:' : 'Exención de responsabilidad médica:'}</span>
            </div>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              {isEn
                ? 'This app is intended exclusively for personal tracking of blood pressure readings. The displayed information is for informational purposes only.'
                : 'Esta aplicación está destinada exclusivamente al registro y seguimiento personal de valores de tensión arterial. La información mostrada tiene carácter meramente informativo.'}
            </p>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              {isEn
                ? 'It is not a medical device, does not diagnose, and does not replace evaluation, advice, or treatment prescribed by a qualified healthcare professional.'
                : 'No constituye un producto sanitario, no realiza diagnósticos y no sustituye la valoración, el consejo ni el tratamiento indicado por un profesional sanitario cualificado.'}
            </p>
            <p style={{ margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>
              <em>
                {isEn
                  ? 'Do not modify your medication or make medical decisions based on app data. Always consult your physician.'
                  : 'No modifique su medicación ni tome decisiones médicas basándose en los datos de la aplicación. Consulte siempre con su médico.'}
              </em>
            </p>
          </div>

          {/* Privacidad y protección de datos */}
          <div className="settings-subcard" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <div className="field-label" style={{ color: '#059669', margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '14px', gap: '8px' }}>
              <Lock size={22} className="legal-icon-block" />
              <span>{isEn ? 'Privacy & Data Protection' : 'Privacidad y protección de datos'}</span>
            </div>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              <strong>{isEn ? '100% Private:' : '100% Privado:'}</strong>{' '}
              {isEn
                ? 'All entered data (readings, patient profile, and notes) is processed and stored exclusively on the self-hosted private server. The application does not collect, transmit, or share data with third-party servers. It uses no cookies, analytics, advertising, or tracking tools.'
                : 'Todos los datos introducidos (lecturas, perfil del paciente y notas) se procesan y almacenan exclusivamente en el servidor privado autoalojado. La aplicación no recopila, transmite ni comparte datos con servidores de terceros. Tampoco utiliza cookies, servicios de análisis, publicidad ni herramientas de seguimiento.'}
            </p>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              <strong>{isEn ? '100% Control:' : '100% Control:'}</strong>{' '}
              {isEn
                ? 'The user can consult, export, and erase data at any time. Exported files remain under user control and responsibility.'
                : 'El usuario puede consultar, exportar y eliminar sus datos en cualquier momento. Los archivos exportados quedan bajo su control y responsabilidad.'}
            </p>
            <p style={{ margin: '12px 0 0 0', fontStyle: 'italic', fontSize: '12px', lineHeight: '1.4' }}>
              {isEn
                ? 'Designed following Privacy by Design and Data Minimization principles set by EU GDPR.'
                : 'La aplicación ha sido diseñada siguiendo los principios de privacidad de diseño y minimización de datos establecidos en el RGPD de la Unión Europea.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
