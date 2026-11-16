import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { runDijkstra } from '../algorithms/dijkstra';
import { runPrim } from '../algorithms/prim';
import { CityGraph, CityNode } from '../types/graph';

export type SceneMode = 'dijkstra-north' | 'prim-mst' | 'dijkstra-south';
export type CameraPreset = 'aerial' | 'harbor' | 'bridge' | 'top';

interface HeroThreeSceneProps {
  graph: CityGraph;
  sceneMode: SceneMode;
  cameraPreset: CameraPreset;
  autoOrbit: boolean;
  rushHour?: boolean;
  selectedNodeId: string | null;
  onSelectNode?: (node: CityNode | null) => void;
}

// Module-scope reusable scratch objects (zero per-frame allocations)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _vec3D = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _lookMat = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  aerial: { pos: [0, 17.5, 25], target: [0, 1.0, 0] },
  harbor: { pos: [-18.5, 9.5, 16], target: [-4, 1.0, 0] },
  bridge: { pos: [8.5, 7.2, 14.5], target: [3.2, 1.4, 0] },
  top: { pos: [0, 31, 4.5], target: [0, 0, 0] },
};

function toWorld(nx: number, ny: number): [number, number] {
  const wx = ((nx - 492) / 420) * 18.5;
  const wz = ((ny - 340) / 270) * 12.2;
  return [wx, wz];
}

function createProceduralGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0B0908';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.11)';
  ctx.lineWidth = 1.5;
  for (let r = 120; r <= 480; r += 120) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(214, 211, 209, 0.065)';
  ctx.lineWidth = 1;
  const minor = size / 32;
  for (let i = 0; i <= 32; i++) {
    const p = i * minor;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
  ctx.lineWidth = 1.5;
  const major = size / 8;
  for (let i = 0; i <= 8; i++) {
    const p = i * major;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    2,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(253, 230, 138, 0.78)');
  grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildDroneGroup(
  hullMat: THREE.Material,
  rotorMat: THREE.Material,
  beaconMat: THREE.Material
): { group: THREE.Group; rotors: THREE.Mesh[] } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 6), hullMat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const wingGeo = new THREE.BoxGeometry(0.85, 0.04, 0.16);
  const wing = new THREE.Mesh(wingGeo, hullMat);
  group.add(wing);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), beaconMat);
  core.position.set(0, 0.08, 0);
  group.add(core);

  const rotorGeo = new THREE.TorusGeometry(0.14, 0.018, 6, 16);
  rotorGeo.rotateX(Math.PI / 2);
  const rLeft = new THREE.Mesh(rotorGeo, rotorMat);
  rLeft.position.set(-0.4, 0.05, 0);
  const rRight = new THREE.Mesh(rotorGeo, rotorMat);
  rRight.position.set(0.4, 0.05, 0);
  group.add(rLeft, rRight);

  return { group, rotors: [rLeft, rRight] };
}

