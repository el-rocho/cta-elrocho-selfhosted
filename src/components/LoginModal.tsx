import React, { useState } from 'react';
import { UserCheck, Key, Lock, AlertCircle, LogIn, Sparkles, Calendar, User } from 'lucide-react';
import type { AuthUser, PatientSex } from '../types/bloodPressure';
import { login, setupAdmin, verifyLoginTotp } from '../services/authService';
import { useLanguage } from '../i18n/LanguageContext';
import { AppLogo } from './AppLogo';

interface LoginModalProps {
  hasAdmin: boolean;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ hasAdmin, onLoginSuccess }) => {
  const { t } = useLanguage();

  // Estados de formulario
  const [isInitialSetup, setIsInitialSetup] = useState(!hasAdmin);
  const [step2FA, setStep2FA] = useState(false);
  const [tempToken2FA, setTempToken2FA] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [sex, setSex] = useState<PatientSex>('');
  const [birthDate, setBirthDate] = useState('');

  const [totpCode, setTotpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isInitialSetup) {
        // Registro del primer Administrador
        const res = await setupAdmin({ username, name, password, sex, birthDate });
        if (!res.success || !res.user) {
          setErrorMsg(res.error || 'Error al configurar administrador inicial');
          setLoading(false);
          return;
        }
        onLoginSuccess(res.user);
        return;
      }

      if (step2FA && tempToken2FA) {
        // Paso 2: Verificación de código 2FA / TOTP
        const res = await verifyLoginTotp({ tempToken: tempToken2FA, code: totpCode });
        if (!res.success || !res.user) {
          setErrorMsg(res.error || 'Código 2FA no válido');
          setLoading(false);
          return;
        }
        onLoginSuccess(res.user);
        return;
      }

      // Paso 1: Login de Usuario + Contraseña
      const res = await login({ username, password });
      if (!res.success) {
        setErrorMsg(res.error || 'Usuario o contraseña incorrectos');
        setLoading(false);
        return;
      }

      if (res.requires2FA && res.tempToken) {
        setStep2FA(true);
        setTempToken2FA(res.tempToken);
        setLoading(false);
        return;
      }

      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMsg('Error de comunicación con el servidor');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay auth-modal-overlay">
      <div className="modal-content auth-modal-card">
        <div className="auth-header">
          <div className="auth-logo-badge">
            <AppLogo className="auth-app-logo" />
          </div>
          <h2>
            {isInitialSetup
              ? 'Configuración Inicial del Servidor'
              : step2FA
              ? 'Verificación de Seguridad 2FA'
              : 'Iniciar Sesión'}
          </h2>
          <p className="auth-subtitle">
            {isInitialSetup
              ? 'Crea la cuenta de Administrador de tu servidor.'
              : step2FA
              ? 'Introduce el código de 6 dígitos de tu aplicación de autenticación (o código de recuperación).'
              : 'Accede a tus datos de salud.'}
          </p>
        </div>

        {errorMsg && (
          <div className="form-error-banner">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="auth-form">
          {isInitialSetup && (
            <>
              <div className="edit-field-group">
                <label htmlFor="setup-name">
                  <UserCheck size={16} /> Nombre Completo
                </label>
                <input
                  id="setup-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Javier / Mamá / Papá"
                  className="edit-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="edit-field-group">
                  <label htmlFor="setup-sex">
                    <User size={16} /> Género
                  </label>
                  <select
                    id="setup-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as PatientSex)}
                    className="edit-input"
                  >
                    <option value="">Sin especificar</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </div>
                <div className="edit-field-group">
                  <label htmlFor="setup-birthdate">
                    <Calendar size={16} /> Fecha Nacimiento
                  </label>
                  <input
                    id="setup-birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="edit-input"
                  />
                </div>
              </div>
            </>
          )}

          {!step2FA ? (
            <>
              <div className="edit-field-group">
                <label htmlFor="auth-username">
                  <UserCheck size={16} /> Nombre de Usuario
                </label>
                <input
                  id="auth-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={handleFocus}
                  placeholder="Ej. javier"
                  className="edit-input"
                  required
                />
              </div>

              <div className="edit-field-group">
                <label htmlFor="auth-password">
                  <Lock size={16} /> Contraseña
                </label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="edit-input"
                  required
                />
              </div>
            </>
          ) : (
            <div className="edit-field-group">
              <label htmlFor="auth-totp">
                <Key size={16} /> Código de Verificación (6 dígitos)
              </label>
              <input
                id="auth-totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9A-Za-z-]*"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                onFocus={handleFocus}
                placeholder="Ej. 123456"
                className="edit-input num-input text-center"
                style={{ fontSize: '24px', letterSpacing: '4px', textAlign: 'center' }}
                required
                autoFocus
              />
            </div>
          )}

          <button type="submit" className="btn-primary-large btn-auth-submit" disabled={loading}>
            {isInitialSetup ? (
              <>
                <Sparkles size={20} />
                <span>Crear Cuenta Administrador</span>
              </>
            ) : step2FA ? (
              <>
                <Key size={20} />
                <span>Verificar e Iniciar Sesión</span>
              </>
            ) : (
              <>
                <LogIn size={20} />
                <span>Entrar</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
