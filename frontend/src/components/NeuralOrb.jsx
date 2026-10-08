import { useEffect, useRef } from 'react';

// A small Canvas 2D renderer: full-float decorative geometry, no model/API calls.
export default function NeuralOrb({ paused = false, mode = 'spiral', energy = .6, pulse = 0 }) {
  const canvasRef = useRef(null);
  const settings = useRef({ paused, mode, energy, pulse });
  useEffect(() => { settings.current = { paused, mode, energy, pulse }; }, [paused, mode, energy, pulse]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 500, height = 500, frame = 0, timer = 0, last = 0, elapsed = .7, lastState = '';
    let visible = false, angle = .15, tilt = -.28, targetAngle = .15, targetTilt = -.28;
    let boost = 0, previousPulse = 0, down = null, dragDistance = 0, lastMode = 'spiral', blend = 1, fromMode = 'spiral';
    let strands = 22, steps = 92;
    const point = (kind, u, v, t) => {
      if (kind === 'spiral') {
        const q = u * Math.PI * 2, r = .64 + .23 * Math.cos(3 * q + v * .24);
        return [r * Math.cos(2 * q) + .06 * Math.cos(v), r * Math.sin(2 * q) + .06 * Math.sin(v), .31 * Math.sin(3 * q + v * .24) + .07 * Math.cos(v)];
      }
      if (kind === 'voice') {
        const a = u * Math.PI * 2, r = .66 + .09 * Math.sin(a * 8 + t * 1.5 + v) + .06 * Math.sin(v);
        return [r * Math.cos(a), r * Math.sin(a), .22 * Math.cos(v) + .13 * Math.sin(a * 6 - t * 1.2 + v)];
      }
      const x = (u - .5) * 1.8;
      return [x, .25 * Math.sin(u * Math.PI * 4 + t * 1.4 + v * .35) + .22 * Math.sin(v), .32 * Math.cos(v) + .09 * Math.sin(u * 12 - t)];
    };
    const project = ([x, y, z]) => {
      const x1 = x * Math.cos(angle) + z * Math.sin(angle), z1 = -x * Math.sin(angle) + z * Math.cos(angle);
      const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt), depth = y * Math.sin(tilt) + z1 * Math.cos(tilt);
      const scale = 3.5 / (3.5 - depth), radius = Math.min(width, height) * .43;
      return [width / 2 + x1 * radius * scale, height * .46 + y1 * radius * scale, depth];
    };
    const draw = () => {
      const { mode: next, energy: power } = settings.current;
      if (next !== lastMode) { fromMode = lastMode; lastMode = next; blend = reduced.matches || settings.current.paused ? 1 : 0; }
      ctx.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * .43, cx = width / 2, cy = height * .46;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.3);
      glow.addColorStop(0, `rgba(143,63,255,${.15 + power * .12 + boost * .08})`); glow.addColorStop(.55, 'rgba(103,36,199,.07)'); glow.addColorStop(1, 'rgba(103,36,199,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      // Subtle elliptical guides and travelling light keep the volume legible.
      for (let i = 0; i < 2; i++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.4 + i * 1.2);
        ctx.lineWidth = .6; ctx.strokeStyle = 'rgba(189,143,255,.18)'; ctx.beginPath(); ctx.ellipse(0, 0, radius * 1.08, radius * .68, 0, 0, Math.PI * 2); ctx.stroke();
        const t = elapsed * .18 + i * 2.2;
        ctx.fillStyle = '#eedbff'; ctx.shadowColor = '#b785ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(Math.cos(t) * radius * 1.08, Math.sin(t) * radius * .68, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      const curves = [];
      for (let j = 0; j < strands; j++) {
        const v = j / strands * Math.PI * 2, points = [];
        for (let i = 0; i <= steps; i++) {
          const u = i / steps, b = point(next, u, v, elapsed), a = blend < 1 ? point(fromMode, u, v, elapsed) : b;
          const k = blend * blend * (3 - 2 * blend);
          points.push(project(a.map((value, axis) => value + (b[axis] - value) * k)));
        }
        curves.push({ points, j, depth: points.reduce((sum, p) => sum + p[2], 0) / points.length });
      }
      curves.sort((a, b) => a.depth - b.depth);
      ctx.globalCompositeOperation = 'lighter';
      curves.forEach(({ points, j, depth }) => {
        const light = Math.max(.18, Math.min(.85, .42 + depth * .48 + power * .2));
        ctx.lineWidth = j % 5 === 0 ? 1.3 : .65;
        ctx.strokeStyle = `rgba(${j % 5 === 0 ? '233,205,255' : '160,94,255'},${light})`;
        ctx.shadowBlur = j % 5 === 0 ? 9 + power * 4 : 0; ctx.shadowColor = '#9a4cff';
        ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
        // A short, bright pulse travels along each filament.
        const head = Math.floor(((elapsed * (.05 + power * .035) + j / strands) % 1) * steps);
        ctx.shadowBlur = 10; ctx.strokeStyle = `rgba(245,227,255,${.55 + boost * .35})`; ctx.lineWidth = 1.6;
        ctx.beginPath(); for (let k = Math.max(0, head - 3); k <= head; k++) { const [x, y] = points[k]; if (k === Math.max(0, head - 3)) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
      });
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
      if (boost > .01) {
        ctx.strokeStyle = `rgba(223,183,255,${boost * .65})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, radius * (1.15 - boost * .3), radius * (.8 - boost * .2), -.2, 0, Math.PI * 2); ctx.stroke();
      }
    };
    const tick = now => {
      const current = settings.current;
      const changed = current.pulse !== previousPulse;
      if (changed) { boost = 1; previousPulse = current.pulse; }
      const dt = last ? Math.min((now - last) / 1000, .05) : .033;
      const animated = !current.paused && !reduced.matches;
      if (!last || now - last >= 32) {
        if (animated) { elapsed += dt; if (!down) targetAngle += dt * (.075 + current.energy * .085); blend = Math.min(1, blend + dt * 1.5); boost = Math.max(0, boost - dt * .65); }
        const state = `${current.mode}/${current.energy}/${current.pulse}/${boost}/${targetAngle}/${targetTilt}`;
        if (animated || state !== lastState || Math.abs(targetAngle - angle) > .001 || Math.abs(targetTilt - tilt) > .001) {
          if (!animated) blend = 1;
          angle += (targetAngle - angle) * .13; tilt += (targetTilt - tilt) * .13;
          draw(); lastState = state;
        }
        last = now;
      }
      // Low-frequency checks while paused allow mode/energy controls to remain usable.
      if (animated) frame = requestAnimationFrame(tick);
      else timer = setTimeout(() => tick(performance.now()), 100);
    };
    const stop = () => { cancelAnimationFrame(frame); clearTimeout(timer); };
    const start = () => { stop(); last = 0; if (visible && !document.hidden) frame = requestAnimationFrame(tick); };
    const resize = () => {
      const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
      strands = width < 420 ? 14 : 22; steps = width < 420 ? 70 : 92;
      const dpr = Math.min(devicePixelRatio || 1, 1.5); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    };
    const pointerDown = event => { down = { x: event.clientX, y: event.clientY, type: event.pointerType }; dragDistance = 0; if (event.pointerType === 'mouse') canvas.setPointerCapture(event.pointerId); };
    const move = event => {
      if (!down) return;
      const dx = event.clientX - down.x, dy = event.clientY - down.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      targetAngle += dx * .008; if (down.type === 'mouse') targetTilt = Math.max(-.85, Math.min(.85, targetTilt + dy * .005));
      down.x = event.clientX; down.y = event.clientY;
    };
    const end = () => { if (down && dragDistance < 12) boost = 1; down = null; };
    const cancel = () => { down = null; };
    const key = event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'ArrowLeft') targetAngle -= .3;
        else if (event.key === 'ArrowRight') targetAngle += .3;
        else if (event.key === 'ArrowUp') targetTilt = Math.max(-.85, targetTilt - .2);
        else if (event.key === 'ArrowDown') targetTilt = Math.min(.85, targetTilt + .2);
        else boost = 1;
      }
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); }); intersection.observe(canvas);
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('pointerleave', cancel); canvas.addEventListener('keydown', key);
    document.addEventListener('visibilitychange', start); reduced.addEventListener('change', start); resize();
    return () => { stop(); observer.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', start); reduced.removeEventListener('change', start); canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('pointerleave', cancel); canvas.removeEventListener('keydown', key); };
  }, []);
  return <canvas ref={canvasRef} className="neural-orb" role="button" tabIndex={0} aria-label="Interactive signal sculpture. Drag or use arrow keys to rotate. Tap or press Enter to illuminate." />;
}
