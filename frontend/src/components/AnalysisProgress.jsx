import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Animated step-based progress indicator for analysis.
 * Fakes intermediate states on the frontend using timers
 * while the single API call runs in the background.
 *
 * Props:
 *   isLoading: boolean — drives the animation lifecycle
 *   type: 'voice' | 'drawing' — determines step labels
 */

const STEP_SETS = {
  voice: [
    { label: 'Preparing audio input', delay: 0 },
    { label: 'Extracting acoustic features', delay: 800 },
    { label: 'Running voice model', delay: 2200 },
    { label: 'Preparing classification', delay: 3800 },
  ],
  drawing: [
    { label: 'Processing image', delay: 0 },
    { label: 'Analyzing stroke patterns', delay: 700 },
    { label: 'Running CNN model', delay: 1800 },
    { label: 'Preparing classification', delay: 3000 },
  ],
};

const AnalysisProgress = ({ isLoading, type = 'voice' }) => {
  const [activeStep, setActiveStep] = useState(-1);
  const timersRef = useRef([]);
  const steps = STEP_SETS[type] || STEP_SETS.voice;

  useEffect(() => {
    // Clean up any pending timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!isLoading) {
      const reset = setTimeout(() => setActiveStep(-1), 0);
      return () => clearTimeout(reset);
    }

    // Start stepping through
    steps.forEach((step, i) => {
      const timer = setTimeout(() => setActiveStep(i), step.delay);
      timersRef.current.push(timer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [isLoading, steps]);

  if (!isLoading) return null;

  return (
    <motion.div
      className="analysis-progress"
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: 'auto', marginTop: '1.5rem' }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {steps.map((step, i) => {
        const status = i < activeStep ? 'completed' : i === activeStep ? 'active' : 'pending';
        return (
          <motion.div
            key={i}
            className={`progress-step ${status}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{
              opacity: i <= activeStep ? 1 : 0.3,
              x: 0,
            }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <span className="step-icon">
              {status === 'completed' ? (
                <Check size={11} strokeWidth={3} />
              ) : status === 'active' ? (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'white', display: 'block',
                }} />
              ) : (
                <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{i + 1}</span>
              )}
            </span>
            <span className="step-text">
              {step.label}{status === 'active' ? '…' : ''}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default AnalysisProgress;
