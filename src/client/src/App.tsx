import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import HomePage from './pages/HomePage';
import EnterWishPage from './pages/EnterWishPage';
import SearchPage from './pages/SearchPage';
import DisplayPage from './pages/DisplayPage';
import RemotePreview from './pages/RemotePreview';
import AdminPage from './pages/AdminPage';
import AccountPage from './AccountPage';
import WiFiQrCode from './components/WiFiQrCode';

const pages = [
  { id: 'home', label: 'Home' },
  { id: 'enter', label: 'Enter a Wish' },
  { id: 'search', label: 'Search Wishes' },
  { id: 'display', label: 'Big Screen' },
  { id: 'remote', label: 'Remote Preview' },
  { id: 'account', label: 'My Account' },
  { id: 'admin', label: 'Admin' }
];

type PageId = 'home' | 'enter' | 'search' | 'display' | 'remote' | 'account' | 'admin';

function AppContent() {
  const getHashPage = (): PageId => {
    if (typeof window === 'undefined') {
      return 'home';
    }
    const hash = window.location.hash.replace(/^#/, '');
    return (pages.find((item) => item.id === hash)?.id as PageId) ?? 'home';
  };

  const [page, setPage] = useState<PageId>(getHashPage);
  const [isKiosk, setIsKiosk] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  
  const [kioskUsername, setKioskUsername] = useState('');
  const [kioskPassphrase, setKioskPassphrase] = useState('');
  const [kioskError, setKioskError] = useState<string | null>(null);

  const { user, login, logout } = useAuth();

  useEffect(() => {
    const handleHashChange = () => setPage(getHashPage());
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
          <div className="user-area">
            {user ? (
              <>
                <span>{user.username}</span>
                <button className="secondary-button" onClick={logout}>Logout</button>
              </>
            ) : (
              <span>Guest</span>
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
          {page === 'remote' && <RemotePreview />}
          {page === 'account' && <AccountPage />}
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
