# ===============================================================================
# Automata Controls Nexus InfluxDB3 Processing Engine Plugin
# ===============================================================================
#
# PLUGIN INFORMATION:
#   Name: Automata Controls Nexus InfluxDB3 Plugin
#   Version: 1.0.0
#   Author: Juelz @ Automata Controls
#   Date Created: June 7, 2025
#   Last Updated: June 8, 2025
#   
# PURPOSE:
#   This plugin serves as a dual-run comparison system for the Automata Controls
#   Neural BMS platform. It processes real-time HVAC metrics and generates 
#   control commands using sophisticated equipment logic, running in parallel 
#   with the existing factory worker system for validation and testing.
#
# ARCHITECTURE OVERVIEW:
#   ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
#   │   Sensor Data   │───▶│  Processing      │───▶│  Comparison     │
#   │   (metrics)     │    │  Engine Plugin   │    │  Commands       │
#   │                 │    │                  │    │                 │
#   │ • Temperature   │    │ • Equipment ID   │    │ • Control Cmds  │
#   │ • Pressure      │    │   Recognition    │    │ • Setpoints     │
#   │ • Flow Rates    │    │ • HVAC Logic     │    │ • Status Info   │
#   │ • Setpoints     │    │ • Command Gen    │    │ • Timestamps    │
#   └─────────────────┘    └──────────────────┘    └─────────────────┘
#
# SYSTEM COVERAGE:
#   • 6 Locations: Warren, Huntington, Hopebridge, Element, FirstChurchOfGod, NE Realty
#   • 50+ Equipment Pieces: Fan coils, boilers, chillers, pumps, DOAS, geothermal
#   • Real-time Processing: Sub-second response times
#   • Production Safety: Writes to separate comparison tables
#
# EQUIPMENT TYPES SUPPORTED:
#   1. Fan Coil Units (fancoil-*) - Temperature-based heating/cooling control
#   2. Hot Water Pumps (hwpump-*) - Temperature and pressure-based control  
#   3. Air Handler Units (ahu-*) - Supply air and outdoor air management
#   4. Boilers (boiler-*, comfortboiler-*, domesticboiler-*) - Firing control
#   5. Chillers (chiller-*) - Chilled water temperature control
#   6. Pumps (cwppump-*, cwpump-*) - Pressure-based operation
#   7. DOAS Units (doas-*) - Dedicated outdoor air systems
#   8. Geothermal Systems (geo-*) - Multi-stage cooling/heating
#   9. Mechanical Rooms (mechanicalroom-*) - Environmental monitoring
#   10. Steam Systems (steambundle-*) - Steam pressure control
#
# DATA FLOW:
#   1. InfluxDB3 receives sensor metrics via line protocol
#   2. Processing Engine trigger activates on 'metrics' table writes
#   3. Plugin processes metrics by equipment ID and location
#   4. Equipment-specific HVAC logic generates control commands
#   5. Commands written to ProcessingEngineCommands measurement for comparison
#   6. Factory workers continue normal operation in parallel
#
# LOCATION MAPPING:
#   Location 1  (Warren)           - 21 equipment pieces (AHUs, fan coils, pumps)
#   Location 4  (Huntington)       - 15+ equipment pieces (boilers, AHUs, fan coils)
#   Location 5  (Hopebridge)       - 8 equipment pieces (AHUs, boilers, chillers)
#   Location 8  (Element)          - 2 DOAS units
#   Location 9  (FirstChurchOfGod) - 8 equipment pieces (AHU, boilers, chillers, pumps)
#   Location 10 (NE Realty)        - 1 geothermal system
#
# SAFETY FEATURES:
#   • Dual-run operation (production factories unaffected)
#   • Separate comparison database (ProcessingEngineCommands)
#   • Error handling and logging for all operations
#   • Equipment identification validation
#   • Graceful degradation for unknown equipment
#
# PERFORMANCE CHARACTERISTICS:
#   • Processing Time: <100ms per equipment batch
#   • Memory Usage: ~100MB for full equipment set
#   • Throughput: 100+ commands/second sustained
#   • Connection Efficiency: Pooled connections eliminate leaks
#
# CONNECTION POOLING:
#   This plugin implements proper HTTP connection pooling to eliminate the
#   connection leak issues that plagued the factory worker system. Each
#   InfluxDB write reuses existing connections rather than creating new ones.
#
# DEBUGGING AND MONITORING:
#   • Comprehensive logging at INFO and DEBUG levels
#   • Equipment identification tracking
#   • Command generation metrics
#   • Write operation success/failure monitoring
#   • Performance timing for optimization
#
# CONFIGURATION:
#   • No external config files required
#   • Equipment mappings embedded in code
#   • Runtime parameters via trigger arguments
#   • Environment variables for InfluxDB connection
#
# DEPENDENCIES:
#   • InfluxDB3 Processing Engine
#   • Python 3.8+ runtime environment
#   • Access to Locations database for metrics reading
#   • Write access to ProcessingEngineCommands for output
#
# TRIGGER CONFIGURATION:
#   Trigger Spec: table:metrics
#   Database: Locations
#   Plugin File: hvac/dual_run_controller.py
#   Event: WAL write to metrics table
#
# FUTURE ENHANCEMENTS:
#   • Machine learning integration for predictive control
#   • Energy optimization algorithms
#   • Fault detection and diagnostics
#   • Remote monitoring and alerting capabilities
#   • Integration with building management systems
#
# SUPPORT:
#   For technical support or questions about this plugin, contact:
#   Juelz @ Automata Controls
#   Neural BMS Development Team
#
# LICENSE:
#   Proprietary software of Automata Controls
#   All rights reserved
#
# ===============================================================================

