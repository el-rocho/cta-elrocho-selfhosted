import React, { useState, useEffect } from 'react';
import { Users, X, UserPlus, Trash2, Key, Shield, ShieldCheck, AlertCircle, PlusCircle } from 'lucide-react';
import type { AuthUser } from '../types/bloodPressure';
import { listUsers, createUser, deleteUser, resetUserPassword } from '../services/authService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUserList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function loadUserList() {
    setLoading(true);
    const data = await listUsers();
    setUsers(data);
    setLoading(false);
  }

  async function handleAddUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    setLoading(true);
    const res = await createUser({
      username: newUsername,
      name: newName,
      password: newPassword,
      role: newRole,
    });
    setLoading(false);

    if (!res.success || !res.user) {
      setErrorMsg(res.error || 'Error al crear usuario');
      return;
    }

    setSuccessMsg(`✓ Usuario "${res.user.name}" creado con éxito.`);
    setNewUsername('');
    setNewName('');
    setNewPassword('');
    setShowAddForm(false);
    loadUserList();
  }

  async function handleDeleteUser(user: AuthUser) {
    if (confirm(`¿Seguro que deseas eliminar la cuenta del usuario "${user.name}"? Se borrarán todas sus mediciones.`)) {
      setLoading(true);
      const ok = await deleteUser(user.id);
      setLoading(false);
      if (ok) {
        setSuccessMsg(`Usuario "${user.name}" eliminado.`);
        loadUserList();
      }
    }
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUserId) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    setLoading(true);
    const res = await resetUserPassword(resetUserId, resetPasswordVal);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Error al cambiar contraseña');
      return;
    }

    setSuccessMsg('✓ Contraseña actualizada con éxito.');
    setResetUserId(null);
    setResetPasswordVal('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-mgmt-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Users size={24} className="modal-header-icon" />
            <h2>Gestión de Usuarios</h2>
          </div>
          <button type="button" className="btn-icon-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {errorMsg && (
            <div className="form-error-banner" style={{ marginBottom: '16px' }}>
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="form-success-banner" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '10px 14px', borderRadius: '8px', color: '#10b981', marginBottom: '16px' }}>
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p className="text-sm text-muted" style={{ margin: 0 }}>
              Administra quién tiene acceso al servidor.
            </p>
            <button
              type="button"
              className="btn-primary-gradient"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setResetUserId(null);
              }}
              style={{ fontSize: '13px', padding: '6px 12px' }}
            >
              <UserPlus size={16} />
              <span>{showAddForm ? 'Cancelar' : 'Añadir Usuario'}</span>
            </button>
          </div>

          {/* Formulario para añadir nuevo usuario */}
          {showAddForm && (
            <form onSubmit={handleAddUserSubmit} className="add-user-card" style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 12px 0' }}>Añadir Nuevo Usuario</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Nombre Completo</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ej. Carmen"
                    className="edit-input"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Usuario</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Ej. carmen"
                    className="edit-input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Contraseña Inicial</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="edit-input"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Rol de Permiso</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                    className="edit-input"
                  >
                    <option value="user">Usuario</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn-secondary-large" style={{ padding: '6px 14px' }} onClick={() => setShowAddForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary-large" style={{ padding: '6px 14px' }} disabled={loading}>
                  <PlusCircle size={16} />
                  <span>Guardar Usuario</span>
                </button>
              </div>
            </form>
          )}

          {/* Formulario de reseteo de contraseña */}
          {resetUserId && (
            <form onSubmit={handleResetPasswordSubmit} className="reset-pwd-card" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#ef4444' }}>Cambiar Contraseña de Usuario</h4>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="password"
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Nueva contraseña..."
                  className="edit-input"
                  required
                />
                <button type="submit" className="btn-primary-large" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }} disabled={loading}>
                  Cambiar
                </button>
                <button type="button" className="btn-secondary-large" style={{ padding: '8px 12px' }} onClick={() => setResetUserId(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Lista de Usuarios */}
          <div className="users-list-table-container">
            <table className="expanded-readings-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>2FA TOTP</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <strong>{u.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username}</div>
                      </div>
                    </td>
                    <td>
                      <span className="category-pill" style={{ background: u.role === 'admin' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-input)', color: u.role === 'admin' ? '#2563eb' : 'var(--text-secondary)' }}>
                        {u.role === 'admin' ? <Shield size={12} /> : null}
                        {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      {u.totp_enabled ? (
                        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={14} /> Activo
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions-cell">
                        <button
                          type="button"
                          className="btn-text-edit"
                          onClick={() => {
                            setResetUserId(u.id);
                            setShowAddForm(false);
                          }}
                          title="Cambiar contraseña"
                        >
                          <Key size={14} /> Clave
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            className="btn-text-delete"
                            onClick={() => handleDeleteUser(u)}
                            title="Eliminar usuario"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
