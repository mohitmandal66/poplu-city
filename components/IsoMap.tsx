

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Environment, SoftShadows, Instance, Instances, Float, useTexture, Outlines, OrthographicCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType, TileData } from '../types';
import { GRID_SIZE, BUILDINGS, LAND_COST, LAND_SELL } from '../constants';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

// Deterministic random based on coordinates
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 8, 8);

// --- 1. Advanced Procedural Buildings ---

// FIX: Wrap component in React.memo to ensure TypeScript recognizes it as a component that accepts a 'key' prop.
const WindowBlock = React.memo(({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) => (
  <mesh geometry={boxGeo} position={position} scale={scale}>
    <meshStandardMaterial color="#bfdbfe" emissive="#bfdbfe" emissiveIntensity={0.2} roughness={0.1} metalness={0.8} />
  </mesh>
));

const SmokeStack = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.children.forEach((child, i) => {
        const cloud = child as THREE.Mesh;
        cloud.position.y += 0.01 + i * 0.005;
        cloud.scale.addScalar(0.005);
        
        const material = cloud.material as THREE.MeshStandardMaterial;
        if (material) {
          material.opacity -= 0.005;
          if (cloud.position.y > 1.5) {
            cloud.position.y = 0;
            cloud.scale.setScalar(0.1 + Math.random() * 0.1);
            material.opacity = 0.6;
          }
        }
      });
    }
  });

  return (
    <group position={position}>
      <mesh geometry={cylinderGeo} castShadow receiveShadow position={[0, 0.5, 0]} scale={[0.2, 1, 0.2]}>
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <group ref={ref} position={[0, 1, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} geometry={sphereGeo} position={[Math.random()*0.1, i*0.4, Math.random()*0.1]} scale={0.2}>
            <meshStandardMaterial color="#d1d5db" transparent opacity={0.6} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
};

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const hash = getHash(x, y);
  const variant = Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  
  // Color variation
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    // Shift hue and lightness slightly based on hash
    c.offsetHSL(hash * 0.1 - 0.05, 0, hash * 0.2 - 0.1);
    return c;
  }, [baseColor, hash]);

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial({ color, flatShading: true, opacity, transparent, roughness: 0.8 }), [color, opacity, transparent]);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), flatShading: true, opacity, transparent }), [color, opacity, transparent]);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.5).offsetHSL(0,0,-0.1), flatShading: true, opacity, transparent }), [color, opacity, transparent]);

  const commonProps = { castShadow: true, receiveShadow: true };

  // Buildings are built assuming y=0 is ground level within their group
  // Adjust vertical position to sit on top of ground tile (approx -0.3)
  const yOffset = -0.3;

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            if (variant < 33) {
              // Cozy Cottage
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.3, 0]} scale={[0.7, 0.6, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={coneGeo} position={[0, 0.75, 0]} scale={[0.6, 0.4, 0.6]} rotation={[0, Math.PI/4, 0]} />
                  <WindowBlock position={[0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <WindowBlock position={[-0.2, 0.3, 0.31]} scale={[0.15, 0.2, 0.05]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0.32]} scale={[0.15, 0.2, 0.05]} />
                </>
              );
            } else if (variant < 66) {
              // Modern Boxy
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.1, 0.35, 0]} scale={[0.6, 0.7, 0.8]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.25, 0.25, 0.1]} scale={[0.4, 0.5, 0.6]} />
                  <WindowBlock position={[-0.1, 0.5, 0.41]} scale={[0.4, 0.2, 0.05]} />
                </>
              );
            } else {
              // Townhouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.5, 0]} scale={[0.5, 1, 0.6]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0, 1.05, 0]} scale={[0.55, 0.1, 0.65]} />
                  <WindowBlock position={[0, 0.7, 0.31]} scale={[0.3, 0.2, 0.05]} />
                  <WindowBlock position={[0, 0.3, 0.31]} scale={[0.3, 0.2, 0.05]} />
                </>
              );
            }

          case BuildingType.Commercial:
            if (variant < 40) {
              // High-rise
              const height = 1.5 + hash * 1.5;
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, height/2, 0]} scale={[0.7, height, 0.7]} />
                  {Array.from({ length: Math.floor(height * 3) }).map((_, i) => (
                    <WindowBlock key={i} position={[0, 0.2 + i * 0.3, 0]} scale={[0.72, 0.15, 0.72]} />
                  ))}
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, height + 0.1, 0]} scale={[0.5, 0.2, 0.5]} />
                </>
              );
            } else if (variant < 70) {
              // Shop
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <WindowBlock position={[0, 0.3, 0.41]} scale={[0.8, 0.4, 0.05]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({ color: hash > 0.5 ? '#ef4444' : '#3b82f6' })} geometry={boxGeo} position={[0, 0.55, 0.5]} scale={[0.9, 0.1, 0.2]} rotation={[Math.PI/6, 0, 0]} />
                </>
              );
            } else {
              // Corner store
               return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.5, -0.2]} scale={[0.5, 1, 0.5]} />
                  <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.1, 0.3, 0.1]} scale={[0.7, 0.6, 0.7]} />
                  <WindowBlock position={[0.1, 0.3, 0.46]} scale={[0.6, 0.3, 0.05]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#9ca3af'})} geometry={boxGeo} position={[0.2, 0.65, 0.2]} scale={[0.2, 0.1, 0.2]} />
                </>
               )
            }

          case BuildingType.Industrial:
            if (variant < 50) {
              // Factory
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.4, 0]} scale={[0.9, 0.8, 0.8]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[-0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <mesh {...commonProps} material={roofMat} geometry={boxGeo} position={[0.2, 0.9, 0]} scale={[0.4, 0.2, 0.8]} rotation={[0,0,Math.PI/4]} />
                  <SmokeStack position={[0.3, 0.4, 0.3]} />
                </>
              );
            } else {
              // Warehouse
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.3, 0]} scale={[0.5, 0.6, 0.9]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, -0.2]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.25, 0.4, 0.25]} scale={[0.2, 0.8, 0.2]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#6b7280'})} geometry={boxGeo} position={[0.25, 0.7, 0]} scale={[0.05, 0.05, 0.5]} />
                </>
              );
            }

          case BuildingType.Park:
            const treeCount = 1 + Math.floor(hash * 3);
            const positions = [[-0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [0.2, -0.2]];
            
            return (
              <group position={[0, -yOffset - 0.29, 0]}> {/* Adjust park base to sit exactly on top of ground tile */}
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial color="#86efac" />
                </mesh>
                
                {variant < 30 && (
                    <group position={[0,0.05,0]}>
                        <mesh material={new THREE.MeshStandardMaterial({color: '#cbd5e1'})} geometry={cylinderGeo} scale={[0.4, 0.1, 0.4]} castShadow receiveShadow />
                        <mesh material={new THREE.MeshStandardMaterial({color: '#3b82f6', roughness: 0.1})} geometry={cylinderGeo} position={[0, 0.06, 0]} scale={[0.3, 0.05, 0.3]} />
                    </group>
                )}

                {Array.from({length: treeCount}).map((_, i) => {
                    const pos = positions[i % positions.length];
                    const scale = 0.5 + getHash(x+i, y-i) * 0.5;
                    const treeColor = new THREE.Color("#166534").offsetHSL(0, 0, getHash(x,y+i)*0.2);
                    return (
                    <group key={i} position={[pos[0], 0, pos[1]]} scale={scale} rotation={[0, getHash(i,x)*Math.PI, 0]}>
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: '#78350f' })} geometry={cylinderGeo} position={[0, 0.15, 0]} scale={[0.1, 0.3, 0.1]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.4, 0]} scale={[0.4, 0.5, 0.4]} />
                        <mesh castShadow receiveShadow material={new THREE.MeshStandardMaterial({ color: treeColor, flatShading: true })} geometry={coneGeo} position={[0, 0.65, 0]} scale={[0.3, 0.4, 0.3]} />
                    </group>
                    )
                })}
              </group>
            );

          case BuildingType.TrainStation:
            return (
                <group position={[0, 0.1, 0]}>
                    {/* Platform */}
                    <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.9, 0.2, 0.8]} />
                    {/* Main Building */}
                    <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[-0.2, 0.4, 0]} scale={[0.4, 0.6, 0.6]} />
                    {/* Clock Tower */}
                    <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[-0.2, 0.8, 0]} scale={[0.2, 0.4, 0.2]} />
                    <mesh {...commonProps} geometry={boxGeo} position={[-0.2, 0.9, 0.11]} scale={[0.1, 0.1, 0.05]}>
                        <meshBasicMaterial color="white" />
                    </mesh>
                    {/* Roof */}
                    <mesh {...commonProps} material={roofMat} geometry={coneGeo} position={[-0.2, 1.1, 0]} scale={[0.3, 0.3, 0.3]} rotation={[0, Math.PI/4, 0]} />
                    
                    {/* Canopy */}
                    <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0.2, 0.5, 0]} scale={[0.4, 0.05, 0.6]} />
                    <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#333'})} geometry={cylinderGeo} position={[0.35, 0.3, 0.25]} scale={[0.05, 0.4, 0.05]} />
                    <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color:'#333'})} geometry={cylinderGeo} position={[0.35, 0.3, -0.25]} scale={[0.05, 0.4, 0.05]} />
                </group>
            );

          case BuildingType.Rail:
          case BuildingType.Road:
          case BuildingType.Bridge:
             return null;
          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- 2. Dynamic Systems (Traffic, Citizens, Environment, Train) ---

