import React from 'react';
import InfoToggle from './InfoToggle';
import WishCard from './WishCard';

interface WishPreviewProps {
  wish: any;
  onOverflowChange: (isOverflowing: boolean) => void;
}

export default function WishPreview({ wish, onOverflowChange }: Readonly<WishPreviewProps>) {
  return (
    <div className="wish-preview-container" style={{ position: 'sticky', top: '24px' }}>
      <div
        className="label-with-info"
        style={{ borderBottom: '2px solid #e4e9f0', paddingBottom: '8px', marginBottom: '8px' }}
      >
        <h3 style={{ margin: 0 }}>Card Preview</h3>
        <InfoToggle>
          Watch your card scale automatically! If text turns red, it won't fit on the board.
        </InfoToggle>
      </div>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <WishCard
          wish={wish}
          showFlag={false}
          onOverflowChange={onOverflowChange}
          isEditorPreview={true}
        />
      </div>
    </div>
  );
}
