import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Key, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { setupTotp, verifyAndEnableTotp, disableTotp } from '../services/authService';

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isTotpEnabled: boolean;
  onTotpStatusChanged: (enabled: boolean) => void;
}

export const TotpSetupModal: React.FC<TotpSetupModalProps> = ({
  isOpen,
  onClose,
  isTotpEnabled,
  onTotpStatusChanged,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !isTotpEnabled && !recoveryCodes) {
      loadSetup();
    }
  }, [isOpen, isTotpEnabled]);

  if (!isOpen) return null;

  async function loadSetup() {
    setLoading(true);
    setErrorMsg(null);
    const data = await setupTotp();
    if (data && data.qrCodeDataUrl && data.secret) {
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
    } else {
      setErrorMsg(data?.error || 'No se pudo generar la clave 2FA. Revisa la conexión con el servidor.');
    }
    setLoading(false);
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!verifyCode || verifyCode.trim().length !== 6) {
      setErrorMsg('Introduce el código de 6 dígitos generado por tu app de autenticación.');
      return;
    }

    setLoading(true);
    const res = await verifyAndEnableTotp(verifyCode);
    setLoading(false);

    if (!res.success || !res.recoveryCodes) {
      setErrorMsg(res.error || 'Código incorrecto. Comprueba la hora del teléfono.');
      return;
    }

    setRecoveryCodes(res.recoveryCodes);
    onTotpStatusChanged(true);
  }

  async function handleDisable2FA() {
    if (confirm('¿Seguro que deseas desactivar la autenticación de doble factor 2FA para tu cuenta?')) {
      setLoading(true);
      const ok = await disableTotp();
      setLoading(false);
      if (ok) {
        onTotpStatusChanged(false);
        onClose();
      }
    }
  }

  function copyToClipboardFallback(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
    document.body.removeChild(textarea);
  }

  function handleCopyCodes() {
    if (recoveryCodes) {
      const textToCopy = recoveryCodes.join('\n');
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(textToCopy).catch(() => copyToClipboardFallback(textToCopy));
      } else {
        copyToClipboardFallback(textToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content totp-setup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <ShieldCheck size={24} className="modal-header-icon" />
            <h2>Autenticación en Dos Pasos (2FA TOTP)</h2>
          </div>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body totp-modal-body">
          {isTotpEnabled && !recoveryCodes ? (
            <div className="totp-status-active">
              <div className="active-badge-card">
                <ShieldCheck size={48} style={{ color: '#10b981' }} />
                <h3>2FA / TOTP Activo y Protegido</h3>
                <p>Tu cuenta está protegida con verificación en dos pasos mediante aplicación de autenticación.</p>
              </div>

              <div className="modal-actions-row" style={{ marginTop: '24px' }}>
                <button type="button" className="btn-secondary-large" onClick={onClose}>
                  <span>Cerrar</span>
                </button>
                <button type="button" className="btn-danger-large" onClick={handleDisable2FA} disabled={loading}>
                  <span>Desactivar 2FA</span>
                </button>
              </div>
            </div>
          ) : recoveryCodes ? (
            <div className="totp-recovery-codes-step">
              <div className="form-success-banner" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px', borderRadius: '8px', color: '#10b981', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <ShieldCheck size={20} />
                <span>¡Autenticación 2FA configurada con éxito!</span>
              </div>

              <h4 style={{ marginTop: '16px', marginBottom: '8px' }}>Códigos de Recuperación de Emergencia</h4>
              <p className="text-sm text-muted">
                Guarda o imprime estos 8 códigos en un lugar seguro. Si pierdes el teléfono o la app de autenticación, podrás usarlos para entrar.
              </p>

              <div className="recovery-codes-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '16px 0', background: 'var(--bg-input)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace' }}>
                {recoveryCodes.map((code, index) => (
                  <div key={index} className="recovery-code-item" style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    {code}
                  </div>
                ))}
              </div>

              <div className="modal-actions-row">
                <button type="button" className="btn-secondary-large" onClick={handleCopyCodes}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? '¡Copiados!' : 'Copiar Códigos'}</span>
                </button>
                <button type="button" className="btn-primary-large" onClick={onClose}>
                  <span>Finalizar</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerifySubmit} className="totp-setup-form">
              <p className="text-sm text-muted">
                Escanea el código QR con tu aplicación de autenticación (Google Authenticator, Aegis, Authy, Bitwarden, etc.) e introduce el código de 6 dígitos que aparezca.
              </p>

              {errorMsg && (
                <div className="form-error-banner" style={{ marginTop: '12px' }}>
                  <AlertCircle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <RefreshCw size={24} className="spin-icon" />
                  <p>Generando código QR seguro...</p>
                </div>
              ) : (
                <>
                  {qrCodeDataUrl && (
                    <div className="qr-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0' }}>
                      <img src={qrCodeDataUrl} alt="Código QR TOTP 2FA" style={{ width: '180px', height: '180px', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                      {secret && (
                        <p className="secret-key-display" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'monospace' }}>
                          Clave manual: <strong>{secret}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="edit-field-group">
                    <label htmlFor="verify-totp-input">
                      <Key size={16} /> Código de Confirmación (6 dígitos)
                    </label>
                    <input
                      id="verify-totp-input"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="123456"
                      className="edit-input num-input text-center"
                      style={{ fontSize: '24px', letterSpacing: '4px', textAlign: 'center' }}
                      required
                    />
                  </div>

                  <div className="modal-actions-row">
                    <button type="button" className="btn-secondary-large" onClick={onClose}>
                      <span>Cancelar</span>
                    </button>
                    <button type="submit" className="btn-primary-large" disabled={loading}>
                      <ShieldCheck size={20} />
                      <span>Activar 2FA</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
