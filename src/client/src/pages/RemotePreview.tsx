import { useState } from 'react';
import EnterWishPage from './EnterWishPage';
import SearchPage from './SearchPage';
import DisplayPage from './DisplayPage';

export default function RemotePreview() {
  const [kioskMode, setKioskMode] = useState<'enter' | 'search'>('enter');

  return (
    <section>
      <h1>Remote Live Preview</h1>
      <p>
        This page shows a simulated kiosk on the left and the rotating main display on the right.
        It is ideal for remote development and live demos.
      </p>

      <div className="device-grid">
        <div className="device-frame">
          <div className="device-header">Kiosk Tablet</div>
          <div className="device-nav">
            <button onClick={() => setKioskMode('enter')} className={kioskMode === 'enter' ? 'nav-button active' : 'nav-button'}>
              Enter Wish
            </button>
            <button onClick={() => setKioskMode('search')} className={kioskMode === 'search' ? 'nav-button active' : 'nav-button'}>
              Search
            </button>
          </div>
          <div className="device-content">
            {kioskMode === 'enter' ? <EnterWishPage /> : <SearchPage />}
          </div>
        </div>

        <div className="device-frame">
          <div className="device-header">Main Display</div>
          <div className="device-content">
            <DisplayPage />
          </div>
        </div>
      </div>
    </section>
  );
}
