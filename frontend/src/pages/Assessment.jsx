import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Mic, PenTool, Upload, Download, Printer, RotateCcw, FlaskConical, ArrowRight, Check, X, Loader, SlidersHorizontal } from 'lucide-react';
import PageTransition from '../components/PageTransition';
import Recorder from '../components/assessment/Recorder';
import { createAssessment, fetchDemoSample } from '../services/api';
import '../assessment.css';

const TESTS = [
  { key: 'voice', title: 'Voice recording', Icon: Mic, hint: 'A clear 3–5 second sustained vowel. Quiet room; consistent microphone distance.', accept: 'audio/*,.wav,.mp3,.webm,.m4a,.ogg,.flac', limit: 25 },
  { key: 'spiral', title: 'Spiral drawing', Icon: PenTool, hint: 'Draw an expanding spiral on plain paper. Crop the photo to the drawing; avoid shadows.', accept: 'image/png,image/jpeg,image/webp', limit: 12 },
  { key: 'wave', title: 'Wave drawing', Icon: Activity, hint: 'Draw several continuous waves on plain paper. Use a clear, evenly lit photograph.', accept: 'image/png,image/jpeg,image/webp', limit: 12 },
];
const initialWeights = { voice: 1, spiral: 1, wave: 1 };
const newCode = () => `NS-${crypto.randomUUID().slice(0, 8)}`;
const number = value => value == null ? '—' : value.toFixed(3);

