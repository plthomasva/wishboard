import { useEffect, useState, useRef } from 'react';
import WishCard from '../components/WishCard';
import useFlagWish from '../hooks/useFlagWish';
import SendWishmailModal from '../components/SendWishmailModal';

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
  const [capacity, setCapacity] = useState<number>(12);
  const [mailWishId, setMailWishId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadWishes = async () => {
      setError(null);
      try {
        // Fetch exactly the number of wishes that perfectly fit the physical screen
        const currentLimit = isKiosk ? capacity : 12;
        const response = await fetch(`/api/wishes/random?limit=${currentLimit}`);
        if (!response.ok) {
          throw new Error('Unable to load wishes.');
        }
        const data = await response.json();
        setWishes(data);
      } catch (err) {
        setError((err as Error).message);
      }
    };

    loadWishes();
    const handle = globalThis.setInterval(loadWishes, 12000);
    return () => globalThis.clearInterval(handle);
  }, [capacity, isKiosk]);

  useEffect(() => {
    if (!isKiosk) return;
    
    const calculateCapacity = () => {
      if (!gridRef.current) return;
      const width = gridRef.current.clientWidth;
      const height = gridRef.current.clientHeight;
      
      // Determine card min-width and gap based on screen size (matches styles.css media queries)
      const isLargeScreen = globalThis.innerWidth >= 1600;
      const gap = isLargeScreen ? 40 : 24;
      const cardWidth = isLargeScreen ? 500 : 240;
      
      // Cards have aspect-ratio: 5 / 3
      const cardHeight = cardWidth * (3 / 5);
      
      const cols = Math.max(1, Math.floor((width + gap) / (cardWidth + gap)));
      // Subtract a little buffer from height to ensure we don't clip the bottom row
      const rows = Math.max(1, Math.floor((height + gap - 10) / (cardHeight + gap)));
      
      setCapacity(cols * rows);
    };

    const observer = new ResizeObserver(calculateCapacity);
    if (gridRef.current) observer.observe(gridRef.current);
    
    calculateCapacity();
    return () => observer.disconnect();
  }, [isKiosk, wishes]);

  const handleFlag = useFlagWish((id) => setWishes((prev) => prev.filter((wish) => wish.id !== id)));

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
      <div className="display-grid" ref={gridRef}>
        {wishes.map((wish) => (
          <WishCard
            key={wish.id}
            wish={wish}
            cardClass="display-card"
            showFlag={!isKiosk}
            onFlag={handleFlag}
            onSendMail={setMailWishId}
          />
        ))}
      </div>

      {mailWishId && (
        <SendWishmailModal wishId={mailWishId} onClose={() => setMailWishId(null)} />
      )}
    </section>
  );
}