const carColors = ['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#1f2937', '#f97316'];

const TrafficSystem = ({ grid }: { grid: Grid }) => {
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Bridge) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const carCount = Math.min(roadTiles.length, 30);
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsState = useRef<Float32Array>(new Float32Array(0)); 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => new Float32Array(0), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    carsState.current = new Float32Array(carCount * 6);
    const newColors = new Float32Array(carCount * 3);

    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*6 + 0] = startNode.x;
      carsState.current[i*6 + 1] = startNode.y;
      carsState.current[i*6 + 2] = startNode.x;
      carsState.current[i*6 + 3] = startNode.y;
      carsState.current[i*6 + 4] = 1; // force pick new target
      carsState.current[i*6 + 5] = getRandomRange(0.01, 0.03); // speed

      const color = new THREE.Color(carColors[Math.floor(Math.random() * carColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }

    if (carsRef.current) {
        carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    }
  }, [roadTiles, carCount]);

  useFrame(() => {
    if (!carsRef.current || roadTiles.length < 2 || carsState.current.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const idx = i * 6;
      let curX = carsState.current[idx];
      let curY = carsState.current[idx+1];
      let tarX = carsState.current[idx+2];
      let tarY = carsState.current[idx+3];
      let progress = carsState.current[idx+4];
      const speed = carsState.current[idx+5];

      progress += speed;

      if (progress >= 1) {
        curX = tarX;
        curY = tarY;
        progress = 0;
        
        const neighbors = roadTiles.filter(t => 
          (Math.abs(t.x - curX) === 1 && t.y === curY) || 
          (Math.abs(t.y - curY) === 1 && t.x === curX)
        );

        if (neighbors.length > 0) {
            // Simple pathfinding
            const valid = neighbors.length > 1 
                ? neighbors.filter(n => Math.abs(n.x - carsState.current[idx]) > 0.1 || Math.abs(n.y - carsState.current[idx+1]) > 0.1)
                : neighbors;
            
            const next = valid.length > 0 
                ? valid[Math.floor(Math.random() * valid.length)]
                : neighbors[0];
            
            tarX = next.x;
            tarY = next.y;
        } else {
            const rnd = roadTiles[Math.floor(Math.random() * roadTiles.length)];
            curX = rnd.x; curY = rnd.y; tarX = rnd.x; tarY = rnd.y;
        }
      }

      carsState.current[idx] = curX;
      carsState.current[idx+1] = curY;
      carsState.current[idx+2] = tarX;
      carsState.current[idx+3] = tarY;
      carsState.current[idx+4] = progress;

      // Interpolate position
      const gx = MathUtils.lerp(curX, tarX, progress);
      const gy = MathUtils.lerp(curY, tarY, progress);

      // Determine driving side offset
      const dx = tarX - curX;
      const dy = tarY - curY;
      const angle = Math.atan2(dy, dx);
      
      const offsetAmt = 0.15;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offX = (-dy/len) * offsetAmt;
      const offY = (dx/len) * offsetAmt;

      const [wx, _, wz] = gridToWorld(gx + offX, gy + offY);

      dummy.position.set(wx, -0.3 + 0.075, wz);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(0.5, 0.15, 0.3); 
      
      dummy.updateMatrix();
      carsRef.current.setMatrixAt(i, dummy.matrix);
    }
    carsRef.current.instanceMatrix.needsUpdate = true;
  });

  if (roadTiles.length < 2) return null;

  return (
    <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]} castShadow>
      <meshStandardMaterial roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
};

