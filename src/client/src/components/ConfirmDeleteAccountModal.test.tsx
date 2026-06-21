import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ConfirmDeleteAccountModal from './ConfirmDeleteAccountModal';

describe('ConfirmDeleteAccountModal', () => {
  it('renders plural forms when counts are not 1', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteAccountModal
        deletePreview={{ wishesCount: 2, wishmailsCount: 0 }}
        deleteError={null}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/wishes/)).toBeInTheDocument();
    expect(screen.getByText(/0/)).toBeInTheDocument();
    expect(screen.getByText(/wishmail messages/)).toBeInTheDocument();
  });

  it('renders singular forms when counts are exactly 1', () => {
    render(
      <ConfirmDeleteAccountModal
        deletePreview={{ wishesCount: 1, wishmailsCount: 1 }}
        deleteError={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText((content, element) => element?.textContent === '1 wish')).toBeInTheDocument();
    expect(screen.queryByText((content, element) => element?.textContent === '1 wishes')).not.toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.textContent === '1 wishmail message')).toBeInTheDocument();
    expect(screen.queryByText(/wishmail messages/)).not.toBeInTheDocument();
  });

  it('renders the deleteError if provided', () => {
    render(
      <ConfirmDeleteAccountModal
        deletePreview={{ wishesCount: 0, wishmailsCount: 0 }}
        deleteError="Failed to delete account"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText('Failed to delete account')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteAccountModal
        deletePreview={{ wishesCount: 0, wishmailsCount: 0 }}
        deleteError={null}
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Yes, Delete Account is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteAccountModal
        deletePreview={{ wishesCount: 0, wishmailsCount: 0 }}
        deleteError={null}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete Account' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
