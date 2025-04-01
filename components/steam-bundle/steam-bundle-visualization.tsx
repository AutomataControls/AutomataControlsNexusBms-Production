"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { Badge } from "@/components/ui/badge"
import { Gauge, Thermometer, Droplets } from "lucide-react"
import * as THREE from "three"

// Update the SteamBundleVisualization props to include the new valves
export interface SteamBundleVisualizationProps {
  controls: {
    // General
    systemEnable?: boolean
    operationMode?: string
    pressureSetpoint?: number
    temperatureSetpoint?: number
    differentialPressureSetpoint?: number

    // Valves for HX-1
    valve13Enable?: boolean
    valve13Position?: number
    valve13Mode?: string
    valve23Enable?: boolean
    valve23Position?: number
    valve23Mode?: string

    // Valves for HX-2
    valve33Enable?: boolean
    valve33Position?: number
    valve33Mode?: string
    valve43Enable?: boolean
    valve43Position?: number
    valve43Mode?: string

    valveControlStrategy?: string

    // Pumps
    pump1Enable?: boolean
    pump1Speed?: number
    pump1Mode?: string
    pump1Status?: string
    pump1IsLead?: boolean
    pump2Enable?: boolean
    pump2Speed?: number
    pump2Mode?: string
    pump2Status?: string
    pumpControlMode?: string
    leadLagAutoChangeover?: boolean

    // Advanced
    differentialPressureLowLimit?: number
    lowFlowAlarm?: boolean
    lowFlowDelay?: number
    pumpFailoverOnLowFlow?: boolean
    pumpRampTime?: number
    valveResponseTime?: number
    autoRestart?: boolean
    restartDelay?: number
    maxRestartAttempts?: number
  }
  sensorData?: {
    temperature: number
    pressure: number
    differentialPressure: number
    flow: number
  }
}

// Metal pipe component with improved appearance
const Pipe = ({ start, end, diameter = 0.15, color = "#888", segments = 20 }) => {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
  ])

  const tubeGeometry = new THREE.TubeGeometry(path, segments, diameter, 12, false)

  return (
    <mesh geometry={tubeGeometry}>
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

// Create a pipe with multiple segments for bends
const BentPipe = ({ points, diameter = 0.15, color = "#888" }) => {
  const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], point[1], point[2])))

  const tubeGeometry = new THREE.TubeGeometry(path, points.length * 5, diameter, 12, false)

  return (
    <mesh geometry={tubeGeometry}>
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
    </mesh>
  )
}