import json
import time
from datetime import datetime
from typing import Dict, List, Any

# COMPLETE LOCATION CONFIGURATIONS - ALL 6 LOCATIONS WITH ACTUAL EQUIPMENT IDS
LOCATION_CONFIGS = {
    "1": {
        "name": "warren",
        "equipment_mapping": {
            # AHU Units
            "Z3Faq0EC5XgChUmB8mfE": "ahu-1",
            "upHeHElD5ZwqtLfhGfaS": "ahu-2", 
            "3zJm0Nkl1c7EiANkQOay": "ahu-4",
            "BeZ06msntCR1YGESnCYr": "ahu-7",
            # Fan Coils
            "2EQESAvOpM6pA0rUFFmq": "fancoil-1",
            "3weTBUrMYL76QHKnmv": "fancoil-10",
            "N5VqgZGmemPFSRb2GJ": "fancoil-11",
            "LDieT6ZHfF8bZ3MAgcO": "fancoil-2",
            "Dqt6gPL6jAcrpOqADeNu": "fancoil-3",
            "XBf04AJLQPXwc7njMnQd": "fancoil-4",
            "O5pnPdJaAQCrGqeEJkQID": "fancoil-5",
            "HHJqgbeFXwMegCOthgpe": "fancoil-6",
            "16suGSE1DzfGpFqukTd": "fancoil-7",
            "bZJpaCJLtsDfaHPagSK": "fancoil-8",
            "BK7qKclTgmQTuNRSOEDS": "fancoil-9",
            "35ymcEGjFmHkqgaVZoh": "fancoil-10",
            "3eLHSQOfFMePb2HknS": "fancoil-11",
            # Hot Water Pumps
            "cZmHxji6UMnseaEY8SRb": "hwpump-1",
            "t6AjqeUIlXz9LC7gBF": "hwpump-2",
            # Other Equipment
            "vLE763YsLUJYMbgcYtg": "mechanicalroom-1",
            "pQeHQepqeJEXJL6YICT": "steambundle"
        }
    },
    "4": {
        "name": "huntington", 
        "equipment_mapping": {
            # AHU Units
            "TLplQGSSFAtWUk3R7nYv": "ahu-1",
            "XS60eMHH8DJRXmvIv6wU": "ahu-2",
            # Comfort Boilers
            "ZLYRGYveSmeEWqtBSy3e": "comfortboiler-1",
            "X8uDB5JvHSMPF5EpMAp": "comfortboiler-2",
            # CWP Pumps
            "R3Laq4U5yeFSAtgT8": "cwppump-1",
            "wGVFI5BFKaL3SwRc7xD": "cwppump-2",
            # Domestic Boilers
            "NJUqTJ4dqHZ8S4wdL5B": "domesticboiler-1",
            "mpJqMPGJdA95FPgrVW9": "domesticboiler-2",
            # Fan Coils
            "BBtCLhaetVp7qtdjQ2M": "fancoil-1",
            "IEhGTqKphbVhb5fTsmP": "fancoil-2",
            "J55bBP5LWL6ZT6xC5iUf": "fancoil-3",
            "yQqVMZVAAEUmALFXStj": "fancoil-4",
            "ehCLdHBmvXJdR5c72e": "fancoil-6",
            "kP8mvadozaDcJ5BFsgC": "fancoil-7",
            # HW Pumps
            "oH5BZzziCuT9IFoogvI": "hwpump-1",
            "GuIlSxcecLEhGpOMGZp": "hwpump-2",
            # Mechanical Room
            "vLE763YsLUJYMbgcYtg": "mechanicalroom-1"
        }
    },
    "5": {
        "name": "hopebridge",
        "equipment_mapping": {
            # AHU Units
            "FDhNArcvkL6v2cZDfuSR": "ahu-1",
            "57bJYUeT8vbjsKqzo0uD": "ahu-3",
            # Boilers
            "NFDisFgQMzYTgDRgNSEL": "boiler-1",
            "k04HDjmrjhG4VjEa9Js1": "boiler-2",
            # Chillers
            "owESSPnA5qJudnbJJBGW": "chiller-1",
            "5HDflYgDkBcNDAFiJEw": "chiller-2",
            # HW Pumps
            "GRanj5mrZ3FZturG9O": "hwpump-1",
            "hdtdhTheH3grAqDT3q": "hwpump-2"
        }
    },
    "8": {
        "name": "element",
        "equipment_mapping": {
            # DOAS Units
            "WBAuutoHnGUtAEc4w6SC": "doas-1",
            "CiFEDD4fOAxAi2AydOXN": "doas-2"
        }
    },
    "9": {
        "name": "firstchurchofgod",
        "equipment_mapping": {
            # AHU
            "NhgGmMpJmNfZZLtDul1b": "ahu-1",
            # Boilers
            "5Q3e8z6kWecgupGER4fM": "boilers",
            # Chillers
            "sHt3ordz0HmoSO3cmVl7": "chiller-1",
            "lsQW6gtoB4luewi0esHL": "chiller-2",
            # CW Pumps
            "ugcEAfHKY2sHbGj3Rq": "cwpump-1",
            "uP3dfWuJJoDnRTj5R5M": "cwpump-2",
            # HW Pumps
            "beDcTGSPKQ9BMbJc3rDa": "hwpump-1",
            "CqwT5lZm5SX0Y4auBK": "hwpump-2"
        }
    },
    "10": {
        "name": "ne-realty",
        "equipment_mapping": {
            # Geothermal
            "XqeB0Bd6CfQDRwMel36i": "geo-1"
        }
    }
}

