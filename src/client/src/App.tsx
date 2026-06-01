import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import HomePage from './pages/HomePage';
import EnterWishPage from './pages/EnterWishPage';
import SearchPage from './pages/SearchPage';
import DisplayPage from './pages/DisplayPage';
import RemotePreview from './pages/RemotePreview';
import AdminPage from './pages/AdminPage';
import AccountPage from './AccountPage';

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
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleHashChange = () => setPage(getHashPage());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (pageId: PageId) => {
    window.location.hash = `#${pageId}`;
    setPage(pageId);
  };

  return (
    <div className="app-shell">
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

      <main className="content-area">
        {page === 'home' && <HomePage onNavigate={navigate} />}
        {page === 'enter' && <EnterWishPage />}
        {page === 'search' && <SearchPage />}
        {page === 'display' && <DisplayPage />}
        {page === 'remote' && <RemotePreview />}
        {page === 'account' && <AccountPage />}
        {page === 'admin' && <AdminPage />}
      </main>
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
