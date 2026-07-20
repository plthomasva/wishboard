import React from 'react';
import { useDomain } from '../DomainContext';

interface AttributeInputProps {
  id?: string;
  category?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: string[];
  warning?: string;
}

export default function AttributeInput({
  id,
  category,
  value,
  onChange,
  placeholder,
  suggestions,
  warning,
}: Readonly<AttributeInputProps>) {
  const { stickers = {} } = useDomain();

  const currentItems = value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '');

  const handleToggle = (option: string) => {
    const optionLower = option.toLowerCase();
    const isSelected = currentItems.includes(optionLower);

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
              {getDynamicPillIcon(opt, category, stickers)}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