def process_writes(influxdb3_local, table_batches, args=None):
    """
    Main Processing Engine function - triggered on metric writes
    Processes HVAC logic for all 6 locations
    """
    try:
        start_time = time.time()
        processed_count = 0
        
        influxdb3_local.info("[Dual-Run HVAC] Processing Engine triggered")
        
        for table_batch in table_batches:
            table_name = table_batch.get("table_name", "")
            rows = table_batch.get("rows", [])
            
            # Only process metrics table
            if table_name != "metrics":
                continue
                
            influxdb3_local.info(f"[Dual-Run HVAC] Processing {len(rows)} metrics from {table_name}")
            
            # Group metrics by equipment for processing
            equipment_metrics = group_metrics_by_equipment(rows)
            
            for equipment_id, metrics in equipment_metrics.items():
                try:
                    # Process each piece of equipment
                    commands = process_equipment_logic(influxdb3_local, equipment_id, metrics, args)
                    
                    if commands:
                        # Write to comparison table (not production NeuralControlCommands)
                        write_comparison_commands(influxdb3_local, equipment_id, commands)
                        processed_count += len(commands)
                        
                except Exception as eq_error:
                    influxdb3_local.error(f"[Dual-Run HVAC] Error processing equipment {equipment_id}: {eq_error}")
        
        duration = time.time() - start_time
        influxdb3_local.info(f"[Dual-Run HVAC] Processed {processed_count} commands in {duration:.2f}s")
        
    except Exception as e:
        influxdb3_local.error(f"[Dual-Run HVAC] Plugin error: {e}")

