import React from 'react';

interface ConfirmDeleteAccountModalProps {
  deletePreview: { wishesCount: number; wishmailsCount: number };
  deleteError: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteAccountModal({
  deletePreview,
  deleteError,
  onCancel,
  onConfirm,
}: Readonly<ConfirmDeleteAccountModalProps>) {
  return (
    <div className="kiosk-modal-backdrop" style={{ zIndex: 100000 }}>
      <div className="kiosk-modal" style={{ maxWidth: '500px' }}>
        <h2>Delete Account Confirmation</h2>
        <p style={{ color: '#e53e3e', fontWeight: 'bold' }}>
          This action is permanent and cannot be undone.
        </p>
        <p>
          If you proceed, the following data will be permanently deleted along with the account:
        </p>
        <ul style={{ margin: '16px 0', paddingLeft: '24px' }}>
          <li>
            <strong>{deletePreview.wishesCount}</strong>{' '}
            {deletePreview.wishesCount === 1 ? 'wish' : 'wishes'}
          </li>
          <li>
            <strong>{deletePreview.wishmailsCount}</strong>{' '}
            {deletePreview.wishmailsCount === 1 ? 'wishmail message' : 'wishmail messages'}
          </li>
        </ul>
        {deleteError && <div className="message error">{deleteError}</div>}
        <div
          className="kiosk-modal-actions"
          style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}
        >
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="button"
            style={{ background: '#e53e3e', color: 'white', borderColor: '#e53e3e' }}
            onClick={onConfirm}
          >
            Yes, Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
