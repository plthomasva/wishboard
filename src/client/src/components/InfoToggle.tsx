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
        <span className="emoji-icon" aria-hidden="true">
          ℹ️
        </span>
      </button>
      {isOpen && <div className="info-toggle-content">{children}</div>}
    </div>
  );
}
