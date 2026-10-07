import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

export default function Recorder({ disabled, onFile, onActive, onError }) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef(null);
  const stream = useRef(null);
  const timer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearInterval(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state === 'recording') recorder.current.stop();
      }
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  const stop = () => {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };
  const start = async () => {
    setStarting(true); onActive(true); onFile(null);
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!mounted.current) { capture.getTracks().forEach(track => track.stop()); return; }
      stream.current = capture;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      const device = new MediaRecorder(capture, mimeType ? { mimeType } : undefined);
      recorder.current = device;
      const chunks = [];
      device.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      device.onstop = () => {
        clearInterval(timer.current); capture.getTracks().forEach(track => track.stop());
        if (!mounted.current) return;
        setActive(false); onActive(false);
        if (!chunks.length) { onError('No audio was captured. Please record again.'); return; }
        const extension = device.mimeType.includes('mp4') ? 'm4a' : device.mimeType.includes('ogg') ? 'ogg' : 'webm';
        onFile(new File(chunks, `recording.${extension}`, { type: device.mimeType }));
      };
      device.onerror = () => { stop(); onError('Microphone recording failed. Please try again.'); };
      device.start(); setActive(true); setSeconds(0);
      const began = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.min(10, Math.floor((Date.now() - began) / 1000));
        setSeconds(elapsed); if (elapsed >= 10) stop();
      }, 250);
    } catch (error) {
      stream.current?.getTracks().forEach(track => track.stop());
      if (mounted.current) { onError(`Could not record: ${error.message}`); onActive(false); }
    } finally { if (mounted.current) setStarting(false); }
  };
  return <div className="session-recorder">
    <button type="button" className="btn btn-outline" disabled={disabled || starting} onClick={active ? stop : start}>
      {active ? <Square size={15} /> : <Mic size={15} />}
      {starting ? 'Opening microphone…' : active ? `Stop recording (${seconds}s)` : 'Record voice'}
    </button>
    <span aria-live="polite">{active ? 'Recording • stops at 10 seconds' : 'Sustain “Ahh” for 3–5 seconds'}</span>
  </div>;
}
