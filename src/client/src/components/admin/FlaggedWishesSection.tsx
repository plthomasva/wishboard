import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

export default function FlaggedWishesSection({ authHeader, setMessage, setError, refreshCounter }: any) {
  const [flags, setFlags] = useState<Array<{ id: string; content: string; flagged: number; user_id: string | null }>>([]);

  const loadFlags = async () => {
    setError(null);
    const response = await fetch('/api/admin/flags', { headers: authHeader });
    if (!response.ok) { setError('Unable to load flagged wishes.'); return; }
    setFlags(await response.json());
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFlags(); }, [refreshCounter]);

  const { socket } = useWebSocket();

  const addFlag = React.useCallback((wish: any) => {
    setFlags(prev => prev.some(w => w.id === wish.id) ? prev : [wish, ...prev]);
  }, []);

  const removeFlag = React.useCallback((wishId: string) => {
    setFlags(prev => prev.filter(w => w.id !== wishId));
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('wish:flagged', addFlag);
    socket.on('wish:deleted', removeFlag);

    return () => {
      socket.off('wish:flagged', addFlag);
      socket.off('wish:deleted', removeFlag);
    };
  }, [socket, addFlag, removeFlag]);

  const removeWish = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}/remove`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to remove wish.'); return; }
    setMessage(`Removed wish ${id}`);
    loadFlags();
  };

  const clearFlag = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}/clear-flag`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to clear flag.'); return; }
    setMessage(`Cleared flag for wish ${id}`);
    loadFlags();
  };

  const clearAllFlags = async () => {
    if (!globalThis.confirm('Are you sure you want to clear flags for all remaining wishes?')) return;
    setMessage(null); setError(null);
    const response = await fetch('/api/admin/wishes/clear-all-flags', { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to clear all flags.'); return; }
    setMessage('Cleared all flags successfully.');
    loadFlags();
  };

  return (
    <section>
      <h2>Flagged Wishes</h2>
      <div className="wish-grid">
        {flags.length === 0 ? <p>No flagged wishes at the moment.</p> : flags.map((wish) => (
          <article className="wish-card" key={wish.id}>
            <p>{wish.content}</p>
            <p className="microtext">Submitted by {wish.user_id || 'anonymous'}</p>
            <div className="wish-actions">
              <button type="button" className="secondary-button" onClick={() => clearFlag(wish.id)}>Clear Flag</button>
              <button type="button" onClick={() => removeWish(wish.id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
      {flags.length > 0 && (
        <div className="admin-bulk-actions">
          <button type="button" className="secondary-button" onClick={clearAllFlags}>Clear All Flags</button>
        </div>
      )}
    </section>
  );
}
