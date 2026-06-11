import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import WishCard from '../components/WishCard';
import useFlagWish from '../hooks/useFlagWish';
import InfoToggle from '../components/InfoToggle';

interface Wish {
  id: string;
  content: string;
  creator_genders?: string[];
  creator_orientations?: string[];
}

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Wish[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useProfileAttributes, setUseProfileAttributes] = useState<boolean>(Boolean(user));
  const [manualGenders, setManualGenders] = useState('');
  const [manualOrientations, setManualOrientations] = useState('');
  const [manualRoles, setManualRoles] = useState('');

  useEffect(() => {
    setUseProfileAttributes(Boolean(user));
  }, [user]);

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
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

    const response = await fetch(`/api/wishes?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      setError('Unable to perform search.');
      return;
    }

    setResults(data);
  };

  const handleFlag = useFlagWish((id) => setResults((prev) => prev.filter((wish) => wish.id !== id)));

  return (
    <section>
      <h1>Search Wishes</h1>
      <form className="form-card" onSubmit={search}>
        <label>
          Search phrase
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
              Filter results by my profile attributes
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
              Searcher genders
              <input
                value={manualGenders}
                onChange={(event) => setManualGenders(event.target.value)}
                placeholder="e.g. woman, cisgender man"
              />
            </label>
            <label>
              Searcher orientations
              <input
                value={manualOrientations}
                onChange={(event) => setManualOrientations(event.target.value)}
                placeholder="e.g. lesbian, bisexual"
              />
            </label>
            <label>
              Searcher roles
              <input
                value={manualRoles}
                onChange={(event) => setManualRoles(event.target.value)}
                placeholder="e.g. top, bottom"
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
          />
        ))}
      </div>
    </section>
  );
}
