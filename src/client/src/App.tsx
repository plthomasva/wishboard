import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import HomePage from './pages/HomePage';
import EnterWishPage from './pages/EnterWishPage';
import SearchPage from './pages/SearchPage';
import DisplayPage from './pages/DisplayPage';
import AdminPage from './pages/AdminPage';
import AccountPage from './AccountPage';
import ManageWishPage from './pages/ManageWishPage';
import WishmailDashboard from './pages/WishmailDashboard';
import AboutPage from './pages/AboutPage';
import WiFiQrCode from './components/WiFiQrCode';
import PosterPage from './pages/PosterPage';

const pages = [
  { id: 'home', label: 'Home' },
  { id: 'enter', label: 'Enter a Wish' },
  { id: 'search', label: 'Search Wishes' },
  { id: 'display', label: 'Big Screen' },
  { id: 'account', label: 'My Account' },
  { id: 'about', label: 'About' },
  { id: 'admin', label: 'Admin' }
];

type PageId = 'home' | 'enter' | 'search' | 'display' | 'account' | 'about' | 'admin' | 'manage-wish' | 'wishmail-dashboard' | 'poster';

const getHashPage = (): PageId => {
  if (typeof globalThis === 'undefined') {
    return 'home';
  }
  const hashPart = globalThis.location.hash.split('?')[0].replace(/^#/, '');
  const validPages = ['home', 'enter', 'search', 'display', 'account', 'about', 'admin', 'manage-wish', 'wishmail-dashboard', 'poster'];
  if (validPages.includes(hashPart)) {
    return hashPart as PageId;
  }
  return 'home';
};

const checkIsKioskParam = (): boolean => {
  if (typeof globalThis === 'undefined') {
    return false;
  }
  const searchParams = new URLSearchParams(globalThis.location.search);
  if (searchParams.get('kiosk') === 'true') {
    return true;
  }
  const hashIndex = globalThis.location.hash.indexOf('?');
  if (hashIndex !== -1) {
    const hashParams = new URLSearchParams(globalThis.location.hash.substring(hashIndex));
    if (hashParams.get('kiosk') === 'true') {
      return true;
    }
  }
  return false;
};

const removeKioskParams = () => {
  if (typeof globalThis === 'undefined') {
    return;
  }
  if (globalThis.location.hash.includes('kiosk=true')) {
    const hashIndex = globalThis.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      globalThis.location.hash = globalThis.location.hash.substring(0, hashIndex);
    }
  }
  const searchParams = new URLSearchParams(globalThis.location.search);
  if (searchParams.has('kiosk')) {
    searchParams.delete('kiosk');
    const searchStr = searchParams.toString();
    const newUrl = globalThis.location.pathname + (searchStr ? `?${searchStr}` : '') + globalThis.location.hash;
    globalThis.history.replaceState({}, '', newUrl);
  }
};

