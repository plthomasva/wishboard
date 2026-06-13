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

const pages = [
  { id: 'home', label: 'Home' },
  { id: 'enter', label: 'Enter a Wish' },
  { id: 'search', label: 'Search Wishes' },
  { id: 'display', label: 'Big Screen' },
  { id: 'account', label: 'My Account' },
  { id: 'about', label: 'About' },
  { id: 'admin', label: 'Admin' }
];

type PageId = 'home' | 'enter' | 'search' | 'display' | 'account' | 'about' | 'admin' | 'manage-wish' | 'wishmail-dashboard';

function AppContent() {
  const getHashPage = (): PageId => {
    if (typeof window === 'undefined') {
      return 'home';
    }
    const hashPart = window.location.hash.split('?')[0].replace(/^#/, '');
    const validPages = ['home', 'enter', 'search', 'display', 'account', 'about', 'admin', 'manage-wish', 'wishmail-dashboard'];
    if (validPages.includes(hashPart)) {
      return hashPart as PageId;
    }
    return 'home';
  };

  const checkIsKioskParam = (): boolean => {
    if (typeof window === 'undefined') {
      return false;
    }
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('kiosk') === 'true') {
      return true;
    }
    const hashIndex = window.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(window.location.hash.substring(hashIndex));
      if (hashParams.get('kiosk') === 'true') {
        return true;
      }
    }
    return false;
  };

  const [page, setPage] = useState<PageId>(getHashPage);
  const [isKiosk, setIsKiosk] = useState<boolean>(checkIsKioskParam);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const [kioskUsername, setKioskUsername] = useState('');
  const [kioskPassphrase, setKioskPassphrase] = useState('');
  const [kioskError, setKioskError] = useState<string | null>(null);

  const { user, login, logout, setTokenExternally } = useAuth();

  useEffect(() => {
    // Check for auto-login token in the URL hash
    const hashIndex = window.location.hash.indexOf('?');
    if (hashIndex !== -1) {
      const hashParams = new URLSearchParams(window.location.hash.substring(hashIndex));
      const token = hashParams.get('token');
      if (token) {
        setTokenExternally(token);
        hashParams.delete('token');
        const hashStr = hashParams.toString();
        const baseHash = window.location.hash.substring(0, hashIndex);
        window.location.hash = baseHash + (hashStr ? `?${hashStr}` : '');
      }
    }

    const handleHashChange = () => {
      setPage(getHashPage());
      if (checkIsKioskParam()) {
        setIsKiosk(true);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isKiosk) {
        setShowExitPrompt(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKiosk]);

  const navigate = (pageId: PageId) => {
    window.location.hash = `#${pageId}`;
    setPage(pageId);
  };

  const handleExitKiosk = async (e: React.FormEvent) => {
    e.preventDefault();
    setKioskError(null);
    try {
      const res = await login(kioskUsername, kioskPassphrase);
      if (res.success) {
        if (res.role === 'admin') {
          setIsKiosk(false);
          setShowExitPrompt(false);
          setKioskUsername('');
          setKioskPassphrase('');

          // Remove the kiosk parameter from the URL to prevent re-entering on reload
          if (window.location.hash.includes('kiosk=true')) {
            const hashIndex = window.location.hash.indexOf('?');
            if (hashIndex !== -1) {
              window.location.hash = window.location.hash.substring(0, hashIndex);
            }
          }
          const searchParams = new URLSearchParams(window.location.search);
          if (searchParams.has('kiosk')) {
            searchParams.delete('kiosk');
            const searchStr = searchParams.toString();
            const newUrl = window.location.pathname + (searchStr ? `?${searchStr}` : '') + window.location.hash;
            window.history.replaceState({}, '', newUrl);
          }
        } else {
          setKioskError('Access denied: You must be an admin to exit kiosk mode.');
        }
      } else {
        setKioskError(res.error || 'Invalid credentials.');
      }
    } catch (err) {
      setKioskError('An error occurred during authentication.');
    }
  };

  const shellClass = `app-shell ${page === 'display' ? 'page-display' : ''} ${isKiosk ? 'kiosk-mode' : ''}`;

  return (
    <div className={shellClass}>
      {!isKiosk && (
        <header className="app-header">
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
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>👤</span>
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
        </main>
      )}

      {showExitPrompt && (
        <div className="kiosk-modal-backdrop">
          <div className="kiosk-modal">
            <h2>Exit Kiosk Mode</h2>
            <p className="kiosk-modal-sub">Please enter admin credentials to exit kiosk mode.</p>
            <form onSubmit={handleExitKiosk}>
              {kioskError && <div className="kiosk-modal-error">{kioskError}</div>}
              <label>
                Admin Username
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
                Passphrase
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
