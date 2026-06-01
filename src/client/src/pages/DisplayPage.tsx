import { useEffect, useState } from 'react';

export default function DisplayPage() {
  const [wishes, setWishes] = useState<Array<{ id: string; content: string }>>([]);
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
    <section>
      <h1>Big Screen Display</h1>
      <p>This screen refreshes automatically with rotated wishes.</p>
      {error && <div className="message error">{error}</div>}
      <div className="display-grid">
        {wishes.map((wish) => (
          <article className="display-card" key={wish.id}>
            <p>{wish.content}</p>
            <span>{wish.id}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
