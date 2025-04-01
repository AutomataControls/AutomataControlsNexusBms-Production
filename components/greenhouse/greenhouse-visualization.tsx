"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { cn } from "@/lib/utils"
import { FanIcon, Flame, Thermometer, Droplets, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import * as THREE from "three"

export interface GreenhouseVisualizationProps {
  controls: {
    // Ventilation
    ridgeVentEnable?: boolean
    ridgeVentPosition?: number // 0-100%
    sideVentEnable?: boolean
    sideVentPosition?: number // 0-100%
    exhaustFan1Enable?: boolean
    exhaustFan1Speed?: number // 0-100%
    exhaustFan2Enable?: boolean
    exhaustFan2Speed?: number // 0-100%
    supplyFanEnable?: boolean
    supplyFanSpeed?: number // 0-100%

    // Heating
    hangingHeater1Enable?: boolean
    hangingHeater2Enable?: boolean
    hangingHeater3Enable?: boolean
    hangingHeater4Enable?: boolean
    floorHeater1Enable?: boolean
    floorHeater2Enable?: boolean
  }
  sensorData: {
    temperature: { avg: number; values: number[] }
    humidity: { avg: number; values: number[] }
    uvIndex: number
  }
}

const GlassPanel = ({ position, rotation = [0, 0, 0], scale, opacity = 0.3 }) => {
  return (
    <mesh position={position} rotation={rotation} scale={scale}>
      <boxGeometry args={[1, 1, 0.05]} />
      <meshPhysicalMaterial
        transparent
        opacity={opacity}
        roughness={0}
        metalness={0.2}
        transmission={0.9}
        color="#a8c5ff"
      />
    </mesh>
  )
}

const MetalFrame = ({ position, rotation = [0, 0, 0], scale }) => {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4a5568" metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

const GrowTable = ({ position, rotation = [0, 0, 0], plantHeight = 0.3 }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Table surface */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[2, 0.1, 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Table legs */}
      <mesh position={[-0.9, 0.4, -0.4]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.9, 0.4, -0.4]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[-0.9, 0.4, 0.4]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0.9, 0.4, 0.4]} castShadow>
        <boxGeometry args={[0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Plants */}
      <mesh position={[-0.6, 0.8 + plantHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.1, plantHeight, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      <mesh position={[0, 0.8 + plantHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.1, plantHeight, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      <mesh position={[0.6, 0.8 + plantHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.1, plantHeight, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  )
}

// Enhance the WaterCoil component to make it more visible
const WaterCoil = ({ start, end, height, active }) => {
  const tubeRef = useRef()
  const flowRef = useRef(0)

  // Create a curved path for the pipe
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(start[0], height, start[1]),
    new THREE.Vector3(end[0], height, end[1]),
  ])

  // Create a tube geometry along the path - increase radius from 0.1 to 0.15 for visibility
  const tubeGeometry = new THREE.TubeGeometry(path, 20, 0.15, 12, false)

  // Create a custom shader material for the water flow animation with enhanced visibility
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(active ? "#ff5500" : "#888888") },
      isActive: { value: active ? 1.0 : 0.0 }, // Renamed from 'active' to 'isActive'
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      uniform float isActive; // Renamed from 'active' to 'isActive'
      varying vec2 vUv;
      
      void main() {
        // Create flowing stripes when active with enhanced contrast
        float stripe = sin(vUv.x * 50.0 - time * 5.0) * 0.5 + 0.5;
        float intensity = mix(0.6, 1.0, stripe * isActive); // Changed here too
        vec3 finalColor = mix(color * 0.7, color, intensity * isActive); // And here
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: true,
  })

  // Update the flow animation
  useFrame((state) => {
    if (tubeRef.current) {
      flowRef.current += 0.01
      tubeRef.current.material.uniforms.time.value = flowRef.current
      tubeRef.current.material.uniforms.color.value = new THREE.Color(active ? "#ff5500" : "#888888")
      tubeRef.current.material.uniforms.isActive.value = active ? 1.0 : 0.0 // Changed here too
    }
  })

  return (
    <>
      <mesh ref={tubeRef} geometry={tubeGeometry} material={flowMaterial} />
      {active && (
        <pointLight
          position={[start[0] + (end[0] - start[0]) / 2, height, start[1] + (end[1] - start[1]) / 2]}
          color="#ff3300"
          intensity={0.5}
          distance={2}
        />
      )}
    </>
  )
}

// Update the HangingHeater component to be more accurate and support rotation
const HangingHeater = ({ position, rotation = [0, 0, 0], enabled }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Main heater housing */}
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.8, 0.4]} />
        <meshStandardMaterial color="#4a5568" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Red top exhaust */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial color="#e53e3e" />
      </mesh>

      {/* Front grille with louvers/fins */}
      <group position={[0, 0, 0.21]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`louver-${i}`} position={[0, 0.25 - i * 0.1, 0]} castShadow>
            <boxGeometry args={[1.1, 0.08, 0.02]} />
            <meshStandardMaterial
              color="#e2e8f0"
              emissive={enabled ? "#ff4500" : "#000000"}
              emissiveIntensity={enabled ? 0.2 : 0}
            />
          </mesh>
        ))}
      </group>

      {/* Fan grille on side */}
      <mesh position={[-0.61, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.05, 16]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>

      {/* Fan blades (visible when active) */}
      {enabled && (
        <mesh position={[-0.64, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 8]} />
          <meshStandardMaterial color="#a0aec0" />
        </mesh>
      )}

      {/* Brand label */}
      <mesh position={[0, -0.35, 0.21]} castShadow>
        <boxGeometry args={[0.4, 0.08, 0.01]} />
        <meshStandardMaterial color="#e53e3e" />
      </mesh>

      {/* Mounting bracket */}
      <mesh position={[0, 0.5, -0.1]} castShadow>
        <boxGeometry args={[0.8, 0.1, 0.2]} />
        <meshStandardMaterial color="#2d3748" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Heat effect */}
      {enabled && <pointLight position={[0, -0.2, 0.5]} color="#ff4500" intensity={0.8} distance={4} />}
    </group>
  )
}

