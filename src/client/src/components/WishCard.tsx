import React from 'react';
import IdentityStickers from './IdentityStickers';
import FlagButton from './FlagButton';
import { useTextFit } from '../hooks/useTextFit';

interface Contact {
  type: string;
  value: string;
}

interface Wish {
  id: string;
  content: string;
  creator_genders?: string[];
  creator_orientations?: string[];
  contacts?: Contact[];
  wishmail_enabled?: boolean;
}

interface WishCardProps {
  wish: Wish;
  cardClass?: 'wish-card' | 'display-card';
  showFlag?: boolean;
  onFlag?: (id: string) => void;
  onSendMail?: (id: string) => void;
  onOverflowChange?: (isOverflowing: boolean) => void;
  isEditorPreview?: boolean;
}

export default function WishCard({ wish, cardClass = 'wish-card', showFlag = true, onFlag, onSendMail, onOverflowChange, isEditorPreview = false }: Readonly<WishCardProps>) {
  // Use lower max font size for the card, and minimum 10px so we have enough room to scale down
  const { containerRef, contentRef, isOverflowing } = useTextFit({
    minFontSize: 10,
    maxFontSize: cardClass === 'display-card' ? 36 : 18,
    step: 1
  }, [wish]);

  React.useEffect(() => {
    if (onOverflowChange) {
      onOverflowChange(isOverflowing);
    }
  }, [isOverflowing, onOverflowChange]);

  return (
    <article
      className={`${cardClass} ${isOverflowing && isEditorPreview ? 'text-overflow-hint' : ''}`}
      key={wish.id}
      ref={containerRef}
    >
      <div className="wish-card-inner-scale" ref={contentRef}>
        <IdentityStickers genders={wish.creator_genders} orientations={wish.creator_orientations} />
        
        {showFlag && onFlag && (
          <FlagButton onFlag={() => onFlag(wish.id)} />
        )}
        
        <p className="wish-text">{wish.content}</p>

        {wish.contacts && wish.contacts.length > 0 && (
          <div className="wish-contacts-list">
            {wish.contacts.map((c, i) => (
              <span key={`${c.type}-${i}`} className="wish-contact-item">
                <strong>{c.type}:</strong> {c.value}
              </span>
            ))}
          </div>
        )}

        {wish.wishmail_enabled && (
          <div style={{ clear: 'both', textAlign: 'right', marginTop: '12px' }}>
            <button 
              type="button"
              className="send-mail-icon-btn" 
              onClick={(e) => {
                e.preventDefault();
                if (onSendMail) onSendMail(wish.id);
              }}
              title="Send Wishmail"
              aria-label="Send Wishmail"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
