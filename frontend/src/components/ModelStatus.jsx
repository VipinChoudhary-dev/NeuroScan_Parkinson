import { useEffect, useState } from 'react';
import { RefreshCw, CloudMoon } from 'lucide-react';
import { healthCheck } from '../services/api';
import { IS_PUBLIC_PREVIEW } from '../config/deployment';

// Only mounted in analysis workspaces; no background polling or homepage alert.
export default function ModelStatus() {
  const [state, setState] = useState(IS_PUBLIC_PREVIEW ? 'preview' : 'checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (IS_PUBLIC_PREVIEW) return undefined;
    let active = true;
    const controller = new AbortController();
    healthCheck(controller.signal).then(health => {
      if (active) setState(health.status === 'ok' ? 'ready' : 'unavailable');
    }).catch(() => { if (active) setState('unavailable'); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  if (state !== 'unavailable') return null;
  return <aside className="service-note no-print" role="status"><CloudMoon size={19} /><div><strong>Analysis is temporarily unavailable</strong><p>You can still explore the site and prepare your files. Please check again before analysing.</p></div><button type="button" onClick={() => { setState('checking'); setAttempt(value => value + 1); }}><RefreshCw size={14} /> Check again</button></aside>;
}
