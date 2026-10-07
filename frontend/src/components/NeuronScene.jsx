import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

/* ---------- Constants ---------- */
const NODE_COUNT = 160;
const CONNECTION_DISTANCE = 2.2;
const SPHERE_RADIUS = 3.5;
const COLORS = {
  emerald: new THREE.Color('#10b981'),
  teal: new THREE.Color('#0ea5e9'),
  white: new THREE.Color('#e2e8f0'),
};

/* ---------- Generate node positions on a sphere ---------- */
function generateNodes(count, radius) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    const r = radius * (0.7 + Math.random() * 0.5);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Blend emerald → teal based on vertical position
    const t = (y / radius + 1) / 2;
    const color = COLORS.emerald.clone().lerp(COLORS.teal, t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = 0.03 + Math.random() * 0.035;
  }

  return { positions, colors, sizes };
}

/* ---------- Generate connection lines ---------- */
function generateConnections(positions, count, maxDist) {
  const lines = [];

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < maxDist) {
        lines.push({
          start: [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]],
          end: [positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]],
          opacity: 0.06 + 0.1 * (1 - dist / maxDist),
        });
      }
    }
  }

  return lines;
}

/* ---------- Particle nodes ---------- */
function Nodes({ nodes }) {
  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(nodes.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(nodes.colors, 3));
    return geo;
  }, [nodes]);

  return <points geometry={geometry} material={material} />;
}

/* ---------- Connection lines ---------- */
function Connections({ connections }) {
  const linesGroup = useMemo(() => {
    const group = new THREE.Group();

    connections.forEach(({ start, end, opacity }) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...start),
        new THREE.Vector3(...end),
      ]);
      const mat = new THREE.LineBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        color: COLORS.emerald.clone().lerp(COLORS.teal, 0.4),
        opacity,
      });
      group.add(new THREE.Line(geo, mat));
    });

    return group;
  }, [connections]);

  return <primitive object={linesGroup} />;
}

/* ---------- Brain group with rotation + parallax ---------- */
function BrainGroup({ nodes, connections }) {
  const groupRef = useRef();
  const mouse = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += 0.0015;
    groupRef.current.rotation.x += 0.0004;

    const targetRotX = mouse.current.y * 0.12;
    const targetRotZ = -mouse.current.x * 0.06;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * 0.015;
    groupRef.current.rotation.z += (targetRotZ - groupRef.current.rotation.z) * 0.015;
  });

  const handlePointerMove = (e) => {
    mouse.current.x = (e.clientX / size.width - 0.5) * 2;
    mouse.current.y = (e.clientY / size.height - 0.5) * 2;
  };

  return (
    <group ref={groupRef} onPointerMove={handlePointerMove}>
      <Nodes nodes={nodes} />
      <Connections connections={connections} />
    </group>
  );
}

/* ---------- Scene ---------- */
function Scene() {
  const nodes = useMemo(() => generateNodes(NODE_COUNT, SPHERE_RADIUS), []);
  const connections = useMemo(
    () => generateConnections(nodes.positions, NODE_COUNT, CONNECTION_DISTANCE),
    [nodes]
  );

  return (
    <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.25}>
      <BrainGroup nodes={nodes} connections={connections} />
    </Float>
  );
}

/* ---------- Canvas export ---------- */
export default function NeuronScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.25} color="#10b981" />
      <pointLight position={[-10, -10, -5]} intensity={0.15} color="#0ea5e9" />
      <Scene />
    </Canvas>
  );
}
