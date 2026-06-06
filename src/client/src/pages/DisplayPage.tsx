import { useEffect, useState } from 'react';
import IdentityStickers from '../components/IdentityStickers';

interface Wish {
  id: string;
  content: string;
  creator_genders?: string[];
  creator_orientations?: string[];
}

interface DisplayPageProps {
  onEnterKiosk?: () => void;
  isKiosk?: boolean;
}

export default function DisplayPage({ onEnterKiosk, isKiosk }: DisplayPageProps = {}) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadWishes = async () => {
    setError(null);
    try {
      const response = await fetch('/api/wishes/random?limit=12');
      if (!response.ok) {
        throw new Error('Unable to load wishes.');
      }
      const data = await response.json();
      setWishes(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    loadWishes();
    const handle = window.setInterval(loadWishes, 12000);
    return () => window.clearInterval(handle);
  }, []);

  return (
    <section className="display-section">
      <div className="display-header-bar">
        <h1>Big Screen Display</h1>
        {!isKiosk && onEnterKiosk && (
          <button className="kiosk-btn secondary-button" onClick={onEnterKiosk}>
            Enter Kiosk Mode
          </button>
        )}
      </div>
      <p>This screen refreshes automatically with rotated wishes.</p>
      {error && <div className="message error">{error}</div>}
      <div className="display-grid">
        {wishes.map((wish) => (
          <article className="display-card" key={wish.id}>
            <IdentityStickers genders={wish.creator_genders} orientations={wish.creator_orientations} />
            <span className="wish-id">#{wish.id}</span>
            <p className="wish-text">{wish.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