// Enhanced Fan component with detailed design
const Fan3D = ({ position, rotation, active, speed, label, color }) => {
  const fanRef = useRef()
  const bladeRef = useRef()

  useFrame(() => {
    if (active && bladeRef.current) {
      bladeRef.current.rotation.z += 0.05 * (speed / 100)
    }
  })

  return (
    <group position={position} rotation={rotation} ref={fanRef}>
      {/* Fan housing - outer ring */}
      <mesh castShadow>
        <torusGeometry args={[0.5, 0.1, 16, 32]} />
        <meshStandardMaterial color="#555" />
      </mesh>

      {/* Fan housing - back plate */}
      <mesh position={[0, 0, -0.05]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
        <meshStandardMaterial color="#444" />
      </mesh>

      {/* Fan center hub */}
      <mesh position={[0, 0, 0.05]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.15, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* Fan blades */}
      <mesh position={[0, 0, 0.1]} ref={bladeRef}>
        <group>
          {[0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3].map((angle, i) => (
            <mesh
              key={`blade-${i}`}
              position={[Math.sin(angle) * 0.3, Math.cos(angle) * 0.3, 0]}
              rotation={[0, 0, angle]}
            >
              <boxGeometry args={[0.1, 0.35, 0.02]} />
              <meshStandardMaterial color={active ? color : "#888"} />
            </mesh>
          ))}
        </group>
      </mesh>

      {/* Fan grill */}
      <mesh position={[0, 0, 0.15]} castShadow>
        <group>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={`grill-${i}`} rotation={[0, 0, (Math.PI * i) / 4]}>
              <boxGeometry args={[1.05, 0.05, 0.02]} />
              <meshStandardMaterial color="#666" />
            </mesh>
          ))}
        </group>
      </mesh>
    </group>
  )
}

