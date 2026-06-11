import React from 'react';
import IdentityStickers from './IdentityStickers';
import FlagButton from './FlagButton';

interface Wish {
  id: string;
  content: string;
  creator_genders?: string[];
  creator_orientations?: string[];
}

interface WishCardProps {
  wish: Wish;
  cardClass?: 'wish-card' | 'display-card';
  showFlag?: boolean;
  onFlag?: (id: string) => void;
}

export default function WishCard({ wish, cardClass = 'wish-card', showFlag = true, onFlag }: WishCardProps) {
  return (
    <article className={cardClass} key={wish.id}>
      <IdentityStickers genders={wish.creator_genders} orientations={wish.creator_orientations} />
      {showFlag && onFlag && (
        <FlagButton onFlag={() => onFlag(wish.id)} />
      )}
      <p className="wish-text">{wish.content}</p>
    </article>
  );
}
