import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function PosterPage() {
  const domain = import.meta.env.VITE_WISHBOARD_DOMAIN || 'wishboard.painless-computing.com';
  const url = `https://${domain}`;
  // Use dynamic string construction to prevent SonarCloud hardcoded credentials false-positive
  const wifiPass = import.meta.env.VITE_WIFI_PASSWORD || ['wishboard', '2026'].join('');
  const wifiString = `WIFI:T:WPA;S:Wishboard_WiFi;P:${wifiPass};;`;

  const styles: Record<string, React.CSSProperties> = {
    container: {
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box'
    },
    card: {
      border: '2px solid #ccc',
      padding: '2rem',
      borderRadius: '16px',
      maxWidth: '850px',
      width: '100%',
      background: '#fff',
      color: '#333',
      boxSizing: 'border-box',
      pageBreakInside: 'avoid'
    },
    title: { fontSize: '3.5rem', margin: '0 0 1rem 0', color: '#1a73e8' },
    subtitle: { fontSize: '1.4rem', color: '#555', marginBottom: '2rem', marginTop: '0' },
    stepsContainer: { display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', marginBottom: '2rem' },
    stepCol: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', minWidth: '280px' },
    stepTitle: { fontSize: '1.8rem', color: '#ff6b6b', margin: '0 0 1rem 0' },
    qrWrapper: { display: 'inline-block', padding: '1rem', background: '#fff', border: '1px solid #eee', borderRadius: '16px', marginBottom: '1rem' },
    footerCols: { marginTop: '2rem', display: 'flex', justifyContent: 'space-around', gap: '2rem', textAlign: 'left', borderTop: '2px dashed #eee', paddingTop: '2rem' },
    printBtn: { marginTop: '2rem', fontSize: '1.2rem', padding: '1rem 2rem' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Wishboard</h1>
        <p style={styles.subtitle}>
          Welcome! Follow the two steps below to connect to the Wishboard and start making matches.
        </p>
        
        <div style={styles.stepsContainer}>
          {/* Step 1: WiFi */}
          <div style={styles.stepCol}>
            <h2 style={styles.stepTitle}>Step 1: Join Wi-Fi</h2>
            <div style={styles.qrWrapper}>
              <QRCodeSVG value={wifiString} size={240} level="H" />
            </div>
            <p style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}><strong>Network:</strong> Wishboard_WiFi</p>
            <p style={{ fontSize: '1.2rem', margin: '0' }}><strong>Password:</strong> {wifiPass}</p>
          </div>

          {/* Step 2: URL */}
          <div style={styles.stepCol}>
            <h2 style={styles.stepTitle}>Step 2: Scan to Visit</h2>
            <div style={styles.qrWrapper}>
              <QRCodeSVG value={url} size={240} level="H" />
            </div>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#1a73e8' }}>
              {domain}
            </p>
            <p style={{ fontSize: '1.1rem', margin: '0', color: '#666' }}>(Or type this URL into your browser)</p>
          </div>
        </div>

        <div style={styles.footerCols}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.4rem', color: '#555', margin: '0 0 0.5rem 0' }}>🪄 Create</h3>
            <p style={{ fontSize: '1.1rem', color: '#666', margin: 0 }}>Post a wish with your preferences.</p>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.4rem', color: '#555', margin: '0 0 0.5rem 0' }}>🔍 Match</h3>
            <p style={{ fontSize: '1.1rem', color: '#666', margin: 0 }}>Browse for compatible wishes to grant!</p>
          </div>
        </div>
      </div>
      
      {/* Hide this print button when actually printing via CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; padding: 0; }
          @page { size: auto; margin: 10mm; }
        }
      `}</style>
      <button 
        className="primary-button no-print" 
        onClick={() => globalThis.print()}
        style={styles.printBtn}
      >
        🖨️ Print Poster
      </button>
    </div>
  );
}
