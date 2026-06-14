import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

interface SendWishmailModalProps {
  wishId: string;
  onClose: () => void;
}

export default function SendWishmailModal({ wishId, onClose }: SendWishmailModalProps) {
  const { token } = useAuth();
  const [content, setContent] = useState('');
  const [contacts, setContacts] = useState<{ type: string; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const addContact = () => setContacts([...contacts, { type: 'FetLife', value: '' }]);
  const updateContact = (index: number, field: 'type' | 'value', val: string) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: val };
    setContacts(newContacts);
  };
  const removeContact = (index: number) => setContacts(contacts.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api/wishes/${wishId}/mail`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        return_contacts: contacts.filter(c => c.value.trim())
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to send message.');
    } else {
      setSuccess(true);
      setTimeout(onClose, 2000);
    }
  };

  return (
    <div className="kiosk-modal-backdrop" style={{ zIndex: 100000 }}>
      <div className="kiosk-modal" style={{ maxWidth: '500px' }}>
        <h2>Send Wishmail</h2>
        {success ? (
          <div className="message success">Message sent successfully!</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="kiosk-modal-error">{error}</div>}

            <label>
              Your Message
              <textarea
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What would you like to say to the wish creator?"
                autoFocus
              />
            </label>

            <fieldset style={{ border: '1px solid #d7dee5', borderRadius: '12px', padding: '16px', background: '#f8fafc', marginTop: '16px' }}>
              <legend style={{ fontWeight: 600, padding: '0 8px' }}>Return Contacts (Optional)</legend>
              <p className="microtext" style={{ marginTop: 0 }}>Provide a way for them to reply to you.</p>

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
                  <button type="button" onClick={() => removeContact(index)} style={{ minHeight: '36px', padding: '0 12px', background: '#e53e3e' }}>X</button>
                </div>
              ))}
              <button type="button" onClick={addContact} className="secondary-button" style={{ minHeight: '36px', padding: '6px 12px', fontSize: '0.9rem' }}>
                + Add Return Contact
              </button>
            </fieldset>

            <div className="kiosk-modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit">
                Send Message
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