// Steam pipe with animated flow
const SteamPipe = ({ start, end, diameter = 0.2, active = false }) => {
  const tubeRef = useRef()
  const flowRef = useRef(0)

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
  ])

  const tubeGeometry = new THREE.TubeGeometry(path, 20, diameter, 12, false)

  // Create a custom shader material for the steam flow animation
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(active ? "#ff9966" : "#aaaaaa") },
      isActive: { value: active ? 1.0 : 0.0 },
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
      uniform float isActive;
      varying vec2 vUv;
      
      void main() {
        // Create flowing steam effect
        float noise = sin(vUv.x * 20.0 - time * 2.0) * 0.5 + 0.5;
        float intensity = mix(0.6, 1.0, noise * isActive);
        vec3 finalColor = mix(color * 0.7, color, intensity * isActive);
        gl_FragColor = vec4(finalColor, 0.9);
      }
    `,
    transparent: true,
  })

  // Update the flow animation
  useFrame(() => {
    if (tubeRef.current) {
      flowRef.current += 0.01
      tubeRef.current.material.uniforms.time.value = flowRef.current
      tubeRef.current.material.uniforms.color.value = new THREE.Color(active ? "#ff9966" : "#aaaaaa")
      tubeRef.current.material.uniforms.isActive.value = active ? 1.0 : 0.0
    }
  })

  return (
    <>
      <mesh ref={tubeRef} geometry={tubeGeometry} material={flowMaterial} />
      {active && (
        <pointLight
          position={[
            start[0] + (end[0] - start[0]) / 2,
            start[1] + (end[1] - start[1]) / 2,
            start[2] + (end[2] - start[2]) / 2,
          ]}
          color="#ff9966"
          intensity={0.8}
          distance={2}
        />
      )}
    </>
  )
}

// Bent steam pipe with animated flow
const BentSteamPipe = ({ points, diameter = 0.2, active = false }) => {
  const tubeRef = useRef()
  const flowRef = useRef(0)

  const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], point[1], point[2])))

  const tubeGeometry = new THREE.TubeGeometry(path, points.length * 5, diameter, 12, false)

  // Create a custom shader material for the steam flow animation
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(active ? "#ff9966" : "#aaaaaa") },
      isActive: { value: active ? 1.0 : 0.0 },
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
      uniform float isActive;
      varying vec2 vUv;
      
      void main() {
        // Create flowing steam effect
        float noise = sin(vUv.x * 20.0 - time * 2.0) * 0.5 + 0.5;
        float intensity = mix(0.6, 1.0, noise * isActive);
        vec3 finalColor = mix(color * 0.7, color, intensity * isActive);
        gl_FragColor = vec4(finalColor, 0.9);
      }
    `,
    transparent: true,
  })

  // Update the flow animation
  useFrame(() => {
    if (tubeRef.current) {
      flowRef.current += 0.01
      tubeRef.current.material.uniforms.time.value = flowRef.current
      tubeRef.current.material.uniforms.color.value = new THREE.Color(active ? "#ff9966" : "#aaaaaa")
      tubeRef.current.material.uniforms.isActive.value = active ? 1.0 : 0.0
    }
  })

  return (
    <>
      <mesh ref={tubeRef} geometry={tubeGeometry} material={flowMaterial} />
      {active && (
        <pointLight
          position={[
            points[Math.floor(points.length / 2)][0],
            points[Math.floor(points.length / 2)][1],
            points[Math.floor(points.length / 2)][2],
          ]}
          color="#ff9966"
          intensity={0.8}
          distance={2}
        />
      )}
    </>
  )
}

// Water pipe with animated flow
const WaterPipe = ({ start, end, diameter = 0.15, active = false, speed = 0 }) => {
  const tubeRef = useRef()
  const flowRef = useRef(0)

  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
  ])

  const tubeGeometry = new THREE.TubeGeometry(path, 20, diameter, 12, false)

  // Create a custom shader material for the water flow animation
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(active ? "#4287f5" : "#888888") },
      isActive: { value: active ? 1.0 : 0.0 },
      speed: { value: speed / 100 },
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
      uniform float isActive;
      uniform float speed;
      varying vec2 vUv;
      
      void main() {
        // Create flowing water effect with speed control
        float flowSpeed = 3.0 * speed;
        float stripe = sin(vUv.x * 30.0 - time * flowSpeed) * 0.5 + 0.5;
        float intensity = mix(0.6, 1.0, stripe * isActive);
        vec3 finalColor = mix(color * 0.7, color, intensity * isActive);
        gl_FragColor = vec4(finalColor, 0.9);
      }
    `,
    transparent: true,
  })

  // Update the flow animation
  useFrame(() => {
    if (tubeRef.current && active) {
      flowRef.current += 0.01
      tubeRef.current.material.uniforms.time.value = flowRef.current
      tubeRef.current.material.uniforms.speed.value = speed / 100
    }
  })

  return <mesh ref={tubeRef} geometry={tubeGeometry} material={flowMaterial} />
}

// Bent water pipe with animated flow
const BentWaterPipe = ({ points, diameter = 0.15, active = false, speed = 0 }) => {
  const tubeRef = useRef()
  const flowRef = useRef(0)

  const path = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(point[0], point[1], point[2])))

  const tubeGeometry = new THREE.TubeGeometry(path, points.length * 5, diameter, 12, false)

  // Create a custom shader material for the water flow animation
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(active ? "#4287f5" : "#888888") },
      isActive: { value: active ? 1.0 : 0.0 },
      speed: { value: speed / 100 },
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
      uniform float isActive;
      uniform float speed;
      varying vec2 vUv;
      
      void main() {
        // Create flowing water effect with speed control
        float flowSpeed = 3.0 * speed;
        float stripe = sin(vUv.x * 30.0 - time * flowSpeed) * 0.5 + 0.5;
        float intensity = mix(0.6, 1.0, stripe * isActive);
        vec3 finalColor = mix(color * 0.7, color, intensity * isActive);
        gl_FragColor = vec4(finalColor, 0.9);
      }
    `,
    transparent: true,
  })

  // Update the flow animation
  useFrame(() => {
    if (tubeRef.current && active) {
      flowRef.current += 0.01
      tubeRef.current.material.uniforms.time.value = flowRef.current
      tubeRef.current.material.uniforms.speed.value = speed / 100
    }
  })

  return <mesh ref={tubeRef} geometry={tubeGeometry} material={flowMaterial} />
}

