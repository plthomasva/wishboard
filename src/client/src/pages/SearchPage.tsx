import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import IdentityStickers from '../components/IdentityStickers';

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
        params.set('searcher_genders', manualGenders.trim());
      }
      if (manualOrientations.trim()) {
        params.set('searcher_orientations', manualOrientations.trim());
      }
      if (manualRoles.trim()) {
        params.set('searcher_roles', manualRoles.trim());
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
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useProfileAttributes}
              onChange={(event) => setUseProfileAttributes(event.target.checked)}
            />
            Filter results by my profile attributes
          </label>
        ) : (
          <fieldset className="filter-fieldset">
            <legend>Temporary search attributes</legend>
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
          <article className="wish-card" key={wish.id}>
            <IdentityStickers genders={wish.creator_genders} orientations={wish.creator_orientations} />
            <strong className="wish-id">#{wish.id}</strong>
            <p className="wish-text">{wish.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