const TrainSystem = ({ grid }: { grid: Grid }) => {
    // Collect rail tiles (BuildingType.Rail)
    const railTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
            if (tile.buildingType === BuildingType.Rail || tile.isRail) tiles.push({x: tile.x, y: tile.y});
        }));
        
        // Simple sorting for visualization (Not true graph pathfinding)
        // Try to sort by X then Y to create a contiguous flow if it's a line
        // If it's a complex network, the train will teleport between segments, which is acceptable.
        return tiles.sort((a,b) => (a.x - b.x) + (a.y - b.y) * 0.1); 
    }, [grid]);

    const trainRef = useRef<THREE.Group>(null);
    const speed = 3; // tiles per second
    const progressRef = useRef(0);

    useFrame((state, delta) => {
        if (!trainRef.current || railTiles.length < 2) return;
        
        progressRef.current += delta * speed;
        const totalLen = railTiles.length;
        // Ping pong movement
        const rawPos = progressRef.current % (totalLen * 2);
        const pos = rawPos > totalLen ? (totalLen * 2) - rawPos : rawPos;

        const idx = Math.floor(pos);
        const nextIdx = Math.min(idx + 1, totalLen - 1);
        const t = pos - idx;

        const cur = railTiles[idx];
        const next = railTiles[nextIdx];

        // If gap is too large, snap
        if (Math.abs(cur.x - next.x) > 1.5 || Math.abs(cur.y - next.y) > 1.5) {
             // Jump
        }

        const x = MathUtils.lerp(cur.x, next.x, t);
        const y = MathUtils.lerp(cur.y, next.y, t);

        const [wx, _, wz] = gridToWorld(x, y);
        
        // Look ahead for rotation
        const dx = next.x - cur.x;
        const dy = next.y - cur.y;
        let angle = Math.atan2(dy, dx); 
        if (rawPos > totalLen) angle += Math.PI; // Reverse rotation on return

        trainRef.current.position.set(wx, -0.2, wz);
        trainRef.current.rotation.y = -angle + Math.PI/2; 
    });

    if (railTiles.length === 0) return null;

    return (
        <group ref={trainRef}>
            {/* Engine */}
            <mesh position={[0, 0.25, 0.3]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.8]} />
                <meshStandardMaterial color="#ef4444" />
            </mesh>
            <mesh position={[0, 0.4, 0.5]}>
                <boxGeometry args={[0.52, 0.3, 0.4]} />
                <meshStandardMaterial color="#991b1b" />
            </mesh>
            <mesh position={[0, 0.6, -0.05]} castShadow>
                <cylinderGeometry args={[0.1, 0.1, 0.4]} />
                <meshStandardMaterial color="#333" />
            </mesh>
             {/* Carriage 1 */}
            <mesh position={[0, 0.25, -0.6]} castShadow>
                <boxGeometry args={[0.5, 0.45, 0.8]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>
             {/* Carriage 2 */}
             <mesh position={[0, 0.25, -1.5]} castShadow>
                <boxGeometry args={[0.5, 0.45, 0.8]} />
                <meshStandardMaterial color="#3b82f6" />
            </mesh>
        </group>
    )
}

const clothesColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'];

const PopulationSystem = ({ population, grid }: { population: number, grid: Grid }) => {
    const agentCount = Math.min(Math.floor(population / 2), 300); 
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    // Find tiles where people can walk (Roads, Parks, empty owned ground)
    const walkableTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
          if (tile.owned && !tile.isWater && !tile.isRail && (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Park || tile.buildingType === BuildingType.None)) {
            tiles.push({x: tile.x, y: tile.y});
          }
        }));
        return tiles;
    }, [grid]);
    
    const agentsState = useRef<Float32Array>(new Float32Array(0));
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (agentCount === 0 || walkableTiles.length === 0) return;
        agentsState.current = new Float32Array(agentCount * 6);
        const newColors = new Float32Array(agentCount * 3);

        for(let i=0; i<agentCount; i++) {
            const t = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            // Spawn with random offset in tile
            const x = t.x + getRandomRange(-0.4, 0.4);
            const y = t.y + getRandomRange(-0.4, 0.4);

            agentsState.current[i*6+0] = x;
            agentsState.current[i*6+1] = y;
            
            // Initial target
            const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            agentsState.current[i*6+2] = tt.x + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+3] = tt.y + getRandomRange(-0.4, 0.4);
            
            agentsState.current[i*6+4] = getRandomRange(0.005, 0.015); // speed
            agentsState.current[i*6+5] = Math.random() * Math.PI * 2; // anim

            const c = new THREE.Color(clothesColors[Math.floor(Math.random() * clothesColors.length)]);
            newColors[i*3] = c.r; newColors[i*3+1] = c.g; newColors[i*3+2] = c.b;
        }

        if (meshRef.current) {
            meshRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
        }
    }, [agentCount, walkableTiles]);

    useFrame((state) => {
        if (!meshRef.current || agentCount === 0 || agentsState.current.length === 0) return;
        const time = state.clock.elapsedTime;

        for(let i=0; i<agentCount; i++) {
            const idx = i*6;
            let x = agentsState.current[idx];
            let y = agentsState.current[idx+1];
            let tx = agentsState.current[idx+2];
            let ty = agentsState.current[idx+3];
            const speed = agentsState.current[idx+4];
            const animOffset = agentsState.current[idx+5];

            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 0.1) {
                // Pick new random target from walkable
                if (walkableTiles.length > 0) {
                    const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
                    tx = tt.x + getRandomRange(-0.4, 0.4);
                    ty = tt.y + getRandomRange(-0.4, 0.4);
                    agentsState.current[idx+2] = tx;
                    agentsState.current[idx+3] = ty;
                }
            } else {
                x += (dx/dist) * speed;
                y += (dy/dist) * speed;
                agentsState.current[idx] = x;
                agentsState.current[idx+1] = y;
            }

            const [wx, _, wz] = gridToWorld(x, y);

            // Walking bounce
            const bounce = Math.abs(Math.sin(time * 10 + animOffset)) * 0.03;

            // Person dimensions
            const height = 0.2;
            const width = 0.08;
            // Ground level approx -0.3 to -0.4
            const groundY = -0.35; 

            dummy.position.set(wx, groundY + height/2 + bounce, wz);
            dummy.rotation.set(0, -Math.atan2(dy, dx), 0);
            dummy.scale.set(width, height, width);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (agentCount === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, agentCount]} castShadow>
            <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
    )
};