// Redesigned valve component for more realism
const Valve = ({ position, rotation = [0, 0, 0], scale = 1, openPercent = 0, active = false }) => {
  const bodyRef = useRef()

  // Calculate valve stem position based on openPercent
  const stemPosition = (openPercent / 100) * 0.2

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Valve body */}
      <mesh ref={bodyRef} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.5, 16]} />
        <meshStandardMaterial color="#dddddd" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Valve flanges */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.3, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.1, 16]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Valve actuator */}
      <mesh position={[0, 0, 0.4]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.3]} />
        <meshStandardMaterial color="#3366cc" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Valve stem */}
      <mesh position={[0, 0, 0.6 + stemPosition]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
        <meshStandardMaterial color="#dddddd" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Valve position indicator */}
      <mesh position={[0, 0, 0.8]} castShadow>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial
          color={active ? "#00ff00" : "#ff0000"}
          emissive={active ? "#00ff00" : "#ff0000"}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  )
}

// Redesigned end suction pump component
const EndSuctionPump = ({
  position,
  rotation = [0, 0, 0],
  scale = 1,
  active = false,
  speed = 0,
  isLead = false,
  status = "stopped",
}) => {
  const impellerRef = useRef()

  // Rotate the impeller when the pump is active
  useFrame(() => {
    if (impellerRef.current && active && status === "running") {
      impellerRef.current.rotation.z += 0.05 * (speed / 100)
    }
  })

  // Determine status color
  const statusColor = status === "running" ? "#00ff00" : status === "fault" ? "#ff0000" : "#888888"

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Pump base */}
      <mesh position={[0, -0.25, 0]} castShadow>
        <boxGeometry args={[1.2, 0.1, 0.8]} />
        <meshStandardMaterial color="#777777" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Pump casing - volute */}
      <mesh position={[0.3, 0, 0]} castShadow>
        <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI]} />
        <meshStandardMaterial color="#4287f5" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pump suction inlet */}
      <mesh position={[0.3, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
        <meshStandardMaterial color="#4287f5" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pump discharge outlet */}
      <mesh position={[0.3, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
        <meshStandardMaterial color="#4287f5" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Motor */}
      <mesh position={[-0.3, 0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.8, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#dddddd" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Motor cooling fins */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`fin-${i}`} position={[-0.3, 0, 0]} rotation={[0, (Math.PI * i) / 4, 0]} castShadow>
          <boxGeometry args={[0.8, 0.05, 0.05]} />
          <meshStandardMaterial color="#cccccc" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Motor end cap */}
      <mesh position={[-0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.25, 0.1, 16]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Shaft */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
        <meshStandardMaterial color="#dddddd" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Impeller (visible through cutaway) */}
      <group position={[0.3, 0, 0]} ref={impellerRef}>
        {Array.from({ length: 6 }).map((_, i) => (
          <mesh key={`blade-${i}`} rotation={[0, (Math.PI * 2 * i) / 6, 0]} castShadow>
            <boxGeometry args={[0.15, 0.05, 0.05]} position={[0.1, 0, 0]} />
            <meshStandardMaterial color="#dddddd" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}
      </group>

      {/* Status indicator */}
      <mesh position={[-0.7, 0.3, 0]} castShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Lead/Lag indicator */}
      {isLead && (
        <mesh position={[-0.7, 0.3, 0.2]} castShadow>
          <boxGeometry args={[0.15, 0.15, 0.05]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  )
}

// Redesigned heat exchanger (steam bundle) component
const SteamBundle = ({ position, rotation = [0, 0, 0], scale = 1, active = false, temperature = 180 }) => {
  // Calculate color based on temperature (blue to red)
  const tempColor = new THREE.Color().setHSL((1 - Math.min(Math.max(temperature - 120, 0) / 130, 1)) * 0.6, 0.8, 0.5)

  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Main shell - horizontal cylinder */}
      <mesh castShadow>
        <cylinderGeometry args={[0.8, 0.8, 4, 24]} />
        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* End caps */}
      <mesh position={[0, 0, 2]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.1, 24]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -2]} castShadow>
        <cylinderGeometry args={[0.8, 0.8, 0.1, 24]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Steam inlet - on top */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Condensate outlet - on bottom */}
      <mesh position={[0, -0.8, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
        <meshStandardMaterial color="#cccccc" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Water inlet - on end */}
      <mesh position={[0, 0, -2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
        <meshStandardMaterial color="#4287f5" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Water outlet - on other end */}
      <mesh position={[0, 0, 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.5, 16]} />
        <meshStandardMaterial color="#4287f5" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Support brackets */}
      <mesh position={[1, -1, 0]} castShadow>
        <boxGeometry args={[0.5, 0.4, 0.8]} />
        <meshStandardMaterial color="#777777" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-1, -1, 0]} castShadow>
        <boxGeometry args={[0.5, 0.4, 0.8]} />
        <meshStandardMaterial color="#777777" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Decorative bands */}
      <mesh position={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.81, 0.05, 16, 24]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#999999" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1, 0, 0]} castShadow>
        <torusGeometry args={[0.81, 0.05, 16, 24]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#999999" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-1, 0, 0]} castShadow>
        <torusGeometry args={[0.81, 0.05, 16, 24]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#999999" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Temperature indicator - keep the light but remove the text */}
      {active && <pointLight position={[0, 0, 0]} color={tempColor} intensity={1.0} distance={3} />}
    </group>
  )
}