// Add a new component for fan shutters/dampers
const FanShutter = ({ position, rotation = [0, 0, 0], isOpen }) => {
  // Calculate the opening angle based on whether the shutter is open
  const openAngle = isOpen ? Math.PI / 4 : 0

  return (
    <group position={position} rotation={rotation}>
      {/* Shutter frame */}
      <mesh castShadow>
        <boxGeometry args={[0.8, 0.8, 0.05]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>

      {/* Shutter blades - these rotate when open */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`blade-${i}`} position={[0, 0.3 - i * 0.15, 0.03]} rotation={[openAngle, 0, 0]} castShadow>
          <boxGeometry args={[0.7, 0.12, 0.02]} />
          <meshStandardMaterial color="#a0aec0" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// Add a new component for wall-mounted grow boxes
const WallMountedGrowBox = ({ position, rotation = [0, 0, 0], length, active = true }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Main structure - shelf */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.1, 0.6]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Back panel */}
      <mesh position={[0, 0.2, -0.3]} castShadow>
        <boxGeometry args={[length, 0.5, 0.05]} />
        <meshStandardMaterial color="#a0522d" />
      </mesh>

      {/* Support brackets - placed every 1 unit */}
      {Array.from({ length: Math.floor(length) + 1 }).map((_, i) => (
        <mesh key={`bracket-${i}`} position={[length / 2 - i, 0, 0]} castShadow>
          <boxGeometry args={[0.05, 0.3, 0.6]} />
          <meshStandardMaterial color="#5d4037" />
        </mesh>
      ))}

      {/* Plants - placed every 0.5 units */}
      {Array.from({ length: Math.floor(length * 2) }).map((_, i) => (
        <group key={`plant-${i}`} position={[length / 2 - 0.25 - i * 0.5, 0.15, 0]}>
          {/* Plant pot */}
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.1, 0.2, 8]} />
            <meshStandardMaterial color="#795548" />
          </mesh>

          {/* Plant */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry args={[0.2, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#2e7d32" />
          </mesh>

          {/* Stem */}
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
            <meshStandardMaterial color="#33691e" />
          </mesh>
        </group>
      ))}

      {/* Grow lights - placed every 1 unit */}
      {active &&
        Array.from({ length: Math.floor(length) }).map((_, i) => (
          <group key={`light-${i}`} position={[length / 2 - 0.5 - i, 0.4, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.8, 0.05, 0.1]} />
              <meshStandardMaterial color="#424242" />
            </mesh>
            <pointLight position={[0, -0.1, 0]} color="#ff9800" intensity={0.3} distance={1.5} />
          </group>
        ))}
    </group>
  )
}

// Replace the existing RidgeVent component with this updated version
const RidgeVent = ({ position, open }) => {
  // Calculate how far the roof should open outward
  const openDistance = open * 0.8 // Max open distance is 0.8 units

  return (
    <group position={position}>
      {/* No sliding panel anymore, as the entire roof will move in the GreenhouseModel */}
    </group>
  )
}

const SideVent = ({ position, open }) => {
  const tiltAngle = (open * Math.PI) / 4 // Max tilt is 45 degrees

  return (
    <group position={position}>
      <GlassPanel position={[0, 0, 0]} rotation={[tiltAngle, 0, 0]} scale={[2, 3, 1]} />
    </group>
  )
}

// Replace the existing SensorUnit component with this enhanced version that supports different sensor types
const SensorUnit = ({ position, rotation = [0, 0, 0], type = "temp" }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Sensor housing */}
      <mesh castShadow>
        <boxGeometry args={[0.25, 0.3, 0.15]} />
        <meshStandardMaterial color="#2d3748" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Sensor face with different colors based on type */}
      <mesh position={[0, 0, 0.08]} castShadow>
        <boxGeometry args={[0.2, 0.25, 0.02]} />
        <meshStandardMaterial
          color={type === "uv" ? "#9c27b0" : "#2196f3"}
          emissive={type === "uv" ? "#9c27b0" : "#2196f3"}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Sensor elements */}
      {type === "uv" ? (
        // UV sensor elements - grid pattern
        <group position={[0, 0, 0.09]}>
          {Array.from({ length: 3 }).map((_, i) =>
            Array.from({ length: 3 }).map((_, j) => (
              <mesh key={`uv-element-${i}-${j}`} position={[(i - 1) * 0.05, (j - 1) * 0.05, 0]} castShadow>
                <boxGeometry args={[0.03, 0.03, 0.01]} />
                <meshStandardMaterial color="#e91e63" />
              </mesh>
            )),
          )}
        </group>
      ) : (
        // Temp/humidity sensor elements - vents and indicator
        <group position={[0, 0, 0.09]}>
          {/* Ventilation slits */}
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={`vent-${i}`} position={[0, 0.08 - i * 0.05, 0]} castShadow>
              <boxGeometry args={[0.15, 0.02, 0.01]} />
              <meshStandardMaterial color="#90caf9" />
            </mesh>
          ))}
          {/* Status LED */}
          <mesh position={[0, -0.09, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.02, 8]} />
            <meshStandardMaterial color="#4caf50" emissive="#4caf50" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}

      {/* Mounting bracket */}
      <mesh position={[0, 0, -0.09]} castShadow>
        <boxGeometry args={[0.15, 0.2, 0.02]} />
        <meshStandardMaterial color="#455a64" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Connection cable */}
      <mesh position={[0, -0.2, -0.05]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
    </group>
  )
}

