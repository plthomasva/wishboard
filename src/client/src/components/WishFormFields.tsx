import React from 'react';
import InfoToggle from './InfoToggle';

interface Contact {
  type: string;
  value: string;
}

interface WishFormFieldsProps {
  content: string;
  setContent: (content: string) => void;
  contacts: Contact[];
  setContacts: (contacts: Contact[]) => void;
  wishmailEnabled: boolean;
  setWishmailEnabled: (enabled: boolean) => void;
  isOverflowing?: boolean;
}

export default function WishFormFields({
  content,
  setContent,
  contacts,
  setContacts,
  wishmailEnabled,
  setWishmailEnabled,
  isOverflowing
}: WishFormFieldsProps) {
  const addContact = () => setContacts([...contacts, { type: 'FetLife', value: '' }]);
  
  const updateContact = (index: number, field: 'type' | 'value', val: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: val };
    setContacts(newContacts);
  };
  
  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  return (
    <>
      <label>
        What is your wish?
        <textarea
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Type your wish here"
          className={isOverflowing ? 'overflowing-textarea' : ''}
        />
      </label>
      
      {isOverflowing && (
        <div className="label-with-info" style={{ marginTop: '-4px', marginBottom: '8px' }}>
          <strong style={{ color: '#b91717', fontSize: '0.9rem', margin: 0 }}>Text Overflowing</strong>
          <InfoToggle>
            Your wish is getting quite long! The text won't fit beautifully on the physical display board at this size. Consider making it more concise.
          </InfoToggle>
        </div>
      )}

      <fieldset style={{ border: '1px solid #d7dee5', borderRadius: '12px', padding: '16px', background: '#f8fafc', marginTop: '4px' }}>
        <legend style={{ fontWeight: 600, padding: '0 8px' }}>Contacts & Wishmail</legend>
        <div style={{ display: 'grid', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal' }}>
            <input 
              type="checkbox" 
              checked={wishmailEnabled} 
              onChange={(e) => setWishmailEnabled(e.target.checked)} 
              style={{ width: 'auto', minHeight: 'auto' }}
            />
            Enable Wishmail (allow others to message you about this wish)
          </label>

          <div>
            <p style={{ margin: '8px 0', fontWeight: 600, fontSize: '0.9rem' }}>Contact Methods</p>
            {contacts.map((contact, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <select 
                  value={contact.type} 
                  onChange={(e) => updateContact(index, 'type', e.target.value)}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid #d7dee5', background: 'white' }}
                >
                  <option value="FetLife">FetLife</option>
                  <option value="Phone">Phone</option>
                  <option value="Email">Email</option>
                </select>
                <input 
                  type="text" 
                  value={contact.value} 
                  onChange={(e) => updateContact(index, 'value', e.target.value)} 
                  placeholder="Username, number, etc."
                  style={{ minHeight: '36px', padding: '8px' }}
                />
                <button type="button" onClick={() => removeContact(index)} style={{ minHeight: '36px', padding: '0 12px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>X</button>
              </div>
            ))}
            <button type="button" onClick={addContact} className="secondary-button" style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.9rem' }}>
              + Add Contact Method
            </button>
          </div>
        </div>
      </fieldset>
    </>
  );
}