// Pressure sensor component
const PressureSensor = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Sensor body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
        <meshStandardMaterial color="#dddddd" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Sensor connection */}
      <mesh position={[0, -0.25, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Sensor display */}
      <mesh position={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.25, 0.2, 0.05]} />
        <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Decorative details */}
      <mesh position={[0, 0, 0.23]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.05, 8]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// Differential pressure sensor component
const DifferentialPressureSensor = ({ position, rotation = [0, 0, 0], scale = 1 }) => {
  return (
    <group position={position} rotation={rotation} scale={[scale, scale, scale]}>
      {/* Sensor body */}
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.3, 0.2]} />
        <meshStandardMaterial color="#dddddd" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* High pressure connection */}
      <mesh position={[-0.25, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Low pressure connection */}
      <mesh position={[0.25, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.3, 8]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#bbbbbb" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Sensor display */}
      <mesh position={[0, 0, 0.15]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial color="#222222" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Decorative details - arrows indicating differential */}
      <mesh position={[-0.1, 0, 0.18]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.02]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.1, 0, 0.18]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.02]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// Update the SceneSetup component to adjust camera position for the new layout
const SceneSetup = () => {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(8, 6, 8)
    camera.lookAt(0, 1.5, 0)
  }, [camera])

  return null
}

// Update the SteamBundleModel component to implement a dual heat exchanger system with proper valve arrangement

