import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WishFormFields from './WishFormFields';
import React from 'react';

describe('WishFormFields', () => {
  it('renders content textarea and calls setContent', () => {
    const setContent = vi.fn();
    render(
      <WishFormFields
        content="my wish"
        setContent={setContent}
        contacts={[]}
        setContacts={vi.fn()}
        wishmailEnabled={false}
        setWishmailEnabled={vi.fn()}
        isOverflowing={false}
      />
    );
    const textarea = screen.getByRole('textbox', { name: /What is your wish\?/i });
    expect(textarea).toHaveValue('my wish');
    expect(textarea).toHaveAttribute('rows', '6');
    expect(textarea).toHaveAttribute('placeholder', 'Type your wish here');
    expect(textarea).not.toHaveClass('overflowing-textarea');
    expect(screen.queryByText('Text Overflowing')).not.toBeInTheDocument();

    // Check fieldset renders
    expect(screen.getByText('Contacts & Wishmail')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'new wish' } });
    expect(setContent).toHaveBeenCalledWith('new wish');
  });

  it('renders overflow hint and styling when isOverflowing is true', () => {
    render(
      <WishFormFields
        content="my wish"
        setContent={vi.fn()}
        contacts={[]}
        setContacts={vi.fn()}
        wishmailEnabled={false}
        setWishmailEnabled={vi.fn()}
        isOverflowing={true}
      />
    );
    expect(screen.getByText('Text Overflowing')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox', { name: /What is your wish\?/i });
    expect(textarea).toHaveClass('overflowing-textarea');
  });

  it('toggles wishmail checkbox', () => {
    const setWishmailEnabled = vi.fn();
    render(
      <WishFormFields
        content=""
        setContent={vi.fn()}
        contacts={[]}
        setContacts={vi.fn()}
        wishmailEnabled={false}
        setWishmailEnabled={setWishmailEnabled}
      />
    );
    const checkbox = screen.getByRole('checkbox', { name: /Enable Wishmail/i });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(setWishmailEnabled).toHaveBeenCalledWith(true);
  });

  it('adds, updates, and removes contacts', () => {
    const setContacts = vi.fn();
    const contacts = [{ type: 'FetLife', value: 'user1' }];

    render(
      <WishFormFields
        content=""
        setContent={vi.fn()}
        contacts={contacts}
        setContacts={setContacts}
        wishmailEnabled={false}
        setWishmailEnabled={vi.fn()}
      />
    );

    // Add contact
    const addButton = screen.getByRole('button', { name: '+ Add Contact Method' });
    fireEvent.click(addButton);
    expect(setContacts).toHaveBeenCalledWith([...contacts, { type: 'FetLife', value: '' }]);

    // Update contact type
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBe(1);
    fireEvent.change(selects[0], { target: { value: 'Email' } });

    // Test updateContact callback payload
    expect(setContacts).toHaveBeenCalledWith([{ type: 'Email', value: 'user1' }]);

    // Update contact value
    const textInputs = screen.getAllByPlaceholderText('Username, number, etc.');
    expect(textInputs.length).toBe(1);
    fireEvent.change(textInputs[0], { target: { value: 'newval' } });
    expect(setContacts).toHaveBeenCalledWith([{ type: 'FetLife', value: 'newval' }]);

    // Remove contact
    const removeButton = screen.getByRole('button', { name: 'X' });
    fireEvent.click(removeButton);
    expect(setContacts).toHaveBeenCalledWith([]);
  });
});