// Clouds & Birds
const Cloud = ({ position, scale, speed }: { position: [number, number, number], scale: number, speed: number }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (group.current) {
            group.current.position.x += speed * delta;
            if (group.current.position.x > GRID_SIZE * 1.5) group.current.position.x = -GRID_SIZE * 1.5;
        }
    });

    const bubbles = useMemo(() => Array.from({length: 5 + Math.random() * 5}).map(() => ({
        pos: [getRandomRange(-1,1), getRandomRange(-0.5, 0.5), getRandomRange(-1,1)] as [number, number, number],
        scale: getRandomRange(0.5, 1.2)
    })), []);

    return (
        <group ref={group} position={position} scale={scale}>
            {bubbles.map((b, i) => (
                <mesh key={i} geometry={sphereGeo} position={b.pos} scale={b.scale} castShadow>
                    <meshStandardMaterial color="white" flatShading opacity={0.9} transparent />
                </mesh>
            ))}
        </group>
    )
}

const Bird = ({ position, speed, offset }: { position: [number, number, number], speed: number, offset: number }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(ref.current) {
            const time = state.clock.elapsedTime + offset;
            ref.current.position.x = position[0] + Math.sin(time * speed) * GRID_SIZE;
            ref.current.position.z = position[1] + Math.cos(time * speed) * GRID_SIZE/2;
            ref.current.rotation.y = -time * speed + Math.PI;
            ref.current.scale.y = 1 + Math.sin(time * 15) * 0.3;
        }
    });

    return (
        <group ref={ref} position={[position[0], position[2], position[1]]}>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[0.1,0,0]} rotation={[0, Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
            <mesh geometry={boxGeo} scale={[0.2, 0.05, 0.05]} position={[-0.1,0,0]} rotation={[0, -Math.PI/4, 0]}><meshBasicMaterial color="#333" /></mesh>
        </group>
    )
}

