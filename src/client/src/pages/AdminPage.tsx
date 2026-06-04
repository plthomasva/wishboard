import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';

export default function AdminPage() {
  const { user, token, login } = useAuth();
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [flags, setFlags] = useState<Array<{ id: string; content: string; flagged: number; user_id: string | null }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const loadFlags = async () => {
    setError(null);
    const response = await fetch('/api/admin/flags', { headers: authHeader });
    if (!response.ok) {
      setError('Unable to load flagged wishes. Please login as admin.');
      return;
    }
    setFlags(await response.json());
  };

  const loadUsers = async () => {
    setError(null);
    const response = await fetch('/api/admin/users', { headers: authHeader });
    if (!response.ok) {
      return;
    }
    setUsers(await response.json());
  };

  const removeWish = async (id: string) => {
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/admin/wishes/${id}/remove`, { method: 'POST', headers: authHeader });
    if (!response.ok) {
      setError('Failed to remove wish.');
      return;
    }
    setMessage(`Removed wish ${id}`);
    loadFlags();
  };

  const updateRole = async (id: string, role: string) => {
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/admin/users/${id}/role`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    if (!response.ok) {
      setError('Failed to update role.');
      return;
    }
    setMessage(`Updated user role for ${id}`);
    loadUsers();
  };

  const deleteUser = async (id: string) => {
    setMessage(null);
    setError(null);
    const response = await fetch(`/api/admin/users/${id}/delete`, { method: 'POST', headers: authHeader });
    if (!response.ok) {
      setError('Failed to delete user.');
      return;
    }
    setMessage(`Deleted user ${id}`);
    loadUsers();
  };

  const runSeeder = async () => {
    setMessage(null);
    setError(null);
    const response = await fetch('/api/admin/reset-demo', { method: 'POST', headers: authHeader });
    if (!response.ok) {
      setError('Failed to run seeder.');
      return;
    }
    const data = await response.json();
    setMessage(`Seeder completed: ${data.stats.usersCreated} users and ${data.stats.wishesCreated} wishes created.`);
    loadUsers();
    loadFlags();
  };

  const onLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const result = await login(username.trim(), passphrase.trim());
    if (!result.success) {
      setError(result.error || 'Login failed.');
      return;
    }
    setUsername('');
    setPassphrase('');
    if (result.role !== 'admin') {
      setError('Logged in successfully, but this account is not an admin.');
      return;
    }
    setMessage('Admin login successful.');
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadFlags();
      loadUsers();
    }
  }, [user]);

  return (
    <section>
      <h1>Admin Panel</h1>
      <p>Only admin users can review flagged wishes and manage accounts.</p>
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {user?.role !== 'admin' ? (
        <form className="form-card" onSubmit={onLogin}>
          <label>
            Admin username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            Admin passphrase
            <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
          </label>
          <button type="submit">Login as Admin</button>
        </form>
      ) : (
        <>
          <section>
            <h2>Flagged Wishes</h2>
            <div className="wish-grid">
              {flags.length === 0 ? (
                <p>No flagged wishes at the moment.</p>
              ) : (
                flags.map((wish) => (
                  <article className="wish-card" key={wish.id}>
                    <strong>{wish.id}</strong>
                    <p>{wish.content}</p>
                    <p className="microtext">Submitted by {wish.user_id || 'anonymous'}</p>
                    <div className="wish-actions">
                      <button onClick={() => removeWish(wish.id)}>Remove</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section style={{ marginTop: '24px' }}>
            <h2>Demo Seeder</h2>
            <p>Generate simulated users and wishes for testing. <strong>Warning: This clears existing demo data.</strong></p>
            <button className="secondary-button" onClick={runSeeder} style={{ marginTop: '12px' }}>
              Run Seeder
            </button>
          </section>

          <section style={{ marginTop: '24px' }}>
            <h2>User Accounts</h2>
            {users.length === 0 ? (
              <p>No user accounts exist yet.</p>
            ) : (
              <div className="wish-grid">
                {users.map((account) => (
                  <article className="wish-card" key={account.id}>
                    <strong>{account.username}</strong>
                    <p>Role: {account.role}</p>
                    <div className="wish-actions">
                      {account.role !== 'admin' ? (
                        <button onClick={() => updateRole(account.id, 'admin')}>Promote</button>
                      ) : (
                        <button onClick={() => updateRole(account.id, 'user')}>Demote</button>
                      )}
                      <button className="secondary-button" onClick={() => deleteUser(account.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