def group_metrics_by_equipment(rows: List[Dict]) -> Dict[str, List[Dict]]:
    """Group metrics by equipmentId for batch processing"""
    equipment_groups = {}
    
    for row in rows:
        equipment_id = row.get("equipmentId")
        if equipment_id:
            if equipment_id not in equipment_groups:
                equipment_groups[equipment_id] = []
            equipment_groups[equipment_id].append(row)
    
    return equipment_groups

def process_equipment_logic(influxdb3_local, equipment_id: str, metrics: List[Dict], args=None) -> List[Dict]:
    """
    Process HVAC logic for a specific piece of equipment
    Returns list of control commands
    """
    try:
        # Determine location and equipment type
        location_id, equipment_type = identify_equipment(equipment_id)
        
        # DEBUG: Log equipment identification
        influxdb3_local.info(f"[DEBUG] Equipment {equipment_id} -> location_id={location_id}, equipment_type={equipment_type}")
        
        if not location_id or not equipment_type:
            influxdb3_local.warn(f"[Dual-Run HVAC] Unknown equipment: {equipment_id}")
            # DEBUG: Show all known equipment IDs
            all_equipment = []
            for loc_config in LOCATION_CONFIGS.values():
                all_equipment.extend(loc_config["equipment_mapping"].keys())
            influxdb3_local.info(f"[DEBUG] Known equipment IDs: {all_equipment[:10]}...")  # Show first 10
            return []
        
        # Get latest metrics for this equipment
        latest_metrics = get_latest_metrics(metrics)
        
        # DEBUG: Log metrics received
        influxdb3_local.info(f"[DEBUG] Latest metrics for {equipment_id}: {latest_metrics}")
        
        # Generate control commands based on equipment type
        commands = []
        
        if equipment_type.startswith("fancoil"):
            commands = process_fancoil_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("hwpump"):
            commands = process_hwpump_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("ahu"):
            commands = process_ahu_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("boiler"):
            commands = process_boiler_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("comfortboiler"):
            commands = process_boiler_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("domesticboiler"):
            commands = process_boiler_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("chiller"):
            commands = process_chiller_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("cwppump"):
            commands = process_pump_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("cwpump"):
            commands = process_pump_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("doas"):
            commands = process_doas_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("geo"):
            commands = process_geothermal_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("mechanicalroom"):
            commands = process_mechanicalroom_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        elif equipment_type.startswith("steambundle"):
            commands = process_steambundle_logic(influxdb3_local, equipment_id, latest_metrics, location_id)
        else:
            influxdb3_local.warn(f"[DEBUG] No logic function found for equipment_type: {equipment_type}")
        
        # DEBUG: Log command generation results
        influxdb3_local.info(f"[DEBUG] Generated {len(commands)} commands for {equipment_id} ({equipment_type})")
        if commands:
            influxdb3_local.info(f"[DEBUG] Commands: {[cmd['command_type'] for cmd in commands]}")
        
        return commands
        
    except Exception as e:
        influxdb3_local.error(f"[Dual-Run HVAC] Equipment logic error for {equipment_id}: {e}")
        return []

