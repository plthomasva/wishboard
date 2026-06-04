import React from 'react';

interface Props {
  genders?: string[];
  orientations?: string[];
}

export default function IdentityStickers({ genders = [], orientations = [] }: Props) {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');

  const renderOrientationSticker = (orientation: string, index: number) => {
    const norm = normalize(orientation);
    let flagClass = '';
    
    if (norm.includes('straight')) flagClass = 'flag-straight';
    else if (norm.includes('gay')) flagClass = 'flag-rainbow';
    else if (norm.includes('lesbian')) flagClass = 'flag-lesbian';
    else if (norm.includes('bi')) flagClass = 'flag-bisexual';
    else if (norm.includes('pan')) flagClass = 'flag-pansexual';
    else if (norm.includes('asexual') || norm.includes('ace')) flagClass = 'flag-asexual';
    else if (norm.includes('queer')) flagClass = 'flag-rainbow';
    else return null;

    return (
      <div key={`ori-${index}`} className="sticker-heart-shadow" title={orientation}>
        <div className={`sticker-heart ${flagClass}`}></div>
      </div>
    );
  };

  const renderGenderSticker = (gender: string, index: number) => {
    const norm = normalize(gender);
    if (norm.includes('trans')) {
      return <div key={`gen-${index}`} className="sticker sticker-flag flag-trans" title={gender}></div>;
    }
    if (norm.includes('nonbinary') || norm.includes('enby') || norm.includes('genderqueer') || norm.includes('agender')) {
      return <div key={`gen-${index}`} className="sticker sticker-flag flag-nonbinary" title={gender}></div>;
    }
    if (norm.includes('woman') || norm.includes('female')) {
      return (
        <div key={`gen-${index}`} className="sticker sticker-icon female-icon" title={gender}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="10" r="6" />
            <line x1="12" y1="16" x2="12" y2="22" />
            <line x1="9" y1="19" x2="15" y2="19" />
          </svg>
        </div>
      );
    }
    if (norm.includes('man') || norm.includes('male')) {
      return (
        <div key={`gen-${index}`} className="sticker sticker-icon male-icon" title={gender}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="14" r="6" />
            <line x1="14.24" y1="9.76" x2="20" y2="4" />
            <line x1="16" y1="4" x2="20" y2="4" />
            <line x1="20" y1="8" x2="20" y2="4" />
          </svg>
        </div>
      );
    }
    return null;
  };

  const hasStickers = genders.length > 0 || orientations.length > 0;
  if (!hasStickers) return null;

  return (
    <div className="identity-stickers">
      {orientations.map(renderOrientationSticker)}
      {genders.map(renderGenderSticker)}
    </div>
  );
}
