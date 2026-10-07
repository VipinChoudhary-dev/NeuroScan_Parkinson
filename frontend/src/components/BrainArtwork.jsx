import { useEffect, useRef, useState } from 'react';
import { AudioLines, Fingerprint, Pause, Play } from 'lucide-react';

export default function BrainArtwork() {
  const ref = useRef(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); }, { threshold: .08 });
    observer.observe(ref.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  const tilt = event => {
    if (paused || event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--brain-x', `${((event.clientY - box.top) / box.height - .5) * -7}deg`);
    event.currentTarget.style.setProperty('--brain-y', `${((event.clientX - box.left) / box.width - .5) * 9}deg`);
  };
  const resetTilt = () => { ref.current?.style.setProperty('--brain-x', '0deg'); ref.current?.style.setProperty('--brain-y', '0deg'); };
  return <div ref={ref} className={`brain-feature-art living-brain ${visible && !paused ? 'is-running' : ''}`} onPointerMove={tilt} onPointerLeave={resetTilt}>
    <div className="brain-feature-aura" aria-hidden="true" />
    <div className="brain-parallax"><img src="/brain-hero.png" width="1376" height="1184" loading="lazy" decoding="async" alt="Stylized purple neural brain illustration" /><div className="brain-energy-ring" aria-hidden="true" /><div className="brain-energy-ring second" aria-hidden="true" /><div className="brain-spark spark-one" aria-hidden="true" /><div className="brain-spark spark-two" aria-hidden="true" /><div className="brain-spark spark-three" aria-hidden="true" /></div>
    <span className="brain-art-label">THE HUMAN CONTEXT / NEUROSCAN</span>
    <div className="brain-callout brain-callout-one"><AudioLines size={16} /><span>Voice patterns<small>An acoustic perspective</small></span></div>
    <div className="brain-callout brain-callout-two"><Fingerprint size={16} /><span>Drawing patterns<small>A movement perspective</small></span></div>
    <div className="brain-art-bottom"><span className="brain-art-caption">Conceptual illustration · not a brain scan</span><button type="button" aria-label={paused ? 'Play brain animation' : 'Pause brain animation'} onClick={() => { setPaused(!paused); resetTilt(); }}>{paused ? <Play size={13} /> : <Pause size={13} />}</button></div>
  </div>;
}
