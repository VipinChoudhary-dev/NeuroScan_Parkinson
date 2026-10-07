import { motion } from 'framer-motion';

/**
 * Spring-based hover/press micro-interaction wrapper.
 * Wraps any element (button, link, card) with scale + glow on hover/tap.
 *
 * Props:
 *   as: HTML tag to render (default: 'div')
 *   glowColor: CSS color for the hover box-shadow glow (default: cyan)
 *   scale: hover scale factor (default: 1.03)
 *   className, style, children: passed through
 */
const MotionButton = ({
  children,
  className,
  style,
  glowColor = 'rgba(139, 92, 246, 0.25)',
  scale = 1.03,
  ...rest
}) => (
  <motion.div
    whileHover={{
      scale,
      boxShadow: `0 0 20px ${glowColor}`,
      transition: { type: 'spring', stiffness: 400, damping: 17 },
    }}
    whileTap={{
      scale: 0.97,
      transition: { type: 'spring', stiffness: 400, damping: 17 },
    }}
    className={className}
    style={{ display: 'inline-block', ...style }}
    {...rest}
  >
    {children}
  </motion.div>
);

export default MotionButton;
