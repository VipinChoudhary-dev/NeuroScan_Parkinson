import { useEffect, useState } from 'react';
import { healthCheck } from '../services/api';

export default function ModelStatus() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const health = await healthCheck();
        const unavailable = Object.entries(health.models || {}).filter(([, state]) => state !== 'loaded').map(([name]) => name);
        if (active) setMessage(unavailable.length ? `Analysis unavailable for: ${unavailable.join(', ')}. Please try again later.` : '');
      } catch (error) { if (active) setMessage(error.message); }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return message ? <div className="model-status analysis-error" role="alert">{message}</div> : null;
}
