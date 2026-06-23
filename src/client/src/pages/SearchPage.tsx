import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import WishCard from '../components/WishCard';
import useFlagWish from '../hooks/useFlagWish';
import InfoToggle from '../components/InfoToggle';
import AttributeInput from '../components/AttributeInput';
import SendWishmailModal from '../components/SendWishmailModal';
import { SUGGESTED_GENDERS, SUGGESTED_ORIENTATIONS, SUGGESTED_ROLES } from '../constants';
import { useWebSocket } from '../hooks/useWebSocket';

interface Wish {
  id: string;
  content: string;
  creator_genders?: string[];
  creator_orientations?: string[];
}

export default function SearchPage() {
  const { user, token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Wish[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useProfileAttributes, setUseProfileAttributes] = useState<boolean>(Boolean(user));
  const [manualGenders, setManualGenders] = useState('');
  const [manualOrientations, setManualOrientations] = useState('');
  const [manualRoles, setManualRoles] = useState('');
  const [mailWishId, setMailWishId] = useState<string | null>(null);
  const [lastSearchParams, setLastSearchParams] = useState<string | null>(null);
  const { socket } = useWebSocket();

  const prependIfNotPresent = React.useCallback((newWish: Wish) => {
    setResults(prev => prev.some(w => w.id === newWish.id) ? prev : [newWish, ...prev]);
  }, []);

  const handleNewWish = React.useCallback(async (newWish: Wish) => {
    if (lastSearchParams === null) return;
    try {
      const response = await fetch(`/api/wishes?${lastSearchParams}`);
      if (!response.ok) return;
      const data = await response.json();
      if (data.some((w: Wish) => w.id === newWish.id)) {
        prependIfNotPresent(newWish);
      }
    } catch (err) {
      console.debug('WebSocket wish:created check failed:', err);
    }
  }, [lastSearchParams, prependIfNotPresent]);

  const handleDeletedWish = React.useCallback((deletedWishId: string) => {
    setResults(prev => prev.filter(w => w.id !== deletedWishId));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('wish:created', handleNewWish);
    socket.on('wish:reactivated', handleNewWish);
    socket.on('wish:deleted', handleDeletedWish);
    return () => {
      socket.off('wish:created', handleNewWish);
      socket.off('wish:reactivated', handleNewWish);
      socket.off('wish:deleted', handleDeletedWish);
    };
  }, [socket, handleNewWish, handleDeletedWish]);

  useEffect(() => {
    setUseProfileAttributes(Boolean(user));
  }, [user]);

  const search = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }

    if (user) {
      if (!useProfileAttributes) {
        params.set('ignore_attributes', '1');
      }
    } else {
      if (manualGenders.trim()) {
        params.set('sg', manualGenders.trim());
      }
      if (manualOrientations.trim()) {
        params.set('so', manualOrientations.trim());
      }
      if (manualRoles.trim()) {
        params.set('sr', manualRoles.trim());
      }
      if (!manualGenders.trim() && !manualOrientations.trim() && !manualRoles.trim()) {
        params.set('ignore_attributes', '1');
      }
    }

    const paramsStr = params.toString();
    setLastSearchParams(paramsStr);

    const response = await fetch(`/api/wishes?${paramsStr}`);
    const data = await response.json();
    if (!response.ok) {
      setError('Unable to perform search.');
      return;
    }

    setResults(data);
  };

  const handleFlag = useFlagWish((id) => setResults((prev) => prev.filter((wish) => wish.id !== id)));

  const handleAdminDelete = React.useCallback(async (id: string) => {
    if (!token) return;
    if (!globalThis.confirm('Are you sure you want to delete this wish as an admin?')) return;
    try {
      const response = await fetch(`/api/admin/wishes/${id}/remove`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setResults(prev => prev.filter(w => w.id !== id));
      } else {
        globalThis.alert('Failed to delete wish.');
      }
    } catch (err) {
      console.error('Error deleting wish:', err);
      globalThis.alert('Error deleting wish.');
    }
  }, [token]);

  return (
    <section>
      <h1 style={{ maxWidth: '800px', margin: '0 auto' }}>Search Wishes</h1>
      <form className="form-card" onSubmit={search} style={{ maxWidth: '800px', margin: '18px auto 24px' }}>
        <label>
          Search phrase{' '}
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search existing wishes"
          />
        </label>

        {user ? (
          <div className="label-with-info" style={{ marginTop: '8px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={useProfileAttributes}
                onChange={(event) => setUseProfileAttributes(event.target.checked)}
              />
              {' '}Filter results by my profile attributes
            </label>
            <InfoToggle>
              When checked, we use your identity attributes to show only wishes from compatible creators. Uncheck this if you just want to do a broad keyword search across all wishes!
            </InfoToggle>
          </div>
        ) : (
          <fieldset className="filter-fieldset">
            <div className="label-with-info" style={{ marginBottom: '12px' }}>
              <legend style={{ fontWeight: 'bold' }}>Temporary search attributes</legend>
              <InfoToggle>
                These let you perform a one-off compatibility search as a specific identity. 
                Leaving these blank will do a broad keyword-only search across all wishes!
              </InfoToggle>
            </div>
            <label>
              Searcher genders{' '}
              <AttributeInput
                value={manualGenders}
                onChange={setManualGenders}
                placeholder="e.g. woman, cisgender man"
                suggestions={SUGGESTED_GENDERS}
              />
            </label>
            <label>
              Searcher orientations{' '}
              <AttributeInput
                value={manualOrientations}
                onChange={setManualOrientations}
                placeholder="e.g. lesbian, bisexual"
                suggestions={SUGGESTED_ORIENTATIONS}
              />
            </label>
            <label>
              Searcher roles{' '}
              <AttributeInput
                value={manualRoles}
                onChange={setManualRoles}
                placeholder="e.g. top, bottom"
                suggestions={SUGGESTED_ROLES}
              />
            </label>
            <p className="note-box">Leave these blank for keyword-only search across all wishes.</p>
          </fieldset>
        )}

        <button type="submit">Search</button>
      </form>

      {error && <div className="message error">{error}</div>}

      <div className="wish-grid">
        {results.map((wish) => (
          <WishCard
            key={wish.id}
            wish={wish}
            onFlag={handleFlag}
            onSendMail={setMailWishId}
            onAdminDelete={user?.role === 'admin' ? handleAdminDelete : undefined}
          />
        ))}
      </div>

      {mailWishId && (
        <SendWishmailModal wishId={mailWishId} onClose={() => setMailWishId(null)} />
      )}
    </section>
  );
}