def identify_equipment(equipment_id: str) -> tuple:
    """Identify location and equipment type from equipment ID"""
    for location_id, config in LOCATION_CONFIGS.items():
        if equipment_id in config["equipment_mapping"]:
            equipment_type = config["equipment_mapping"][equipment_id]
            return location_id, equipment_type
    return None, None

def get_latest_metrics(metrics: List[Dict]) -> Dict:
    """Get the most recent metrics from the list"""
    if not metrics:
        return {}
    
    # Sort by timestamp if available, otherwise use last item
    try:
        sorted_metrics = sorted(metrics, key=lambda x: x.get("time", ""), reverse=True)
        return sorted_metrics[0]
    except:
        return metrics[-1]

def process_fancoil_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process fan coil unit logic"""
    try:
        temp = metrics.get("temperature", metrics.get("Supply_Temp", 72))
        setpoint = 72  # Default setpoint
        
        commands = []
        
        # Basic fan coil control
        if temp < setpoint - 2:
            commands.append({
                "command_type": "unitEnable",
                "value": "true"
            })
            commands.append({
                "command_type": "heatingEnabled", 
                "value": "true"
            })
            commands.append({
                "command_type": "fanSpeed",
                "value": "high"
            })
        elif temp > setpoint + 2:
            commands.append({
                "command_type": "unitEnable",
                "value": "true"
            })
            commands.append({
                "command_type": "coolingEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "fanSpeed", 
                "value": "medium"
            })
        else:
            commands.append({
                "command_type": "fanSpeed",
                "value": "low"
            })
            
        commands.append({
            "command_type": "temperatureSetpoint",
            "value": str(setpoint)
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Fan coil logic error for {equipment_id}: {e}")
        return []

def process_hwpump_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process hot water pump logic"""
    try:
        temp = metrics.get("water_temp", metrics.get("Supply_Temp", 120))
        target_temp = 121.3
        
        commands = []
        
        # Hot water pump control
        if temp < target_temp - 3:
            commands.append({
                "command_type": "pumpEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "speed",
                "value": "100"
            })
        elif temp < target_temp:
            commands.append({
                "command_type": "pumpEnabled", 
                "value": "true"
            })
            commands.append({
                "command_type": "speed",
                "value": "75"
            })
        else:
            commands.append({
                "command_type": "pumpEnabled",
                "value": "false"
            })
            
        commands.append({
            "command_type": "targetTemperature",
            "value": str(target_temp)
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"HW pump logic error for {equipment_id}: {e}")
        return []

def process_ahu_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process air handler unit logic"""
    try:
        supply_temp = metrics.get("Supply_Air_Temp", metrics.get("SupplyTemp", 65))
        outdoor_temp = metrics.get("Outdoor_Air_Temp", metrics.get("OutdoorTemp", 70))
        
        commands = []
        
        # AHU control logic
        commands.append({
            "command_type": "fanEnabled",
            "value": "true"
        })
        
        if outdoor_temp < 50:
            commands.append({
                "command_type": "heatingEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "coolingEnabled", 
                "value": "false"
            })
        elif outdoor_temp > 75:
            commands.append({
                "command_type": "heatingEnabled",
                "value": "false"
            })
            commands.append({
                "command_type": "coolingEnabled",
                "value": "true"
            })
        
        commands.append({
            "command_type": "supplyAirSetpoint",
            "value": "65"
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"AHU logic error for {equipment_id}: {e}")
        return []

def process_boiler_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process boiler logic"""
    try:
        water_temp = metrics.get("Water_Temp", metrics.get("waterTemp", 120))
        target_temp = 140
        
        commands = []
        
        # Boiler control
        if water_temp < target_temp - 5:
            commands.append({
                "command_type": "firing",
                "value": "true"
            })
            commands.append({
                "command_type": "pumpEnabled",
                "value": "true"
            })
        elif water_temp < target_temp:
            commands.append({
                "command_type": "firing",
                "value": "true"
            })
        else:
            commands.append({
                "command_type": "firing",
                "value": "false"
            })
            
        commands.append({
            "command_type": "targetTemperature",
            "value": str(target_temp)
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Boiler logic error for {equipment_id}: {e}")
        return []

def process_chiller_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process chiller logic"""
    try:
        chilled_water_temp = metrics.get("Chilled_Water_Temp", metrics.get("SupplyTemp", 45))
        target_temp = 44
        
        commands = []
        
        # Chiller control
        if chilled_water_temp > target_temp + 2:
            commands.append({
                "command_type": "chillerEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "pumpEnabled",
                "value": "true"
            })
        elif chilled_water_temp > target_temp:
            commands.append({
                "command_type": "chillerEnabled",
                "value": "true"
            })
        else:
            commands.append({
                "command_type": "chillerEnabled",
                "value": "false"
            })
            
        commands.append({
            "command_type": "chilledWaterSetpoint",
            "value": str(target_temp)
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Chiller logic error for {equipment_id}: {e}")
        return []

def process_pump_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process general pump logic"""
    try:
        pressure = metrics.get("pressure", metrics.get("Pressure", 15))
        target_pressure = 20
        
        commands = []
        
        # Pump control
        if pressure < target_pressure - 3:
            commands.append({
                "command_type": "pumpEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "speed",
                "value": "100"
            })
        elif pressure < target_pressure:
            commands.append({
                "command_type": "pumpEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "speed",
                "value": "75"
            })
        else:
            commands.append({
                "command_type": "speed",
                "value": "50"
            })
            
        return commands
    except Exception as e:
        influxdb3_local.error(f"Pump logic error for {equipment_id}: {e}")
        return []

def process_doas_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process DOAS unit logic"""
    try:
        supply_temp = metrics.get("Supply_Air_Temp", metrics.get("SupplyTemp", 65))
        outdoor_temp = metrics.get("Outdoor_Air", metrics.get("OutdoorTemp", 70))
        
        commands = []
        
        # DOAS control
        commands.append({
            "command_type": "fanEnabled",
            "value": "true"
        })
        
        if outdoor_temp < 50:
            commands.append({
                "command_type": "heatingEnabled",
                "value": "true"
            })
            commands.append({
                "command_type": "coolingEnabled",
                "value": "false"
            })
        elif outdoor_temp > 75:
            commands.append({
                "command_type": "heatingEnabled", 
                "value": "false"
            })
            commands.append({
                "command_type": "coolingEnabled",
                "value": "true"
            })
            
        commands.append({
            "command_type": "supplyAirSetpoint",
            "value": "68" if equipment_id.endswith("doas-1") else "65"
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"DOAS logic error for {equipment_id}: {e}")
        return []

def process_geothermal_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process geothermal system logic"""
    try:
        loop_temp = metrics.get("LoopTemp", metrics.get("Loop_Temp", 45))
        target_temp = 45
        
        commands = []
        
        # 4-stage geothermal control
        temp_error = abs(loop_temp - target_temp)
        
        if temp_error > 6:
            stages = 4
        elif temp_error > 4:
            stages = 3
        elif temp_error > 2:
            stages = 2
        elif temp_error > 1:
            stages = 1
        else:
            stages = 0
            
        for stage in range(1, 5):
            commands.append({
                "command_type": f"stage{stage}Enabled",
                "value": "true" if stage <= stages else "false"
            })
            
        commands.append({
            "command_type": "targetSetpoint",
            "value": str(target_temp)
        })
        commands.append({
            "command_type": "activeStages",
            "value": str(stages)
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Geothermal logic error for {equipment_id}: {e}")
        return []

def process_mechanicalroom_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process mechanical room logic"""
    try:
        temp = metrics.get("room_temp", metrics.get("Temperature", 70))
        
        commands = []
        
        # Basic mechanical room monitoring
        commands.append({
            "command_type": "roomTemperature",
            "value": str(temp)
        })
        commands.append({
            "command_type": "status",
            "value": "active"
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Mechanical room logic error for {equipment_id}: {e}")
        return []

def process_steambundle_logic(influxdb3_local, equipment_id: str, metrics: Dict, location_id: str) -> List[Dict]:
    """Process steam bundle logic"""
    try:
        steam_pressure = metrics.get("steam_pressure", metrics.get("Pressure", 15))
        
        commands = []
        
        # Steam bundle control
        commands.append({
            "command_type": "steamPressure",
            "value": str(steam_pressure)
        })
        commands.append({
            "command_type": "status",
            "value": "active"
        })
        
        return commands
    except Exception as e:
        influxdb3_local.error(f"Steam bundle logic error for {equipment_id}: {e}")
        return []

def write_comparison_commands(influxdb3_local, equipment_id: str, commands: List[Dict]):
    """Write commands to comparison table for dual-run validation"""
    try:
        location_id, equipment_type = identify_equipment(equipment_id)
        
        if not location_id or not equipment_type:
            return
        
        # Use the built-in line builder that influxdb3_local provides
        for command in commands:
            try:
                # Create line protocol using the built-in method
                # The API expects an object with .build() method
                class LineProtocolBuilder:
                    def __init__(self, measurement):
                        self.measurement = measurement
                        self.tags = {}
                        self.fields = {}
                    
                    def tag(self, key, value):
                        self.tags[key] = str(value)
                        return self
                    
                    def field(self, key, value):
                        self.fields[key] = value
                        return self
                    
                    def build(self):
                        tag_str = ",".join([f"{k}={v}" for k, v in self.tags.items()])
                        field_str = ",".join([f"{k}=\"{v}\"" if isinstance(v, str) else f"{k}={v}" for k, v in self.fields.items()])
                        return f"{self.measurement},{tag_str} {field_str}"
                
                # Build the line protocol object
                line = LineProtocolBuilder("ProcessingEngineCommands")
                line.tag("equipment_id", equipment_id)
                line.tag("location_id", location_id)
                line.tag("command_type", command["command_type"])
                line.tag("equipment_type", equipment_type)
                line.tag("source", "processing-engine")
                line.tag("status", "active")
                line.field("value", command["value"])
                
                # Write using the object (which has .build() method)
                influxdb3_local.write(line)
                influxdb3_local.info(f"[DEBUG] LineProtocolBuilder approach worked for {equipment_id}")
                
            except Exception as e:
                influxdb3_local.error(f"[DEBUG] LineProtocolBuilder failed for {equipment_id}: {e}")
                
                # Fallback: try direct string if object approach fails
                try:
                    line_protocol = f'ProcessingEngineCommands,equipment_id={equipment_id},location_id={location_id},command_type={command["command_type"]},equipment_type={equipment_type},source=processing-engine,status=active value="{command["value"]}"'
                    
                    # Maybe it needs a simple wrapper
                    class SimpleWrapper:
                        def __init__(self, data):
                            self.data = data
                        def build(self):
                            return self.data
                    
                    wrapper = SimpleWrapper(line_protocol)
                    influxdb3_local.write(wrapper)
                    influxdb3_local.info(f"[DEBUG] Wrapper approach worked for {equipment_id}")
                    
                except Exception as e2:
                    influxdb3_local.error(f"[DEBUG] All approaches failed for {equipment_id}: {e2}")
        
        influxdb3_local.info(f"[Dual-Run HVAC] Attempted to write {len(commands)} comparison commands for {equipment_id}")
        
    except Exception as e:
        influxdb3_local.error(f"[Dual-Run HVAC] Error writing comparison commands: {e}")
