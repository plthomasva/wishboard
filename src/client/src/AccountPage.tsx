import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { generatePassphrase } from './passphrase.js';
import InfoToggle from './components/InfoToggle';
import AttributeInput from './components/AttributeInput';
import { SUGGESTED_GENDERS, SUGGESTED_ORIENTATIONS, SUGGESTED_ROLES } from './constants';
import { QRCodeSVG } from 'qrcode.react';

export default function AccountPage() {
  const { user, token, login, register, logout, refreshUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [identityGenders, setIdentityGenders] = useState('');
  const [identityOrientations, setIdentityOrientations] = useState('');
  const [identityRoles, setIdentityRoles] = useState('');
  const [editIdentityGenders, setEditIdentityGenders] = useState('');
  const [editIdentityOrientations, setEditIdentityOrientations] = useState('');
  const [editIdentityRoles, setEditIdentityRoles] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wishes, setWishes] = useState<Array<{ id: string; content: string; flagged: number }>>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [existingUsername, setExistingUsername] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Claim wish state
  const [claimId, setClaimId] = useState('');
  const [claimSecret, setClaimSecret] = useState('');

  const effectiveMode = existingUsername ? 'login' : mode;

  useEffect(() => {
    const name = username.trim();
    let active = true;

    if (!name) {
      setExistingUsername(false);
      setCheckingUsername(false);
      setMode('register');
      return;
    }

    setCheckingUsername(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/users/exists?username=${encodeURIComponent(name)}`);
        if (!active) {
          return;
        }
        if (!response.ok) {
          setExistingUsername(false);
          setMode('register');
        } else {
          const data = await response.json();
          setExistingUsername(Boolean(data.exists));
          setMode(data.exists ? 'login' : 'register');
        }
      } catch {
        if (active) {
          setExistingUsername(false);
          setMode('register');
        }
      } finally {
        if (active) {
          setCheckingUsername(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username]);

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

  useEffect(() => {
    if (!user) {
      return;
    }
    setEditIdentityGenders(user.identity_genders.join(', '));
    setEditIdentityOrientations(user.identity_orientations.join(', '));
    setEditIdentityRoles(user.identity_roles.join(', '));
  }, [user]);

  const saveProfile = async () => {
    setError(null);
    setMessage(null);
    const response = await fetch('/api/users/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        identity_genders: editIdentityGenders,
        identity_orientations: editIdentityOrientations,
        identity_roles: editIdentityRoles
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to save profile.');
      return;
    }

    setMessage('Profile updated successfully.');
    if (refreshUser) {
      await refreshUser();
    }
  };

  const onLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!username.trim() || !passphrase.trim()) {
      setError('Username and passphrase are required to log in.');
      return;
    }
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
    if (!username.trim()) {
      setError('Username is required to register.');
      return;
    }
    const response = await register(username.trim(), passphrase.trim() || undefined, {
      genders: identityGenders,
      orientations: identityOrientations,
      roles: identityRoles
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

  const claimWish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!claimId.trim() || !claimSecret.trim()) {
      setError('Wish ID and Passphrase are required to claim a wish.');
      return;
    }

    const response = await fetch(`/api/wishes/${claimId.trim()}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ secret: claimSecret.trim() })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Unable to claim wish.');
      return;
    }

    setMessage('Wish claimed successfully!');
    setClaimId('');
    setClaimSecret('');
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
        <form className="form-card" onSubmit={effectiveMode === 'login' ? onLogin : onRegister}>
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
              placeholder={effectiveMode === 'register' ? 'Leave blank to auto-generate when registering' : 'Enter your passphrase'}
            />
          </label>
          {effectiveMode === 'register' && (
            <>
              <div className="label-with-info" style={{ marginTop: '12px', marginBottom: '8px' }}>
                <strong style={{ display: 'block' }}>Identity Attributes</strong>
                <InfoToggle>
                  These attributes are automatically applied to any wishes you create, and are used by default when you search.
                </InfoToggle>
              </div>
              <label>
                Identity genders
                <AttributeInput
                  value={identityGenders}
                  onChange={setIdentityGenders}
                  placeholder="e.g. woman, non-binary"
                  suggestions={SUGGESTED_GENDERS}
                />
              </label>
              <label>
                Identity orientations
                <AttributeInput
                  value={identityOrientations}
                  onChange={setIdentityOrientations}
                  placeholder="e.g. queer, straight"
                  suggestions={SUGGESTED_ORIENTATIONS}
                />
              </label>
              <label>
                Identity roles
                <AttributeInput
                  value={identityRoles}
                  onChange={setIdentityRoles}
                  placeholder="e.g. speaker, volunteer"
                  suggestions={SUGGESTED_ROLES}
                />
              </label>
            </>
          )}
          <button type="submit">{effectiveMode === 'login' ? 'Login' : 'Register'}</button>
        </form>
        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
        {effectiveMode === 'register' && (
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

      <div className="profile-details">
        <h2>Your profile attributes</h2>
        <ul>
          <li>
            <strong>Genders:</strong> {user.identity_genders.length ? user.identity_genders.join(', ') : 'None set'}
          </li>
          <li>
            <strong>Orientations:</strong> {user.identity_orientations.length ? user.identity_orientations.join(', ') : 'None set'}
          </li>
          <li>
            <strong>Roles:</strong> {user.identity_roles.length ? user.identity_roles.join(', ') : 'None set'}
          </li>
        </ul>
      </div>

      <div className="profile-edit">
        <div className="label-with-info" style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Edit profile attributes</h2>
          <InfoToggle>
            Updating these attributes will change how you are matched with other users across all your wishes.
          </InfoToggle>
        </div>
        <label>
          Genders
          <AttributeInput
            value={editIdentityGenders}
            onChange={setEditIdentityGenders}
            placeholder="e.g. woman, non-binary"
            suggestions={SUGGESTED_GENDERS}
          />
        </label>
        <label>
          Orientations
          <AttributeInput
            value={editIdentityOrientations}
            onChange={setEditIdentityOrientations}
            placeholder="e.g. queer, straight"
            suggestions={SUGGESTED_ORIENTATIONS}
          />
        </label>
        <label>
          Roles
          <AttributeInput
            value={editIdentityRoles}
            onChange={setEditIdentityRoles}
            placeholder="e.g. speaker, volunteer"
            suggestions={SUGGESTED_ROLES}
          />
        </label>
        <button className="secondary-button" onClick={saveProfile} type="button">
          Save attributes
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '32px' }}>
        <div className="profile-edit">
          <div className="label-with-info" style={{ marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Claim an Anonymous Wish</h2>
            <InfoToggle>
              Adopt a wish you created anonymously so you can manage it from your account.
            </InfoToggle>
          </div>
          <form onSubmit={claimWish} style={{ display: 'grid', gap: '12px' }}>
            <label>
              Wish ID
              <input
                type="text"
                value={claimId}
                onChange={(e) => setClaimId(e.target.value)}
                placeholder="e.g. abc123xy"
              />
            </label>
            <label>
              Passphrase
              <input
                type="text"
                value={claimSecret}
                onChange={(e) => setClaimSecret(e.target.value)}
                placeholder="e.g. CorrectHorseBatteryStaple"
              />
            </label>
            <button type="submit" className="secondary-button">Claim Wish</button>
          </form>
        </div>

        {token && (
          <div className="profile-edit" style={{ textAlign: 'center' }}>
            <div className="label-with-info" style={{ marginBottom: '16px', justifyContent: 'center' }}>
              <h2 style={{ margin: 0 }}>Easy Mobile Login</h2>
              <InfoToggle>
                Scan this QR code with your phone or save the link to instantly log back into your account without a passphrase.
              </InfoToggle>
            </div>
            <div style={{ background: 'white', padding: '16px', display: 'inline-block', borderRadius: '12px' }}>
              <QRCodeSVG 
                value={`${window.location.origin}${window.location.pathname}?token=${token}#account`} 
                size={160} 
                includeMargin={false}
              />
            </div>
            <p style={{ marginTop: '16px' }}>
              <a href={`?token=${token}#account`}>
                Bookmark this auto-login link
              </a>
            </p>
          </div>
        )}
      </div>

    </section>
  );
}
