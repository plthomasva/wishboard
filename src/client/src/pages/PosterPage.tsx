import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function PosterPage() {
  const domain = import.meta.env.VITE_WISHBOARD_DOMAIN || 'wishboard.painless-computing.com';
  const url = `https://${domain}`;
  const wifiString = 'WIFI:T:WPA;S:Wishboard_WiFi;P:wishboard2026;;';

  return (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center', 
      fontFamily: 'sans-serif', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        border: '2px solid #ccc', 
        padding: '2rem', 
        borderRadius: '16px', 
        maxWidth: '850px', 
        width: '100%', 
        background: '#fff', 
        color: '#333',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid'
      }}>
        <h1 style={{ fontSize: '3.5rem', margin: '0 0 1rem 0', color: '#1a73e8' }}>Wishboard</h1>
        <p style={{ fontSize: '1.4rem', color: '#555', marginBottom: '2rem', marginTop: '0' }}>
          Welcome! Follow the two steps below to connect to the Wishboard and start making matches.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          {/* Step 1: WiFi */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', minWidth: '280px' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#ff6b6b', margin: '0 0 1rem 0' }}>Step 1: Join Wi-Fi</h2>
            <div style={{ display: 'inline-block', padding: '1rem', background: '#fff', border: '1px solid #eee', borderRadius: '16px', marginBottom: '1rem' }}>
              <QRCodeSVG value={wifiString} size={240} level="H" />
            </div>
            <p style={{ fontSize: '1.2rem', margin: '0.5rem 0' }}><strong>Network:</strong> Wishboard_WiFi</p>
            <p style={{ fontSize: '1.2rem', margin: '0' }}><strong>Password:</strong> wishboard2026</p>
          </div>

          {/* Step 2: URL */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1', minWidth: '280px' }}>
            <h2 style={{ fontSize: '1.8rem', color: '#ff6b6b', margin: '0 0 1rem 0' }}>Step 2: Scan to Visit</h2>
            <div style={{ display: 'inline-block', padding: '1rem', background: '#fff', border: '1px solid #eee', borderRadius: '16px', marginBottom: '1rem' }}>
              <QRCodeSVG value={url} size={240} level="H" />
            </div>
            <p style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '0.5rem 0', color: '#1a73e8' }}>
              {domain}
            </p>
            <p style={{ fontSize: '1.1rem', margin: '0', color: '#666' }}>(Or type this URL into your browser)</p>
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-around', gap: '2rem', textAlign: 'left', borderTop: '2px dashed #eee', paddingTop: '2rem' }}>
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
        onClick={() => window.print()}
        style={{ marginTop: '2rem', fontSize: '1.2rem', padding: '1rem 2rem' }}
      >
        🖨️ Print Poster
      </button>
    </div>
  );
}
