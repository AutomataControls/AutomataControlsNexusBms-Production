// File: /opt/productionapp/app/api/run-server-logic/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { secondaryDb } from '@/lib/secondary-firebase';
import { ControlLogicManager } from '@/lib/control-logic-manager';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, get, set } from 'firebase/database';

// Default PID settings - matching your client-side implementation
const defaultPIDSettings = {
  kp: 1.0,
  ki: 0.1,
  kd: 0.01,
  enabled: true,
  outputMin: 0,
  outputMax: 100,
  sampleTime: 1000,
  reverseActing: false,
};

// PID state storage - maintains state between runs
const pidStateStorage = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { equipmentId, runAll = false } = body;
    
    if (!runAll && !equipmentId) {
      return NextResponse.json(
        { success: false, message: 'Equipment ID is required' },
        { status: 400 }
      );
    }
    
    if (runAll) {
      // Run logic for all equipment with custom logic enabled
      const results = await runAllEquipmentLogic();
      return NextResponse.json({
        success: true,
        message: 'Server logic execution completed for all equipment',
        results
      });
    } else {
      // Run logic for specific equipment
      const result = await runEquipmentLogic(equipmentId);
      return NextResponse.json({
        success: !!result,
        message: result ? 'Server logic execution completed' : 'Failed to execute logic',
        result
      });
    }
  } catch (error) {
    console.error('Error running server logic:', error);
    return NextResponse.json(
      { success: false, message: 'Error running server logic', error: String(error) },
      { status: 500 }
    );
  }
}

// The GET method can be used to run logic for all equipment
export async function GET(request: NextRequest) {
  try {
    // Include an auth check here for production
    const authHeader = request.headers.get('Authorization');
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      // Skip auth check in development
    } else if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // This is a scheduled run for all equipment
    const results = await runAllEquipmentLogic();
    return NextResponse.json({
      success: true,
      message: 'Scheduled server logic execution completed',
      results
    });
  } catch (error) {
    console.error('Error running scheduled logic:', error);
    return NextResponse.json(
      { success: false, message: 'Error running scheduled logic', error: String(error) },
      { status: 500 }
    );
  }
}

// Function to get equipment with custom logic enabled
async function getEquipmentWithCustomLogic() {
  try {
    const equipmentRef = collection(db, 'equipment');
    const equipmentSnap = await getDocs(equipmentRef);
    
    const equipmentList = [];
    
    equipmentSnap.forEach((doc) => {
      const data = doc.data();
      if (data.controls?.customLogicEnabled && data.controls?.customLogic) {
        equipmentList.push({
          ...data,
          id: doc.id
        });
      }
    });
    
    return equipmentList;
  } catch (error) {
    console.error('Error fetching equipment with custom logic:', error);
    return [];
  }
}

