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

  it('renders gender icons with correct stroke colors on suggestions', () => {
    render(
      <AttributeInput
        value=""
        onChange={() => {}}
        placeholder="Enter gender"
        suggestions={['woman', 'man']}
      />
    );

    const womanPill = screen.getByRole('button', { name: /\bwoman\b/ });
    const manPill = screen.getByRole('button', { name: /\bman\b/ });

    const womanSvg = womanPill.querySelector('svg');
    const manSvg = manPill.querySelector('svg');

    expect(womanSvg).toBeInTheDocument();
    expect(womanSvg).toHaveAttribute('stroke', '#d81b60');

    expect(manSvg).toBeInTheDocument();
    expect(manSvg).toHaveAttribute('stroke', '#1565c0');
  });
});
