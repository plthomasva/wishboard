import React, { useEffect, useState } from 'react';
import InfoToggle from '../components/InfoToggle';
import useFlagWish from '../hooks/useFlagWish';

export default function ManageWishPage() {
  const [wish, setWish] = useState<{ id: string; content: string; created_at: string } | null>(null);
  const [content, setContent] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const hashIndex = window.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      const params = new URLSearchParams(window.location.hash.substring(hashIndex));
      const wishId = params.get('id');
      const wishSecret = params.get('secret');

      if (wishSecret) {
        setSecret(wishSecret);
      }

      if (wishId) {
        fetch(`/api/wishes/${wishId}`)
          .then((res) => {
            if (res.ok) return res.json();
            throw new Error('Wish not found');
          })
          .then((data) => {
            setWish(data);
            setContent(data.content);
          })
          .catch((err) => {
            setError(err.message);
          });
      } else {
        setError('No wish ID provided.');
      }
    } else {
      setError('No wish ID provided.');
    }
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wish) return;
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/wishes/${wish.id}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, content })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to update wish.');
    } else {
      setMessage('Wish updated successfully!');
    }
  };

  const handleDelete = async () => {
    if (!wish) return;
    if (!confirm('Are you sure you want to delete this wish?')) return;
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/wishes/${wish.id}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, action: 'delete' })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to delete wish.');
    } else {
      setMessage('Wish deleted successfully.');
      setWish(null);
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
    return <section>Loading...</section>;
  }

  return (
    <section>
      <h1>Manage Your Wish</h1>
      <p>Edit the content of your anonymous wish or delete it permanently.</p>
      
      <form className="form-card" onSubmit={handleUpdate}>
        <label>
          Wish content
          <textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        
        <div style={{ display: 'grid', gap: '8px' }}>
          <div className="label-with-info">
            <label>Passphrase</label>
            <InfoToggle>
              This is the secret phrase generated when you created the wish. It is required to make any changes.
            </InfoToggle>
          </div>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter passphrase"
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button type="submit">Save Changes</button>
          <button type="button" className="secondary-button" onClick={handleDelete} style={{ background: '#fee2e2', color: '#b91c1c' }}>
            Delete Wish
          </button>
        </div>
      </form>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
    </section>
  );
}
