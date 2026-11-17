import { useState, type FormEvent } from 'react';
import type { Session } from '../../stats/src/types';
import { API, loadSession, signIn, signOut } from './api';
import { FeedView } from './Feed';
import { OverviewView } from './Overview';
import { ToolsView } from './Tools';
import { VisitorPanel } from './Visitor';
import styles from './Admin.module.css';

const TABS = [
  ['overview', 'Обзор'],
  ['feed', 'Лента'],
  ['tools', 'Инструменты'],
] as const;

type Tab = (typeof TABS)[number][0];

const readTab = (): Tab => {
  const hash = location.hash.slice(1);
  return TABS.some(([id]) => id === hash) ? (hash as Tab) : 'overview';
};

export function Admin() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [tab, setTab] = useState<Tab>(readTab);
  const [visitor, setVisitor] = useState<string | null>(null);

  if (!session) return <Login onSignedIn={setSession} />;

  const signedOut = () => {
    signOut();
    setSession(null);
  };
  const open = (next: Tab) => {
    setTab(next);
    history.replaceState(null, '', `#${next}`);
  };
  const props = { session, onSignedOut: signedOut, onVisitor: setVisitor };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href={import.meta.env.BASE_URL}>
          bash-me-up<span>/admin</span>
        </a>
        <nav className={styles.tabs} aria-label="Разделы">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={id === tab ? styles.tabOn : styles.tab}
              aria-current={id === tab ? 'page' : undefined}
              onClick={() => open(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button type="button" className={styles.ghost} onClick={signedOut}>
          Выйти
        </button>
      </header>
      <main className={styles.main}>
        {tab === 'overview' && <OverviewView {...props} />}
        {tab === 'feed' && <FeedView {...props} />}
        {tab === 'tools' && <ToolsView {...props} />}
      </main>
      {visitor && <VisitorPanel {...props} id={visitor} onClose={() => setVisitor(null)} />}
    </div>
  );
}

function Login({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onSignedIn(await signIn(password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <form className={styles.login} onSubmit={submit}>
        <h1>
          bash-me-up<span>/admin</span>
        </h1>
        <label htmlFor="password">пароль:</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy || !API}
        />
        <button type="submit" className={styles.button} disabled={busy || !password || !API}>
          {busy ? 'проверяю…' : 'войти'}
        </button>
        <p className={styles.error} role="alert">
          {!API ? 'VITE_STATS_URL не задан: админке не к чему подключаться' : error}
        </p>
      </form>
    </div>
  );
}

export interface ViewProps {
  session: Session;
  onSignedOut: () => void;
  onVisitor: (id: string) => void;
}