// Run logic for all equipment with custom logic enabled
async function runAllEquipmentLogic() {
  try {
    const equipmentList = await getEquipmentWithCustomLogic();
    console.log(`Found ${equipmentList.length} equipment with custom logic enabled`);
    
    const results = [];
    
    for (const equipment of equipmentList) {
      try {
        const result = await runEquipmentLogic(equipment.id);
        results.push({
          equipmentId: equipment.id,
          name: equipment.name,
          success: !!result,
          result
        });
      } catch (error) {
        console.error(`Error running logic for equipment ${equipment.id}:`, error);
        results.push({
          equipmentId: equipment.id,
          name: equipment.name || 'Unknown',
          success: false,
          error: String(error)
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error running logic for all equipment:', error);
    throw error;
  }
}

// Run logic for specific equipment
async function runEquipmentLogic(equipmentId: string) {
  try {
    // Get equipment data from Firestore
    const equipRef = doc(db, 'equipment', equipmentId);
    const equipSnap = await getDoc(equipRef);
    
    if (!equipSnap.exists()) {
      throw new Error(`Equipment ${equipmentId} not found`);
    }
    
    const equipment = {
      ...equipSnap.data(),
      id: equipSnap.id
    };
    
    // Check if custom logic is enabled
    if (!equipment.controls?.customLogicEnabled) {
      console.log(`Custom logic disabled for equipment ${equipmentId}`);
      return null;
    }
    
    // Get the logic code
    let customLogic = equipment.controls?.customLogic;
    
    // If no custom logic in Firestore, try to get from ControlLogicManager
    if (!customLogic) {
      try {
        const logicManager = new ControlLogicManager();
        const logicData = await logicManager.getLatestLogic(equipmentId);
        
        if (logicData && logicData.code && logicData.code.length > 0) {
          customLogic = logicData.code[0].as_py();
        }
      } catch (error) {
        console.error(`Error fetching logic from ControlLogicManager for ${equipmentId}:`, error);
      }
    }
    
    // Fallback to default logic if still no custom logic
    if (!customLogic) {
      // Define a default logic if necessary
      console.log(`No custom logic found for ${equipmentId}, using default`);
      return null;
    }
    
    // Get metrics from RTDB
    const metricsRef = ref(secondaryDb, `metrics/${equipment.locationId}/${equipmentId}`);
    const metricsSnap = await get(metricsRef);
    const metrics = metricsSnap.exists() ? metricsSnap.val() : {};
    
    // Get current control values
    const controlValuesRef = ref(secondaryDb, `control_values/${equipment.locationId}/${equipmentId}`);
    const controlValuesSnap = await get(controlValuesRef);
    let controlValues = controlValuesSnap.exists() ? controlValuesSnap.val() : {};
    
    // Ensure controlValues has all required properties
    controlValues = {
      fanSpeed: controlValues.fanSpeed || 'low',
      fanMode: controlValues.fanMode || 'auto',
      fanEnabled: controlValues.fanEnabled !== undefined ? controlValues.fanEnabled : true,
      heatingValvePosition: controlValues.heatingValvePosition || 0,
      coolingValvePosition: controlValues.coolingValvePosition || 0,
      heatingValveMode: controlValues.heatingValveMode || 'auto',
      coolingValveMode: controlValues.coolingValveMode || 'auto',
      temperatureSetpoint: controlValues.temperatureSetpoint || 72,
      operationMode: controlValues.operationMode || 'auto',
      unitEnable: controlValues.unitEnable !== undefined ? controlValues.unitEnable : true,
      outdoorDamperPosition: controlValues.outdoorDamperPosition || 0,
      pidControllers: controlValues.pidControllers || {
        heating: { ...defaultPIDSettings, reverseActing: true },
        cooling: { ...defaultPIDSettings },
        outdoorDamper: { ...defaultPIDSettings },
      },
      ...controlValues
    };
    
    // Get PID state from storage or initialize if not exists
    const pidStateKey = `${equipment.locationId}_${equipmentId}`;
    let pidState = pidStateStorage.get(pidStateKey);
    
    if (!pidState) {
      pidState = {
        heating: { integral: 0, previousError: 0, lastOutput: 0 },
        cooling: { integral: 0, previousError: 0, lastOutput: 0 },
        outdoorDamper: { integral: 0, previousError: 0, lastOutput: 0 },
      };
      pidStateStorage.set(pidStateKey, pidState);
    }
    
    // Create sandbox environment for evaluation
    const sandbox = {
      metrics: {
        roomTemperature:
          metrics.roomTemperature ||
          metrics.roomTemp ||
          metrics.coveTemp ||
          metrics.chapelTemp ||
          metrics.kitchenTemp ||
          metrics.mailRoomTemp ||
          metrics.spaceTemp ||
          metrics.SpaceTemp ||
          metrics.zoneTemp ||
          metrics.ZoneTemp ||
          metrics.RoomTemp ||
          metrics.ZoneTemperature ||
          metrics.zone_temperature ||
          metrics.room_temperature ||
          72,
        supplyTemperature:
          metrics.supplyTemperature ||
          metrics.supplyTemp ||
          metrics.Supply ||
          metrics.supply ||
          metrics.SupplyTemp ||
          metrics.supply_temperature ||
          metrics.supply_temp ||
          metrics.dischargeTemperature ||
          metrics.dischargeTemp ||
          metrics.DischargeTemperature ||
          metrics.DischargeTemp ||
          metrics.Discharge ||
          metrics.discharge ||
          metrics.discharge_temperature ||
          metrics.discharge_temp ||
          metrics.SAT ||
          metrics.sat ||
          metrics.SupplyAirTemp ||
          metrics.supplyAirTemp ||
          metrics.SupplyAirTemperature ||
          metrics.supplyAirTemperature ||
          55,
        returnTemperature:
          metrics.returnTemperature ||
          metrics.returnTemp ||
          metrics.Return ||
          metrics.return ||
          metrics.ReturnTemp ||
          metrics.return_temperature ||
          metrics.return_temp ||
          metrics.RAT ||
          metrics.rat ||
          metrics.ReturnAirTemp ||
          metrics.returnAirTemp ||
          metrics.ReturnAirTemperature ||
          metrics.returnAirTemperature ||
          75,
        outdoorTemperature:
          metrics.outdoorTemperature ||
          metrics.outdoorTemp ||
          metrics.Outdoor ||
          metrics.outdoor ||
          metrics.OutdoorTemp ||
          metrics.OutdoorAir ||
          metrics.outdoorAir ||
          metrics.outdoorAirTemp ||
          metrics.OutdoorAirTemp ||
          metrics.OutdoorAirTemperature ||
          metrics.outdoorAirTemperature ||
          metrics.outdoor_temperature ||
          metrics.outdoor_temp ||
          metrics.outdoor_air_temp ||
          metrics.outdoor_air_temperature ||
          metrics.OAT ||
          metrics.oat ||
          metrics.OutsideAirTemp ||
          metrics.outsideAirTemp ||
          metrics.OutsideTemp ||
          metrics.outsideTemp ||
          85,
        // Raw metrics
        Supply: metrics.Supply,
        Return: metrics.Return,
        Outdoor: metrics.Outdoor,
        Setpoint: metrics.Setpoint || controlValues.temperatureSetpoint,
        // Additional metrics
        ...metrics,
      },
      settings: {
        temperatureSetpoint: controlValues.temperatureSetpoint,
        operationMode: controlValues.operationMode,
        fanEnabled: controlValues.fanEnabled,
        fanSpeed: controlValues.fanSpeed,
        heatingValvePosition: controlValues.heatingValvePosition,
        coolingValvePosition: controlValues.coolingValvePosition,
        heatingValveMode: controlValues.heatingValveMode,
        coolingValveMode: controlValues.coolingValveMode,
        unitEnable: controlValues.unitEnable,
        pidControllers: controlValues.pidControllers,
      },
    };
    
    // Evaluate the custom logic
    console.log(`Evaluating custom logic for ${equipmentId}...`);
    const evalResult = evaluateCustomLogic(customLogic, sandbox, pidState);
    
    if (!evalResult || evalResult.error) {
      console.error(`Logic evaluation failed for ${equipmentId}:`, 
                    evalResult ? evalResult.error : 'No result');
      return null;
    }
    
    // Update control values if there are changes
    if (evalResult.hasChanges && evalResult.result) {
      const result = evalResult.result;
      const updates = {};
      let hasUpdates = false;
      
      if (result && typeof result === 'object') {
        // Get the current timestamp
        const timestamp = Date.now();
        const formattedDate = new Date(timestamp).toISOString();
        
        // Format data for RTDB and create command history
        for (const [key, value] of Object.entries(result)) {
          if (controlValues[key] !== value) {
            const commandType = `update_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
            const commandId = `${commandType}_${timestamp}`;
            
            updates[`control_history/${equipment.locationId}/${equipmentId}/${commandType}/${commandId}`] = {
              command: commandType,
              equipmentId,
              locationId: equipment.locationId,
              timestamp,
              formattedTimestamp: formattedDate,
              value: value ?? null,
              previousValue: controlValues[key] ?? null,
              mode: 'auto',
              source: 'server_logic',
              status: 'completed',
              userId: 'system',
              userName: 'Automated Logic',
              details: `${key} updated to ${value} by automated logic`,
            };
            
            // Update control values
            controlValues[key] = value;
            hasUpdates = true;
          }
        }
      }
      
      // Update control values in RTDB if there are changes
      if (hasUpdates) {
        console.log(`Updating control values for ${equipmentId} with:`, controlValues);
        
        // Update control_values
        await set(ref(secondaryDb, `control_values/${equipment.locationId}/${equipmentId}`), controlValues);
        
        // Add command history
        for (const [path, data] of Object.entries(updates)) {
          await set(ref(secondaryDb, path), data);
        }
        
        // Update equipment in Firestore
        await updateDoc(equipRef, {
          'controls': controlValues,
          'lastUpdated': new Date()
        });
      }
    }
    
    return evalResult.result;
  } catch (error) {
    console.error(`Error running logic for equipment ${equipmentId}:`, error);
    throw error;
  }
}

// Evaluate custom logic
function evaluateCustomLogic(customLogic: string, sandbox: any, pidState: any) {
  if (!customLogic) {
    console.log("Custom logic is empty");
    return null;
  }

  try {
    console.log("Evaluating custom logic...");

    // Create a function from the custom logic
    const logicFn = new Function(
      "metrics",
      "settings",
      "pidState",
      `
      try {
        ${customLogic}

        // Override the original pidController function to properly track state
        const originalPidController = typeof pidController === 'function' ? pidController : null;
        
        function pidController(input, setpoint, kp, ki, kd, dt, outputMin, outputMax, controllerType) {
          // Get the current state for this controller - use the controllerType parameter
          const controllerKey = String(controllerType);
          const state = pidState[controllerKey] || { integral: 0, previousError: 0, lastOutput: 0 };
          
          // Calculate error - special handling for cooling
          let error;
          if (controllerKey === 'cooling') {
            // For cooling, higher temp means positive error (need more cooling)
            error = input - setpoint;
          } else {
            // For heating and other controls, lower temp means positive error
            error = setpoint - input;
          }
          
          // Calculate integral with anti-windup
          let integral = state.integral + (error * dt);
          
          // Anti-windup - limit integral to prevent excessive buildup
          const maxIntegral = (outputMax - outputMin) / (ki || 0.1); // Avoid division by zero
          integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral);
          
          // Calculate derivative
          const derivative = (error - state.previousError) / dt;
          
          // Calculate output
          let output = kp * error + ki * integral + kd * derivative;
          
          // Clamp output
          output = Math.max(outputMin, Math.min(outputMax, output));
          
          console.log(\`PID Controller (\${controllerKey}): Error=\${error.toFixed(2)}, Integral=\${integral.toFixed(2)}, Derivative=\${derivative.toFixed(2)}, Output=\${output.toFixed(2)}\`);
          
          // Store updated state for next run
          pidState[controllerKey] = {
            integral,
            previousError: error,
            lastOutput: output
          };
          
          // Return the result
          return {
            output,
            newState: pidState[controllerKey]
          };
        }
        
        // Call fanCoilControl with our modified pidController
        const result = fanCoilControl(metrics, settings);
        
        // Return the result
        return result;
      } catch (error) {
        console.error("Logic evaluation error in custom logic:", error);
        return { error: error.message };
      }
      `
    );

    // Execute the logic with the current PID state
    console.log("Executing logic function with PID state...");
    const result = logicFn(sandbox.metrics, sandbox.settings, pidState);
    console.log("Logic function returned:", result);

    // Handle potential errors from logicFn
    if (result && result.error) {
      console.error("Logic evaluation failed:", result.error);
      return { error: result.error, result: null, hasChanges: false, timestamp: Date.now() };
    }

    // Return the evaluation result for external use
    return {
      result,
      hasChanges: true,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error in evaluateCustomLogic:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      result: null,
      hasChanges: false,
      timestamp: Date.now(),
    };
  }
}
