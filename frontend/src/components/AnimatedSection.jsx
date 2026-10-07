import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: (direction = 'up') => ({
    opacity: 0,
    y: direction === 'up' ? 40 : direction === 'down' ? -40 : 0,
    x: direction === 'left' ? 40 : direction === 'right' ? -40 : 0,
  }),
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

/**
 * Reusable scroll-triggered animation wrapper.
 *
 * Usage:
 *   <AnimatedSection>        → stagger container (wrap around multiple AnimatedItem)
 *   <AnimatedSection.Item>   → individual animated child
 *
 * Props:
 *   direction: 'up' | 'down' | 'left' | 'right' (default: 'up')
 *   delay: additional delay in seconds
 *   className, style: passed through
 */
const AnimatedSection = ({ children, className, style, ...rest }) => (
  <motion.div
    variants={containerVariants}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.15 }}
    className={className}
    style={style}
    {...rest}
  >
    {children}
  </motion.div>
);

const AnimatedItem = ({ children, direction = 'up', delay = 0, className, style, ...rest }) => (
  <motion.div
    variants={itemVariants}
    custom={direction}
    className={className}
    style={style}
    transition={{ delay }}
    {...rest}
  >
    {children}
  </motion.div>
);

AnimatedSection.Item = AnimatedItem;

export default AnimatedSection;
