import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowUp, ArrowUpRight, Plus, Trash2, BookOpen, ShieldCheck, Loader, Copy, Check } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import { assistantStatus, askAssistant } from '../services/api';
const starters = ['What is the difference between tremor and Parkinson’s?', 'How should I understand a model confidence score?', 'What questions can I prepare for a neurologist?', 'How do the three NeuroScan models work?'];
export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const bottom = useRef(null), controller = useRef(null), input = useRef(null);
  useEffect(() => { let active = true; assistantStatus().then(result => { if (active) setStatus(result); }).catch(() => { if (active) setStatus({ configured: false }); }); return () => { active = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (messages.length) bottom.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' }); }, [messages, busy]);
  const submit = async event => {
    event.preventDefault();
    if (!question.trim() || busy || !status?.configured) return;
    const previous = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    while (previous.reduce((length, turn) => length + turn.content.length, 0) + question.trim().length > 14000) previous.splice(0, 2);
    const next = [...previous, { role: 'user', content: question.trim() }];
    setBusy(true); setError('');
    controller.current = new AbortController();
    try {
      const response = await askAssistant(next, controller.current.signal);
      setMessages([...messages, { role: 'user', content: question.trim() }, { role: 'assistant', content: response.answer, references: response.references }]);
      setQuestion('');
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { setBusy(false); }
  };
  const reset = () => { controller.current?.abort(); setMessages([]); setError(''); setQuestion(''); setCopied(null); input.current?.focus(); };
  const copy = async (content, index) => { try { await navigator.clipboard.writeText(content); setCopied(index); } catch { setError('Copy is unavailable in this browser. Select the answer text to copy it.'); } };
  return <PageTransition><div className="assistant-page">
    <aside className="assistant-sidebar"><Link to="/assistant" className="assistant-side-title"><Sparkles size={20} /> Medical assistant</Link><button className="p-button ghost" onClick={reset} disabled={busy}><Plus size={17} /> New conversation</button><div className="sidebar-section"><span className="p-kicker">GOOD PLACES TO START</span>{starters.map(text => <button key={text} disabled={busy} onClick={() => { setQuestion(text); input.current?.focus(); }}>{text}<ArrowUpRight size={14} /></button>)}</div><div className="assistant-library"><BookOpen size={20} /><h3>A little more context.</h3><p>Understand overlapping symptoms and what the models have been tested on.</p><Link to="/clinical-context">Clinical reference <ArrowUpRight size={14} /></Link><Link to="/evidence">Model evidence <ArrowUpRight size={14} /></Link></div><small>Conversations stay in this page’s memory. Reloading or leaving clears them.</small></aside>
    <section className="chat-main" aria-label="Medical information assistant"><header className="chat-top"><span><span className="status-dot" /> INFORMATION, WITH PERSPECTIVE</span><button type="button" className="chat-clear" onClick={reset} disabled={busy} aria-label="Clear conversation"><Trash2 size={16} /></button></header>
      {!messages.length && <div className="chat-welcome"><div className="assistant-symbol"><Sparkles size={35} /></div><span className="p-kicker">YOUR QUESTIONS HAVE A PLACE HERE</span><h1>Let’s make health<br /><em>a little clearer.</em></h1><p>Ask about medical concepts, movement symptoms, or how to understand research results.</p><div className="chat-starters">{starters.slice(0, 2).map(text => <button key={text} onClick={() => { setQuestion(text); input.current?.focus(); }}>{text}<ArrowUpRight size={16} /></button>)}</div></div>}
      <div className="chat-messages" aria-live="polite" aria-relevant="additions">{messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}><div className="message-author">{message.role === 'assistant' ? <><Sparkles size={15} /> NEUROSCAN AI</> : 'YOU'}</div><p>{message.content}</p>{message.references?.length > 0 && <div className="chat-references"><span>Suggested reading · not a live web search</span>{message.references.map(reference => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.title}<ArrowUpRight size={13} /></a>)}</div>}{message.role === 'assistant' && <button type="button" className="copy-answer" onClick={() => copy(message.content, index)}>{copied === index ? <Check size={13} /> : <Copy size={13} />}{copied === index ? 'Copied' : 'Copy answer'}</button>}</article>)}{busy && <div className="chat-thinking" role="status"><Loader className="animate-spin" size={15} /> Preparing an answer…</div>}<div ref={bottom} /></div>
      <div className="chat-composer"><div id="chat-privacy" className="chat-privacy"><ShieldCheck size={15} /><span>General information, not diagnosis or emergency care. AI can make mistakes. For an emergency, contact local emergency services.</span></div>{status && !status.configured && <p className="chat-connection" role="status">The AI connection is unavailable. The reference library and assessment tools are still available.</p>}<form onSubmit={submit}><label className="sr-only" htmlFor="medical-question">Your medical question</label><p className="chat-send-notice">By sending, you share your message and recent conversation with Google for an AI response. Please leave out names and identifying medical details.</p><div className="composer-box"><textarea id="medical-question" ref={input} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a general medical question…" maxLength={2000} rows={3} disabled={busy} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><div><span>{question.length}/2000 · Shift + Enter for a new line</span><button type="submit" aria-label="Send question" disabled={busy || !question.trim() || !status?.configured}><ArrowUp size={20} /></button></div></div></form><p className="chat-disclosure">Only recent conversation context is sent. Drawings, recordings and reports are never attached. This server does not store chat history. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a></p>{error && <p className="analysis-error" role="alert">{error} Your question is kept here so you can retry.</p>}</div>
    </section>
  </div></PageTransition>;
}
