import React from 'react';

interface AttributeInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: string[];
  warning?: string;
}

const getPillIcon = (opt: string) => {
  const norm = opt.toLowerCase().replace(/[^a-z]/g, '');

  if (norm.includes('trans')) {
    return <span className="pill-flag flag-trans" title="Transgender" />;
  }
  if (
    norm.includes('nonbinary') ||
    norm.includes('enby') ||
    norm.includes('genderqueer') ||
    norm.includes('agender')
  ) {
    return <span className="pill-flag flag-nonbinary" title="Nonbinary" />;
  }
  if (norm.includes('lesbian')) {
    return <span className="pill-flag-heart flag-lesbian" title="Lesbian" />;
  }
  if (norm.includes('bisexual') || norm === 'bi') {
    return <span className="pill-flag-heart flag-bisexual" title="Bisexual" />;
  }
  if (norm.includes('pansexual') || norm === 'pan') {
    return <span className="pill-flag-heart flag-pansexual" title="Pansexual" />;
  }
  if (norm.includes('asexual') || norm === 'ace') {
    return <span className="pill-flag-heart flag-asexual" title="Asexual" />;
  }
  if (norm.includes('gay') || norm.includes('queer') || norm.includes('rainbow')) {
    return <span className="pill-flag-heart flag-rainbow" title="Rainbow / Queer" />;
  }
  if (norm.includes('straight')) {
    return <span className="pill-flag-heart flag-straight" title="Straight" />;
  }
  if (norm.includes('woman') || norm.includes('female')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        stroke="#d81b60"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pill-svg-icon"
      >
        <circle cx="12" cy="10" r="6" />
        <line x1="12" y1="16" x2="12" y2="22" />
        <line x1="9" y1="19" x2="15" y2="19" />
      </svg>
    );
  }
  if (norm.includes('man') || norm.includes('male')) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="12"
        height="12"
        stroke="#1565c0"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pill-svg-icon"
      >
        <circle cx="10" cy="14" r="6" />
        <line x1="14.24" y1="9.76" x2="20" y2="4" />
        <line x1="16" y1="4" x2="20" y2="4" />
        <line x1="20" y1="8" x2="20" y2="4" />
      </svg>
    );
  }
  return null;
};

export default function AttributeInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions,
  warning,
}: Readonly<AttributeInputProps>) {
  const currentItems = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '');

  const handleToggle = (option: string) => {
    const optionLower = option.toLowerCase();
    const isSelected = currentItems.includes(optionLower);

    // We want to preserve the exact casing of what they manually typed if possible,
    // but for simplicity we'll just reconstruct the string.
    let newItems;
    if (isSelected) {
      newItems = currentItems.filter((i) => i !== optionLower);
    } else {
      newItems = [...currentItems, optionLower];
    }
    onChange(newItems.join(', '));
  };

  return (
    <div className="attribute-input-container">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={
          warning
            ? { borderColor: '#e53935', boxShadow: '0 0 4px rgba(229, 57, 53, 0.4)' }
            : undefined
        }
      />
      {warning && (
        <div
          className="attribute-input-warning"
          style={{
            color: '#e53935',
            fontSize: '13px',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 'bold',
          }}
        >
          <span>⚠️</span>
          <span>{warning}</span>
        </div>
      )}
      <div className="suggestion-pills">
        {suggestions.map((opt) => {
          const isSelected = currentItems.includes(opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              className={`pill-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggle(opt)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>{isSelected ? '✓ ' : '+ '}</span>
              {getPillIcon(opt)}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
