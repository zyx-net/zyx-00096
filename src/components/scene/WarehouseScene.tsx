import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import type { Shelf, Slot, Pallet, SlotStatus, PalletStatus } from '@/types';

const SLOT_WIDTH = 1.5;
const SLOT_DEPTH = 1.2;
const SLOT_HEIGHT = 1.8;
const SHELF_THICKNESS = 0.1;

const statusColors: Record<SlotStatus | 'selected', string> = {
  empty: '#4b5563',
  occupied: '#10b981',
  conflict: '#ef4444',
  warning: '#f59e0b',
  selected: '#3b82f6',
};

const palletStatusColors: Record<PalletStatus, string> = {
  normal: '#22c55e',
  damaged: '#f97316',
  expired: '#ec4899',
  unknown: '#8b5cf6',
};

interface SlotMeshProps {
  slot: Slot;
  pallets: Pallet[];
  isSelected: boolean;
  hasConflict: boolean;
  onClick: () => void;
}

function SlotMesh({ slot, pallets, isSelected, hasConflict, onClick }: SlotMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const palletMeshes = useMemo(() => {
    return pallets.filter((p) => p.slotId === slot.id);
  }, [pallets, slot.id]);

  const displayStatus: SlotStatus = hasConflict ? 'conflict' : slot.status;
  const baseColor = isSelected ? statusColors.selected : statusColors[displayStatus];

  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.03;
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[slot.column * SLOT_WIDTH, slot.level * SLOT_HEIGHT, 0]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <boxGeometry args={[SLOT_WIDTH * 0.9, SLOT_HEIGHT * 0.9, SLOT_DEPTH * 0.9]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={isSelected ? 0.9 : 0.6}
          emissive={baseColor}
          emissiveIntensity={isSelected || hasConflict ? 0.3 : 0.1}
        />
      </mesh>

      {palletMeshes.length > 0 &&
        palletMeshes.map((pallet, idx) => {
          const offsetX = (idx - (palletMeshes.length - 1) / 2) * 0.5;
          return (
            <group key={pallet.id} position={[offsetX, -0.2, 0]}>
              <mesh position={[0, 0.15, 0]} castShadow>
                <boxGeometry args={[SLOT_WIDTH * 0.7, 0.3, SLOT_DEPTH * 0.7]} />
                <meshStandardMaterial color={palletStatusColors[pallet.status]} metalness={0.3} roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.5, 0]} castShadow>
                <boxGeometry args={[SLOT_WIDTH * 0.6, 0.4, SLOT_DEPTH * 0.6]} />
                <meshStandardMaterial color="#d4d4d4" metalness={0.2} roughness={0.8} />
              </mesh>
              <Html
                position={[0, 0.9, 0]}
                center
                distanceFactor={8}
                style={{ pointerEvents: 'none' }}
              >
                <div className="text-xs font-mono bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                  {pallet.palletNo.slice(-6)}
                </div>
              </Html>
            </group>
          );
        })}

      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[SLOT_WIDTH, SLOT_HEIGHT, SLOT_DEPTH]} />
          <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

interface ShelfGroupProps {
  shelf: Shelf;
  slots: Slot[];
  pallets: Pallet[];
  selectedSlotId: string | null;
  conflictSlotIds: Set<string>;
  onSlotClick: (slotId: string) => void;
}

function ShelfGroup({ shelf, slots, pallets, selectedSlotId, conflictSlotIds, onSlotClick }: ShelfGroupProps) {
  const shelfSlots = slots.filter((s) => s.shelfId === shelf.id);
  const width = shelf.columns * SLOT_WIDTH;
  const height = shelf.levels * SLOT_HEIGHT;

  return (
    <group position={[shelf.position.x, 0, shelf.position.z]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width + 0.2, height + 0.2, SLOT_DEPTH + 0.3]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, height + 0.05, 0]}>
        <boxGeometry args={[width + 0.2, SHELF_THICKNESS, SLOT_DEPTH + 0.3]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.4} />
      </mesh>

      {shelfSlots.map((slot) => (
        <SlotMesh
          key={slot.id}
          slot={slot}
          pallets={pallets}
          isSelected={selectedSlotId === slot.id}
          hasConflict={conflictSlotIds.has(slot.id)}
          onClick={() => onSlotClick(slot.id)}
        />
      ))}

      <Html position={[width / 2 + 0.5, height + 0.3, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div className="text-sm font-bold text-white bg-slate-700/80 px-2 py-1 rounded whitespace-nowrap">
          {shelf.name}
        </div>
      </Html>
    </group>
  );
}

interface CameraControllerProps {
  onCameraChange?: () => void;
}

function CameraController({ onCameraChange }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { cameraState, setCameraState } = useStore();

  useEffect(() => {
    if (cameraState && controlsRef.current) {
      controlsRef.current.object.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
      controlsRef.current.target.set(cameraState.target.x, cameraState.target.y, cameraState.target.z);
      controlsRef.current.update();
    }
  }, [cameraState]);

  const handleChange = () => {
    if (controlsRef.current) {
      const pos = controlsRef.current.object.position;
      const target = controlsRef.current.target;
      setCameraState({
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: target.x, y: target.y, z: target.z },
      });
    }
    onCameraChange?.();
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={50}
      maxPolarAngle={Math.PI / 2.1}
      onChange={handleChange}
    />
  );
}

export default function WarehouseScene() {
  const { layout, selectedSlotId, setSelectedSlotId, conflicts, getCurrentPallets, filters } = useStore();
  const pallets = getCurrentPallets();

  const conflictSlotIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      if (c.type === 'multi_pallet_slot') {
        const palletList = pallets.filter((p) => c.relatedIds.includes(p.id));
        palletList.forEach((p) => ids.add(p.slotId));
      }
    });
    return ids;
  }, [conflicts, pallets]);

  const filteredSlots = useMemo(() => {
    let slots = [...layout.slots];

    if (filters.shelfFilter !== 'all') {
      slots = slots.filter((s) => s.shelfId === filters.shelfFilter);
    }

    if (filters.statusFilter !== 'all') {
      if (filters.statusFilter === 'conflict') {
        slots = slots.filter((s) => conflictSlotIds.has(s.id));
      } else {
        slots = slots.filter((s) => s.status === filters.statusFilter);
      }
    }

    return slots;
  }, [layout.slots, filters, conflictSlotIds]);

  const handleSlotClick = (slotId: string) => {
    setSelectedSlotId(slotId);
  };

  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 12, 18], fov: 50 }} shadows style={{ background: '#111827' }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow shadow-mapSize={[2048, 2048]} />
        <hemisphereLight args={['#60a5fa', '#1f2937', 0.3]} />

        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#374151"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#4b5563"
          fadeDistance={40}
          fadeStrength={1}
          followCamera={false}
          position={[0, -0.01, 0]}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>

        {layout.shelves.map((shelf) => (
          <ShelfGroup
            key={shelf.id}
            shelf={shelf}
            slots={filteredSlots}
            pallets={pallets}
            selectedSlotId={selectedSlotId}
            conflictSlotIds={conflictSlotIds}
            onSlotClick={handleSlotClick}
          />
        ))}

        <CameraController />
      </Canvas>
    </div>
  );
}