const SceneSetup = () => {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(15, 10, 15)
    camera.lookAt(0, 0, 0)
  }, [camera])

  return null
}

// Update the GreenhouseModel component to include the new elements
const GreenhouseModel = ({ controls }) => {
  const ridgeVentPos = (controls.ridgeVentPosition || 0) / 100
  const sideVentPos = (controls.sideVentPosition || 0) / 100

  // Determine if water coils should be active (when either floor heater is on)
  const waterCoilsActive = controls.floorHeater1Enable || controls.floorHeater2Enable

  return (
    <group>
      {/* Foundation */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[12, 0.2, 8]} />
        <meshStandardMaterial color="#718096" />
      </mesh>

      {/* Frame Structure */}
      <MetalFrame position={[-6, 2, -4]} scale={[0.1, 4, 0.1]} />
      <MetalFrame position={[-6, 2, 4]} scale={[0.1, 4, 0.1]} />
      <MetalFrame position={[6, 2, -4]} scale={[0.1, 4, 0.1]} />
      <MetalFrame position={[6, 2, 4]} scale={[0.1, 4, 0.1]} />
      <MetalFrame position={[0, 4, 0]} scale={[12, 0.1, 0.1]} />

      {/* Ridge Vents - now the roof splits from the center */}
      <RidgeVent position={[0, 4, 0]} open={controls.ridgeVentEnable ? ridgeVentPos : 0} />

      {/* Side Vents - Added more panels along the length */}
      <SideVent position={[-4, 2, -4]} open={controls.sideVentEnable ? sideVentPos : 0} />
      <SideVent position={[0, 2, -4]} open={controls.sideVentEnable ? sideVentPos : 0} />
      <SideVent position={[4, 2, -4]} open={controls.sideVentEnable ? sideVentPos : 0} />

      <SideVent position={[-4, 2, 4]} open={controls.sideVentEnable ? sideVentPos : 0} />
      <SideVent position={[0, 2, 4]} open={controls.sideVentEnable ? sideVentPos : 0} />
      <SideVent position={[4, 2, 4]} open={controls.sideVentEnable ? sideVentPos : 0} />

      {/* Glass Panels */}
      <GlassPanel position={[0, 2, -4]} scale={[12, 4, 1]} />
      <GlassPanel position={[0, 2, 4]} scale={[12, 4, 1]} />
      <GlassPanel position={[-6, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
      <GlassPanel position={[6, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
      {/* Roof panels that split from the center */}
      <GlassPanel
        position={[-3 - (controls.ridgeVentEnable ? ridgeVentPos * 1.5 : 0), 4, 0]}
        rotation={[Math.PI / 2, 0, controls.ridgeVentEnable ? ridgeVentPos * 0.2 : 0]}
        scale={[6, 8, 1]}
      />
      <GlassPanel
        position={[3 + (controls.ridgeVentEnable ? ridgeVentPos * 1.5 : 0), 4, 0]}
        rotation={[Math.PI / 2, 0, controls.ridgeVentEnable ? -ridgeVentPos * 0.2 : 0]}
        scale={[6, 8, 1]}
      />

      {/* Wall-mounted Grow Boxes - added to end walls */}
      <WallMountedGrowBox position={[-5.9, 1.2, 0]} rotation={[0, Math.PI / 2, 0]} length={7} active={true} />

      <WallMountedGrowBox position={[5.9, 1.2, 0]} rotation={[0, -Math.PI / 2, 0]} length={7} active={true} />

      {/* Water Coils - enhanced for visibility */}
      {/* Front wall - multiple rows with different heights */}
      <WaterCoil start={[-5.8, -3.9]} end={[5.8, -3.9]} height={0.3} active={waterCoilsActive} />
      <WaterCoil start={[-5.8, -3.9]} end={[5.8, -3.9]} height={0.6} active={waterCoilsActive} />
      <WaterCoil start={[-5.8, -3.9]} end={[5.8, -3.9]} height={0.9} active={waterCoilsActive} />

      {/* Back wall */}
      <WaterCoil start={[-5.8, 3.9]} end={[5.8, 3.9]} height={0.3} active={waterCoilsActive} />
      <WaterCoil start={[-5.8, 3.9]} end={[5.8, 3.9]} height={0.6} active={waterCoilsActive} />
      <WaterCoil start={[-5.8, 3.9]} end={[5.8, 3.9]} height={0.9} active={waterCoilsActive} />

      {/* Left wall */}
      <WaterCoil start={[-5.9, -3.8]} end={[-5.9, 3.8]} height={0.3} active={waterCoilsActive} />
      <WaterCoil start={[-5.9, -3.8]} end={[-5.9, 3.8]} height={0.6} active={waterCoilsActive} />
      <WaterCoil start={[-5.9, -3.8]} end={[-5.9, 3.8]} height={0.9} active={waterCoilsActive} />

      {/* Right wall */}
      <WaterCoil start={[5.9, -3.8]} end={[5.9, 3.8]} height={0.3} active={waterCoilsActive} />
      <WaterCoil start={[5.9, -3.8]} end={[5.9, 3.8]} height={0.6} active={waterCoilsActive} />
      <WaterCoil start={[5.9, -3.8]} end={[5.9, 3.8]} height={0.9} active={waterCoilsActive} />

      {/* Grow Tables - rotated 3 of them 90 degrees */}
      <GrowTable position={[-3, 0, -2]} rotation={[0, Math.PI / 2, 0]} plantHeight={0.2} />
      <GrowTable position={[0, 0, -2]} rotation={[0, Math.PI / 2, 0]} plantHeight={0.4} />
      <GrowTable position={[3, 0, -2]} rotation={[0, Math.PI / 2, 0]} plantHeight={0.6} />
      <GrowTable position={[-3, 0, 2]} plantHeight={0.3} />
      <GrowTable position={[0, 0, 2]} plantHeight={0.5} />
      <GrowTable position={[3, 0, 2]} plantHeight={0.2} />

      {/* Hanging Heaters - positioned in corners, pointing toward center */}
      <HangingHeater position={[-5, 3, -3]} rotation={[0, Math.PI / 4, 0]} enabled={controls.hangingHeater1Enable} />
      <HangingHeater position={[5, 3, -3]} rotation={[0, -Math.PI / 4, 0]} enabled={controls.hangingHeater2Enable} />
      <HangingHeater
        position={[-5, 3, 3]}
        rotation={[0, (3 * Math.PI) / 4, 0]}
        enabled={controls.hangingHeater3Enable}
      />
      <HangingHeater
        position={[5, 3, 3]}
        rotation={[0, (-3 * Math.PI) / 4, 0]}
        enabled={controls.hangingHeater4Enable}
      />

      {/* Fans - using our enhanced Fan3D component - moved up more */}
      <Fan3D
        position={[5.8, 2.7, -2]}
        rotation={[0, -Math.PI / 2, 0]}
        active={controls.exhaustFan1Enable}
        speed={controls.exhaustFan1Speed || 50}
        label="Exhaust 1"
        color="#f00"
      />
      <Fan3D
        position={[5.8, 2.7, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        active={controls.exhaustFan2Enable}
        speed={controls.exhaustFan2Speed || 50}
        label="Exhaust 2"
        color="#f00"
      />

      {/* Supply fan with shutters on each side - moved up more */}
      <FanShutter position={[-5.8, 2.7, -1.2]} rotation={[0, Math.PI / 2, 0]} isOpen={controls.supplyFanEnable} />
      <Fan3D
        position={[-5.8, 2.7, 0]}
        rotation={[0, Math.PI / 2, 0]}
        active={controls.supplyFanEnable}
        speed={controls.supplyFanSpeed || 50}
        label="Supply"
        color="#0080ff"
      />
      <FanShutter position={[-5.8, 2.7, 1.2]} rotation={[0, Math.PI / 2, 0]} isOpen={controls.supplyFanEnable} />

      {/* Temperature/Humidity Sensors - one on each side wall between windows */}
      <SensorUnit position={[-3, 2, -3.9]} rotation={[0, 0, 0]} type="temp" />
      <SensorUnit position={[3, 2, 3.9]} rotation={[0, Math.PI, 0]} type="temp" />

      {/* UV Sensor - enhanced and rotated to face downward toward the floor */}
      <SensorUnit position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]} type="uv" />

      {/* Floor Heaters */}
      {controls.floorHeater1Enable && (
        <pointLight position={[-3, 0.2, 0]} color="#ff4500" intensity={0.8} distance={3} />
      )}
      {controls.floorHeater2Enable && (
        <pointLight position={[3, 0.2, 0]} color="#ff4500" intensity={0.8} distance={3} />
      )}
    </group>
  )
}

export function GreenhouseVisualization({
  controls = {
    ridgeVentEnable: false,
    ridgeVentPosition: 0,
    sideVentEnable: false,
    sideVentPosition: 0,
    exhaustFan1Enable: false,
    exhaustFan1Speed: 0,
    exhaustFan2Enable: false,
    exhaustFan2Speed: 0,
    supplyFanEnable: false,
    supplyFanSpeed: 0,
    hangingHeater1Enable: false,
    hangingHeater2Enable: false,
    hangingHeater3Enable: false,
    hangingHeater4Enable: false,
    floorHeater1Enable: false,
    floorHeater2Enable: false,
  },
  sensorData = {
    temperature: { avg: 22, values: [21, 22, 23, 22, 21] },
    humidity: { avg: 65, values: [64, 65, 66, 65, 64] },
    uvIndex: 3,
  },
}: GreenhouseVisualizationProps) {
  const [view, setView] = useState<"3d" | "2d">("3d")

  return (
    <div className="w-full h-[800px] bg-background rounded-lg overflow-hidden relative">
      {/* View Toggle */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Badge variant={view === "3d" ? "default" : "outline"} className="cursor-pointer" onClick={() => setView("3d")}>
          3D View
        </Badge>
        <Badge variant={view === "2d" ? "default" : "outline"} className="cursor-pointer" onClick={() => setView("2d")}>
          2D View
        </Badge>
      </div>

      {/* Sensor Data */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Badge variant="outline" className="flex items-center gap-2">
          <Thermometer className="w-4 h-4" />
          {sensorData.temperature.avg}°C
        </Badge>
        <Badge variant="outline" className="flex items-center gap-2">
          <Droplets className="w-4 h-4" />
          {sensorData.humidity.avg}%
        </Badge>
        <Badge variant="outline" className="flex items-center gap-2">
          <Sun className="w-4 h-4" />
          UV: {sensorData.uvIndex}
        </Badge>
      </div>

      {view === "3d" ? (
        <Canvas shadows>
          <SceneSetup />
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <OrbitControls enableDamping dampingFactor={0.05} />
          <GreenhouseModel controls={controls} />
        </Canvas>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="relative w-[80%] h-[80%] border-2 border-gray-300">
            {/* 2D Greenhouse Representation */}
            <div
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 w-20 h-8 bg-blue-200/30 border border-blue-300 transition-transform",
                controls.ridgeVentEnable && `translate-x-[${controls.ridgeVentPosition}%]`,
              )}
            />

            {/* Side Vents */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 left-0 w-8 h-20 bg-blue-200/30 border border-blue-300 transition-transform origin-top",
                controls.sideVentEnable && `-rotate-[${controls.sideVentPosition * 0.45}deg]`,
              )}
            />
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 right-0 w-8 h-20 bg-blue-200/30 border border-blue-300 transition-transform origin-top",
                controls.sideVentEnable && `rotate-[${controls.sideVentPosition * 0.45}deg]`,
              )}
            />

            {/* Water Coils */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none">
              {/* Horizontal water coils along the bottom of walls */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent",
                  (controls.floorHeater1Enable || controls.floorHeater2Enable) && "animate-pulse",
                )}
              ></div>
              <div
                className={cn(
                  "absolute bottom-4 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent",
                  (controls.floorHeater1Enable || controls.floorHeater2Enable) && "animate-pulse",
                )}
              ></div>
              <div
                className={cn(
                  "absolute bottom-8 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-500 to-transparent",
                  (controls.floorHeater1Enable || controls.floorHeater2Enable) && "animate-pulse",
                )}
              ></div>

              {/* Vertical water coils along the sides */}
              <div
                className={cn(
                  "absolute bottom-0 left-0 top-0 w-2 bg-gradient-to-t from-transparent via-red-500 to-transparent",
                  (controls.floorHeater1Enable || controls.floorHeater2Enable) && "animate-pulse",
                )}
              ></div>
              <div
                className={cn(
                  "absolute bottom-0 right-0 top-0 w-2 bg-gradient-to-t from-transparent via-red-500 to-transparent",
                  (controls.floorHeater1Enable || controls.floorHeater2Enable) && "animate-pulse",
                )}
              ></div>
            </div>

            {/* Fans */}
            {[
              { enabled: controls.exhaustFan1Enable, speed: controls.exhaustFan1Speed },
              { enabled: controls.exhaustFan2Enable, speed: controls.exhaustFan2Speed },
            ].map((fan, i) => (
              <div key={i} className={cn("absolute right-8 p-2", i === 0 ? "top-1/3" : "top-2/3")}>
                <FanIcon
                  className={cn("w-6 h-6 text-gray-400", fan.enabled && "text-blue-500")}
                  style={{
                    animation: fan.enabled ? "spin 1s linear infinite" : "none",
                    animationDuration: fan.enabled ? `${1 / (fan.speed / 100)}s` : "0s",
                  }}
                />
                {fan.enabled && (
                  <span className="absolute -right-12 top-2 text-xs bg-blue-100 px-1 rounded">{fan.speed}%</span>
                )}
              </div>
            ))}

            {/* Supply Fan */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 p-2">
              <FanIcon
                className={cn("w-6 h-6 text-gray-400", controls.supplyFanEnable && "text-blue-500")}
                style={{
                  animation: controls.supplyFanEnable ? "spin 1s linear infinite" : "none",
                  animationDuration: controls.supplyFanEnable ? `${1 / (controls.supplyFanSpeed / 100)}s` : "0s",
                }}
              />
              {controls.supplyFanEnable && (
                <span className="absolute -left-12 top-2 text-xs bg-blue-100 px-1 rounded">
                  {controls.supplyFanSpeed}%
                </span>
              )}
            </div>

            {/* Heaters */}
            {[
              controls.hangingHeater1Enable,
              controls.hangingHeater2Enable,
              controls.hangingHeater3Enable,
              controls.hangingHeater4Enable,
            ].map((enabled, i) => (
              <div
                key={i}
                className={cn("absolute p-2", i % 2 === 0 ? "left-1/4" : "right-1/4", i < 2 ? "top-1/4" : "bottom-1/4")}
              >
                <Flame className={cn("w-6 h-6 text-gray-400", enabled && "text-orange-500")} />
              </div>
            ))}

            {/* Grow Tables */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/2 grid grid-cols-3 grid-rows-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-green-100 border border-green-300 rounded-sm" />
              ))}
            </div>

            {/* Sensors */}
            <div className="absolute left-12 top-1/3 p-2">
              <Thermometer className="w-4 h-4 text-gray-600" />
            </div>
            <div className="absolute left-12 bottom-1/3 p-2">
              <Droplets className="w-4 h-4 text-gray-600" />
            </div>
            <div className="absolute right-12 top-1/3 p-2">
              <Thermometer className="w-4 h-4 text-gray-600" />
            </div>
            <div className="absolute right-12 bottom-1/3 p-2">
              <Droplets className="w-4 h-4 text-gray-600" />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2">
              <Sun className="w-4 h-4 text-yellow-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