const EnvironmentEffects = ({ timeOfDay }: { timeOfDay: number }) => {
    // 0 = dawn, 0.5 = noon, 1.0 = dusk
    // Smooth transitions using Sine waves
    const cyclePos = Math.sin(timeOfDay * Math.PI); // 0 -> 1 -> 0
    
    // Sun position
    const sunX = Math.cos(timeOfDay * Math.PI - Math.PI) * 30;
    const sunY = Math.max(0, Math.sin(timeOfDay * Math.PI) * 30); // Ensure not negative
    
    // Light color: Interpolate seamlessly
    const lightColor = useMemo(() => {
        const c = new THREE.Color();
        // Interpolate between Orange (0.05) and White/Blueish (0.6)
        if (cyclePos < 0.2) {
             // Low sun (Sunrise/Sunset) - Orange
             c.setHSL(0.05, 0.8, 0.6);
        } else {
             // Day - White/Clear
             c.setHSL(0.1, 0.2, 0.9);
        }
        return c;
    }, [cyclePos]);
    
    // "Always bright" logic: Ambient never drops below 0.6 to prevent sudden dark
    const ambientIntensity = 0.6 + (cyclePos * 0.4); // Range: 0.6 to 1.0
    
    // Sun intensity follows the arc smoothly
    const sunIntensity = cyclePos * 2.5; 

    return (
        <group raycast={() => null}>
             <ambientLight intensity={ambientIntensity} color="#cceeff" />
             <directionalLight
                castShadow
                position={[sunX, sunY, 10]}
                intensity={sunIntensity}
                color={lightColor}
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-25} shadow-camera-right={25}
                shadow-camera-top={25} shadow-camera-bottom={-25}
             />

             {/* Stars (Subtle, only when sun is low) */}
             {cyclePos < 0.2 && (
                 <Points positions={new Float32Array(Array.from({length:300}).flatMap(() => [Math.random()*100-50, Math.random()*50+20, Math.random()*100-50]))}>
                     <pointsMaterial size={0.3} color="white" transparent opacity={(0.2 - cyclePos) * 5} />
                 </Points>
             )}

            {/* Clouds */}
            <Cloud position={[-12, 8, 4]} scale={1.5} speed={0.3} />
            <Cloud position={[5, 9, -8]} scale={1.2} speed={0.5} />
            <Cloud position={[15, 7, 10]} scale={1.8} speed={0.2} />
            
            {/* Birds */}
            <group position={[0, 0, 0]} scale={0.8}>
                <Bird position={[0, 0, 10]} speed={0.6} offset={0} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={1.2} />
                <Bird position={[0, 0, 10]} speed={0.6} offset={2.5} />
            </group>

            {/* Ocean underlayer (for river) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
                <planeGeometry args={[GRID_SIZE * 4, GRID_SIZE * 4]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.1} metalness={0.5} opacity={0.8} transparent />
            </mesh>
        </group>
    )
};

// Quick helper for stars
const Points = ({ positions, children }: { positions: Float32Array, children: React.ReactNode }) => {
    return (
        <points>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} />
            </bufferGeometry>
            {children}
        </points>
    )
}


// --- 3. Main Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset }: { x: number; y: number; grid: Grid; yOffset: number }) => {
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24' }), []);
  const lineGeo = useMemo(() => new THREE.PlaneGeometry(0.1, 0.5), []);

  const hasUp = y > 0 && (grid[y - 1][x].buildingType === BuildingType.Road || grid[y-1][x].buildingType === BuildingType.Bridge);
  const hasDown = y < GRID_SIZE - 1 && (grid[y + 1][x].buildingType === BuildingType.Road || grid[y+1][x].buildingType === BuildingType.Bridge);
  const hasLeft = x > 0 && (grid[y][x - 1].buildingType === BuildingType.Road || grid[y][x-1].buildingType === BuildingType.Bridge);
  const hasRight = x < GRID_SIZE - 1 && (grid[y][x + 1].buildingType === BuildingType.Road || grid[y][x+1].buildingType === BuildingType.Bridge);

  const connections = [hasUp, hasDown, hasLeft, hasRight].filter(Boolean).length;
  
  if (connections === 0) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]} geometry={lineGeo} material={lineMaterial} />
    );
  }

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
      {(hasUp || hasDown) && (hasLeft || hasRight) && (
        <mesh position={[0, 0, 0.005]} material={lineMaterial}>
           <planeGeometry args={[0.12, 0.12]} />
        </mesh>
      )}

      {hasUp && <mesh position={[0, 0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasDown && <mesh position={[0, -0.25, 0]} geometry={lineGeo} material={lineMaterial} />}
      {hasLeft && <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
      {hasRight && <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
    </group>
  );
});

interface GroundTileProps {
    tile: TileData;
    grid: Grid;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
    isLandTool: boolean;
}

const RailTracks = () => (
    <group position={[0, 0.02, 0]}>
        {/* Sleepers */}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}>
            <planeGeometry args={[0.6, 1]} />
            <meshStandardMaterial color="#554433" transparent opacity={0} /> {/* Placeholder for logic, but manually drawing stripes below */}
        </mesh>
        {[-0.3, 0, 0.3].map(z => (
             <mesh key={z} position={[0, 0, z]} scale={[0.8, 0.05, 0.15]}>
                <boxGeometry />
                <meshStandardMaterial color="#3f2e21" />
             </mesh>
        ))}
        {/* Rails */}
        {[-0.2, 0.2].map(x => (
             <mesh key={x} position={[x, 0.05, 0]} scale={[0.05, 0.05, 1]}>
                <boxGeometry />
                <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
             </mesh>
        ))}
    </group>
);

