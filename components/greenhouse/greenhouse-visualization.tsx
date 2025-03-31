"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Thermometer, Droplets, Sun, Fan, Flame } from "lucide-react"
import * as THREE from "three"

interface GreenhouseVisualizationProps {
  controls: any
  sensorData: any
}

export function GreenhouseVisualization({ controls, sensorData }: GreenhouseVisualizationProps) {
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d")

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Greenhouse Visualization</CardTitle>
          <div className="flex space-x-2">
            <Button variant={viewMode === "3d" ? "default" : "outline"} size="sm" onClick={() => setViewMode("3d")}>
              3D View
            </Button>
            <Button variant={viewMode === "2d" ? "default" : "outline"} size="sm" onClick={() => setViewMode("2d")}>
              2D View
            </Button>
          </div>
        </div>
        <CardDescription>Interactive visualization of greenhouse systems</CardDescription>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden rounded-b-lg">
        <div className="w-full h-[500px] bg-black/5">
          {viewMode === "3d" ? (
            <Canvas shadows camera={{ position: [0, 5, 10], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <directionalLight
                position={[10, 10, 5]}
                intensity={1}
                castShadow
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
              />
              <GreenhouseModel controls={controls} sensorData={sensorData} />
              <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={5} maxDistance={20} />
            </Canvas>
          ) : (
            <Greenhouse2D controls={controls} sensorData={sensorData} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function GreenhouseModel({ controls, sensorData }: { controls: any; sensorData: any }) {
  const group = useRef<THREE.Group>(null)
  const { camera } = useThree()

  // Animation states
  const [roofOpenAmount, setRoofOpenAmount] = useState(0)
  const [sideVentOpenAmount, setSideVentOpenAmount] = useState(0)
  const [fan1Speed, setFan1Speed] = useState(0)
  const [fan2Speed, setFan2Speed] = useState(0)
  const [supplyFanSpeed, setSupplyFanSpeed] = useState(0)
  const [heatingActive, setHeatingActive] = useState(false)

  // Update animation states based on controls
  useEffect(() => {
    if (controls) {
      // Roof vent (ridge vent)
      setRoofOpenAmount(controls.ridgeVentEnable ? (controls.ridgeVentPosition || 0) / 100 : 0)

      // Side vent
      setSideVentOpenAmount(controls.sideVentEnable ? (controls.sideVentPosition || 0) / 100 : 0)

      // Fans
      setFan1Speed(controls.exhaustFan1Enable ? (controls.exhaustFan1Speed || 0) / 100 : 0)
      setFan2Speed(controls.exhaustFan2Enable ? (controls.exhaustFan2Speed || 0) / 100 : 0)
      setSupplyFanSpeed(controls.supplyFanEnable ? (controls.supplyFanSpeed || 0) / 100 : 0)

      // Heating
      setHeatingActive(
        controls.hangingHeater1Enable ||
          controls.hangingHeater2Enable ||
          controls.hangingHeater3Enable ||
          controls.hangingHeater4Enable ||
          controls.floorHeater1Enable ||
          controls.floorHeater2Enable,
      )
    }
  }, [controls])

  // Animate fans and other components
  useFrame((state, delta) => {
    if (group.current) {
      // Animate fans based on speed
      const fan1 = group.current.getObjectByName("exhaustFan1")
      const fan2 = group.current.getObjectByName("exhaustFan2")
      const supplyFan = group.current.getObjectByName("supplyFan")

      if (fan1) fan1.rotation.z += delta * 5 * fan1Speed
      if (fan2) fan2.rotation.z += delta * 5 * fan2Speed
      if (supplyFan) supplyFan.rotation.z += delta * 5 * supplyFanSpeed

      // Animate roof opening
      const roofLeft = group.current.getObjectByName("roofLeft")
      const roofRight = group.current.getObjectByName("roofRight")

      if (roofLeft) roofLeft.rotation.z = THREE.MathUtils.lerp(roofLeft.rotation.z, (roofOpenAmount * Math.PI) / 6, 0.1)
      if (roofRight)
        roofRight.rotation.z = THREE.MathUtils.lerp(roofRight.rotation.z, (-roofOpenAmount * Math.PI) / 6, 0.1)

      // Animate side vents
      const sideVentLeft = group.current.getObjectByName("sideVentLeft")
      const sideVentRight = group.current.getObjectByName("sideVentRight")

      if (sideVentLeft)
        sideVentLeft.rotation.x = THREE.MathUtils.lerp(sideVentLeft.rotation.x, (sideVentOpenAmount * Math.PI) / 4, 0.1)
      if (sideVentRight)
        sideVentRight.rotation.x = THREE.MathUtils.lerp(
          sideVentRight.rotation.x,
          (sideVentOpenAmount * Math.PI) / 4,
          0.1,
        )
    }
  })

  return (
    <group ref={group}>
      {/* Greenhouse Structure */}
      <group>
        {/* Floor */}
        <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 15]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>

        {/* Walls */}
        <group>
          {/* Front Wall */}
          <mesh position={[0, 2, 7.5]} castShadow receiveShadow>
            <boxGeometry args={[10, 4, 0.1]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.2} />
          </mesh>

          {/* Back Wall */}
          <mesh position={[0, 2, -7.5]} castShadow receiveShadow>
            <boxGeometry args={[10, 4, 0.1]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.2} />
          </mesh>

          {/* Left Wall (with side vent) */}
          <mesh position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[15, 2, 0.1]} /> {/* Lower half */}
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.2} />
          </mesh>

          {/* Right Wall (with side vent) */}
          <mesh position={[5, 2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[15, 2, 0.1]} /> {/* Lower half */}
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.2} />
          </mesh>

          {/* Side Vents (Lambo style) */}
          <mesh name="sideVentLeft" position={[-5, 3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[15, 2, 0.1]} /> {/* Upper half */}
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
          </mesh>

          <mesh name="sideVentRight" position={[5, 3, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[15, 2, 0.1]} /> {/* Upper half */}
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
          </mesh>
        </group>

        {/* Roof */}
        <group position={[0, 4, 0]}>
          {/* Left Roof Panel */}
          <mesh name="roofLeft" position={[-2.5, 0, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[5, 0.1, 15]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
          </mesh>

          {/* Right Roof Panel */}
          <mesh name="roofRight" position={[2.5, 0, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[5, 0.1, 15]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
          </mesh>
        </group>

        {/* Fans */}
        <group>
          {/* Exhaust Fan 1 */}
          <group position={[-4, 3, 7.4]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.8, 0.8, 0.2, 16]} />
              <meshStandardMaterial color="#444444" />
            </mesh>
            <mesh name="exhaustFan1" position={[0, 0, 0.15]} castShadow>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 3]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
            <Html position={[0, -1.5, 0]} center>
              <Badge variant={controls?.exhaustFan1Enable ? "default" : "outline"} className="bg-blue-500">
                <Fan className="h-3 w-3 mr-1" />
                {controls?.exhaustFan1Enable ? `${controls?.exhaustFan1Speed || 0}%` : "Off"}
              </Badge>
            </Html>
          </group>

          {/* Exhaust Fan 2 */}
          <group position={[4, 3, 7.4]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.8, 0.8, 0.2, 16]} />
              <meshStandardMaterial color="#444444" />
            </mesh>
            <mesh name="exhaustFan2" position={[0, 0, 0.15]} castShadow>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 3]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
            <Html position={[0, -1.5, 0]} center>
              <Badge variant={controls?.exhaustFan2Enable ? "default" : "outline"} className="bg-blue-500">
                <Fan className="h-3 w-3 mr-1" />
                {controls?.exhaustFan2Enable ? `${controls?.exhaustFan2Speed || 0}%` : "Off"}
              </Badge>
            </Html>
          </group>

          {/* Supply Fan */}
          <group position={[0, 3, -7.4]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.8, 0.8, 0.2, 16]} />
              <meshStandardMaterial color="#444444" />
            </mesh>
            <mesh name="supplyFan" position={[0, 0, -0.15]} castShadow>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 3]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
            <Html position={[0, -1.5, 0]} center>
              <Badge variant={controls?.supplyFanEnable ? "default" : "outline"} className="bg-blue-500">
                <Fan className="h-3 w-3 mr-1" />
                {controls?.supplyFanEnable ? `${controls?.supplyFanSpeed || 0}%` : "Off"}
              </Badge>
            </Html>
          </group>
        </group>

        {/* Hanging Heaters in Corners */}
        <group>
          {/* NE Corner */}
          <group position={[4, 3.5, -6]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1, 0.5, 1]} />
              <meshStandardMaterial
                color={controls?.hangingHeater1Enable ? "#FF6347" : "#8B0000"}
                emissive={controls?.hangingHeater1Enable ? "#FF6347" : "#000000"}
                emissiveIntensity={controls?.hangingHeater1Enable ? 0.5 : 0}
              />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <Badge variant={controls?.hangingHeater1Enable ? "default" : "outline"} className="bg-red-500">
                <Flame className="h-3 w-3 mr-1" />
                {controls?.hangingHeater1Enable ? "On" : "Off"}
              </Badge>
            </Html>
          </group>

          {/* NW Corner */}
          <group position={[-4, 3.5, -6]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1, 0.5, 1]} />
              <meshStandardMaterial
                color={controls?.hangingHeater2Enable ? "#FF6347" : "#8B0000"}
                emissive={controls?.hangingHeater2Enable ? "#FF6347" : "#000000"}
                emissiveIntensity={controls?.hangingHeater2Enable ? 0.5 : 0}
              />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <Badge variant={controls?.hangingHeater2Enable ? "default" : "outline"} className="bg-red-500">
                <Flame className="h-3 w-3 mr-1" />
                {controls?.hangingHeater2Enable ? "On" : "Off"}
              </Badge>
            </Html>
          </group>

          {/* SE Corner */}
          <group position={[4, 3.5, 6]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1, 0.5, 1]} />
              <meshStandardMaterial
                color={controls?.hangingHeater3Enable ? "#FF6347" : "#8B0000"}
                emissive={controls?.hangingHeater3Enable ? "#FF6347" : "#000000"}
                emissiveIntensity={controls?.hangingHeater3Enable ? 0.5 : 0}
              />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <Badge variant={controls?.hangingHeater3Enable ? "default" : "outline"} className="bg-red-500">
                <Flame className="h-3 w-3 mr-1" />
                {controls?.hangingHeater3Enable ? "On" : "Off"}
              </Badge>
            </Html>
          </group>

          {/* SW Corner */}
          <group position={[-4, 3.5, 6]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1, 0.5, 1]} />
              <meshStandardMaterial
                color={controls?.hangingHeater4Enable ? "#FF6347" : "#8B0000"}
                emissive={controls?.hangingHeater4Enable ? "#FF6347" : "#000000"}
                emissiveIntensity={controls?.hangingHeater4Enable ? 0.5 : 0}
              />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <Badge variant={controls?.hangingHeater4Enable ? "default" : "outline"} className="bg-red-500">
                <Flame className="h-3 w-3 mr-1" />
                {controls?.hangingHeater4Enable ? "On" : "Off"}
              </Badge>
            </Html>
          </group>
        </group>

        {/* Radiant Baseboard Heaters */}
        <group>
          {/* Left Side */}
          <mesh position={[-4.9, 0.3, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.6, 14]} />
            <meshStandardMaterial
              color={controls?.floorHeater1Enable ? "#FF6347" : "#8B0000"}
              emissive={controls?.floorHeater1Enable ? "#FF6347" : "#000000"}
              emissiveIntensity={controls?.floorHeater1Enable ? 0.5 : 0}
            />
          </mesh>

          {/* Right Side */}
          <mesh position={[4.9, 0.3, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.2, 0.6, 14]} />
            <meshStandardMaterial
              color={controls?.floorHeater2Enable ? "#FF6347" : "#8B0000"}
              emissive={controls?.floorHeater2Enable ? "#FF6347" : "#000000"}
              emissiveIntensity={controls?.floorHeater2Enable ? 0.5 : 0}
            />
          </mesh>
        </group>

        {/* Sensors */}
        <group>
          {/* Temperature/Humidity Sensor 1 */}
          <group position={[-3, 2, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <div className="flex flex-col items-center space-y-1">
                <Badge className="bg-orange-500">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {sensorData?.temperature?.values[0]?.toFixed(1) || "--"}°F
                </Badge>
                <Badge className="bg-blue-500">
                  <Droplets className="h-3 w-3 mr-1" />
                  {sensorData?.humidity?.values[0]?.toFixed(1) || "--"}%
                </Badge>
              </div>
            </Html>
          </group>

          {/* Temperature/Humidity Sensor 2 */}
          <group position={[3, 2, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <Html position={[0, -1, 0]} center>
              <div className="flex flex-col items-center space-y-1">
                <Badge className="bg-orange-500">
                  <Thermometer className="h-3 w-3 mr-1" />
                  {sensorData?.temperature?.values[1]?.toFixed(1) || "--"}°F
                </Badge>
                <Badge className="bg-blue-500">
                  <Droplets className="h-3 w-3 mr-1" />
                  {sensorData?.humidity?.values[1]?.toFixed(1) || "--"}%
                </Badge>
              </div>
            </Html>
          </group>

          {/* UV Sensor */}
          <group position={[0, 3.9, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[0.3, 0.1, 0.3]} />
              <meshStandardMaterial color="#AAAAAA" />
            </mesh>
            <Html position={[0, -0.5, 0]} center>
              <Badge className="bg-yellow-500">
                <Sun className="h-3 w-3 mr-1" />
                {sensorData?.uvIndex?.toFixed(1) || "--"}
              </Badge>
            </Html>
          </group>
        </group>
      </group>
    </group>
  )
}

function Greenhouse2D({ controls, sensorData }: { controls: any; sensorData: any }) {
  return (
    <div className="w-full h-full bg-white p-4 relative">
      <div className="border-2 border-gray-300 w-full h-full rounded-lg relative overflow-hidden">
        {/* Roof */}
        <div className="absolute top-0 left-0 right-0 flex">
          <div
            className="w-1/2 h-8 bg-sky-200 border-r border-gray-300 transition-transform origin-right"
            style={{
              transform: controls?.ridgeVentEnable ? `rotate(${-controls.ridgeVentPosition * 0.3}deg)` : "rotate(0deg)",
            }}
          ></div>
          <div
            className="w-1/2 h-8 bg-sky-200 border-l border-gray-300 transition-transform origin-left"
            style={{
              transform: controls?.ridgeVentEnable ? `rotate(${controls.ridgeVentPosition * 0.3}deg)` : "rotate(0deg)",
            }}
          ></div>
        </div>

        {/* Side Vents */}
        <div
          className="absolute top-[20%] left-0 w-4 h-[60%] bg-sky-200 border-r border-gray-300 transition-transform origin-left"
          style={{
            transform: controls?.sideVentEnable ? `rotateY(${controls.sideVentPosition * 0.9}deg)` : "rotateY(0deg)",
          }}
        ></div>
        <div
          className="absolute top-[20%] right-0 w-4 h-[60%] bg-sky-200 border-l border-gray-300 transition-transform origin-right"
          style={{
            transform: controls?.sideVentEnable ? `rotateY(${-controls.sideVentPosition * 0.9}deg)` : "rotateY(0deg)",
          }}
        ></div>

        {/* Fans */}
        <div className="absolute top-[10%] right-[20%] flex flex-col items-center">
          <div className="relative w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            <div
              className="absolute w-8 h-1 bg-gray-600 rounded-full"
              style={{
                animation: controls?.exhaustFan1Enable
                  ? `spin ${100 / (controls.exhaustFan1Speed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
            <div
              className="absolute w-1 h-8 bg-gray-600 rounded-full"
              style={{
                animation: controls?.exhaustFan1Enable
                  ? `spin ${100 / (controls.exhaustFan1Speed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
          </div>
          <span className="text-xs mt-1">Exhaust 1</span>
          <Badge variant={controls?.exhaustFan1Enable ? "default" : "outline"} className="mt-1">
            {controls?.exhaustFan1Enable ? `${controls?.exhaustFan1Speed || 0}%` : "Off"}
          </Badge>
        </div>

        <div className="absolute top-[10%] left-[20%] flex flex-col items-center">
          <div className="relative w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            <div
              className="absolute w-8 h-1 bg-gray-600 rounded-full"
              style={{
                animation: controls?.exhaustFan2Enable
                  ? `spin ${100 / (controls.exhaustFan2Speed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
            <div
              className="absolute w-1 h-8 bg-gray-600 rounded-full"
              style={{
                animation: controls?.exhaustFan2Enable
                  ? `spin ${100 / (controls.exhaustFan2Speed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
          </div>
          <span className="text-xs mt-1">Exhaust 2</span>
          <Badge variant={controls?.exhaustFan2Enable ? "default" : "outline"} className="mt-1">
            {controls?.exhaustFan2Enable ? `${controls?.exhaustFan2Speed || 0}%` : "Off"}
          </Badge>
        </div>

        <div className="absolute bottom-[10%] left-[45%] flex flex-col items-center">
          <div className="relative w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
            <div
              className="absolute w-8 h-1 bg-gray-600 rounded-full"
              style={{
                animation: controls?.supplyFanEnable
                  ? `spin ${100 / (controls.supplyFanSpeed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
            <div
              className="absolute w-1 h-8 bg-gray-600 rounded-full"
              style={{
                animation: controls?.supplyFanEnable
                  ? `spin ${100 / (controls.supplyFanSpeed || 1)}ms linear infinite`
                  : "none",
              }}
            ></div>
          </div>
          <span className="text-xs mt-1">Supply</span>
          <Badge variant={controls?.supplyFanEnable ? "default" : "outline"} className="mt-1">
            {controls?.supplyFanEnable ? `${controls?.supplyFanSpeed || 0}%` : "Off"}
          </Badge>
        </div>

        {/* Hanging Heaters */}
        <div className="absolute top-[25%] left-[15%] flex flex-col items-center">
          <div className={`w-8 h-8 ${controls?.hangingHeater1Enable ? "bg-red-500" : "bg-red-900"} rounded-md`}></div>
          <span className="text-xs mt-1">Heater NW</span>
          <Badge variant={controls?.hangingHeater1Enable ? "default" : "outline"} className="mt-1 bg-red-500">
            {controls?.hangingHeater1Enable ? "On" : "Off"}
          </Badge>
        </div>

        <div className="absolute top-[25%] right-[15%] flex flex-col items-center">
          <div className={`w-8 h-8 ${controls?.hangingHeater2Enable ? "bg-red-500" : "bg-red-900"} rounded-md`}></div>
          <span className="text-xs mt-1">Heater NE</span>
          <Badge variant={controls?.hangingHeater2Enable ? "default" : "outline"} className="mt-1 bg-red-500">
            {controls?.hangingHeater2Enable ? "On" : "Off"}
          </Badge>
        </div>

        <div className="absolute bottom-[25%] left-[15%] flex flex-col items-center">
          <div className={`w-8 h-8 ${controls?.hangingHeater3Enable ? "bg-red-500" : "bg-red-900"} rounded-md`}></div>
          <span className="text-xs mt-1">Heater SW</span>
          <Badge variant={controls?.hangingHeater3Enable ? "default" : "outline"} className="mt-1 bg-red-500">
            {controls?.hangingHeater3Enable ? "On" : "Off"}
          </Badge>
        </div>

        <div className="absolute bottom-[25%] right-[15%] flex flex-col items-center">
          <div className={`w-8 h-8 ${controls?.hangingHeater4Enable ? "bg-red-500" : "bg-red-900"} rounded-md`}></div>
          <span className="text-xs mt-1">Heater SE</span>
          <Badge variant={controls?.hangingHeater4Enable ? "default" : "outline"} className="mt-1 bg-red-500">
            {controls?.hangingHeater4Enable ? "On" : "Off"}
          </Badge>
        </div>

        {/* Radiant Baseboard Heaters */}
        <div
          className={`absolute bottom-0 left-0 w-[98%] h-2 ${controls?.floorHeater1Enable ? "bg-red-500" : "bg-red-900"} ml-1`}
        ></div>
        <div className="absolute bottom-3 left-2">
          <Badge variant={controls?.floorHeater1Enable ? "default" : "outline"} className="bg-red-500">
            Floor 1 {controls?.floorHeater1Enable ? "On" : "Off"}
          </Badge>
        </div>

        <div
          className={`absolute bottom-0 right-0 w-[98%] h-2 ${controls?.floorHeater2Enable ? "bg-red-500" : "bg-red-900"} mr-1`}
        ></div>
        <div className="absolute bottom-3 right-2">
          <Badge variant={controls?.floorHeater2Enable ? "default" : "outline"} className="bg-red-500">
            Floor 2 {controls?.floorHeater2Enable ? "On" : "Off"}
          </Badge>
        </div>

        {/* Sensors */}
        <div className="absolute top-[50%] left-[30%] flex flex-col items-center">
          <div className="w-6 h-6 bg-gray-200 rounded-md border border-gray-400"></div>
          <span className="text-xs mt-1">Sensor 1</span>
          <div className="flex flex-col items-center mt-1 space-y-1">
            <Badge className="bg-orange-500">
              <Thermometer className="h-3 w-3 mr-1" />
              {sensorData?.temperature?.values[0]?.toFixed(1) || "--"}°F
            </Badge>
            <Badge className="bg-blue-500">
              <Droplets className="h-3 w-3 mr-1" />
              {sensorData?.humidity?.values[0]?.toFixed(1) || "--"}%
            </Badge>
          </div>
        </div>

        <div className="absolute top-[50%] right-[30%] flex flex-col items-center">
          <div className="w-6 h-6 bg-gray-200 rounded-md border border-gray-400"></div>
          <span className="text-xs mt-1">Sensor 2</span>
          <div className="flex flex-col items-center mt-1 space-y-1">
            <Badge className="bg-orange-500">
              <Thermometer className="h-3 w-3 mr-1" />
              {sensorData?.temperature?.values[1]?.toFixed(1) || "--"}°F
            </Badge>
            <Badge className="bg-blue-500">
              <Droplets className="h-3 w-3 mr-1" />
              {sensorData?.humidity?.values[1]?.toFixed(1) || "--"}%
            </Badge>
          </div>
        </div>

        {/* UV Sensor */}
        <div className="absolute top-2 left-[48%] flex flex-col items-center">
          <div className="w-4 h-4 bg-yellow-200 rounded-md border border-gray-400"></div>
          <span className="text-xs mt-1">UV</span>
          <Badge className="bg-yellow-500 mt-1">
            <Sun className="h-3 w-3 mr-1" />
            {sensorData?.uvIndex?.toFixed(1) || "--"}
          </Badge>
        </div>

        {/* Add CSS animation for fans */}
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}

