import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import InfoToggle from '../components/InfoToggle';
import AttributeInput from '../components/AttributeInput';
import { SUGGESTED_GENDERS, SUGGESTED_ORIENTATIONS, SUGGESTED_ROLES } from '../constants';

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
  const [result, setResult] = useState<{ id: string; secret?: string } | null>(null);
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

    setResult({ id: data.id, secret: data.secret });
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
            <div style={{ display: 'grid', gap: '8px' }}>
              <div className="label-with-info">
                <label htmlFor="passphrase">Optional passphrase</label>
                <InfoToggle>
                  This allows you to edit or delete your wish later. Leave it blank and we'll automatically generate a secure, memorable code phrase for you!
                </InfoToggle>
              </div>
              <input
                id="passphrase"
                type="text"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Leave blank for automatic code phrase"
              />
            </div>
            <label>
              Creator genders (anonymous only)
              <AttributeInput
                value={creatorGenders}
                onChange={setCreatorGenders}
                placeholder="e.g. woman, non-binary"
                suggestions={SUGGESTED_GENDERS}
              />
            </label>
            <label>
              Creator orientations (anonymous only)
              <AttributeInput
                value={creatorOrientations}
                onChange={setCreatorOrientations}
                placeholder="e.g. queer, straight"
                suggestions={SUGGESTED_ORIENTATIONS}
              />
            </label>
            <label>
              Creator roles (anonymous only)
              <AttributeInput
                value={creatorRoles}
                onChange={setCreatorRoles}
                placeholder="e.g. speaker, volunteer"
                suggestions={SUGGESTED_ROLES}
              />
            </label>
          </>
        ) : (
          <div className="note-box">
            <div className="label-with-info">
              <p style={{ margin: 0 }}>Your account identity attributes are applied automatically to this wish.</p>
              <InfoToggle>
                Any genders, orientations, or roles you set on your Account page are implicitly used to match you with compatible fulfillers.
              </InfoToggle>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gap: '8px' }}>
          <div className="label-with-info">
            <label htmlFor="desiredGenders">Desired genders for who can fulfill this wish</label>
            <InfoToggle>
              Leaving this blank means you're open to matching with anyone (based on your own orientation)! Explicitly entering a gender here will override your default orientation preferences.
            </InfoToggle>
          </div>
          <AttributeInput
            id="desiredGenders"
            value={desiredGenders}
            onChange={setDesiredGenders}
            placeholder="e.g. woman, non-binary"
            suggestions={SUGGESTED_GENDERS}
          />
        </div>
        <label>
          Desired orientations for who can fulfill this wish
          <AttributeInput
            value={desiredOrientations}
            onChange={setDesiredOrientations}
            placeholder="e.g. queer, straight"
            suggestions={SUGGESTED_ORIENTATIONS}
          />
        </label>
        <label>
          Desired roles for who can fulfill this wish
          <AttributeInput
            value={desiredRoles}
            onChange={setDesiredRoles}
            placeholder="e.g. speaker, vendor"
            suggestions={SUGGESTED_ROLES}
          />
        </label>
        <button type="submit">Submit Wish</button>
      </form>

      {result && (
        <div className="message success" style={{ textAlign: 'center' }}>
          <p><strong>Wish saved! ID: {result.id}</strong></p>
          {result.secret && (
            <>
              <p>Your passphrase is: <strong>{result.secret}</strong></p>
              <div style={{ margin: '16px 0' }}>
                <QRCodeSVG 
                  value={`${window.location.origin}${window.location.pathname}#manage-wish?id=${result.id}&secret=${encodeURIComponent(result.secret)}`} 
                  size={150} 
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p>
                <a href={`#manage-wish?id=${result.id}&secret=${encodeURIComponent(result.secret)}`}>
                  Click here or bookmark this link to manage your wish later
                </a>
              </p>
              <p style={{ fontSize: '0.9em', color: '#475569' }}>
                Or scan the QR code with your phone to save it!
              </p>
            </>
          )}
        </div>
      )}
      {error && <div className="message error">{error}</div>}
    </section>
  );
}
