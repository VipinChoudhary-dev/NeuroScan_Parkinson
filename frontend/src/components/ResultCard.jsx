import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const ResultCard = ({ result }) => {
  const [displayPct, setDisplayPct] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const isHighRisk = result?.status === 1;
  const cls = isHighRisk ? 'high-risk' : 'low-risk';
  const pct = result ? (result.confidence * 100).toFixed(1) : '0.0';

  // Animate the percentage counter and bar
  useEffect(() => {
    if (!result) return;

    const resetFrame = requestAnimationFrame(() => {
      setDisplayPct(0);
      setBarWidth(0);
    });
    let countFrame;

    // Start bar animation after a brief delay
    const barTimer = setTimeout(() => setBarWidth(parseFloat(pct)), 100);

    // Count up the percentage
    const target = parseFloat(pct);
    const duration = 1000;
    const startTime = Date.now();
    const countUp = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct((eased * target).toFixed(1));
      if (progress < 1) countFrame = requestAnimationFrame(countUp);
    };
    countFrame = requestAnimationFrame(countUp);

    return () => {
      clearTimeout(barTimer);
      cancelAnimationFrame(resetFrame);
      cancelAnimationFrame(countFrame);
    };
  }, [result, pct]);

  // Keep every hook above this return, including when a result is cleared.
  if (!result) return null;

  return (
    <motion.div
      className={`result-card ${cls}`}
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      <motion.div
        className="result-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {result.prediction}
      </motion.div>

      <motion.div
        className="result-value"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 20 }}
      >
        {displayPct}%
      </motion.div>

      <p className="score-caption">Model confidence in this classification</p>
      <div className="confidence-bar">
        <div className="confidence-fill" style={{ width: `${barWidth}%` }} />
      </div>

      <p className="score-caption">This score is not your probability of having Parkinson’s disease.</p>

      {result.detail && (
        <motion.p
          className="result-detail"
          style={{ marginTop: '1rem' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {result.detail}
        </motion.p>
      )}
    </motion.div>
  );
};

export default ResultCard;
