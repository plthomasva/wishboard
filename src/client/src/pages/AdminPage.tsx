import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../AuthContext';

const getSortIcon = (ruleSort: { key: string, dir: 'asc'|'desc' }, key: string) => {
  if (ruleSort.key !== key) return '';
  return ruleSort.dir === 'asc' ? '▲' : '▼';
};

// --- Subcomponents ---

function MatchingRulesSection({ authHeader, setMessage, setError, refreshCounter }: any) {
  const [rules, setRules] = useState<Array<any>>([]);
  const [ruleFilter, setRuleFilter] = useState('');
  const [ruleSort, setRuleSort] = useState<{ key: string, dir: 'asc'|'desc' }>({ key: 'created_at', dir: 'desc' });
  const emptyRule = {
    rule_type: 'expansion', trigger_attribute: 'role', trigger_value: '',
    target_attribute: 'role', target_value: '', context_attribute: '', context_value: ''
  };
  const [newRule, setNewRule] = useState(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const loadRules = async () => {
    setError(null);
    const response = await fetch('/api/rules', { headers: authHeader });
    if (response.ok) setRules(await response.json());
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRules(); }, [refreshCounter]);

  const filteredRules = useMemo(() => {
    return rules.filter(r => 
      !ruleFilter || Object.values(r).some(v => String(v).toLowerCase().includes(ruleFilter.toLowerCase()))
    ).sort((a, b) => {
      const aVal = a[ruleSort.key] || '';
      const bVal = b[ruleSort.key] || '';
      if (aVal === bVal) return 0;
      const cmp = aVal > bVal ? 1 : -1;
      return ruleSort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rules, ruleFilter, ruleSort]);

  const handleRuleSort = (key: string) => {
    if (ruleSort.key === key) {
      setRuleSort({ key, dir: ruleSort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setRuleSort({ key, dir: 'asc' });
    }
  };

  const deleteRule = async (id: string) => {
    if (!globalThis.confirm('Are you sure you want to delete this rule?')) return;
    setMessage(null); setError(null);
    const response = await fetch(`/api/rules/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeader });
    if (!response.ok) { setError('Failed to delete rule.'); return; }
    setMessage(`Deleted rule ${id}`);
    loadRules();
  };

  const editRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setNewRule({
      rule_type: rule.rule_type,
      trigger_attribute: rule.trigger_attribute,
      trigger_value: rule.trigger_value,
      target_attribute: rule.target_attribute,
      target_value: rule.target_value,
      context_attribute: rule.context_attribute || '',
      context_value: rule.context_value || ''
    });
    // scroll to form
    const form = document.getElementById('rule-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setNewRule(emptyRule);
  };

  const saveRule = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null); setError(null);
    const method = editingRuleId ? 'PUT' : 'POST';
    const url = editingRuleId ? `/api/rules/${encodeURIComponent(editingRuleId)}` : '/api/rules';
    
    const response = await fetch(url, {
      method, headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(newRule)
    });
    if (!response.ok) { setError(`Failed to ${editingRuleId ? 'update' : 'create'} rule.`); return; }
    setMessage(`Rule ${editingRuleId ? 'updated' : 'created'} successfully.`);
    setNewRule(emptyRule);
    setEditingRuleId(null);
    loadRules();
  };

  return (
    <section>
      <h2>Matching Rules</h2>
      <p>Define rules for the matchmaking engine. Add expansible matches (e.g. pet -&gt; pup, kitten) or cross-matches (e.g. handler &lt;-&gt; pet).</p>
      <div style={{ marginBottom: '12px' }}>
        <input type="text" placeholder="Filter rules..." value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} className="base-input" style={{ padding: '8px', width: '100%', maxWidth: '300px' }} />
      </div>
      <div style={{ overflowX: 'auto', marginBottom: '24px', background: '#1c1c1c', borderRadius: '8px', border: '1px solid #333' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#e0e0e0' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #444', backgroundColor: '#2a2a2a' }}>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleRuleSort('rule_type')}>Type {getSortIcon(ruleSort, 'rule_type')}</th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleRuleSort('trigger_attribute')}>Trigger {getSortIcon(ruleSort, 'trigger_attribute')}</th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleRuleSort('context_attribute')}>Context {getSortIcon(ruleSort, 'context_attribute')}</th>
              <th style={{ padding: '12px', cursor: 'pointer' }} onClick={() => handleRuleSort('target_attribute')}>Target {getSortIcon(ruleSort, 'target_attribute')}</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => (
              <tr key={rule.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '12px' }}><strong>{rule.rule_type}</strong></td>
                <td style={{ padding: '12px' }}>{rule.trigger_attribute} = {rule.trigger_value}</td>
                <td style={{ padding: '12px' }}>{rule.context_attribute ? `${rule.context_attribute} = ${rule.context_value}` : <span style={{ color: '#777' }}>-</span>}</td>
                <td style={{ padding: '12px' }}>{rule.target_attribute} = {rule.target_value}</td>
                <td style={{ padding: '12px' }}>
                  <button type="button" className="secondary-button" style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: 'auto', marginRight: '4px' }} onClick={() => editRule(rule)}>Edit</button>
                  <button type="button" className="secondary-button" style={{ padding: '4px 8px', fontSize: '0.8rem', minWidth: 'auto' }} onClick={() => deleteRule(rule.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {filteredRules.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#888' }}>No matching rules found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <form id="rule-form" className="form-card" onSubmit={saveRule} style={{ marginTop: '24px', border: editingRuleId ? '2px solid #555' : 'none' }}>
        <h3>{editingRuleId ? 'Edit Rule' : 'Add New Rule'}</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <label>
            Rule Type{' '}
            <select value={newRule.rule_type} onChange={e => setNewRule({ ...newRule, rule_type: e.target.value })}>
              <option value="expansion">Expansion (Synonyms)</option>
              <option value="cross_match">Cross-Match (Symmetrical)</option>
              <option value="enrichment">Enrichment (Implicit Attribute)</option>
              <option value="acceptance">Acceptance (Blank Override)</option>
            </select>
          </label>
          <label>
            Trigger Attribute{' '}
            <select value={newRule.trigger_attribute} onChange={e => setNewRule({ ...newRule, trigger_attribute: e.target.value })}>
              <option value="role">Role</option>
              <option value="gender">Gender</option>
              <option value="orientation">Orientation</option>
            </select>
          </label>
          <label>
            Target Attribute{' '}
            <select value={newRule.target_attribute} onChange={e => setNewRule({ ...newRule, target_attribute: e.target.value })}>
              <option value="role">Role</option>
              <option value="gender">Gender</option>
              <option value="orientation">Orientation</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <label style={{ flex: 1 }}>
            Trigger Value (e.g. handler){' '}
            <input required value={newRule.trigger_value} onChange={e => setNewRule({ ...newRule, trigger_value: e.target.value })} />
          </label>
          <label style={{ flex: 1 }}>
            Target Value (e.g. pet, pup){' '}
            <input required value={newRule.target_value} onChange={e => setNewRule({ ...newRule, target_value: e.target.value })} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <label style={{ flex: 1 }}>
            Context Attribute (Optional){' '}
            <select value={newRule.context_attribute} onChange={e => setNewRule({ ...newRule, context_attribute: e.target.value })}>
              <option value="">None</option>
              <option value="role">Role</option>
              <option value="gender">Gender</option>
              <option value="orientation">Orientation</option>
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Context Value (Optional){' '}
            <input value={newRule.context_value} onChange={e => setNewRule({ ...newRule, context_value: e.target.value })} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="submit">{editingRuleId ? 'Save Changes' : 'Add Rule'}</button>
          {editingRuleId && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>
    </section>
  );
}

function FlaggedWishesSection({ authHeader, setMessage, setError, refreshCounter }: any) {
  const [flags, setFlags] = useState<Array<{ id: string; content: string; flagged: number; user_id: string | null }>>([]);

  const loadFlags = async () => {
    setError(null);
    const response = await fetch('/api/admin/flags', { headers: authHeader });
    if (!response.ok) { setError('Unable to load flagged wishes.'); return; }
    setFlags(await response.json());
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFlags(); }, [refreshCounter]);

  const removeWish = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}/remove`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to remove wish.'); return; }
    setMessage(`Removed wish ${id}`);
    loadFlags();
  };

  const clearFlag = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/wishes/${encodeURIComponent(id)}/clear-flag`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to clear flag.'); return; }
    setMessage(`Cleared flag for wish ${id}`);
    loadFlags();
  };

  const clearAllFlags = async () => {
    if (!globalThis.confirm('Are you sure you want to clear flags for all remaining wishes?')) return;
    setMessage(null); setError(null);
    const response = await fetch('/api/admin/wishes/clear-all-flags', { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to clear all flags.'); return; }
    setMessage('Cleared all flags successfully.');
    loadFlags();
  };

  return (
    <section style={{ marginTop: '24px' }}>
      <h2>Flagged Wishes</h2>
      <div className="wish-grid">
        {flags.length === 0 ? <p>No flagged wishes at the moment.</p> : flags.map((wish) => (
          <article className="wish-card" key={wish.id}>
            <p>{wish.content}</p>
            <p className="microtext">Submitted by {wish.user_id || 'anonymous'}</p>
            <div className="wish-actions">
              <button type="button" className="secondary-button" onClick={() => clearFlag(wish.id)}>Clear Flag</button>
              <button type="button" onClick={() => removeWish(wish.id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>
      {flags.length > 0 && (
        <div className="admin-bulk-actions">
          <button type="button" className="secondary-button" onClick={clearAllFlags}>Clear All Flags</button>
        </div>
      )}
    </section>
  );
}

function DemoSeederSection({ authHeader, setMessage, setError, triggerRefresh }: any) {
  const runSeeder = async () => {
    setMessage(null); setError(null);
    const response = await fetch('/api/admin/reset-demo', { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to run seeder.'); return; }
    const data = await response.json();
    setMessage(`Seeder completed: ${data.stats.usersCreated} users and ${data.stats.wishesCreated} wishes created.`);
    triggerRefresh();
  };

  return (
    <section style={{ marginTop: '24px' }}>
      <h2>Demo Seeder</h2>
      <p>Generate simulated users and wishes for testing. <strong>Warning: This clears existing demo data.</strong></p>
      <button type="button" className="secondary-button" onClick={runSeeder} style={{ marginTop: '12px' }}>Run Seeder</button>
    </section>
  );
}

function SystemMetricsSection({ authHeader, refreshCounter }: any) {
  const [metricsTicket, setMetricsTicket] = useState<string | null>(null);

  const loadMetricsTicket = async () => {
    try {
      const response = await fetch('/api/admin/metrics-ticket', { headers: authHeader });
      if (!response.ok) return;
      const data = await response.json();
      setMetricsTicket(data.ticket);
    } catch (e) { console.error('Failed to load metrics ticket:', e); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMetricsTicket(); }, [refreshCounter]);

  return (
    <section style={{ marginTop: '24px' }}>
      <h2>System Metrics</h2>
      <p>Real-time server performance and request statistics.</p>
      {metricsTicket ? (
        <iframe src={`/api/admin/metrics?ticket=${metricsTicket}`} style={{ width: '100%', height: '600px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', marginTop: '12px' }} title="System Metrics" />
      ) : <p>Loading metrics...</p>}
    </section>
  );
}

function SystemLogsSection({ authHeader, token }: any) {
  const [rawLogs, setRawLogs] = useState<string>('');
  const [filterRepeating, setFilterRepeating] = useState<boolean>(true);
  const [isTailing, setIsTailing] = useState<boolean>(true);
  const logsEndRef = useRef<HTMLPreElement>(null);

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs', { headers: authHeader });
      if (!response.ok) { setRawLogs('Failed to load logs.'); return; }
      const data = await response.json();
      setRawLogs(data.logs || '');
    } catch (e) { console.error(e); setRawLogs('Failed to load logs.'); }
  };

  const displayLogs = useMemo(() => {
    const logsString = rawLogs || '';
    if (!filterRepeating) return logsString;
    return logsString.split('\n').filter(line => !line.includes('/api/admin/logs') && !line.includes('/api/wishes/random')).join('\n');
  }, [rawLogs, filterRepeating]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    if (isTailing && logsEndRef.current) logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
  }, [displayLogs, isTailing]);

  useEffect(() => {
    if (!isTailing || !token) return;
    let isActive = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/admin/logs', { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          if (isActive) setRawLogs(data.logs || '');
        }
      } catch (e) { console.error(e); }
    };
    const interval = setInterval(poll, 2000);
    return () => { isActive = false; clearInterval(interval); };
  }, [isTailing, token]);

  return (
    <section style={{ marginTop: '24px' }}>
      <h2>System Logs</h2>
      <p>Recent server logs including rate limit warnings and failed logins.</p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button type="button" className="secondary-button" onClick={() => setIsTailing(!isTailing)}>{isTailing ? 'Pause Tailing' : 'Resume Tailing'}</button>
        <button type="button" className="secondary-button" onClick={loadLogs}>Refresh Now</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <input type="checkbox" checked={filterRepeating} onChange={(e) => setFilterRepeating(e.target.checked)} />
          <span>Filter repeating logs</span>
        </label>
      </div>
      <pre ref={logsEndRef} style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '12px', overflowX: 'auto', maxHeight: '400px', borderRadius: '4px', fontSize: '12px' }}>
        {displayLogs || 'No logs available.'}
      </pre>
    </section>
  );
}

function UserAccountsSection({ authHeader, setMessage, setError, refreshCounter }: any) {
  const [users, setUsers] = useState<Array<{ id: string; username: string; role: string }>>([]);

  const loadUsers = async () => {
    setError(null);
    const response = await fetch('/api/admin/users', { headers: authHeader });
    if (response.ok) setUsers(await response.json());
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, [refreshCounter]);

  const updateRole = async (id: string, role: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    if (!response.ok) { setError('Failed to update role.'); return; }
    setMessage(`Updated user role for ${id}`);
    loadUsers();
  };

  const resetPassphrase = async (id: string) => {
    if (!globalThis.confirm("Are you sure you want to reset this user's passphrase? Any active sessions will be terminated.")) return;
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to reset passphrase.'); return; }
    const data = await response.json();
    setMessage(`Passphrase successfully reset! The new passphrase is: ${data.newPassphrase}`);
  };

  const deleteUser = async (id: string) => {
    setMessage(null); setError(null);
    const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}/delete`, { method: 'POST', headers: authHeader });
    if (!response.ok) { setError('Failed to delete user.'); return; }
    setMessage(`Deleted user ${id}`);
    loadUsers();
  };

  return (
    <section style={{ marginTop: '24px' }}>
      <h2>User Accounts</h2>
      {users.length === 0 ? <p>No user accounts exist yet.</p> : (
        <div className="wish-grid">
          {users.map((account) => (
            <article className="wish-card" key={account.id}>
              <strong>{account.username}</strong>
              <p>Role: {account.role}</p>
              <div className="wish-actions" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="secondary-button" onClick={() => resetPassphrase(account.id)}>Reset Password</button>
                {account.role === 'admin' ? (
                  <button type="button" onClick={() => updateRole(account.id, 'user')}>Demote</button>
                ) : (
                  <button type="button" onClick={() => updateRole(account.id, 'admin')}>Promote</button>
                )}
                <button type="button" className="secondary-button" onClick={() => deleteUser(account.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminPage() {
  const { user, token, login } = useAuth();
  const [username, setUsername] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const authHeader: Record<string, string> = useMemo(() => token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {}, [token]);

  const onLogin = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setMessage(null);
    const result = await login(username.trim(), passphrase.trim());
    if (!result.success) { setError(result.error || 'Login failed.'); return; }
    setUsername(''); setPassphrase('');
    if (result.role !== 'admin') { setError('Logged in successfully, but this account is not an admin.'); return; }
    setMessage('Admin login successful.');
  };

  const triggerRefresh = () => setRefreshCounter(c => c + 1);

  return (
    <section>
      <h1>Admin Panel</h1>
      <p>Only admin users can review flagged wishes and manage accounts.</p>
      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}

      {user?.role === 'admin' ? (
        <>
          <MatchingRulesSection authHeader={authHeader} setMessage={setMessage} setError={setError} refreshCounter={refreshCounter} />
          <FlaggedWishesSection authHeader={authHeader} setMessage={setMessage} setError={setError} refreshCounter={refreshCounter} />
          <DemoSeederSection authHeader={authHeader} setMessage={setMessage} setError={setError} triggerRefresh={triggerRefresh} />
          <SystemMetricsSection authHeader={authHeader} refreshCounter={refreshCounter} />
          <SystemLogsSection authHeader={authHeader} token={token} />
          <UserAccountsSection authHeader={authHeader} setMessage={setMessage} setError={setError} refreshCounter={refreshCounter} />
        </>
      ) : (
        <form className="form-card" onSubmit={onLogin}>
          <label>Admin username{' '}<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Admin passphrase{' '}<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></label>
          <button type="submit">Login as Admin</button>
        </form>
      )}
    </section>
  );
}
