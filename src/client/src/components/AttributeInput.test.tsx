import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AttributeInput from './AttributeInput';
import React from 'react';

describe('AttributeInput', () => {
  it('renders suggestions as pills', () => {
    const suggestions = ['woman', 'man', 'non-binary'];
    render(
      <AttributeInput
        value=""
        onChange={() => {}}
        placeholder="Enter gender"
        suggestions={suggestions}
      />
    );
    suggestions.forEach((s) => {
      expect(screen.getByRole('button', { name: new RegExp(`\\b${s}\\b`) })).toBeInTheDocument();
    });
  });

  it('adds suggestion to value when pill is clicked', () => {
    const onChange = vi.fn();
    render(
      <AttributeInput
        value="woman"
        onChange={onChange}
        placeholder="Enter gender"
        suggestions={['woman', 'man', 'non-binary']}
      />
    );
    const manPill = screen.getByRole('button', { name: /\bman\b/ });
    fireEvent.click(manPill);
    expect(onChange).toHaveBeenCalledWith('woman, man');
  });

  it('removes suggestion from value when active pill is clicked', () => {
    const onChange = vi.fn();
    render(
      <AttributeInput
        value="woman, man"
        onChange={onChange}
        placeholder="Enter gender"
        suggestions={['woman', 'man', 'non-binary']}
      />
    );
    const manPill = screen.getByRole('button', { name: /\bman\b/ });
    fireEvent.click(manPill);
    expect(onChange).toHaveBeenCalledWith('woman');
  });

  it('handles text input typing', () => {
    const onChange = vi.fn();
    render(
      <AttributeInput
        value="woman"
        onChange={onChange}
        placeholder="Enter gender"
        suggestions={['woman', 'man', 'non-binary']}
      />
    );
    const input = screen.getByPlaceholderText('Enter gender');
    fireEvent.change(input, { target: { value: 'woman, agender' } });
    expect(onChange).toHaveBeenCalledWith('woman, agender');
  });
});