function AppContent() {

  const [page, setPage] = useState<PageId>(getHashPage);
  const [isKiosk, setIsKiosk] = useState<boolean>(checkIsKioskParam);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [kioskUsername, setKioskUsername] = useState('');
  const [kioskPassphrase, setKioskPassphrase] = useState('');
  const [kioskError, setKioskError] = useState<string | null>(null);

  const { user, login, logout, setTokenExternally } = useAuth();

  useEffect(() => {
    // Check for auto-login token in the URL hash
    const hashIndex = globalThis.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(globalThis.location.hash.substring(hashIndex));
      const token = hashParams.get('token');
      if (token) {
        setTokenExternally(token);
        hashParams.delete('token');
        const hashStr = hashParams.toString();
        const baseHash = globalThis.location.hash.substring(0, hashIndex);
        globalThis.location.hash = baseHash + (hashStr ? `?${hashStr}` : '');
      }
    }

    const handleHashChange = () => {
      setPage(getHashPage());
      if (checkIsKioskParam()) {
        setIsKiosk(true);
      }
    };
    globalThis.addEventListener('hashchange', handleHashChange);
    return () => globalThis.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKiosk) {
        setShowExitPrompt(true);
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isKiosk]);

  const navigate = (pageId: PageId) => {
    globalThis.location.hash = `#${pageId}`;
    setPage(pageId);
  };

  const handleExitKiosk = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setKioskError(null);
    try {
      const res = await login(kioskUsername, kioskPassphrase);
      if (!res.success) {
        setKioskError(res.error || 'Invalid credentials.');
        return;
      }

      if (res.role !== 'admin') {
        setKioskError('Access denied: You must be an admin to exit kiosk mode.');
        return;
      }

      setIsKiosk(false);
      setShowExitPrompt(false);
      setKioskUsername('');
      setKioskPassphrase('');
      removeKioskParams();
    } catch (err) {
      console.error(err);
      setKioskError('An error occurred during authentication.');
    }
  };

  const shellClass = `app-shell ${page === 'display' ? 'page-display' : ''} ${page === 'search' ? 'page-search' : ''} ${isKiosk ? 'kiosk-mode' : ''}`;

  return (
    <div className={shellClass}>
      {!isKiosk && (
        <header className="app-header desktop-only">
          <div className="logo">Wishboard</div>
          <nav className="nav-bar">
            {pages.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'nav-button active' : 'nav-button'}
                onClick={() => navigate(item.id as PageId)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="user-area" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user ? (
              <>
                <button
                  className="user-link-button"
                  onClick={() => navigate('account')}
                  aria-label="My Account"
                >
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>👤</span>
                  {user.username}
                </button>
                <button className="compact-btn" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <div
                  style={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontSize: '1.05rem', padding: '8px 12px', cursor: 'default' }}
                  aria-label="Guest Account"
                >
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>👤</span>{' '}
                  Guest
                </div>
                <button className="compact-btn" onClick={() => navigate('account')}>
                  Log in
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {isKiosk ? (
        <main className="kiosk-content">
          <DisplayPage onEnterKiosk={() => setIsKiosk(true)} isKiosk={true} />
          <WiFiQrCode />
        </main>
      ) : (
        <main className="content-area">
          {page === 'home' && <HomePage onNavigate={navigate} />}
          {page === 'enter' && <EnterWishPage />}
          {page === 'search' && <SearchPage />}
          {page === 'display' && <DisplayPage onEnterKiosk={() => setIsKiosk(true)} isKiosk={false} />}
          {page === 'account' && <AccountPage />}
          {page === 'about' && <AboutPage />}
          {page === 'manage-wish' && <ManageWishPage />}
          {page === 'wishmail-dashboard' && <WishmailDashboard />}
          {page === 'admin' && <AdminPage />}
          {page === 'poster' && <PosterPage />}
        </main>
      )}

      {/* Mobile Bottom Tab Bar */}
      {!isKiosk && (
        <nav className="mobile-bottom-bar">
          {pages.filter(p => !['admin', 'poster', 'about'].includes(p.id)).map((item) => (
            <button
              key={item.id}
              className={`mobile-tab-button ${page === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id as PageId)}
            >
              <div className="mobile-tab-icon">
                {item.id === 'home' && '🏠'}
                {item.id === 'enter' && '✨'}
                {item.id === 'search' && '🔍'}
                {item.id === 'display' && '📺'}
                {item.id === 'account' && '👤'}
              </div>
              <span className="mobile-tab-label">{item.label}</span>
            </button>
          ))}
          {/* Hamburger Menu for the rest */}
          <button className="mobile-tab-button" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <div className="mobile-tab-icon">☰</div>
            <span className="mobile-tab-label">More</span>
          </button>
        </nav>
      )}

      {/* Mobile Hamburger Overlay */}
      {!isKiosk && isMobileMenuOpen && (
        <div id="mobile-hamburger-menu" className="mobile-hamburger-menu" style={{ display: 'flex' }}>
          <button
            aria-label="Close menu"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent', border: 'none', cursor: 'default', padding: 0, margin: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsMobileMenuOpen(false);
            }}
          />
          <div className="hamburger-content">
            <button className="hamburger-close" onClick={() => setIsMobileMenuOpen(false)}>✕</button>
            <div className="hamburger-items">
              <button className="hamburger-item" onClick={() => { navigate('about'); setIsMobileMenuOpen(false); }}>About</button>
              <button className="hamburger-item" onClick={() => { navigate('admin'); setIsMobileMenuOpen(false); }}>Admin</button>
              {user && <button className="hamburger-item" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>Log out</button>}
            </div>
          </div>
        </div>
      )}

      {showExitPrompt && (
        <div className="kiosk-modal-backdrop">
          <div className="kiosk-modal">
            <h2>Exit Kiosk Mode</h2>
            <p className="kiosk-modal-sub">Please enter admin credentials to exit kiosk mode.</p>
            <form onSubmit={handleExitKiosk}>
              {kioskError && <div className="kiosk-modal-error">{kioskError}</div>}
              <label>
                Admin Username{' '}
                <input
                  type="text"
                  required
                  value={kioskUsername}
                  onChange={(e) => setKioskUsername(e.target.value)}
                  placeholder="e.g. admin"
                  autoFocus
                />
              </label>
              <label>
                Passphrase{' '}
                <input
                  type="password"
                  required
                  value={kioskPassphrase}
                  onChange={(e) => setKioskPassphrase(e.target.value)}
                  placeholder="Enter passphrase"
                />
              </label>
              <div className="kiosk-modal-actions">
                <button type="button" className="secondary-button" onClick={() => {
                  setShowExitPrompt(false);
                  setKioskError(null);
                  setKioskUsername('');
                  setKioskPassphrase('');
                }}>
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Confirm Exit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
