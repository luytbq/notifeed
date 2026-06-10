import { useEffect, useState } from 'react'
import { FeedPage } from './components/FeedPage'
import { LoginPage } from './components/LoginPage'

type State = 'loading' | 'login' | 'feed'

export default function App() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    fetch(`${base}/api/notifications?limit=1`, { credentials: 'include' })
      .then(r => setState(r.ok ? 'feed' : 'login'))
      .catch(() => setState('login'))
  }, [])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-400">Loading…</div>
      </div>
    )
  }

  if (state === 'login') {
    return <LoginPage onLogin={() => setState('feed')} />
  }

  return <FeedPage onLogout={() => setState('login')} />
}
