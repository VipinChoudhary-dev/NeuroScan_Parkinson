import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { BrainCircuit, Menu, X, ArrowUpRight } from 'lucide-react';
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { const close = event => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const links = [['/assessment','Assessment'],['/voice','Voice'],['/spiral','Spiral'],['/wave','Wave'],['/evidence','Evidence'],['/assistant','Assistant']];
  return <nav className="navbar premium-nav" aria-label="Main navigation"><div className="nav-content"><Link to="/" className="premium-brand" onClick={() => setOpen(false)}><span><BrainCircuit size={22} /></span>neuroscan<span className="brand-ai">/ AI</span></Link><button className="mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="primary-links" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><div className={`nav-links ${open ? 'is-open' : ''}`} id="primary-links">{links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}<Link className="mobile-context" to="/clinical-context" onClick={() => setOpen(false)}>Clinical context</Link></div><Link to={pathname === '/assessment' ? '/evidence' : '/assessment'} className="nav-cta">{pathname === '/assessment' ? 'View evidence' : 'Get started'}<ArrowUpRight size={14} /></Link></div></nav>;
}