const BridgeMesh = ({ type }: { type: BuildingType }) => (
    <group position={[0, 0.1, 0]}>
        <mesh position={[0, -0.2, 0]} scale={[0.8, 0.1, 1]}>
             <boxGeometry />
             <meshStandardMaterial color={type === BuildingType.Rail ? "#78350f" : "#d97706"} />
        </mesh>
        
        {type === BuildingType.Rail && <RailTracks />}
        {type === BuildingType.Bridge && (
             <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
                 <planeGeometry args={[0.7, 1]} />
                 <meshStandardMaterial color="#374151" roughness={0.9} />
             </mesh>
        )}

        {/* Pillars */}
        <mesh position={[0.3, -0.5, 0.4]} scale={[0.1, 1, 0.1]}><cylinderGeometry /><meshStandardMaterial color="#555" /></mesh>
        <mesh position={[-0.3, -0.5, 0.4]} scale={[0.1, 1, 0.1]}><cylinderGeometry /><meshStandardMaterial color="#555" /></mesh>
        <mesh position={[0.3, -0.5, -0.4]} scale={[0.1, 1, 0.1]}><cylinderGeometry /><meshStandardMaterial color="#555" /></mesh>
        <mesh position={[-0.3, -0.5, -0.4]} scale={[0.1, 1, 0.1]}><cylinderGeometry /><meshStandardMaterial color="#555" /></mesh>
        
        {/* Railings for road bridge */}
        {type === BuildingType.Bridge && (
            <>
                 <mesh position={[0.35, -0.05, 0]} scale={[0.05, 0.2, 1]}><boxGeometry /><meshStandardMaterial color="#b45309" /></mesh>
                 <mesh position={[-0.35, -0.05, 0]} scale={[0.05, 0.2, 1]}><boxGeometry /><meshStandardMaterial color="#b45309" /></mesh>
            </>
        )}
    </group>
)

// Ground Tile: Handles pointer events and forms base terrain
const GroundTile = React.memo(({ tile, grid, onHover, onLeave, onClick, isLandTool }: GroundTileProps) => {
  const { x, y, buildingType, owned, isWater, isRail } = tile;
  const [wx, _, wz] = gridToWorld(x, y);
  
  let color = '#10b981';
  let topY = -0.3; 
  let thickness = 0.5;
  let materialProps: any = { flatShading: true, roughness: 1 };
  
  // Logic for visual style
  if (isWater) {
      color = '#3b82f6';
      topY = -0.4;
      thickness = 0.4;
      materialProps = { roughness: 0.1, metalness: 0.5, opacity: 0.8, transparent: true };
  } else if (!owned) {
      color = '#064e3b'; // Dark green for unowned
      // Add randomness to unowned texture look?
      const noise = getHash(x, y);
      if (noise > 0.5) color = '#065f46';
      topY = -0.3;
  } else if (buildingType === BuildingType.None) {
    const noise = getHash(x, y);
    color = noise > 0.7 ? '#059669' : noise > 0.3 ? '#10b981' : '#34d399';
    topY = -0.3 - noise * 0.1; 
  } else if (buildingType === BuildingType.Road) {
    color = '#374151';
    topY = -0.29; 
  } else if (buildingType === BuildingType.Rail) {
    color = '#57534e';
    topY = -0.28;
  } else {
    color = '#d1d5db'; 
    topY = -0.28;
  }

  // Highlights for Land Tool
  if (isLandTool && !isWater) {
      if (owned) {
          // Can sell? (Only if empty)
          if (buildingType === BuildingType.None) color = '#fecaca'; // Light red tint
      } else {
          // Can buy? (If adjacent to owned)
           const hasOwnedNeighbor = 
                (x > 0 && grid[y][x-1].owned) ||
                (x < GRID_SIZE - 1 && grid[y][x+1].owned) ||
                (y > 0 && grid[y-1][x].owned) ||
                (y < GRID_SIZE - 1 && grid[y+1][x].owned);
            
            if (hasOwnedNeighbor) color = '#a7f3d0'; // Light green tint
      }
  }

  const centerY = topY - thickness/2;

  // Render Bridge if Rail crosses Water or if it is a Bridge
  const isBridge = (isRail && isWater) || buildingType === BuildingType.Bridge;
  
  if (isBridge) {
      return (
          <group position={[wx, 0, wz]}>
               <BridgeMesh type={buildingType === BuildingType.Bridge ? BuildingType.Bridge : BuildingType.Rail} />
               {/* Invisible plane for catching clicks if needed, though bridges are infrastructure */}
               <mesh position={[0,-0.3,0]} visible={false} 
                    onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
                    onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
                    onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onClick(x, y); }}
               >
                  <boxGeometry args={[1, 0.5, 1]} />
               </mesh>
          </group>
      )
  }

  return (
    <group position={[wx, 0, wz]}>
        <mesh 
            position={[0, centerY, 0]} 
            receiveShadow castShadow={!isWater}
            onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
            onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
            onPointerDown={(e) => {
                e.stopPropagation();
                if (e.button === 0) onClick(x, y);
            }}
        >
        <boxGeometry args={[1, thickness, 1]} />
        <meshStandardMaterial color={color} {...materialProps} />
        {buildingType === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={thickness / 2 + 0.001} />}
        </mesh>
        
        {/* Render Rail Tracks (non-bridge) */}
        {(buildingType === BuildingType.Rail || isRail) && !isWater && <RailTracks />}
        
        {/* Unowned land indicator (Tree or rock) */}
        {!owned && !isWater && !isRail && getHash(x,y) > 0.7 && (
            <mesh position={[0, 0, 0]} scale={0.3} castShadow>
                <coneGeometry args={[1, 2, 4]} />
                <meshStandardMaterial color="#064e3b" />
            </mesh>
        )}
    </group>
  );
});

