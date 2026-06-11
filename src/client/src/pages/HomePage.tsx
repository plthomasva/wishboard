interface HomePageProps {
  onNavigate: (page: 'enter' | 'search' | 'display' | 'account' | 'admin') => void;
}

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <section>
      <h1>Welcome to Wishboard</h1>
      <p>Choose an action below to enter a wish, search wishes, or show the rotating display.</p>
      <div className="home-actions">
        <button onClick={() => onNavigate('enter')}>Enter a Wish</button>
        <button onClick={() => onNavigate('search')}>Search Wishes</button>
        <button onClick={() => onNavigate('display')}>Big Screen Display</button>

        <button onClick={() => onNavigate('account')}>My Account</button>
        <button onClick={() => onNavigate('admin')}>Admin</button>
      </div>
    </section>
  );
}