export const HeroThreeScene: React.FC<HeroThreeSceneProps> = ({
  graph,
  sceneMode,
  cameraPreset,
  autoOrbit,
  rushHour = false,
  selectedNodeId,
  onSelectNode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const sceneModeRef = useRef<SceneMode>(sceneMode);
  const cameraPresetRef = useRef<CameraPreset>(cameraPreset);
  const autoOrbitRef = useRef<boolean>(autoOrbit);
  const rushHourRef = useRef<boolean>(rushHour);
  const selectedNodeRef = useRef<string | null>(selectedNodeId);
  const onSelectNodeRef = useRef(onSelectNode);
  const cameraTransitionActiveRef = useRef(false);

  sceneModeRef.current = sceneMode;
  autoOrbitRef.current = autoOrbit;
  rushHourRef.current = rushHour;
  selectedNodeRef.current = selectedNodeId;
  onSelectNodeRef.current = onSelectNode;

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
    cameraTransitionActiveRef.current = true;
  }, [cameraPreset]);

  const computedOverlays = useMemo(() => {
    const north = runDijkstra(graph, 'J1', 'J22', 'time', { recordEvents: false });
    const south = runDijkstra(graph, 'J5', 'J18', 'time', { recordEvents: false });
    const prim = runPrim(graph, 'J1', { recordEvents: false });

    const heavyIds = new Set(['E05', 'E16', 'E19', 'E20', 'E29', 'E33']);
    const gridlockIds = new Set(['E10', 'E23']);
    const rushGraph: CityGraph = {
      nodes: graph.nodes,
      edges: graph.edges.map((e) => ({
        ...e,
        trafficMultiplier: gridlockIds.has(e.id)
          ? 3.5
          : heavyIds.has(e.id)
          ? 2.8
          : e.trafficMultiplier,
      })),
    };
    const northRush = runDijkstra(rushGraph, 'J1', 'J22', 'time', { recordEvents: false });
    const southRush = runDijkstra(rushGraph, 'J5', 'J18', 'time', { recordEvents: false });
    const congestedRushEdges = new Set(
      rushGraph.edges.filter((e) => e.trafficMultiplier >= 2.2).map((e) => e.id)
    );
    const congestedBaseEdges = new Set(
      graph.edges.filter((e) => e.trafficMultiplier >= 2.2).map((e) => e.id)
    );

    return {
      northEdges: new Set(north.pathEdgeIds),
      northNodes: new Set(north.pathNodeIds),
      northPath: north.pathNodeIds,
      southEdges: new Set(south.pathEdgeIds),
      southNodes: new Set(south.pathNodeIds),
      southPath: south.pathNodeIds,
      northRushEdges: new Set(northRush.pathEdgeIds),
      northRushNodes: new Set(northRush.pathNodeIds),
      northRushPath: northRush.pathNodeIds,
      southRushEdges: new Set(southRush.pathEdgeIds),
      southRushNodes: new Set(southRush.pathNodeIds),
      southRushPath: southRush.pathNodeIds,
      congestedRushEdges,
      congestedBaseEdges,
      mstEdges: new Set(prim.treeEdgeIds),
    };
  }, [graph]);

  const overlaysRef = useRef(computedOverlays);
  overlaysRef.current = computedOverlays;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    const bgHex = 0x0a0807;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.0145);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.2, 220);
    const initialPreset = CAMERA_PRESETS[cameraPresetRef.current];
    camera.position.set(...initialPreset.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initialPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.minPolarAngle = 0.18;
    controls.minDistance = 9;
    controls.maxDistance = 48;
    controls.autoRotate = !isSoftwareGl && !prefersReducedMotion && autoOrbitRef.current;
    controls.autoRotateSpeed = 0.65;

    const handleControlsStart = () => {
      cameraTransitionActiveRef.current = false;
    };
    controls.addEventListener('start', handleControlsStart);

    // 3-Point Warm/Cool Studio Rig + 1 Dynamic Courier PointLight
    const hemiLight = new THREE.HemisphereLight(0xfbbf24, 0x140f0c, 0.92);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.3);
    keyLight.position.set(18, 28, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 75;
    keyLight.shadow.camera.left = -26;
    keyLight.shadow.camera.right = 26;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.15);
    rimLight.position.set(-20, 14, -18);
    scene.add(rimLight);

    const courierLight = new THREE.PointLight(0xfbbf24, 8, 14, 1.6);
    courierLight.position.set(0, 2.5, 0);
    scene.add(courierLight);

    const disposables: { dispose: () => void }[] = [envRT];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // 1. Ground Terrain Plane
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const groundTex = track(createProceduralGroundTexture(maxAniso));
    const groundGeo = track(new THREE.PlaneGeometry(240, 240));
    const groundMat = track(
      new THREE.MeshStandardMaterial({
        map: groundTex,
        roughness: 0.86,
        metalness: 0.14,
      })
    );
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 2. Animated Specular River Channel (PBR Physical Material + onBeforeCompile Ripples)
    const waterUniforms = { uTime: { value: 0 } };
    const riverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(6.2, 0.04, -40),
      new THREE.Vector3(5.3, 0.04, -12),
      new THREE.Vector3(6.9, 0.04, 10),
      new THREE.Vector3(6.1, 0.04, 40),
    ]);
    const riverGeo = track(new THREE.TubeGeometry(riverCurve, 64, 2.35, 10, false));
    riverGeo.scale(1, 0.035, 1);
    const riverMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x13262a,
        emissive: 0x0a171a,
        emissiveIntensity: 0.55,
        roughness: 0.12,
        metalness: 0.4,
        clearcoat: 0.95,
        clearcoatRoughness: 0.08,
      })
    );
    riverMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = waterUniforms.uTime;
      shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          transformed.y += sin(position.z * 0.9 + uTime * 2.2) * 0.035 + cos(position.x * 1.4 - uTime * 1.7) * 0.025;
          `
        );
    };
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.position.y = 0.03;
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    // 3. Instanced Urban Skyline Towers + Rooftop Aviation Beacons
    const buildingCount = 148;
    const bldgGeo = track(new THREE.BoxGeometry(1, 1, 1));
    bldgGeo.translate(0, 0.5, 0);
    const bldgMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        roughness: 0.65,
        metalness: 0.44,
      })
    );
    const bldgInstanced = new THREE.InstancedMesh(bldgGeo, bldgMat, buildingCount);
    bldgInstanced.castShadow = !isSoftwareGl;
    bldgInstanced.receiveShadow = true;

    const beaconCapGeo = track(new THREE.BoxGeometry(0.16, 0.08, 0.16));
    const beaconCapMat = track(
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    const rooftopBeacons = new THREE.InstancedMesh(beaconCapGeo, beaconCapMat, 48);

    const nodeWorldPos = new Map<string, THREE.Vector3>();
    for (const n of graph.nodes) {
      const [wx, wz] = toWorld(n.x, n.y);
      nodeWorldPos.set(n.id, new THREE.Vector3(wx, 0, wz));
    }

    let placed = 0;
    let beaconPlaced = 0;
    let seed = 17;
    const nextRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const tintColor = new THREE.Color();
    while (placed < buildingCount) {
      const bx = (nextRand() - 0.5) * 46;
      const bz = (nextRand() - 0.5) * 34;
      if (Math.abs(bx - 6.1) < 3.0) continue;
      let tooClose = false;
      for (const pos of nodeWorldPos.values()) {
        if (Math.hypot(bx - pos.x, bz - pos.z) < 2.15) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const w = 0.5 + nextRand() * 0.95;
      const d = 0.5 + nextRand() * 0.95;
      const h = 0.75 + Math.pow(nextRand(), 1.75) * 4.4;
      _vec3A.set(bx, 0, bz);
      _quat.setFromAxisAngle(_up, nextRand() * Math.PI * 0.5);
      _scale.set(w, h, d);
      _mat4.compose(_vec3A, _quat, _scale);
      bldgInstanced.setMatrixAt(placed, _mat4);
      tintColor.setHSL(0.085, 0.22, 0.11 + nextRand() * 0.09);
      bldgInstanced.setColorAt(placed, tintColor);

      if (h > 2.2 && beaconPlaced < 48) {
        _vec3A.set(bx, h + 0.04, bz);
        _scale.set(1, 1, 1);
        _mat4.compose(_vec3A, _quat, _scale);
        rooftopBeacons.setMatrixAt(beaconPlaced, _mat4);
        tintColor.setHex(beaconPlaced % 3 === 0 ? 0x10b981 : 0xfbbf24);
        rooftopBeacons.setColorAt(beaconPlaced, tintColor);
        beaconPlaced++;
      }

      placed++;
    }
    rooftopBeacons.count = beaconPlaced;
    bldgInstanced.instanceMatrix.needsUpdate = true;
    if (bldgInstanced.instanceColor) bldgInstanced.instanceColor.needsUpdate = true;
    bldgInstanced.computeBoundingSphere();
    rooftopBeacons.instanceMatrix.needsUpdate = true;
    if (rooftopBeacons.instanceColor) rooftopBeacons.instanceColor.needsUpdate = true;
    rooftopBeacons.computeBoundingSphere();
    scene.add(bldgInstanced, rooftopBeacons);

    // 4. Elevated Orbital Command Gyroscope Rings Framing the Skyline
    const orbitalGroup = new THREE.Group();
    const outerArcGeo = track(new THREE.TorusGeometry(22.5, 0.045, 8, 96));
    outerArcGeo.rotateX(Math.PI / 2);
    const outerArcMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xb45309,
        emissive: 0x451a03,
        emissiveIntensity: 0.7,
        roughness: 0.3,
        metalness: 0.85,
      })
    );
    const outerArc = new THREE.Mesh(outerArcGeo, outerArcMat);
    outerArc.position.y = 0.35;
    orbitalGroup.add(outerArc);

    const skyGyroGeo = track(new THREE.TorusGeometry(14.5, 0.032, 8, 84, Math.PI * 1.45));
    const skyGyroMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.9,
      })
    );
    const skyGyroA = new THREE.Mesh(skyGyroGeo, skyGyroMat);
    skyGyroA.position.y = 6.2;
    skyGyroA.rotation.x = Math.PI / 2.25;
    const skyGyroB = new THREE.Mesh(skyGyroGeo, outerArcMat);
    skyGyroB.position.y = 7.4;
    skyGyroB.rotation.x = -Math.PI / 2.6;
    skyGyroB.rotation.z = Math.PI * 0.4;
    orbitalGroup.add(skyGyroA, skyGyroB);

    // Instanced tick marks around outer perimeter compass ring
    const tickCount = 72;
    const tickGeo = track(new THREE.BoxGeometry(0.08, 0.06, 0.45));
    const tickInstanced = new THREE.InstancedMesh(tickGeo, beaconCapMat, tickCount);
    for (let i = 0; i < tickCount; i++) {
      const ang = (i / tickCount) * Math.PI * 2;
      const r = 22.5;
      _vec3A.set(Math.cos(ang) * r, 0.38, Math.sin(ang) * r);
      _quat.setFromAxisAngle(_up, -ang + Math.PI / 2);
      const isMajorTick = i % 6 === 0;
      _scale.set(isMajorTick ? 1.8 : 0.9, 1, isMajorTick ? 1.9 : 1);
      _mat4.compose(_vec3A, _quat, _scale);
      tickInstanced.setMatrixAt(i, _mat4);
    }
    tickInstanced.instanceMatrix.needsUpdate = true;
    tickInstanced.computeBoundingSphere();
    orbitalGroup.add(tickInstanced);
    scene.add(orbitalGroup);

    // 5. Composite Multi-Part Procedural Junction Monuments + Endpoint Sky Pillars
    const shadowTex = track(createContactShadowTexture());
    const contactShadowGeo = track(new THREE.PlaneGeometry(2.3, 2.3));
    const contactShadowMat = track(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );

    const plinthMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x292524,
        roughness: 0.72,
        metalness: 0.28,
      })
    );
    const chromeMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xd6d3d1,
        roughness: 0.18,
        metalness: 0.92,
        clearcoat: 0.5,
      })
    );

    const plinthGeo = track(new THREE.CylinderGeometry(0.42, 0.54, 0.16, 8));
    plinthGeo.translate(0, 0.08, 0);
    const collarGeo = track(new THREE.CylinderGeometry(0.28, 0.34, 0.22, 16));
    collarGeo.translate(0, 0.27, 0);
    const towerShaftGeo = track(new THREE.CylinderGeometry(0.14, 0.24, 1.25, 6));
    towerShaftGeo.translate(0, 0.98, 0);
    const hubRingGeo = track(new THREE.TorusGeometry(0.48, 0.035, 10, 28));
    const beaconGeo = track(new THREE.OctahedronGeometry(0.26, 0));
    const pillarGeo = track(new THREE.CylinderGeometry(0.06, 0.38, 7.5, 16, 1, true));
    pillarGeo.translate(0, 3.75, 0);
    const hitGeo = track(new THREE.SphereGeometry(0.9, 10, 10));
    const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));

    interface NodeVisual {
      node: CityNode;
      group: THREE.Group;
      beacon: THREE.Mesh;
      ring: THREE.Mesh | null;
      beaconMat: THREE.MeshPhysicalMaterial;
    }

    const nodeVisuals = new Map<string, NodeVisual>();
    const clickableMeshes: THREE.Object3D[] = [];

    for (const node of graph.nodes) {
      const worldPos = nodeWorldPos.get(node.id)!;
      const group = new THREE.Group();
      group.position.copy(worldPos);

      const shadowDisc = new THREE.Mesh(contactShadowGeo, contactShadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.025;
      group.add(shadowDisc);

      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.castShadow = !isSoftwareGl;
      plinth.receiveShadow = true;
      group.add(plinth);

      const collar = new THREE.Mesh(collarGeo, chromeMat);
      collar.castShadow = !isSoftwareGl;
      group.add(collar);

      const isMajor = node.kind === 'landmark' || node.kind === 'hub' || node.kind === 'transit';
      let ring: THREE.Mesh | null = null;
      const beaconY = isMajor ? 1.82 : 0.64;

      if (isMajor) {
        const spire = new THREE.Mesh(towerShaftGeo, chromeMat);
        spire.castShadow = !isSoftwareGl;
        group.add(spire);

        ring = new THREE.Mesh(hubRingGeo, chromeMat);
        ring.position.y = 1.48;
        ring.rotation.x = Math.PI / 2.4;
        group.add(ring);
      }

      const beaconMat = track(
        new THREE.MeshPhysicalMaterial({
          color: 0xfbbf24,
          emissive: 0xb45309,
          emissiveIntensity: 0.75,
          roughness: 0.12,
          metalness: 0.15,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
        })
      );
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = beaconY;
      beacon.scale.setScalar(isMajor ? 1.2 : 0.82);
      group.add(beacon);

      const hitProxy = new THREE.Mesh(hitGeo, hitMat);
      hitProxy.position.y = isMajor ? 1.15 : 0.45;
      hitProxy.layers.set(1);
      hitProxy.userData.node = node;
      group.add(hitProxy);
      clickableMeshes.push(hitProxy);

      scene.add(group);
      nodeVisuals.set(node.id, { node, group, beacon, ring, beaconMat });
    }

    // Dual Vertical Light Pillars highlighting Start & Destination endpoints
    const startPillarMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const endPillarMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    const startPillar = new THREE.Mesh(pillarGeo, startPillarMat);
    const endPillar = new THREE.Mesh(pillarGeo, endPillarMat);
    scene.add(startPillar, endPillar);

    // 6. 3D Elevated Corridor Tubes + Suspension Bridge Towers & Stay-Cables
    interface EdgeVisual {
      edgeId: string;
      curve: THREE.CatmullRomCurve3;
      mesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
    }

    const pylonMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xd6d3d1,
        roughness: 0.25,
        metalness: 0.88,
      })
    );
    const cableMat = track(
      new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.42,
      })
    );
    const pylonLegGeo = track(new THREE.CylinderGeometry(0.055, 0.085, 3.2, 8));
    pylonLegGeo.translate(0, 1.6, 0);
    const pylonCapGeo = track(new THREE.BoxGeometry(0.14, 0.1, 0.88));

    const edgeVisuals: EdgeVisual[] = [];
    for (const edge of graph.edges) {
      const start = nodeWorldPos.get(edge.from);
      const end = nodeWorldPos.get(edge.to);
      if (!start || !end) continue;

      const isBridge =
        Math.min(start.x, end.x) < 6.2 && Math.max(start.x, end.x) > 6.2;
      const arcHeight = isBridge ? 2.3 : edge.roadClass === 'expressway' ? 0.68 : 0.28;
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mid.y = arcHeight;

      const pA = start.clone().setY(0.2);
      const pB = end.clone().setY(0.2);
      const curve = new THREE.CatmullRomCurve3([pA, mid, pB]);
      const tubeRadius = edge.roadClass === 'expressway' ? 0.08 : 0.05;
      const tubeGeo = track(new THREE.TubeGeometry(curve, 22, tubeRadius, 8, false));
      const tubeMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x3b2f26,
          emissive: 0x1c140e,
          emissiveIntensity: 0.4,
          roughness: 0.35,
          metalness: 0.65,
        })
      );
      const mesh = new THREE.Mesh(tubeGeo, tubeMat);
      mesh.castShadow = isBridge && !isSoftwareGl;
      scene.add(mesh);
      edgeVisuals.push({ edgeId: edge.id, curve, mesh, mat: tubeMat });

      if (isBridge) {
        const dirXZ = new THREE.Vector3(end.x - start.x, 0, end.z - start.z).normalize();
        const perpXZ = new THREE.Vector3(-dirXZ.z, 0, dirXZ.x);
        const yaw = Math.atan2(dirXZ.x, dirXZ.z);

        for (const tPylon of [0.28, 0.72]) {
          const deckPt = curve.getPointAt(tPylon);
          const tower = new THREE.Group();
          tower.position.set(deckPt.x, 0, deckPt.z);
          tower.rotation.y = yaw;

          const leftLeg = new THREE.Mesh(pylonLegGeo, pylonMat);
          leftLeg.position.set(-0.34, 0, 0);
          leftLeg.castShadow = !isSoftwareGl;
          const rightLeg = new THREE.Mesh(pylonLegGeo, pylonMat);
          rightLeg.position.set(0.34, 0, 0);
          rightLeg.castShadow = !isSoftwareGl;
          const cap = new THREE.Mesh(pylonCapGeo, pylonMat);
          cap.rotation.y = Math.PI / 2;
          cap.position.set(0, 3.12, 0);
          tower.add(leftLeg, rightLeg, cap);
          scene.add(tower);

          // Stay-cables fanning from tower top to deck curve
          const peakWorldL = new THREE.Vector3(
            deckPt.x - perpXZ.x * 0.34,
            3.12,
            deckPt.z - perpXZ.z * 0.34
          );
          const peakWorldR = new THREE.Vector3(
            deckPt.x + perpXZ.x * 0.34,
            3.12,
            deckPt.z + perpXZ.z * 0.34
          );
          const anchorTs =
            tPylon < 0.5 ? [0.08, 0.18, 0.4, 0.5] : [0.5, 0.6, 0.82, 0.92];
          const cableVerts: number[] = [];
          for (const aT of anchorTs) {
            const aPt = curve.getPointAt(aT);
            cableVerts.push(peakWorldL.x, peakWorldL.y, peakWorldL.z, aPt.x, aPt.y, aPt.z);
            cableVerts.push(peakWorldR.x, peakWorldR.y, peakWorldR.z, aPt.x, aPt.y, aPt.z);
          }
          const cableGeo = track(new THREE.BufferGeometry());
          cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cableVerts, 3));
          scene.add(new THREE.LineSegments(cableGeo, cableMat));
        }
      }
    }

    // 7. Instanced Telemetry Packets along 3D Corridor Tubes
    const packetsPerEdge = 2;
    const totalPacketInstances = edgeVisuals.length * packetsPerEdge;
    const packetGeo = track(new THREE.OctahedronGeometry(0.15, 0));
    const packetMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xfbbf24,
        emissiveIntensity: 1.75,
        roughness: 0.15,
        metalness: 0.1,
      })
    );
    const packetInstanced = new THREE.InstancedMesh(
      packetGeo,
      packetMat,
      totalPacketInstances
    );
    packetInstanced.frustumCulled = false;
    scene.add(packetInstanced);

    // 8. Three Autonomous 3D Aerial Transit Drones Orbiting Elevated Splines
    const droneHullMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xf5f5f4,
        metalness: 0.85,
        roughness: 0.2,
        clearcoat: 0.8,
      })
    );
    const droneRotorMat = track(
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
    );
    const droneBeaconMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.0,
      })
    );

    const droneCurves = [
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-13, 4.2, -7),
          new THREE.Vector3(-2, 5.4, -9),
          new THREE.Vector3(11, 4.8, -4),
          new THREE.Vector3(14, 4.0, 6),
          new THREE.Vector3(2, 5.2, 8),
          new THREE.Vector3(-12, 4.5, 4),
        ],
        true
      ),
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(13, 5.8, -8),
          new THREE.Vector3(4, 3.8, -1),
          new THREE.Vector3(-9, 5.5, 6),
          new THREE.Vector3(-14, 4.6, -3),
          new THREE.Vector3(0, 6.4, -7),
        ],
        true
      ),
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-6, 6.8, -10),
          new THREE.Vector3(9, 5.0, -7),
          new THREE.Vector3(12, 6.2, 7),
          new THREE.Vector3(-5, 4.4, 9),
          new THREE.Vector3(-14, 5.8, 0),
        ],
        true
      ),
    ];

    const drones = droneCurves.map((curve, idx) => {
      const built = buildDroneGroup(droneHullMat, droneRotorMat, droneBeaconMat);
      scene.add(built.group);
      return { ...built, curve, offset: idx * 0.33, speed: 0.045 + idx * 0.012 };
    });

    // 9. Atmospheric Floating Network Data Dust (THREE.Points)
    const dustCount = 260;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustBaseY = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (nextRand() - 0.5) * 52;
      const y = 0.6 + nextRand() * 11;
      dustPositions[i * 3 + 1] = y;
      dustBaseY[i] = y;
      dustPositions[i * 3 + 2] = (nextRand() - 0.5) * 38;
    }
    const dustGeo = track(new THREE.BufferGeometry());
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const glowTex = track(createGlowSpriteTexture());
    const dustMat = track(
      new THREE.PointsMaterial({
        size: 0.34,
        map: glowTex,
        color: 0xfde68a,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    const dustPoints = new THREE.Points(dustGeo, dustMat);
    scene.add(dustPoints);

    // 10. Expanding Twin Horizon Radar Pulse Rings
    const radarGeo = track(new THREE.RingGeometry(0.96, 1.04, 72));
    radarGeo.rotateX(-Math.PI / 2);
    const radarMatA = track(
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    const radarMatB = track(
      new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      })
    );
    const radarRingA = new THREE.Mesh(radarGeo, radarMatA);
    const radarRingB = new THREE.Mesh(radarGeo, radarMatB);
    radarRingA.position.y = 0.055;
    radarRingB.position.y = 0.06;
    scene.add(radarRingA, radarRingB);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Interactive Raycasting
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    let lastHoverCheck = 0;
    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (moved > 6) return;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const node = hits[0].object.userData.node as CityNode | undefined;
        onSelectNodeRef.current?.(node ?? null);
      } else {
        onSelectNodeRef.current?.(null);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    let lastClock = performance.now();
    let elapsedTotal = 0;

    const activeColor = new THREE.Color();
    const packetColor = new THREE.Color();

    const tick = (now?: number) => {
      if (disposed) return;
      const ts = typeof now === 'number' ? now : performance.now();
      const delta = Math.max(0, Math.min((ts - lastClock) / 1000, 0.05));
      lastClock = ts;
      elapsedTotal += prefersReducedMotion ? 0 : delta;

      waterUniforms.uTime.value = elapsedTotal;

      controls.autoRotate =
        !isSoftwareGl && !prefersReducedMotion && autoOrbitRef.current;

      if (cameraTransitionActiveRef.current) {
        const preset = CAMERA_PRESETS[cameraPresetRef.current];
        _vec3A.set(...preset.pos);
        _vec3B.set(...preset.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _vec3A.x, 4.5, delta || 0.016);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _vec3A.y, 4.5, delta || 0.016);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _vec3A.z, 4.5, delta || 0.016);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _vec3B.x, 4.5, delta || 0.016);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _vec3B.y, 4.5, delta || 0.016);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _vec3B.z, 4.5, delta || 0.016);
        if (camera.position.distanceTo(_vec3A) < 0.08) {
          cameraTransitionActiveRef.current = false;
        }
      }

      controls.update();

      const mode = sceneModeRef.current;
      const isRush = rushHourRef.current;
      const ov = overlaysRef.current;
      const activeEdges =
        mode === 'prim-mst'
          ? ov.mstEdges
          : mode === 'dijkstra-south'
          ? isRush
            ? ov.southRushEdges
            : ov.southEdges
          : isRush
          ? ov.northRushEdges
          : ov.northEdges;
      const activeNodes =
        mode === 'prim-mst'
          ? null
          : mode === 'dijkstra-south'
          ? isRush
            ? ov.southRushNodes
            : ov.southNodes
          : isRush
          ? ov.northRushNodes
          : ov.northNodes;
      const congestedSet = isRush ? ov.congestedRushEdges : ov.congestedBaseEdges;
      const isMst = mode === 'prim-mst';

      // Position Start & Destination Light Pillars
      const startId = mode === 'dijkstra-south' ? 'J5' : 'J1';
      const endId = mode === 'dijkstra-south' ? 'J18' : 'J22';
      const sPos = nodeWorldPos.get(startId);
      const ePos = nodeWorldPos.get(endId);
      if (sPos) startPillar.position.set(sPos.x, 0, sPos.z);
      if (ePos) endPillar.position.set(ePos.x, 0, ePos.z);
      endPillar.visible = !isMst;
      startPillarMat.opacity = 0.14 + Math.sin(elapsedTotal * 2.4) * 0.05;
      endPillarMat.opacity = 0.16 + Math.cos(elapsedTotal * 2.4) * 0.05;

      // Rotate Elevated Gyroscope Rings
      if (!prefersReducedMotion) {
        skyGyroA.rotation.z += delta * 0.18;
        skyGyroB.rotation.z -= delta * 0.14;
        outerArc.rotation.y += delta * 0.04;
      }

      // Animate Aerial Transit Drones along Splines
      for (const drone of drones) {
        const t = prefersReducedMotion
          ? drone.offset
          : (elapsedTotal * drone.speed + drone.offset) % 1;
        drone.curve.getPointAt(t, _vec3A);
        drone.curve.getPointAt((t + 0.01) % 1, _vec3B);
        drone.group.position.copy(_vec3A);
        _lookMat.lookAt(_vec3B, _vec3A, _up);
        drone.group.quaternion.setFromRotationMatrix(_lookMat);
        if (!prefersReducedMotion) {
          for (const rotor of drone.rotors) {
            rotor.rotation.y += delta * 18;
          }
        }
      }

      // Dynamic Courier PointLight gliding along the active route path
      const courierPath =
        mode === 'dijkstra-south'
          ? isRush
            ? ov.southRushPath
            : ov.southPath
          : isRush
          ? ov.northRushPath
          : ov.northPath;
      if (courierPath.length > 1) {
        const segCount = courierPath.length - 1;
        const routeT = prefersReducedMotion ? 0.4 : (elapsedTotal * 0.22) % 1;
        const scaled = routeT * segCount;
        const idx = Math.min(Math.floor(scaled), segCount - 1);
        const localT = scaled - idx;
        const pA = nodeWorldPos.get(courierPath[idx]);
        const pB = nodeWorldPos.get(courierPath[idx + 1]);
        if (pA && pB) {
          _vec3D.lerpVectors(pA, pB, localT);
          courierLight.position.set(_vec3D.x, 2.2, _vec3D.z);
          courierLight.color.setHex(isMst ? 0x10b981 : 0xfbbf24);
        }
      }

      // Animate Junction Beacons
      for (const [id, nv] of nodeVisuals.entries()) {
        const isSelected = selectedNodeRef.current === id;
        const isStart = id === startId;
        const isEnd = !isMst && id === endId;
        const onPath = activeNodes ? activeNodes.has(id) : true;

        if (!prefersReducedMotion) {
          nv.beacon.rotation.y += delta * (isSelected || isStart || isEnd ? 2.0 : 0.75);
          nv.beacon.position.y =
            (nv.ring ? 1.82 : 0.64) +
            Math.sin(elapsedTotal * 2.1 + nv.group.position.x * 0.4) * 0.06;
          if (nv.ring) {
            nv.ring.rotation.z += delta * 0.75;
          }
        }

        if (isSelected) {
          nv.beaconMat.color.setHex(0xf43f5e);
          nv.beaconMat.emissive.setHex(0xe11d48);
          nv.beaconMat.emissiveIntensity = 1.75;
        } else if (isStart) {
          nv.beaconMat.color.setHex(0x34d399);
          nv.beaconMat.emissive.setHex(0x059669);
          nv.beaconMat.emissiveIntensity = 1.5;
        } else if (isEnd) {
          nv.beaconMat.color.setHex(0xfbbf24);
          nv.beaconMat.emissive.setHex(0xd97706);
          nv.beaconMat.emissiveIntensity = 1.5;
        } else if (onPath) {
          nv.beaconMat.color.setHex(isMst ? 0x10b981 : 0xf59e0b);
          nv.beaconMat.emissive.setHex(isMst ? 0x047857 : 0xb45309);
          nv.beaconMat.emissiveIntensity = 0.9;
        } else {
          nv.beaconMat.color.setHex(0x57534e);
          nv.beaconMat.emissive.setHex(0x292524);
          nv.beaconMat.emissiveIntensity = 0.25;
        }
      }

      // Animate Corridor Tubes & Instanced Data Packets
      let instanceIdx = 0;
      for (let i = 0; i < edgeVisuals.length; i++) {
        const ev = edgeVisuals[i];
        const isActive = activeEdges.has(ev.edgeId);
        const isCongested = !isMst && congestedSet.has(ev.edgeId);

        if (isActive) {
          activeColor.setHex(isMst ? 0x10b981 : 0xfbbf24);
          ev.mat.color.lerp(activeColor, 0.18);
          ev.mat.emissive.setHex(isMst ? 0x059669 : 0xd97706);
          ev.mat.emissiveIntensity = 1.25;
        } else if (isCongested) {
          activeColor.setHex(0xea580c);
          ev.mat.color.lerp(activeColor, 0.16);
          ev.mat.emissive.setHex(0x9a3412);
          ev.mat.emissiveIntensity = 0.9;
        } else {
          activeColor.setHex(0x3b2f26);
          ev.mat.color.lerp(activeColor, 0.12);
          ev.mat.emissive.setHex(0x1c140e);
          ev.mat.emissiveIntensity = 0.3;
        }

        for (let k = 0; k < packetsPerEdge; k++) {
          const speed = isActive ? 0.42 : isCongested ? 0.06 : 0.13;
          const phaseOffset = (i * 0.19 + k * 0.5) % 1;
          const t = prefersReducedMotion
            ? (0.25 + k * 0.5) % 1
            : (elapsedTotal * speed + phaseOffset) % 1;

          ev.curve.getPointAt(t, _vec3A);
          ev.curve.getTangentAt(t, _vec3C);
          _quat.setFromUnitVectors(_up, _vec3C);
          const packetScale = isActive ? 1.2 : 0.55;
          _scale.set(packetScale, packetScale * 1.45, packetScale);
          _mat4.compose(_vec3A, _quat, _scale);
          packetInstanced.setMatrixAt(instanceIdx, _mat4);

          packetColor.setHex(
            isActive ? (isMst ? 0x6ee7b7 : 0xfef08a) : isCongested ? 0xf97316 : 0xf59e0b
          );
          packetInstanced.setColorAt(instanceIdx, packetColor);
          instanceIdx++;
        }
      }
      packetInstanced.instanceMatrix.needsUpdate = true;
      if (packetInstanced.instanceColor) packetInstanced.instanceColor.needsUpdate = true;

      // Gentle upward float on atmospheric network dust
      if (!prefersReducedMotion) {
        const posAttr = dustGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < dustCount; i++) {
          const base = dustBaseY[i];
          const py = ((base + elapsedTotal * 0.35 + i * 0.11) % 11.5) + 0.5;
          posAttr.setY(i, py);
        }
        posAttr.needsUpdate = true;
      }

      // Twin Horizon Radar Sweeps
      const radarTA = prefersReducedMotion ? 0.35 : (elapsedTotal * 0.19) % 1;
      const radarTB = prefersReducedMotion ? 0.72 : (elapsedTotal * 0.19 + 0.5) % 1;
      const scaleA = 2 + radarTA * 24;
      const scaleB = 2 + radarTB * 24;
      radarRingA.scale.set(scaleA, 1, scaleA);
      radarRingB.scale.set(scaleB, 1, scaleB);
      radarMatA.color.setHex(isMst ? 0x10b981 : 0xfbbf24);
      radarMatA.opacity = (1 - radarTA) * 0.25;
      radarMatB.opacity = (1 - radarTB) * 0.18;

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        if (isSoftwareGl) {
          afterDraw(() => tick());
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);

      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [graph]);

  return <div ref={mountRef} className="w-full h-full relative select-none" />;
};
