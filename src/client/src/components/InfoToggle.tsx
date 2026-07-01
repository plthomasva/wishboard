import React, { useState } from 'react';

interface InfoToggleProps {
  children: React.ReactNode;
}

export default function InfoToggle({ children }: Readonly<InfoToggleProps>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="info-toggle-wrapper">
      <button
        type="button"
        className="info-toggle-btn"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-label="More information"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>
      {isOpen && <div className="info-toggle-content">{children}</div>}
    </div>
  );
}
