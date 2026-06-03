import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function EnterWishPage() {
  const { token } = useAuth();
  const [content, setContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [creatorGenders, setCreatorGenders] = useState('');
  const [creatorOrientations, setCreatorOrientations] = useState('');
  const [creatorRoles, setCreatorRoles] = useState('');
  const [desiredGenders, setDesiredGenders] = useState('');
  const [desiredOrientations, setDesiredOrientations] = useState('');
  const [desiredRoles, setDesiredRoles] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitWish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch('/api/wishes', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        passphrase: passphrase || undefined,
        creator_genders: creatorGenders,
        creator_orientations: creatorOrientations,
        creator_roles: creatorRoles,
        desired_genders: desiredGenders,
        desired_orientations: desiredOrientations,
        desired_roles: desiredRoles
      })
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Could not submit wish.');
      return;
    }

    const secretMessage = data.secret ? ` · Secret: ${data.secret}` : '';
    setResult(`Wish saved! ID: ${data.id}${secretMessage}`);
    setContent('');
    setPassphrase('');
    setCreatorGenders('');
    setCreatorOrientations('');
    setCreatorRoles('');
    setDesiredGenders('');
    setDesiredOrientations('');
    setDesiredRoles('');
  };

  return (
    <section>
      <h1>Enter a Wish</h1>
      <form className="form-card" onSubmit={submitWish}>
        <label>
          What is your wish?
          <textarea
            rows={6}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Type your wish here"
          />
        </label>
        {!token ? (
          <>
            <label>
              Optional passphrase
              <input
                type="text"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Leave blank for automatic code phrase"
              />
            </label>
            <label>
              Creator genders (anonymous only)
              <input
                value={creatorGenders}
                onChange={(event) => setCreatorGenders(event.target.value)}
                placeholder="e.g. woman, non-binary"
              />
            </label>
            <label>
              Creator orientations (anonymous only)
              <input
                value={creatorOrientations}
                onChange={(event) => setCreatorOrientations(event.target.value)}
                placeholder="e.g. queer, straight"
              />
            </label>
            <label>
              Creator roles (anonymous only)
              <input
                value={creatorRoles}
                onChange={(event) => setCreatorRoles(event.target.value)}
                placeholder="e.g. speaker, volunteer"
              />
            </label>
          </>
        ) : (
          <div className="note-box">
            <p>Your account identity attributes are applied automatically to this wish.</p>
          </div>
        )}
        <label>
          Desired genders for who can fulfill this wish
          <input
            value={desiredGenders}
            onChange={(event) => setDesiredGenders(event.target.value)}
            placeholder="e.g. woman, non-binary"
          />
        </label>
        <label>
          Desired orientations for who can fulfill this wish
          <input
            value={desiredOrientations}
            onChange={(event) => setDesiredOrientations(event.target.value)}
            placeholder="e.g. queer, straight"
          />
        </label>
        <label>
          Desired roles for who can fulfill this wish
          <input
            value={desiredRoles}
            onChange={(event) => setDesiredRoles(event.target.value)}
            placeholder="e.g. speaker, vendor"
          />
        </label>
        <button type="submit">Submit Wish</button>
      </form>

      {result && <div className="message success">{result}</div>}
      {error && <div className="message error">{error}</div>}
    </section>
  );
}
