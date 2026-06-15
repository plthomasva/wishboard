import React from 'react';

interface AttributeInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  suggestions: string[];
}

export default function AttributeInput({ id, value, onChange, placeholder, suggestions }: Readonly<AttributeInputProps>) {
  const currentItems = value.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');

  const handleToggle = (option: string) => {
    const optionLower = option.toLowerCase();
    const isSelected = currentItems.includes(optionLower);
    
    // We want to preserve the exact casing of what they manually typed if possible,
    // but for simplicity we'll just reconstruct the string.
    let newItems;
    if (isSelected) {
      newItems = currentItems.filter(i => i !== optionLower);
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
      />
      <div className="suggestion-pills">
        {suggestions.map((opt) => {
          const isSelected = currentItems.includes(opt.toLowerCase());
          return (
            <button
              key={opt}
              type="button"
              className={`pill-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleToggle(opt)}
            >
              {isSelected ? '✓ ' : '+ '}{opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