export default function Assessment() {
  const [files, setFiles] = useState({});
  const filesRef = useRef({});
  const [weights, setWeights] = useState(initialWeights);
  const [mode, setMode] = useState('same_person');
  const [confirmed, setConfirmed] = useState(false);
  const [sessionCode, setSessionCode] = useState(newCode);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState(null);
  const [demoLabel, setDemoLabel] = useState('healthy');
  const [demoNumber, setDemoNumber] = useState('1');
  const reportRef = useRef(null);
  useEffect(() => () => { Object.values(filesRef.current).forEach(entry => URL.revokeObjectURL(entry.url)); }, []);
  const changed = () => setRevision(value => value + 1);
  const replaceFile = (kind, file) => {
    const test = TESTS.find(test => test.key === kind);
    if (file && file.size > test.limit * 1024 * 1024) { setError(`${test.title} must be smaller than ${test.limit} MB.`); return; }
    if (file && (kind === 'voice' ? !(/\.(wav|wave|mp3|webm|m4a|ogg|flac)$/i.test(file.name) || file.type.startsWith('audio/')) : !file.type.startsWith('image/'))) {
      setError(`Choose a valid ${kind === 'voice' ? 'audio recording' : 'image'} for ${test.title.toLowerCase()}.`); return;
    }
    if (filesRef.current[kind]) URL.revokeObjectURL(filesRef.current[kind].url);
    const next = { ...filesRef.current };
    if (file) next[kind] = { file, url: URL.createObjectURL(file) }; else delete next[kind];
    filesRef.current = next; setFiles(next); setConfirmed(false); setError(''); changed();
  };
  const reset = () => {
    Object.values(filesRef.current).forEach(entry => URL.revokeObjectURL(entry.url));
    filesRef.current = {}; setFiles({}); setWeights(initialWeights); setMode('same_person');
    setConfirmed(false); setNote(''); setReport(null); setError(''); setSessionCode(newCode()); changed();
  };
  const loadDemo = async () => {
    setLoading(true); setError('');
    try {
      const samples = await Promise.all(TESTS.map(test => fetchDemoSample(test.key, demoLabel, demoNumber)));
      TESTS.forEach((test, index) => replaceFile(test.key, samples[index]));
      setMode('demo'); setConfirmed(false); changed();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const submit = async event => {
    event.preventDefault(); setLoading(true); setError('');
    const form = new FormData();
    Object.entries(files).forEach(([kind, entry]) => form.append(kind, entry.file, entry.file.name));
    form.append('mode', mode); form.append('same_person_confirmed', String(confirmed));
    form.append('weights', JSON.stringify(weights)); form.append('session_code', sessionCode); form.append('reviewer_note', note);
    try {
      const result = await createAssessment(form);
      setReport({ data: result, revision });
      requestAnimationFrame(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (err) { setReport(null); setError(err.message); }
    finally { setLoading(false); }
  };
  const data = report?.data;
  const stale = report && report.revision !== revision;
  const totalWeight = Object.keys(files).reduce((sum, kind) => sum + Number(weights[kind]), 0);
  const exportReport = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${data.session_code}-assessment.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <PageTransition><div className="assessment-page">
    <header className="assessment-heading no-print">
      <div><span className="eyebrow">NEUROSCAN • RESEARCH WORKSPACE</span><h1>One session.<br /><span>Three perspectives.</span></h1>
        <p>Bring voice, spiral and wave evidence together. Inspect each result, explore how weights change the indices, and export a transparent review report.</p>
      </div>
      <div className="research-badge"><SlidersHorizontal size={21} /><strong>Experimental fusion</strong><span>Human review stays central</span><Link to="/evidence">See evidence & limits <ArrowRight size={14} /></Link></div>
    </header>
    <div className="session-notice no-print">The models were trained on separate datasets. Fusion can compare tests collected from the same person now, but its accuracy is unvalidated. These indices are not disease probabilities.</div>
    <form onSubmit={submit} className="no-print">
      <fieldset disabled={loading} className="assessment-fieldset">
        <section className="session-panel">
          <div className="panel-heading"><span className="step-number">01</span><div><h2>Set up the session</h2><p>Use a code rather than a name. Uploads are processed by the analysis server and are not saved as a patient history.</p></div></div>
          <div className="session-options">
            <label>Session code<input aria-label="Session code" maxLength={40} pattern="[A-Za-z0-9_-]+" required value={sessionCode} onChange={event => { setSessionCode(event.target.value); changed(); }} /></label>
            <label>Purpose<select aria-label="Session purpose" value={mode} onChange={event => { setMode(event.target.value); setConfirmed(false); changed(); }}>
              <option value="same_person">Same-person research session</option><option value="demo">Unpaired sample demonstration</option>
            </select></label>
          </div>
          <details className="demo-controls"><summary><FlaskConical size={15} /> Try bundled examples</summary>
            <p>These files are not a paired patient record. Loading them switches the session to demonstration mode. Labels may differ from model predictions.</p>
            <div className="demo-row"><select aria-label="Demo label" value={demoLabel} onChange={event => setDemoLabel(event.target.value)}><option value="healthy">Healthy-labelled files</option><option value="parkinson">Parkinson’s-labelled files</option></select>
              <select aria-label="Demo sample number" value={demoNumber} onChange={event => setDemoNumber(event.target.value)}><option value="1">Sample set 1</option><option value="2">Sample set 2</option></select>
              <button type="button" className="btn btn-outline" onClick={loadDemo} disabled={recording}>Load demo files</button></div>
          </details>
        </section>
        <section className="session-panel">
          <div className="panel-heading"><span className="step-number">02</span><div><h2>Collect the evidence</h2><p>Two or three tests enable a combined index. A single test produces an individual result only.</p></div></div>
          <div className="capture-grid">{TESTS.map(({ key, title, Icon, hint, accept }) => <div className="capture-card" key={key}>
            <div className="capture-title"><Icon size={20} /><h3>{title}</h3>{files[key] && <Check size={16} className="capture-check" />}</div>
            <p>{hint}</p>
            <label className={`capture-drop ${files[key] ? 'has-file' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!loading && !recording) replaceFile(key, event.dataTransfer.files[0]); }}>
              {files[key] ? <><span className="file-name">{files[key].file.name}</span>{key !== 'voice' && <img src={files[key].url} alt={`${title} preview`} />}<span>Choose a replacement</span></> : <><Upload size={25} /><strong>Choose {key === 'voice' ? 'audio' : 'image'}</strong><span>or drop a file here</span></>}
              <input type="file" aria-label={`Upload ${key}`} accept={accept} disabled={recording} onChange={event => { if (event.target.files[0]) replaceFile(key, event.target.files[0]); event.target.value = ''; }} />
            </label>
            {key === 'voice' && files[key] && <audio controls src={files[key].url} aria-label="Voice recording preview" />}
            {files[key] && <button type="button" className="text-button" disabled={recording} onClick={() => replaceFile(key, null)}><X size={13} /> Remove {key}</button>}
            {key === 'voice' && <Recorder disabled={loading} onFile={file => replaceFile('voice', file)} onActive={setRecording} onError={setError} />}
          </div>)}</div>
          {mode === 'same_person' ? <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); changed(); }} />I confirm that these files were collected from the same person in the same session.</label> : <div className="demo-warning">DEMONSTRATION ONLY — these inputs are not asserted to belong to the same person. No patient interpretation.</div>}
        </section>
        <section className="session-panel">
          <div className="panel-heading"><span className="step-number">03</span><div><h2>Explore importance weights</h2><p>Equal weights are a research default. A reviewer can specify relative importance; no clinical weights have been established.</p></div></div>
          <div className="weight-grid">{TESTS.map(({ key, title }) => <label className="weight-control" key={key}><span>{title}<strong>{files[key] && totalWeight > 0 ? `${(weights[key] / totalWeight * 100).toFixed(1)}%` : 'Not included'}</strong></span>
            <input type="range" aria-label={`${key} weight`} min="0" max="100" step="1" value={weights[key]} onChange={event => { setWeights({ ...weights, [key]: Number(event.target.value) }); changed(); }} />
            <small>Relative weight: {weights[key]} {weights[key] === 0 ? '• excluded from fusion' : ''}</small></label>)}</div>
          <button type="button" className="text-button" onClick={() => { setWeights(initialWeights); changed(); }}><RotateCcw size={14} /> Reset to equal weights</button>
          <details className="formula-details"><summary>How the two formulas work</summary><div className="formula-grid"><div><h3>Linear integration</h3><code>L = Σ wᵢ pᵢ</code><p>A weighted average of the Parkinson’s-labelled class scores. Larger weights have greater influence.</p></div><div><h3>Cobb–Douglas</h3><code>G = ∏ pᵢ^wᵢ</code><p>Weighted geometric mean with A = 1 and Σw = 1. A low score can suppress the product; it is not interchangeable with a calibrated probability.</p></div></div><p>Only available positive-weight tests are included. Missing tests are never filled with fabricated values. Read the methodology for the assumptions behind each formula.</p></details>
          <label className="reviewer-note">Reviewer observations <span>(optional; excluded from model inputs)</span><textarea aria-label="Reviewer observations" maxLength={2000} rows={3} placeholder="Acquisition context, technical concerns, or questions for review. Avoid personal identifiers." value={note} onChange={event => { setNote(event.target.value); changed(); }} /></label>
        </section>
        {error && <p className="analysis-error" role="alert">{error}</p>}
        <div className="assessment-actions"><button className="btn btn-primary" type="submit" disabled={!Object.keys(files).length || recording || totalWeight <= 0 || (mode === 'same_person' && !confirmed)}>{loading ? <Loader size={17} className="animate-spin" /> : <Activity size={17} />}{loading ? 'Analysing evidence…' : 'Analyse session'}</button>
          <button type="button" className="btn btn-outline" onClick={reset} disabled={recording}>Clear session</button><span>Files stay in this session until you clear or close it. No server-side patient record.</span></div>
      </fieldset>
    </form>
    {data && <section ref={reportRef} className={`assessment-report ${stale ? 'stale-report' : ''}`} aria-label="Assessment report">
      {stale && <p className="analysis-error" role="status">Inputs or settings changed. Analyse again before exporting this report.</p>}
      <div className="report-heading"><div><span className="eyebrow">{data.mode === 'demo' ? 'UNPAIRED DEMONSTRATION • NOT A PATIENT RESULT' : 'EXPLORATORY ASSESSMENT • UNVALIDATED FUSION'}</span><h2>Evidence, together.</h2><p>{data.session_code} · {new Date(data.created_at).toLocaleString()}</p></div>
        <div className="report-buttons no-print"><button className="btn btn-outline" type="button" disabled={stale} onClick={exportReport}><Download size={15} /> Export JSON</button><button className="btn btn-outline" type="button" disabled={stale} onClick={() => window.print()}><Printer size={15} /> Print / save PDF</button></div></div>
      <p className="report-scope">{data.scope}</p>
      <div className="fusion-comparison"><div><span>LINEAR INDEX</span><strong data-testid="linear-index">{number(data.fusion.linear)}</strong><code>Σ wᵢ pᵢ</code></div><div><span>COBB–DOUGLAS INDEX</span><strong data-testid="geometric-index">{number(data.fusion.cobb_douglas)}</strong><code>∏ pᵢ^wᵢ</code></div><div className="fusion-explanation"><h3>{data.fusion.pattern}</h3><p>0–1 research indices, not disease probabilities. No diagnostic cutoff or combined accuracy has been validated.</p><span>{data.fusion.active_modalities.length} contributing tests · {Object.keys(data.results).length}/3 analysed</span></div></div>
      <div className="table-scroll"><table className="evidence-table"><thead><tr><th>Test</th><th>Model classification</th><th>PD-labelled class score</th><th>Effective weight</th><th>Linear contribution</th></tr></thead><tbody>{TESTS.filter(test => data.results[test.key]).map(test => { const result = data.results[test.key], weight = data.fusion.effective_weights[test.key]; return <tr key={test.key}><td>{test.title}</td><td>{result.prediction}</td><td>{number(result.parkinson_score)}</td><td>{(weight * 100).toFixed(1)}%</td><td>{number(result.parkinson_score * weight)}</td></tr>; })}</tbody></table></div>
      <p className="report-caption">Each score describes resemblance to the Parkinson’s-labelled examples. These class-specific scores are not clinically calibrated.</p>
      <div className="report-grid"><div className="review-flags"><h3>Review notes</h3><ul>{[...data.fusion.review_reasons, ...data.quality_warnings].map((reason, index) => <li key={index}>{reason}</li>)}<li>Separate training cohorts do not establish the accuracy of the combined index.</li></ul>{Object.entries(data.errors).map(([kind, issue]) => <p className="analysis-error" key={kind}>{kind}: {issue.detail}</p>)}</div>
      <div><h3>Acquisition checks</h3>{Object.entries(data.results).map(([kind, result]) => <div className="quality-row" key={kind}><strong>{kind}</strong><span>{result.quality?.kind === 'audio' ? `${result.quality.duration_seconds}s · ${result.quality.source_sample_rate} Hz · ${result.quality.channels} channel(s)` : `${result.quality?.width} × ${result.quality?.height} pixels`}</span><small>{result.quality?.warnings.length ? 'Check acquisition flags' : 'No basic technical flags'} · content suitability is unverified</small></div>)}</div></div>
      {!!Object.keys(data.fusion.leave_one_out).length && <details className="formula-details"><summary>Influence check: leave out one test</summary><p>This is a weight-sensitivity demonstration, not a confidence interval or a new model validation.</p><div className="influence-grid">{Object.entries(data.fusion.leave_one_out).map(([kind, scores]) => <div key={kind}><strong>Without {kind}</strong><span>Linear {number(scores.linear)}</span><span>Geometric {number(scores.cobb_douglas)}</span></div>)}</div></details>}
      {data.reviewer_note && <div className="reviewer-observation"><h3>Reviewer observations</h3><p>{data.reviewer_note}</p><small>Entered by the operator; not used by the models.</small></div>}
      <details className="provenance"><summary>Model and input provenance</summary><p>Assessment {data.assessment_id} · {data.schema_version} · {data.fusion.version}</p>{Object.entries(data.results).map(([kind, result]) => <p key={kind}><strong>{kind}</strong> · {result.method}<br /><small>Model SHA-256: {result.model_sha256}<br />Input SHA-256: {result.input_sha256}</small></p>)}</details>
      <p className="report-caption">{data.storage} Clinical interpretation belongs with a qualified clinician. This application cannot distinguish Parkinson’s from its mimics.</p>
      <Link className="text-button no-print" to="/clinical-context">Explore conditions with overlapping symptoms <ArrowRight size={14} /></Link>
    </section>}
  </div></PageTransition>;
}
