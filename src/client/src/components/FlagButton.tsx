import React from 'react';

interface FlagButtonProps {
  onFlag: () => void;
  title?: string;
}

export default function FlagButton({ onFlag, title = 'Flag as inappropriate' }: FlagButtonProps) {
  return (
    <button
      className="flag-wish-btn"
      title={title}
      onClick={onFlag}
    >
      <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    </button>
  );
}
