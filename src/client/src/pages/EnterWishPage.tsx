import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import InfoToggle from '../components/InfoToggle';
import AttributeInput from '../components/AttributeInput';
import WishPreview from '../components/WishPreview';
import WishFormFields from '../components/WishFormFields';
const WishScanner = React.lazy(() => import('../components/WishScanner'));
import { SUGGESTED_GENDERS, SUGGESTED_ORIENTATIONS, SUGGESTED_ROLES } from '../constants';

export default function EnterWishPage() {
  const { token, user } = useAuth();
  const [content, setContent] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [creatorGenders, setCreatorGenders] = useState('');
  const [creatorOrientations, setCreatorOrientations] = useState('');
  const [creatorRoles, setCreatorRoles] = useState('');
  const [desiredGenders, setDesiredGenders] = useState('');
  const [desiredOrientations, setDesiredOrientations] = useState('');
  const [desiredRoles, setDesiredRoles] = useState('');
  
  const [contacts, setContacts] = useState<{ type: string; value: string }[]>([]);
  const [wishmailEnabled, setWishmailEnabled] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (user) {
      setContacts(user.contacts || []);
      setWishmailEnabled(user.wishmail_enabled || false);
    }
  }, [user]);

  const [result, setResult] = useState<{ id: string; secret?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitWish = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body: BodyInit;
    if (imageBlob) {
      delete headers['Content-Type'];
      const formData = new FormData();
      formData.append('content', content);
      if (passphrase) formData.append('passphrase', passphrase);
      formData.append('creator_genders', creatorGenders);
      formData.append('creator_orientations', creatorOrientations);
      formData.append('creator_roles', creatorRoles);
      formData.append('desired_genders', desiredGenders);
      formData.append('desired_orientations', desiredOrientations);
      formData.append('desired_roles', desiredRoles);
      formData.append('contacts', JSON.stringify(contacts));
      formData.append('wishmail_enabled', wishmailEnabled ? 'true' : '');
      formData.append('image', imageBlob, 'wish.jpg');
      body = formData;
    } else {
      body = JSON.stringify({
        content,
        passphrase: passphrase || undefined,
        creator_genders: creatorGenders,
        creator_orientations: creatorOrientations,
        creator_roles: creatorRoles,
        desired_genders: desiredGenders,
        desired_orientations: desiredOrientations,
        desired_roles: desiredRoles,
        contacts,
        wishmail_enabled: wishmailEnabled
      });
    }

    const response = await fetch('/api/wishes', {
      method: 'POST',
      headers,
      body
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
    setContacts([]);
    setWishmailEnabled(false);
    setIsOverflowing(false);
    setImageBlob(null);
  };

  const parsedCreatorGenders = creatorGenders ? creatorGenders.split(',').map(s => s.trim()) : undefined;
  const parsedCreatorOrientations = creatorOrientations ? creatorOrientations.split(',').map(s => s.trim()) : undefined;

  const previewWish = {
    id: 'preview',
    content: content || 'Your wish text will appear here',
    creator_genders: user ? user.identity_genders : parsedCreatorGenders,
    creator_orientations: user ? user.identity_orientations : parsedCreatorOrientations,
    contacts: contacts.filter(c => c.value.trim()),
    wishmail_enabled: wishmailEnabled,
    image_url: imageBlob ? URL.createObjectURL(imageBlob) : undefined
  };

  return (
    <section>
      <h1>Enter a Wish</h1>
      
      <div className="wish-editor-layout">
        <form className="form-card" onSubmit={submitWish}>
          <WishFormFields
            content={content}
            setContent={setContent}
            contacts={contacts}
            setContacts={setContacts}
            wishmailEnabled={wishmailEnabled}
            setWishmailEnabled={setWishmailEnabled}
            isOverflowing={isOverflowing}
          />

          <div style={{ margin: '16px 0', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            {imageBlob ? (
              <div>
                <p style={{ color: '#166534', fontWeight: 'bold' }}>✓ Handwritten wish attached</p>
                <button type="button" className="secondary-button" onClick={() => setImageBlob(null)}>Remove Image</button>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 12px 0' }}>Have a physical 3x5 wish card?</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setShowScanner(true)}>Capture with Camera</button>
                  <label className="secondary-button" style={{ cursor: 'pointer', display: 'inline-block', margin: 0, padding: '12px 24px', borderRadius: '24px', fontWeight: 'bold' }}>
                    Upload Image
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setImageBlob(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {token ? (
            <div className="note-box">
              <div className="label-with-info">
                <p style={{ margin: 0 }}>Your account identity attributes are applied automatically to this wish.</p>
                <InfoToggle>
                  Any genders, orientations, or roles you set on your Account page are implicitly used to match you with compatible fulfillers.
                </InfoToggle>
              </div>
            </div>
          ) : (
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
          )}
          <div className="advanced-criteria-toggle" style={{ margin: '24px 0 16px 0' }}>
            <button 
              type="button" 
              className="secondary-button" 
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Match Criteria</span>
              <span>{showAdvanced ? '▲' : '▼'}</span>
            </button>
            {!showAdvanced && (
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                By default, we smartly guess who you want to match with based on your own identity. Open this to set strict requirements for who can view this wish.
              </p>
            )}
          </div>

          {showAdvanced && (
            <fieldset style={{ border: '1px solid #d7dee5', borderRadius: '12px', padding: '16px', background: '#f8fafc', marginBottom: '16px' }}>
              <legend style={{ fontWeight: 600, padding: '0 8px' }}>Advanced Match Criteria</legend>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div className="label-with-info">
                  <label htmlFor="desiredGenders">Strictly required genders</label>
                  <InfoToggle>
                    Only users with these genders will be able to see this wish. If you leave this blank, we'll smartly fall back to guessing based on your own orientation!
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
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                <div className="label-with-info">
                  <label htmlFor="desiredOrientations">Strictly required orientations</label>
                  <InfoToggle>
                    Only users with these orientations will be able to see this wish.
                  </InfoToggle>
                </div>
                <AttributeInput
                  id="desiredOrientations"
                  value={desiredOrientations}
                  onChange={setDesiredOrientations}
                  placeholder="e.g. queer, straight"
                  suggestions={SUGGESTED_ORIENTATIONS}
                />
              </div>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                <div className="label-with-info">
                  <label htmlFor="desiredRoles">Strictly required roles</label>
                  <InfoToggle>
                    Only users with these roles will be able to see this wish.
                  </InfoToggle>
                </div>
                <AttributeInput
                  id="desiredRoles"
                  value={desiredRoles}
                  onChange={setDesiredRoles}
                  placeholder="e.g. speaker, vendor"
                  suggestions={SUGGESTED_ROLES}
                />
              </div>
            </fieldset>
          )}
          <button type="submit">Submit Wish</button>
        </form>

        <WishPreview wish={previewWish} onOverflowChange={setIsOverflowing} />
      </div>

      {result && (
        <div className="message success" style={{ textAlign: 'center', marginTop: '24px' }}>
          <p><strong>Wish saved! ID: {result.id}</strong></p>
          {result.secret && (
            <>
              <p>Your passphrase is: <strong>{result.secret}</strong></p>
              <div style={{ margin: '16px 0' }}>
                <QRCodeSVG 
                  value={`${globalThis.location.origin}${globalThis.location.pathname}#manage-wish?id=${result.id}&secret=${encodeURIComponent(result.secret)}`} 
                  size={150} 

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

      {showScanner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <React.Suspense fallback={<div style={{ color: 'white' }}>Loading scanner...</div>}>
            <WishScanner 
              onCapture={(ocrContent, blob) => {
                if (ocrContent) setContent(ocrContent);
                setImageBlob(blob);
                setShowScanner(false);
              }} 
              onCancel={() => setShowScanner(false)} 
            />
          </React.Suspense>
        </div>
      )}
    </section>
  );
}
