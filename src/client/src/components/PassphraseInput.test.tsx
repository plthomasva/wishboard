import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PassphraseInput from './PassphraseInput';
import React from 'react';

describe('PassphraseInput', () => {
  it('masks value by default and toggles visibility on button click', () => {
    const handleChange = vi.fn();
    render(
      <PassphraseInput
        id="test-input"
        value="secret123"
        onChange={handleChange}
        placeholder="Enter key"
      />
    );

    const input = screen.getByPlaceholderText('Enter key');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');

    // Click show toggle
    const toggleBtn = screen.getByRole('button', { name: 'Show passphrase' });
    fireEvent.click(toggleBtn);

    expect(input).toHaveAttribute('type', 'text');
    expect(toggleBtn).toHaveAttribute('title', 'Hide passphrase');

    // Click hide toggle
    fireEvent.click(toggleBtn);
    expect(input).toHaveAttribute('type', 'password');

    // Test typing triggers onChange callback
    fireEvent.change(input, { target: { value: 'newsecret' } });
    expect(handleChange).toHaveBeenCalledWith('newsecret');
  });
});
