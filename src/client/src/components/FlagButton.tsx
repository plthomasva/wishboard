import React from 'react';

interface FlagButtonProps {
  onFlag: () => void;
  title?: string;
}

export default function FlagButton({
  onFlag,
  title = 'Flag as inappropriate',
}: Readonly<FlagButtonProps>) {
  return (
    <button type="button" className="flag-wish-btn" title={title} onClick={onFlag}>
      <span className="emoji-icon" aria-hidden="true">
        🚩
      </span>
    </button>
  );
}
