import { useState } from 'react';
import { AudioLines, Fingerprint, Waves, Pause, Play, Sparkles, MoveUpRight } from 'lucide-react';
import NeuralOrb from './NeuralOrb';
const modes = [
  { id: 'spiral', title: 'Spiral', Icon: Fingerprint, description: 'A line becomes a dimension.', number: '01' },
  { id: 'voice', title: 'Voice', Icon: AudioLines, description: 'Find the shape of a sound.', number: '02' },
  { id: 'wave', title: 'Wave', Icon: Waves, description: 'Follow a rhythm in motion.', number: '03' },
];
export default function SignalExperience({ paused, onPause }) {
  const [mode, setMode] = useState('spiral');
  const [energy, setEnergy] = useState(60);
  const [pulse, setPulse] = useState(0);
  const selected = modes.find(item => item.id === mode);
  return <div className="signal-experience" data-mode={mode}>
    <div className="signal-heading"><span><i /> SIGNAL PLAYGROUND</span><span>0{modes.length} FORMS / ONE FIELD</span></div>
    <div className="signal-stage">
      <div className="signal-halo" aria-hidden="true" />
      <NeuralOrb mode={mode} energy={energy / 100} paused={paused} pulse={pulse} />
      <span className="signal-axis axis-top" aria-hidden="true">+</span><span className="signal-axis axis-bottom" aria-hidden="true">+</span>
      <div className="signal-stage-caption"><span>{selected.number} — {selected.title.toUpperCase()}</span><p>{selected.description}</p></div>
      <div className="signal-drag-hint"><MoveUpRight size={12} /><span>Drag to explore · tap to illuminate</span></div>
    </div>
    <div className="signal-console">
      <div className="signal-modes" role="group" aria-label="Choose a signal shape">{modes.map(({ id, title, Icon }) => <button type="button" aria-pressed={mode === id} key={id} onClick={() => setMode(id)}><Icon size={16} /><span>{title}</span></button>)}</div>
      <div className="signal-controls"><label className="signal-energy">Energy<input aria-label="Visual energy" type="range" min="20" max="100" value={energy} onChange={event => setEnergy(Number(event.target.value))} /></label><button className="signal-pulse" onClick={() => setPulse(value => value + 1)} type="button"><Sparkles size={14} /> Pulse</button><button className="signal-pause" type="button" onClick={onPause} aria-label={paused ? 'Play visual animation' : 'Pause visual animation'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div>
    </div>
    <p className="signal-disclaimer">An interactive illustration. No health data or results.</p>
  </div>;
}
