import { useEffect, useRef } from 'react';

// A projected 3D point cloud: no WebGL dependency or GPU-heavy postprocessing.
export default function NeuralOrb({ paused = false }) {
  const canvasRef = useRef(null);
  const phase = useRef(.4);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const n = window.innerWidth < 700 ? 160 : 300;
    const points = Array.from({ length: n }, (_, i) => {
      const y = 1 - 2 * (i + .5) / n, theta = i * 2.39996323;
      const ring = Math.sqrt(1 - y * y), ripple = 1 + .075 * Math.sin(theta * 5) * Math.sin(y * 8);
      return { x: Math.cos(theta) * ring * ripple, y: y * 1.08, z: Math.sin(theta) * ring * ripple };
    });
    const edges = [];
    points.forEach((a, i) => points.slice(i + 1).forEach((b, offset) => {
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance < .32) edges.push([i, i + offset + 1]);
    }));
    let frame, angle = phase.current, last = 0, visible = true, width = 500, height = 500;
    const pointer = { x: 0, y: 0 };
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * .31;
      const cx = width / 2, cy = height / 2;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.7);
      glow.addColorStop(0, 'rgba(150,78,255,.32)'); glow.addColorStop(.6, 'rgba(126,60,216,.14)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      const a = angle + pointer.x * .1, ca = Math.cos(a), sa = Math.sin(a), tilt = -.2 + pointer.y * .08;
      const projected = points.map(p => {
        const x = p.x * ca + p.z * sa, z = -p.x * sa + p.z * ca;
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt), depth = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const scale = 3.8 / (3.8 - depth);
        return { x: cx + x * radius * scale, y: cy + y * radius * scale, z: depth, scale };
      });
      ctx.lineWidth = .9;
      edges.forEach(([i, j]) => {
        const p = projected[i], q = projected[j], opacity = .16 + Math.min(1, Math.max(0, (p.z + q.z + 2) / 4)) * .5;
        ctx.strokeStyle = `rgba(196,153,255,${opacity})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
      projected.sort((a, b) => a.z - b.z).forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, (i % 13 === 0 ? 2.6 : 1.3) * p.scale, 0, Math.PI * 2);
        ctx.fillStyle = p.z > .5 ? 'rgba(251,240,255,1)' : `rgba(193,143,255,${Math.min(1, .4 + (p.z + 1) * .3)})`; ctx.fill();
      });
      // Orbital paths sit in tilted planes around the cloud.
      for (let j = 0; j < 3; j++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.35 + j * 1.05);
        ctx.strokeStyle = `rgba(189,150,250,${j === 0 ? .65 : .3})`; ctx.lineWidth = .85;
        ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.48, radius * (.36 + .1 * j), 0, 0, 2 * Math.PI); ctx.stroke();
        const t = angle * (j + 1) * .7;
        ctx.beginPath(); ctx.arc(Math.cos(t) * radius * 1.48, Math.sin(t) * radius * (.36 + .1 * j), 2.8, 0, Math.PI * 2); ctx.fillStyle = '#dcc6ff'; ctx.fill(); ctx.restore();
      }
    };
    const tick = now => {
      if (now - last > 33) { angle += .003; phase.current = angle; draw(); last = now; }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(frame); draw();
      if (!paused && !reduced.matches && visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }); intersection.observe(canvas);
    const move = event => { const rect = canvas.getBoundingClientRect(); pointer.x = (event.clientX - rect.left) / rect.width - .5; pointer.y = (event.clientY - rect.top) / rect.height - .5; };
    canvas.addEventListener('pointermove', move); document.addEventListener('visibilitychange', start); reduced.addEventListener('change', start);
    resize(); start();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); canvas.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', start); reduced.removeEventListener('change', start); };
  }, [paused]);
  return <canvas ref={canvasRef} className="neural-orb" aria-hidden="true" />;
}
