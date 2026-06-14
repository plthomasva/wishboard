import React, { useEffect, useState } from 'react';
import InfoToggle from '../components/InfoToggle';
import WishCard from '../components/WishCard';
import WishFormFields from '../components/WishFormFields';
import { useAuth } from '../AuthContext';

export default function ManageWishPage() {
  const { token } = useAuth();
  const [wish, setWish] = useState<{ id: string; content: string; contacts: any[]; wishmail_enabled: boolean; created_at: string; creator_genders?: string[]; creator_orientations?: string[] } | null>(null);
  const [content, setContent] = useState('');
  const [contacts, setContacts] = useState<{ type: string; value: string }[]>([]);
  const [wishmailEnabled, setWishmailEnabled] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hashIndex = globalThis.location.hash.indexOf('?');
    if (hashIndex === -1) {
      setError('No wish ID provided.');
      return;
    }

    const params = new URLSearchParams(globalThis.location.hash.substring(hashIndex));
    const wishId = params.get('id');
    const wishSecret = params.get('secret');

    if (wishSecret) {
      setSecret(wishSecret);
    }

    if (!wishId) {
      setError('No wish ID provided.');
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(wishId)) {
      setError('Invalid wish ID format.');
      return;
    }

    fetch(`/api/wishes/${encodeURIComponent(wishId)}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Wish not found');
      })
      .then((data) => {
        setWish(data);
        setContent(data.content);
        setContacts(data.contacts || []);
        setWishmailEnabled(data.wishmail_enabled || false);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  const handleUpdate = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!wish) return;
    setError(null);
    setMessage(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api/wishes/${encodeURIComponent(wish.id)}/manage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret, content, contacts, wishmail_enabled: wishmailEnabled, action: 'update' })
    });

    if (response.ok) {
      setMessage('Wish updated successfully!');
      setWish({ ...wish, content, contacts, wishmail_enabled: wishmailEnabled });
    } else {
      const data = await response.json();
      setError(data.error || 'Failed to update wish.');
    }
  };

  const handleDelete = async () => {
    if (!wish) return;
    if (!confirm('Are you sure you want to delete this wish?')) return;
    setError(null);
    setMessage(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api/wishes/${encodeURIComponent(wish.id)}/manage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ secret, action: 'delete' })
    });

    if (response.ok) {
      setMessage('Wish deleted successfully.');
      setWish(null);
    } else {
      const data = await response.json();
      setError(data.error || 'Failed to delete wish.');
    }
  };

  if (error && !wish) {
    return (
      <section>
        <h1>Manage Wish</h1>
        <div className="message error">{error}</div>
      </section>
    );
  }

  if (!wish) {
    if (message) {
      return (
        <section>
          <h1>Manage Wish</h1>
          <div className="message success">{message}</div>
        </section>
      );
    }
    return <section>Loading...</section>;
  }

  const previewWish = {
    id: wish.id,
    content: content,
    creator_genders: wish.creator_genders,
    creator_orientations: wish.creator_orientations,
    contacts: contacts.filter(c => c.value.trim()),
    wishmail_enabled: wishmailEnabled
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Manage Your Wish</h1>
          <p style={{ marginTop: 0 }}>Edit the content of your wish or delete it permanently.</p>
        </div>
        {wish.wishmail_enabled && (
          <a href={'#wishmail-dashboard?id=' + wish.id + (secret ? '&secret=' + encodeURIComponent(secret) : '')} className="compact-btn" style={{ background: '#1a73e8', textDecoration: 'none' }}>
            View Wishmail
          </a>
        )}
      </div>
      
      <div className="wish-editor-layout">
        <form className="form-card" onSubmit={handleUpdate} style={{ marginTop: 0 }}>
          <WishFormFields
            content={content}
            setContent={setContent}
            contacts={contacts}
            setContacts={setContacts}
            wishmailEnabled={wishmailEnabled}
            setWishmailEnabled={setWishmailEnabled}
            isOverflowing={isOverflowing}
          />
          
          <div style={{ display: 'grid', gap: '8px' }}>
            <div className="label-with-info">
              <label htmlFor="passphrase-input">Passphrase (if anonymous)</label>
              <InfoToggle>
                If you created this wish anonymously, the passphrase is required to save changes. If you are logged into your account, this isn't needed.
              </InfoToggle>
            </div>
            <input
              id="passphrase-input"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter passphrase"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit">Save Changes</button>
            <button type="button" className="secondary-button" onClick={handleDelete} style={{ background: '#fee2e2', color: '#b91c1c' }}>
              Delete Wish
            </button>
          </div>
        </form>

        <div className="wish-preview-container" style={{ position: 'sticky', top: '24px' }}>
          <div className="label-with-info" style={{ borderBottom: '2px solid #e4e9f0', paddingBottom: '8px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0 }}>Card Preview</h3>
            <InfoToggle>
              Watch your card scale automatically! If text turns red, it won't fit on the board.
            </InfoToggle>
          </div>
          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            <WishCard wish={previewWish} showFlag={false} onOverflowChange={setIsOverflowing} isEditorPreview={true} />
          </div>
        </div>
      </div>

      {message && <div className="message success" style={{ marginTop: '24px' }}>{message}</div>}
      {error && <div className="message error" style={{ marginTop: '24px' }}>{error}</div>}
    </section>
  );
}
