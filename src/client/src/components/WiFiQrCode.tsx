import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Position {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
}

export default function WiFiQrCode() {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ bottom: '2rem', right: '2rem' });

  useEffect(() => {
    // Show for 30s, hide for 150s (total cycle 180s)
    const SHOW_DURATION = 30000;
    const HIDE_DURATION = 150000;

    let timeoutId: ReturnType<typeof setTimeout>;

    const cycle = () => {
      // Pick a random corner
      const corners: Position[] = [
        { top: '2rem', left: '2rem' },
        { top: '2rem', right: '2rem' },
        { bottom: '2rem', left: '2rem' },
        { bottom: '2rem', right: '2rem' },
        // Add a few centered variants for fun
        { top: '50%', left: '2rem', transform: 'translateY(-50%)' },
        { top: '50%', right: '2rem', transform: 'translateY(-50%)' }
      ];
      setPosition(corners[Math.floor(Math.random() * corners.length)]);
      setIsVisible(true);

      timeoutId = setTimeout(() => {
        setIsVisible(false);
        timeoutId = setTimeout(cycle, HIDE_DURATION);
      }, SHOW_DURATION);
    };

    // Initial wait before first show (10 seconds for testing/quick visibility)
    timeoutId = setTimeout(cycle, 10000);

    return () => clearTimeout(timeoutId);
  }, []);

  if (!isVisible) return null;

  const wifiString = 'WIFI:T:WPA;S:Wishboard_WiFi;P:wishboard2026;;';

  const domain = import.meta.env.VITE_WISHBOARD_DOMAIN || import.meta.env.VITE_WISHBOARD_AP_IP || '10.42.0.1:3000';
  const url = domain.includes('painless-computing.com') ? `https://${domain}` : `http://${domain}`;

  return (
    <div
      style={{
        position: 'fixed',
        ...position,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        color: 'white',
        padding: '1.5rem',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 9999,
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        // Add a nice glassmorphism look
      }}
    >
      <h3 style={{ margin: 0, fontSize: '1.2rem', textAlign: 'center', fontWeight: 600 }}>Connect to Wishboard</h3>
      <div style={{ background: 'white', padding: '0.75rem', borderRadius: '12px' }}>
        <QRCodeSVG value={wifiString} size={160} level="H" />
      </div>
      <div style={{ textAlign: 'center', maxWidth: '220px' }}>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
          <strong>Network:</strong> Wishboard_WiFi
          <br />
          <strong>Password:</strong> wishboard2026
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
          Then visit:<br />
          <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>{url}</strong>
        </p>
      </div>
    </div>
  );
}
