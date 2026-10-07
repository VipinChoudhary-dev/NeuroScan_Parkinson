import { useState, useRef, useEffect } from 'react';
import { Upload, Loader, Trash2, Mic, Square } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ResultCard from '../components/ResultCard';
import AnalysisProgress from '../components/AnalysisProgress';
import PageTransition from '../components/PageTransition';
import { predictVoice } from '../services/api';

const VoiceAnalysis = () => {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(timerRef.current);
      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state === 'recording') recorder.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const selectFile = (f) => {
    if (!f || isLoading || isRecording || isStarting) return;
    if (!f.type.startsWith('audio/') && !/\.(wav|wave|mp3|m4a|ogg|webm|flac)$/i.test(f.name)) {
      setError('Please choose an audio recording.');
      return;
    }
    setFile(f); setRecordedBlob(null); setResult(null); setError('');
  };
  const onFileSelect = e => selectFile(e.target.files[0]);
  const onDrop = e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); };
  const clear = () => {
    setFile(null); setRecordedBlob(null); setResult(null); setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const startRecording = async () => {
    setIsStarting(true); setError(''); setResult(null); setRecordedBlob(null); setFile(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      } });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        setIsRecording(false);
        if (chunks.length) setRecordedBlob(new Blob(chunks, { type: recorder.mimeType }));
        else setError('No audio was captured. Please try recording again.');
      };
      recorder.onerror = () => {
        stopRecording();
        setError('Recording failed. Check microphone access and try again.');
      };
      recorder.start();
      setIsRecording(true); setRecordingTime(0);
      const started = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setRecordingTime(Math.min(elapsed, 10));
        if (elapsed >= 10) stopRecording();
      }, 250);
    } catch (err) {
      streamRef.current?.getTracks().forEach(track => track.stop());
      setError(`Could not start recording: ${err.message}`);
    } finally { if (mounted.current) setIsStarting(false); }
  };

  const submit = async () => {
    const audioFile = recordedBlob || file;
    if (!audioFile || isRecording || isStarting) return;
    setIsLoading(true); setResult(null); setError('');
    try {
      const extension = recordedBlob?.type.includes('mp4') ? 'm4a' : recordedBlob?.type.includes('ogg') ? 'ogg' : 'webm';
      setResult(await predictVoice(audioFile, recordedBlob ? `recording.${extension}` : file.name));
    } catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  const hasAudio = !!recordedBlob || !!file;

  return (
    <PageTransition>
    <div className="container">
      <div className="tool-layout">
        <div className="tool-info">
          <h2>Acoustic Voice Analysis</h2>
          <p>Record a short voice sample or upload an existing recording to explore its acoustic patterns. Your result describes the recording, not a medical diagnosis.</p>
          <div className="visitor-guide"><h3>Make a clear recording</h3><ol><li>Find a quiet room and keep your microphone at a comfortable, steady distance.</li><li>Say a sustained <strong>“Ahh”</strong> in your usual voice for 3–5 seconds. Avoid music or other voices in the background.</li><li>Stop recording, then choose <strong>Analyze Voice</strong>. You can also upload an audio file you already have.</li></ol></div>
          <p className="visitor-tip"><strong>Before you start:</strong> Allow microphone access when your browser asks. If the sound is very quiet or distorted, record again before analysing it.</p>
        </div>

        <div className="tool-workspace">
          <div className="glass-card" style={{ width: '100%', maxWidth: 520 }}>

            {/* Tab: Record Mic */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
                🎙 Option 1: Record your voice
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                {isRecording ? (
                  <>
                    <button className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', minWidth: 120 }} onClick={stopRecording}>
                      <Square size={16} fill="currentColor" /> Stop ({recordingTime}s)
                    </button>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[...Array(8)].map((_, i) => (
                        <div key={i} style={{ width: 4, background: 'var(--danger)', borderRadius: 2, height: `${[12, 24, 16, 28, 20, 14, 26, 18][i]}px`, animation: 'pulse 0.4s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                      ))}
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--danger)' }}>Recording...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary" style={{ minWidth: 140 }} onClick={startRecording} disabled={isLoading || isStarting}>
                      <Mic size={16} /> {isStarting ? 'Opening microphone...' : 'Start Recording'}
                    </button>
                    {recordedBlob && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                        ✅ Recording ready ({recordingTime}s)
                      </span>
                    )}
                    {!recordedBlob && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Say "Ahhh" for 3–5 seconds</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0 1.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Tab: Upload file */}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
              📂 Option 2: Upload an audio file
            </p>
            <div
              className="upload-zone"
              style={{ height: 140 }}
              onClick={() => !isLoading && !isRecording && !isStarting && inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              {file ? (
                <div style={{ textAlign: 'center' }}>
                  <Mic size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{file.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {(file.size / 1024).toFixed(0)} KB — ready
                  </p>
                </div>
              ) : (
                <>
                  <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '0.6rem' }} />
                  <span className="upload-label" style={{ fontSize: '0.9rem' }}>Click or drag an audio file here</span>
                  <span className="upload-hint">WAV, MP3, M4A, OGG, WebM or FLAC</span>
                </>
              )}
              <input type="file" ref={inputRef} style={{ display: 'none' }} accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac" disabled={isLoading || isRecording || isStarting} onChange={onFileSelect} />
            </div>

            {/* Action buttons */}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', width: '100%' }}>
              <button className="btn btn-outline" onClick={clear} disabled={isLoading || isRecording || isStarting || (!file && !recordedBlob)} style={{ flex: 1 }}>
                <Trash2 size={16} /> Clear
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={!hasAudio || isLoading || isRecording || isStarting} style={{ flex: 2 }}>
                {isLoading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                {isLoading ? 'Analyzing...' : 'Analyze Voice'}
              </button>
            </div>

            <AnimatePresence>
              <AnalysisProgress isLoading={isLoading} type="voice" />
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

export default VoiceAnalysis;
