import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import VoiceAnalysis from './pages/VoiceAnalysis';
import SpiralTest from './pages/SpiralTest';
import WaveTest from './pages/WaveTest';
import About from './pages/About';
import Assessment from './pages/Assessment';
import Evidence from './pages/Evidence';
import ClinicalContext from './pages/ClinicalContext';
import ModelStatus from './components/ModelStatus';
import Assistant from './pages/Assistant';
import SiteFooter from './components/SiteFooter';
import { Sparkles } from 'lucide-react';
import './premium.css';

function AnimatedRoutes() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) { window.scrollTo({ top: 0, behavior: 'instant' }); return; }
    const timer = setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' }), 500);
    return () => clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/voice" element={<VoiceAnalysis />} />
        <Route path="/spiral" element={<SpiralTest />} />
        <Route path="/wave" element={<WaveTest />} />
        <Route path="/about" element={<About />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/evidence" element={<Evidence />} />
        <Route path="/clinical-context" element={<ClinicalContext />} />
        <Route path="/assistant" element={<Assistant />} />
      </Routes>
    </AnimatePresence>
  );
}

function ChatShortcut() {
  const { pathname } = useLocation();
  return pathname === '/assistant' ? null : <Link to="/assistant" className="chat-shortcut no-print" aria-label="Open medical information assistant"><Sparkles size={20} /><span>Ask NeuroScan</span></Link>;
}

function App() {
  return (
    <Router>
      <MotionConfig reducedMotion="user">
        <Navbar />
        <ModelStatus />
        <main>
          <AnimatedRoutes />
        </main>
        <SiteFooter />
        <ChatShortcut />
      </MotionConfig>
    </Router>
  );
}

export default App;
