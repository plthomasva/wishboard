import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const generatePassphrase = () => {
  const adjectives = ['solar', 'bright', 'gentle', 'lucky', 'quiet', 'merry', 'wild', 'cosmic', 'velvet', 'golden'];
  const nouns = ['spark', 'wish', 'cloud', 'echo', 'lantern', 'maple', 'beam', 'ripple', 'pixel', 'trail'];
  const colors = ['blue', 'amber', 'jade', 'pearl', 'ruby', 'sapphire', 'copper', 'opal', 'sage', 'ivory'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return `${adjective}-${noun}-${color}`;
};

export default function AccountPage() {
  const { user, token, login, register, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [identityGenders, setIdentityGenders] = useState('');
  const [identityOrientations, setIdentityOrientations] = useState('');
  const [identityRoles, setIdentityRoles] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wishes, setWishes] = useState<Array<{ id: string; content: string; flagged: number }>>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const loadWishes = async () => {
    setError(null);
    if (!user) {
      return;
    }
    const response = await fetch('/api/users/me/wishes', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      setError('Unable to load your wishes.');
      return;
    }
    const data = await response.json();
    setWishes(data);
    setEdits(data.reduce((acc, wish) => ({ ...acc, [wish.id]: wish.content }), {}));
  };

  useEffect(() => {
    loadWishes();
  }, [user]);

  const onLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await login(username.trim(), passphrase.trim());
    if (!response.success) {
      setError(response.error || 'Login failed.');
      return;
    }
    setMessage('Logged in successfully.');
    setUsername('');
    setPassphrase('');
  };

  const onRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await register(username.trim(), passphrase.trim() || undefined, {
      identities: {
        genders: identityGenders,
        orientations: identityOrientations,
        roles: identityRoles
      }
    });
    if (!response.success) {
      setError(response.error || 'Registration failed.');
      return;
    }
    setMessage(`Account created. Remember your passphrase: ${response.secret}`);
    setUsername('');
    setPassphrase('');
    setIdentityGenders('');
    setIdentityOrientations('');
    setIdentityRoles('');
  };

  const updateWish = async (id: string) => {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/wishes/${id}/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ content: edits[id] })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to update wish.');
      return;
    }
    setMessage('Wish updated successfully.');
    loadWishes();
  };

  const deleteWish = async (id: string) => {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/wishes/${id}/manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ action: 'delete' })
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to delete wish.');
      return;
    }
    setMessage('Wish deleted successfully.');
    loadWishes();
  };

  if (!user) {
    return (
      <section>
        <h1>My Account</h1>
        <p>Create an account to manage multiple wishes, or log in if you already have one.</p>
        <div className="tab-buttons">
          <button className={mode === 'login' ? 'nav-button active' : 'nav-button'} onClick={() => setMode('login')}>
            Login
          </button>
          <button className={mode === 'register' ? 'nav-button active' : 'nav-button'} onClick={() => setMode('register')}>
            Register
          </button>
        </div>
        <form className="form-card" onSubmit={mode === 'login' ? onLogin : onRegister}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Choose a username" />
          </label>
          <label>
            Passphrase
            <input
              type="text"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Leave blank to auto-generate when registering"
            />
          </label>
          {mode === 'register' && (
            <>
              <label>
                Identity genders
                <input
                  value={identityGenders}
                  onChange={(event) => setIdentityGenders(event.target.value)}
                  placeholder="e.g. woman, non-binary"
                />
              </label>
              <label>
                Identity orientations
                <input
                  value={identityOrientations}
                  onChange={(event) => setIdentityOrientations(event.target.value)}
                  placeholder="e.g. queer, straight"
                />
              </label>
              <label>
                Identity roles
                <input
                  value={identityRoles}
                  onChange={(event) => setIdentityRoles(event.target.value)}
                  placeholder="e.g. speaker, volunteer"
                />
              </label>
            </>
          )}
          <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
        </form>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        {mode === 'register' && (
          <div className="note-box">
            <p>Tip: Use a memorable passphrase like <strong>{generatePassphrase()}</strong>.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="account-header">
        <div>
          <h1>Welcome back, {user.username}</h1>
          <p>You can manage your saved wishes here.</p>
        </div>
        <button className="secondary-button" onClick={logout}>
          Logout
        </button>
      </div>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {wishes.length === 0 ? (
        <p>No wishes yet. Submit a new wish from the Enter a Wish page.</p>
      ) : (
        <div className="wish-grid">
          {wishes.map((wish) => (
            <article className="wish-card" key={wish.id}>
              <strong>{wish.id}</strong>
              <textarea
                rows={4}
                value={edits[wish.id] ?? wish.content}
                onChange={(event) => setEdits({ ...edits, [wish.id]: event.target.value })}
              />
              <div className="wish-actions">
                <button onClick={() => updateWish(wish.id)}>Save</button>
                <button className="secondary-button" onClick={() => deleteWish(wish.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
