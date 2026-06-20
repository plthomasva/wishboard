import React, { useState, useEffect } from 'react';
import ConfirmDeleteAccountModal from '../ConfirmDeleteAccountModal';

export default function UserAccountsSection({ authHeader, setMessage, error, setError, refreshCounter, triggerRefresh }: any) {
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<{ wishesCount: number; wishmailsCount: number } | null>(null);

  const loadUsers = async () => {
    setError(null);
    const response = await fetch('/api/admin/users', { headers: authHeader });
    if (response.ok) setUsers(await response.json());
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, [refreshCounter]);

  const updateRole = async (id: string, role: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    if (!response.ok) { setError('Failed to update role.'); return; }
    setMessage(`Updated user role for ${id}`);
    loadUsers();
  };

  const resetPassphrase = async (id: string) => {
    if (!globalThis.confirm("Are you sure you want to reset this user's passphrase? Any active sessions will be terminated.")) return;
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to reset passphrase.'); return; }
    const data = await response.json();
    setMessage(`Passphrase successfully reset! The new passphrase is: ${data.newPassphrase}`);
  };

  const handleDeletePreview = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/delete-preview`, { headers: authHeader });
    if (!response.ok) { setError('Failed to fetch delete preview.'); return; }
    const preview = await response.json();
    setDeletePreview(preview);
    setUserToDelete(id);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    const id = userToDelete;
    setUserToDelete(null);
    setDeletePreview(null);
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/delete`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to delete user.'); return; }
    setMessage(`Deleted user ${id}`);
    loadUsers();
  };

  const runSeeder = async () => {
    setMessage(null); setError(null);
    const response = await fetch('/api/admin/reset-demo', { 
      method: 'POST', 
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    if (!response.ok) { setError('Failed to run seeder.'); return; }
    const data = await response.json();
    setMessage(`Seeder completed: ${data.stats.usersCreated} users and ${data.stats.wishesCreated} wishes created.`);
    triggerRefresh();
  };

  return (
    <>
      <section>
        <h2>User Accounts</h2>
        {users.length === 0 ? <p>No user accounts exist yet.</p> : (
          <div className="wish-grid">
            {users.map((account) => (
              <article className="wish-card" key={account.id}>
                <strong>{account.username}</strong>
                <p>Role: {account.role}</p>
                <div className="wish-actions" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="secondary-button" onClick={() => resetPassphrase(account.id)}>Reset Password</button>
                  {account.role === 'admin' ? (
                    <button type="button" onClick={() => updateRole(account.id, 'user')}>Demote</button>
                  ) : (
                    <button type="button" onClick={() => updateRole(account.id, 'admin')}>Promote</button>
                  )}
                  <button type="button" className="secondary-button" onClick={() => handleDeletePreview(account.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: '48px', padding: '16px', border: '1px solid #ff4444', borderRadius: '8px' }}>
        <h2 style={{ color: '#ff4444' }}>Demo Seeder (Dev Only)</h2>
        <p>Generate simulated users and wishes for testing. <strong>Warning: This clears existing demo data.</strong></p>
        <button type="button" className="secondary-button" onClick={runSeeder} style={{ marginTop: '12px', borderColor: '#ff4444', color: '#ff4444' }}>Run Seeder</button>
      </section>

      {userToDelete && deletePreview && (
        <ConfirmDeleteAccountModal
          deletePreview={deletePreview}
          deleteError={error}
          onCancel={() => {
            setUserToDelete(null);
            setDeletePreview(null);
            setError(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
    </>
  );
}