// Selection/Hover Cursor
const Cursor = ({ x, y, color, label }: { x: number, y: number, color: string, label?: string }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <group position={[wx, 0, wz]}>
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
        <Outlines thickness={0.05} color="white" />
      </mesh>
      {label && (
        <group position={[0, 1.5, 0]}>
             <Float speed={5} rotationIntensity={0} floatIntensity={0.2}>
                 <Text
                    fontSize={0.4}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.02}
                    outlineColor="black"
                 >
                     {label}
                 </Text>
             </Float>
        </group>
      )}
    </group>
  );
};


interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  timeOfDay: number;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, timeOfDay }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  // Preview Logic
  const isLandTool = hoveredTool === BuildingType.Land;
  let showPreview = false;
  let previewColor = 'white';
  let cursorLabel = undefined;
  
  if (hoveredTile) {
      const tile = grid[hoveredTile.y][hoveredTile.x];
      
      if (isLandTool) {
          // Logic handled in GroundTile color mostly, but cursor changes here
          if (tile.owned && tile.buildingType === BuildingType.None) {
              previewColor = '#ef4444'; // Sell
              cursorLabel = `Sell $${Math.floor((tile.landPrice || LAND_COST)/2)}`;
          }
          else if (!tile.owned && !tile.isWater && !tile.isRail) {
              previewColor = '#10b981'; // Buy
              cursorLabel = `$${tile.landPrice || LAND_COST}`;
          }
          else previewColor = '#000000'; // Invalid
          showPreview = true; // Use cursor to show valid/invalid
      } else {
          // Building Tools
          if (tile.owned && (tile.buildingType === BuildingType.None || (hoveredTool === BuildingType.Rail && tile.isWater) || (hoveredTool === BuildingType.Bridge && tile.isWater)) && !tile.isRail) {
               showPreview = true;
               previewColor = BUILDINGS[hoveredTool].color;
          }
      }
  }

  const isBulldoze = hoveredTool === BuildingType.None;
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  return (
    <div className="absolute inset-0 touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <OrthographicCamera makeDefault zoom={30} position={[20, 20, 20]} near={-100} far={200} />
        
        <MapControls 
          enableRotate={true}
          enableZoom={true}
          minZoom={15}
          maxZoom={120}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={0.1}
          target={[0,-0.5,0]}
        />

        <EnvironmentEffects timeOfDay={timeOfDay} />

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              // Calculate world position once per tile
              const [wx, _, wz] = gridToWorld(x, y);
              
              return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    tile={tile}
                    grid={grid}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                    isLandTool={isLandTool}
                />
                
                {/* Building visual - apply world position to group to align with ground tile */}
                <group position={[wx, 0, wz]} raycast={() => null}>
                    {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && tile.buildingType !== BuildingType.Rail && tile.buildingType !== BuildingType.Bridge && tile.owned && (
                      <ProceduralBuilding 
                        type={tile.buildingType} 
                        baseColor={BUILDINGS[tile.buildingType].color} 
                        x={x} y={y} 
                      />
                    )}
                </group>
              </React.Fragment>
            )})
          )}

          {/* Visual Elements - disable pointer events */}
          <group raycast={() => null}>
            <TrafficSystem grid={grid} />
            <TrainSystem grid={grid} />
            <PopulationSystem population={population} grid={grid} />

            {/* Placement Preview */}
            {showPreview && hoveredTile && !isLandTool && !isBulldoze && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} 
                    y={hoveredTile.y} 
                    transparent 
                    opacity={0.7} 
                  />
                </Float>
              </group>
            )}

            {/* Highlight */}
            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={isBulldoze ? '#ef4444' : (isLandTool ? previewColor : (showPreview ? '#ffffff' : '#000000'))} 
                label={cursorLabel}
              />
            )}
          </group>
        </group>
        
        <SoftShadows size={10} samples={8} />
      </Canvas>
    </div>
  );
};

export default IsoMap;