// First, let's modify the SteamBundleModel component to include two heat exchangers and four valves
const SteamBundleModel = ({
  controls,
  sensorData = { temperature: 180, pressure: 30, differentialPressure: 5, flow: 100 },
}) => {
  const systemActive = controls.systemEnable || false

  // Valve states
  const valve13Active = systemActive && controls.valve13Enable
  const valve13Position = controls.valve13Position || 0
  const valve23Active = systemActive && controls.valve23Enable
  const valve23Position = controls.valve23Position || 0

  // Adding states for the second set of valves (V-3 and V-4)
  const valve33Active = systemActive && (controls.valve33Enable || false)
  const valve33Position = controls.valve33Position || 0
  const valve43Active = systemActive && (controls.valve43Enable || false)
  const valve43Position = controls.valve43Position || 0

  // Pump states
  const pump1Active = systemActive && controls.pump1Enable
  const pump1Speed = controls.pump1Speed || 0
  const pump1Status = controls.pump1Status || "stopped"
  const pump1IsLead = controls.pump1IsLead || true

  const pump2Active = systemActive && controls.pump2Enable
  const pump2Speed = controls.pump2Speed || 0
  const pump2Status = controls.pump2Status || "stopped"

  // Calculate if steam is flowing based on valve positions
  const steamFlowingHX1 = systemActive && (valve13Position > 0 || valve23Position > 0)
  const steamFlowingHX2 = systemActive && (valve33Position > 0 || valve43Position > 0)

  // Calculate if water is flowing based on pump status
  const waterFlowing =
    systemActive && ((pump1Status === "running" && pump1Speed > 0) || (pump2Status === "running" && pump2Speed > 0))

  // Calculate effective water flow speed based on active pumps
  const waterFlowSpeed = Math.max(
    pump1Status === "running" ? pump1Speed : 0,
    pump2Status === "running" ? pump2Speed : 0,
  )

  // Calculate temperature based on steam flow, water flow, and setpoint
  const actualTemperature = systemActive
    ? (steamFlowingHX1 || steamFlowingHX2) && waterFlowing
      ? controls.temperatureSetpoint || 180
      : 70
    : 70

  // Add text indicators for components
  const TextIndicator = ({ position, text, color = "#000000" }) => {
    return (
      <group position={position}>
        <Html position={[0, 0, 0]} center>
          <div
            style={{
              color: color,
              fontSize: "12px",
              fontWeight: "bold",
              textShadow: "0px 0px 2px white, 0px 0px 4px white",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
        </Html>
      </group>
    )
  }

  return (
    <group>
      {/* Base plate */}
      <mesh position={[0, -0.6, 0]} receiveShadow>
        <boxGeometry args={[12, 0.2, 8]} />
        <meshStandardMaterial color="#dddddd" />
      </mesh>
      {/* Steam Supply Header - above both heat exchangers */}
      <BentSteamPipe
        points={[
          [-6, 3.0, -1], // Left end extended with 90-degree bend
          [-6, 3.0, 0], // Left corner
          [-5, 3.0, 0],
          [5, 3.0, 0],
          [6, 3.0, 0], // Right corner
          [6, 3.0, -1], // Right end extended with 90-degree bend
        ]}
        active={steamFlowingHX1 || steamFlowingHX2}
      />
      {/* Heat Exchanger 1 (HX-1) - left side */}
      <SteamBundle
        position={[-2.5, 0.5, 0]}
        rotation={[0, 0, Math.PI / 2]}
        active={systemActive && steamFlowingHX1 && waterFlowing}
        temperature={actualTemperature}
      />
      {/* Heat Exchanger 2 (HX-2) - right side */}
      <SteamBundle
        position={[2.5, 0.5, 0]}
        rotation={[0, 0, Math.PI / 2]}
        active={systemActive && steamFlowingHX2 && waterFlowing}
        temperature={actualTemperature}
      />
      {/* Steam Supply Pipes to HX-1 */}
      <SteamPipe start={[-2.5, 3.0, 0]} end={[-2.5, 1.3, 0]} active={steamFlowingHX1} />
      {/* Steam Supply Pipes to HX-2 */}
      <SteamPipe start={[2.5, 3.0, 0]} end={[2.5, 1.3, 0]} active={steamFlowingHX2} />
      {/* Condensate Return Pipes */}
      <Pipe start={[-2.5, -0.3, 0]} end={[-2.5, -1.5, 0]} diameter={0.15} color="#aaaaaa" />
      <Pipe start={[2.5, -0.3, 0]} end={[2.5, -1.5, 0]} diameter={0.15} color="#aaaaaa" />
      {/* Valves for HX-1 */}
      {/* V-1 (1/3 valve) for HX-1 */}
      <Valve position={[-3.5, 3.0, 0]} rotation={[0, 0, 0]} openPercent={valve13Position} active={valve13Active} />
      {/* V-2 (2/3 valve) for HX-1 */}
      <Valve position={[-1.5, 3.0, 0]} rotation={[0, 0, 0]} openPercent={valve23Position} active={valve23Active} />
      {/* Valves for HX-2 */}
      {/* V-3 (1/3 valve) for HX-2 */}
      <Valve position={[1.5, 3.0, 0]} rotation={[0, 0, 0]} openPercent={valve33Position} active={valve33Active} />
      {/* V-4 (2/3 valve) for HX-2 */}
      <Valve position={[3.5, 3.0, 0]} rotation={[0, 0, 0]} openPercent={valve43Position} active={valve43Active} />
      {/* Water circuit */}
      {/* Common water supply header */}
      <BentWaterPipe
        points={[
          [-5, -0.3, -2], // From pump area
          [-5, 0.5, -2], // Rise up
          [5, 0.5, -2], // Extend across both heat exchangers
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      {/* Water supply branches to each heat exchanger */}
      <BentWaterPipe
        points={[
          [-2.5, 0.5, -2], // From header
          [-2.5, 0.5, -1], // To HX-1 inlet
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      <BentWaterPipe
        points={[
          [2.5, 0.5, -2], // From header
          [2.5, 0.5, -1], // To HX-2 inlet
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      {/* Water return branches from each heat exchanger */}
      <BentWaterPipe
        points={[
          [-2.5, 0.5, 1], // From HX-1 outlet
          [-2.5, 0.5, 2], // To return header
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      <BentWaterPipe
        points={[
          [2.5, 0.5, 1], // From HX-2 outlet
          [2.5, 0.5, 2], // To return header
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      {/* Common water return header */}
      <BentWaterPipe
        points={[
          [-5, 0.5, 2], // Start of return header
          [5, 0.5, 2], // Extend across both heat exchangers
          [5, -0.3, 2], // Drop down to pump area
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      {/* Building Return Loop - to pump 1 */}
      <BentWaterPipe
        points={[
          [5, -0.3, 2], // From return header
          [5, -0.3, 4], // Extend back
          [-5, -0.3, 4], // Cross to other side
          [-5, -0.3, -2], // To pump inlet
        ]}
        active={waterFlowing}
        speed={waterFlowSpeed}
      />
      {/* Pump 1 - End Suction */}
      <EndSuctionPump
        position={[-5, 0, -2]}
        rotation={[0, Math.PI / 2, 0]}
        active={pump1Active}
        speed={pump1Speed}
        isLead={pump1IsLead}
        status={pump1Status}
      />
      {/* Pump 2 - End Suction */}
      <EndSuctionPump
        position={[-3, 0, -2]}
        rotation={[0, Math.PI / 2, 0]}
        active={pump2Active}
        speed={pump2Speed}
        isLead={!pump1IsLead}
        status={pump2Status}
      />
      {/* Differential Pressure Sensor */}
      <DifferentialPressureSensor position={[0, 0.5, -1.5]} rotation={[0, 0, 0]} />
      {/* Pressure Sensor */}
      <PressureSensor position={[0, 3.5, 0]} rotation={[0, 0, 0]} />
      {/* Temperature Sensors */}
      <PressureSensor position={[-4, 0.5, 2]} rotation={[0, 0, 0]} /> {/* HWS Temperature */}
      <PressureSensor position={[-4, 0.5, -2]} rotation={[0, 0, 0]} /> {/* HWR Temperature */}
      {/* System Status Indicators */}
      {systemActive && <pointLight position={[0, 0, 0]} color="#00ff00" intensity={0.2} distance={10} />}
      {/* Text indicators */}
      <TextIndicator position={[-2.5, 1.0, 0]} text="HX-1" />
      <TextIndicator position={[2.5, 1.0, 0]} text="HX-2" />
      <TextIndicator position={[-3.5, 3.5, 0]} text="V-1 (1/3)" />
      <TextIndicator position={[-1.5, 3.5, 0]} text="V-2 (2/3)" />
      <TextIndicator position={[1.5, 3.5, 0]} text="V-3 (1/3)" />
      <TextIndicator position={[3.5, 3.5, 0]} text="V-4 (2/3)" />
      <TextIndicator position={[-5, 0.7, -2]} text="HWP-1" />
      <TextIndicator position={[-3, 0.7, -2]} text="HWP-2" />
      <TextIndicator position={[0, 3.8, 0]} text="Steam Pressure" />
      <TextIndicator position={[0, 0.8, -1.5]} text="DP Sensor" />
      <TextIndicator position={[-2.5, -0.3, 0]} text="Condensate" />
      <TextIndicator position={[2.5, -0.3, 0]} text="Condensate" />
      <TextIndicator position={[-4, 0.8, -2]} text="HWR" />
      <TextIndicator position={[-4, 0.8, 2]} text="HWS" />
      <TextIndicator position={[0, -0.3, 4]} text="Building Loop" />
    </group>
  )
}

// Update the default props in the SteamBundleVisualization function
export function SteamBundleVisualization({
  controls = {
    systemEnable: false,
    operationMode: "auto",
    pressureSetpoint: 30,
    temperatureSetpoint: 180,
    differentialPressureSetpoint: 5,

    // Valves for HX-1
    valve13Enable: false,
    valve13Position: 0,
    valve13Mode: "auto",
    valve23Enable: false,
    valve23Position: 0,
    valve23Mode: "auto",

    // Valves for HX-2
    valve33Enable: false,
    valve33Position: 0,
    valve33Mode: "auto",
    valve43Enable: false,
    valve43Position: 0,
    valve43Mode: "auto",

    valveControlStrategy: "sequential",

    pump1Enable: false,
    pump1Speed: 0,
    pump1Mode: "auto",
    pump1Status: "stopped",
    pump1IsLead: true,
    pump2Enable: false,
    pump2Speed: 0,
    pump2Mode: "auto",
    pump2Status: "stopped",
    pumpControlMode: "auto",
    leadLagAutoChangeover: true,
  },
  sensorData = {
    temperature: 70,
    pressure: 0,
    differentialPressure: 0,
    flow: 0,
  },
}: SteamBundleVisualizationProps) {
  const [view, setView] = useState<"3d" | "2d">("3d")

  return (
    <div className="w-full h-[800px] bg-white rounded-lg overflow-hidden relative">
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
        <Badge variant="outline" className="flex items-center gap-2 bg-white">
          <Thermometer className="w-4 h-4" />
          {sensorData.temperature}°F
        </Badge>
        <Badge variant="outline" className="flex items-center gap-2 bg-white">
          <Gauge className="w-4 h-4" />
          {sensorData.pressure} PSI
        </Badge>
        <Badge variant="outline" className="flex items-center gap-2 bg-white">
          <Droplets className="w-4 h-4" />
          ΔP: {sensorData.differentialPressure} PSI
        </Badge>
      </div>

      {/* System Status */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <Badge
          variant={controls.systemEnable ? "default" : "outline"}
          className={controls.systemEnable ? "bg-green-500" : "bg-white"}
        >
          System {controls.systemEnable ? "Running" : "Stopped"}
        </Badge>
      </div>

      {view === "3d" ? (
        <Canvas shadows>
          <SceneSetup />
          <ambientLight intensity={1.0} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
          <directionalLight position={[-10, 10, -5]} intensity={1} castShadow />
          <hemisphereLight args={["#ffffff", "#bbdefb", 0.7]} />
          <OrbitControls enableDamping dampingFactor={0.05} />
          <SteamBundleModel controls={controls} sensorData={sensorData} />
        </Canvas>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white">
          <div className="relative w-[80%] h-[80%] border-2 border-gray-300 p-4">
            {/* 2D Schematic View */}
            <div className="w-full h-full flex flex-col items-center justify-center">
              <h3 className="text-lg font-semibold mb-4">Steam Bundle System Schematic</h3>

              {/* Steam Supply */}
              <div className="w-full flex justify-center mb-8">
                <div className="relative h-8 w-3/4 border-t-4 border-red-400">
                  {/* 1/3 Valve */}
                  <div className="absolute left-1/3 -top-8">
                    <div className="h-8 w-4 border-l-4 border-red-400"></div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center -ml-2 ${controls.valve13Enable && controls.systemEnable ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className="text-xs font-bold">{controls.valve13Position}%</span>
                    </div>
                    <div className="text-xs mt-1">1/3 Valve</div>
                  </div>

                  {/* 2/3 Valve */}
                  <div className="absolute right-1/3 -top-8">
                    <div className="h-8 w-4 border-l-4 border-red-400"></div>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center -ml-2 ${controls.valve23Enable && controls.systemEnable ? "bg-green-500" : "bg-gray-300"}`}
                    >
                      <span className="text-xs font-bold">{controls.valve23Position}%</span>
                    </div>
                    <div className="text-xs mt-1">2/3 Valve</div>
                  </div>
                </div>
              </div>

              {/* Heat Exchanger */}
              <div
                className={`w-1/2 h-16 border-4 rounded-lg flex items-center justify-center ${controls.systemEnable ? "bg-orange-100" : "bg-gray-100"}`}
              >
                <span className="font-semibold">Steam Bundle {sensorData.temperature}°F</span>
              </div>

              {/* Water Pipes */}
              <div className="w-full flex justify-between mt-8">
                <div className="flex flex-col items-center">
                  {/* Pump 1 */}
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${controls.pump1Status === "running" ? "bg-blue-500" : controls.pump1Status === "fault" ? "bg-red-500" : "bg-gray-300"}`}
                  >
                    <span className="text-xs font-bold text-white">{controls.pump1IsLead ? "Lead" : "Lag"}</span>
                  </div>
                  <div className="text-xs mt-1">Pump 1 {controls.pump1Speed}%</div>
                </div>

                {/* Differential Pressure */}
                <div className="flex flex-col items-center">
                  <div className="w-24 h-8 border-2 rounded flex items-center justify-center bg-gray-100">
                    <span className="text-xs">ΔP: {sensorData.differentialPressure} PSI</span>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  {/* Pump 2 */}
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${controls.pump2Status === "running" ? "bg-blue-500" : controls.pump2Status === "fault" ? "bg-red-500" : "bg-gray-300"}`}
                  >
                    <span className="text-xs font-bold text-white">{!controls.pump1IsLead ? "Lead" : "Lag"}</span>
                  </div>
                  <div className="text-xs mt-1">Pump 2 {controls.pump2Speed}%</div>
                </div>
              </div>

              {/* Building Loop */}
              <div className="w-3/4 h-8 border-b-4 border-blue-400 mt-8">
                <div className="text-center -mb-4">Building Loop</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

