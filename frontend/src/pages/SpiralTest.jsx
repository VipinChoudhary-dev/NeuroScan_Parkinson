import ModelStatus from '../components/ModelStatus';
import { useState, useRef, useEffect } from 'react';
import { Upload, Send, Loader, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { predictDrawing } from '../services/api';
import ResultCard from '../components/ResultCard';
import AnalysisProgress from '../components/AnalysisProgress';
import PageTransition from '../components/PageTransition';

const SpiralTest = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onFileSelect = (e) => {
    if (isLoading) return;
    const f = e.target.files[0];
    if (!f) return;
    if (f?.type.startsWith('image/')) {
      setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError('');
    } else setError('Please upload a valid image file.');
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (isLoading) return;
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) {
      setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setError('');
    }
  };

  const clear = () => { setFile(null); setPreview(null); setResult(null); setError(''); if (inputRef.current) inputRef.current.value = ''; };

  const submit = async () => {
    if (!file) return;
    setIsLoading(true);
    setResult(null);
    setError('');
    try { setResult(await predictDrawing(file)); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  return (
    <PageTransition>
    <div className="container">
      <div className="tool-layout">
        <div className="tool-info">
          <h2>Spiral Drawing Test</h2>
          <p>Upload an image of a hand-drawn spiral. Explore the pattern in your drawing, with a result you can review alongside the other tests.</p>
          <ul>
            <li>Draw a continuous expanding spiral on paper</li>
            <li>Take a clear, well-lit photo of the drawing</li>
            <li>Crop the photo to the drawing, then upload and choose Submit Image</li>
          </ul>
          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: 'var(--radius)', background: 'var(--gradient-glow)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--primary)' }}>For a clearer photo:</strong> Use plain paper, keep the camera directly above it, and avoid shadows. Make sure the whole spiral is visible.
            </p>
          </div>
        </div>
        <div className="tool-workspace">
          <ModelStatus />
          <div className="glass-card" style={{ width: '100%', maxWidth: 500 }}>
            <div className="upload-zone"
              onClick={() => !isLoading && !preview && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              {preview ? (
                <img src={preview} alt="Spiral preview" />
              ) : (
                <>
                  <Upload size={44} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <span className="upload-label">Click or drag to upload spiral drawing</span>
                  <span className="upload-hint">Supports PNG, JPG, JPEG</span>
                </>
              )}
              <input type="file" ref={inputRef} style={{ display: 'none' }} accept="image/*" disabled={isLoading} onChange={onFileSelect} />
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', width: '100%' }}>
              <button className="btn btn-outline" onClick={clear} disabled={isLoading || !file} style={{ flex: 1 }}>
                <Trash2 size={16} /> Clear
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={!file || isLoading} style={{ flex: 2 }}>
                {isLoading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                {isLoading ? 'Analyzing...' : 'Submit Image'}
              </button>
            </div>

            <AnimatePresence>
              <AnalysisProgress isLoading={isLoading} type="drawing" />
            </AnimatePresence>

            {error && <p role="alert" className="analysis-error">{error}</p>}
            <ResultCard result={result} />
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  );
};

export default SpiralTest;
