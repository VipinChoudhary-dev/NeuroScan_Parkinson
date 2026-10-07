import { lazy, Suspense, useState, useEffect } from 'react';

/* ---------- Reduced-motion fallback ---------- */
const useReducedMotion = () => {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
};

const StaticFallback = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background:
        'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, rgba(168,85,247,0.08) 40%, transparent 70%)',
      filter: 'blur(20px)',
    }}
  />
);

const LoadingFallback = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        width: 200,
        height: 200,
        borderRadius: '50%',
        background:
          'radial-gradient(ellipse at center, rgba(139,92,246,0.1) 0%, rgba(168,85,247,0.06) 50%, transparent 70%)',
        animation: 'pulse 2s ease-in-out infinite',
      }}
    />
  </div>
);

/* ---------- Lazy-load Three.js scene ---------- */
const NeuronScene = lazy(() => import('./NeuronScene.jsx'));

const NeuronNetwork = () => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="hero-3d-container">
        <StaticFallback />
      </div>
    );
  }

  return (
    <div className="hero-3d-container">
      <Suspense fallback={<LoadingFallback />}>
        <NeuronScene />
      </Suspense>
    </div>
  );
};

export default NeuronNetwork;
