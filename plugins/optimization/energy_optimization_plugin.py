# Automata Controls Nexus InfluxDB3 Energy Optimization Plugin
# Version: 1.2.1
# Author: Juelz @ Automata Controls
# Created: May 28, 2025
# Updated: June 7, 2025

import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict
import math

# Energy optimization configuration
ENERGY_CONFIG = {
    "peak_demand_threshold_kw": 500.0,
    "energy_cost_per_kwh": 0.12,
    "peak_demand_cost_per_kw": 15.00,
    "carbon_factor_kg_per_kwh": 0.4,
    "optimization_interval_minutes": 5,
    "load_shedding_priority": ["lighting", "fancoil", "pump", "ahu", "chiller", "boiler"]
}

# Equipment power consumption baselines (kW)
EQUIPMENT_POWER_BASELINES = {
    "boiler": {"min": 5.0, "max": 50.0, "optimal": 35.0},
    "chiller": {"min": 10.0, "max": 150.0, "optimal": 100.0},
    "air-handler": {"min": 2.0, "max": 25.0, "optimal": 18.0},
    "pump": {"min": 0.5, "max": 15.0, "optimal": 8.0},
    "fancoil": {"min": 0.2, "max": 3.0, "optimal": 2.0},
    "geo": {"min": 3.0, "max": 30.0, "optimal": 20.0}
}

# Utility rate schedule (simplified)
UTILITY_RATES = {
    "peak": {"hours": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], "rate": 0.18},
    "off_peak": {"hours": [22, 23, 0, 1, 2, 3, 4, 5], "rate": 0.08},
    "standard": {"rate": 0.12}
}

# Global state for energy tracking
location_energy_data = defaultdict(dict)
peak_demand_events = []
optimization_commands = []

def process_writes(influxdb3_local, table_batches, args=None):
    """
    Main entry point for Energy Optimization Processing Engine Plugin
    """
    try:
        influxdb3_local.info("[Energy Optimization] Processing Engine triggered")
        
        processed_locations = set()
        optimization_commands_generated = 0
        total_energy_analyzed = 0
        
        for table_batch in table_batches:
            table_name = table_batch.get("table_name", "")
            rows = table_batch.get("rows", [])
            
            if table_name != "metrics":
                continue
                
            influxdb3_local.info(f"[Energy Optimization] Analyzing {len(rows)} equipment energy readings")
            
            # Group equipment by location for comprehensive analysis
            location_equipment = defaultdict(list)
            for row in rows:
                location_id = row.get("location_id")
                equipment_id = row.get("equipmentId")
                
                if location_id and equipment_id:
                    location_equipment[location_id].append({
                        "equipment_id": equipment_id,
                        "metrics": row
                    })
            
            # Analyze each location energy profile
            for location_id, equipment_list in location_equipment.items():
                energy_analysis = analyze_location_energy(influxdb3_local, location_id, equipment_list)
                optimization_opportunities = identify_optimization_opportunities(influxdb3_local, location_id, energy_analysis)
                optimization_commands_batch = generate_optimization_commands(influxdb3_local, location_id, optimization_opportunities)
                
                # Write energy analytics data
                write_energy_analytics(influxdb3_local, location_id, energy_analysis, optimization_opportunities, optimization_commands_batch)
                
                processed_locations.add(location_id)
                optimization_commands_generated += len(optimization_commands_batch)
                total_energy_analyzed += energy_analysis.get("total_power_kw", 0)
        
        influxdb3_local.info(f"[Energy Optimization] Processed {len(processed_locations)} locations, {total_energy_analyzed:.1f} kW total, generated {optimization_commands_generated} optimization commands")
        
    except Exception as e:
        influxdb3_local.error(f"[Energy Optimization] Plugin error: {e}")

def analyze_location_energy(influxdb3_local, location_id: str, equipment_list: List[Dict]) -> Dict:
    """
    Analyze energy consumption for an entire location
    """
    try:
        total_power_kw = 0.0
        equipment_power_breakdown = {}
        efficiency_scores = []
        
        for equipment_data in equipment_list:
            equipment_id = equipment_data["equipment_id"]
            metrics = equipment_data["metrics"]
            
            # Calculate equipment power consumption
            power_consumption = calculate_equipment_power(equipment_id, metrics)
            efficiency_score = calculate_energy_efficiency(equipment_id, metrics, power_consumption)
            
            total_power_kw += power_consumption
            equipment_power_breakdown[equipment_id] = {
                "power_kw": power_consumption,
                "efficiency_percent": efficiency_score,
                "equipment_type": determine_equipment_type(equipment_id)
            }
            
            if efficiency_score > 0:
                efficiency_scores.append(efficiency_score)
        
        # Calculate location wide metrics
        average_efficiency = sum(efficiency_scores) / len(efficiency_scores) if efficiency_scores else 0
        current_hour = datetime.now().hour
        current_rate = get_current_utility_rate(current_hour)
        hourly_cost = total_power_kw * current_rate
        
        # Determine if this is a peak demand period
        is_peak_period = current_hour in UTILITY_RATES["peak"]["hours"]
        peak_demand_risk = "high" if total_power_kw > ENERGY_CONFIG["peak_demand_threshold_kw"] * 0.8 else "low"
        
        # Calculate carbon footprint
        carbon_footprint_kg_per_hour = total_power_kw * ENERGY_CONFIG["carbon_factor_kg_per_kwh"]
        
        energy_analysis = {
            "location_id": location_id,
            "total_power_kw": round(total_power_kw, 2),
            "hourly_cost_usd": round(hourly_cost, 2),
            "average_efficiency_percent": round(average_efficiency, 1),
            "equipment_count": len(equipment_list),
            "equipment_breakdown": equipment_power_breakdown,
            "current_utility_rate": current_rate,
            "is_peak_period": is_peak_period,
            "peak_demand_risk": peak_demand_risk,
            "carbon_footprint_kg_per_hour": round(carbon_footprint_kg_per_hour, 2),
            "analysis_timestamp": datetime.now().isoformat()
        }
        
        # Store location energy data for trending
        location_energy_data[location_id] = energy_analysis
        
        influxdb3_local.info(f"[Energy Optimization] Location {location_id}: {total_power_kw:.1f} kW, ${hourly_cost:.2f}/hour, {average_efficiency:.1f}% efficiency")
        
        return energy_analysis
        
    except Exception as e:
        influxdb3_local.error(f"[Energy Optimization] Location analysis error for {location_id}: {e}")
        return {"total_power_kw": 0, "hourly_cost_usd": 0, "average_efficiency_percent": 0}

def identify_optimization_opportunities(influxdb3_local, location_id: str, energy_analysis: Dict) -> Dict:
    """
    Identify energy optimization opportunities for a location
    """
    try:
        opportunities = {
            "load_shifting": [],
            "efficiency_improvements": [],
            "peak_shaving": [],
            "equipment_staging": []
        }
        
        total_power = energy_analysis.get("total_power_kw", 0)
        is_peak_period = energy_analysis.get("is_peak_period", False)
        equipment_breakdown = energy_analysis.get("equipment_breakdown", {})
        
        # Identify load shifting opportunities
        if is_peak_period and total_power > ENERGY_CONFIG["peak_demand_threshold_kw"] * 0.7:
            for equipment_id, data in equipment_breakdown.items():
                equipment_type = data.get("equipment_type", "unknown")
                power_kw = data.get("power_kw", 0)
                
                if equipment_type in ["fancoil", "pump"] and power_kw > 2.0:
                    opportunities["load_shifting"].append({
                        "equipment_id": equipment_id,
                        "potential_savings_kw": power_kw * 0.3,
                        "action": "reduce_load_during_peak"
                    })
        
        # Identify efficiency improvements
        for equipment_id, data in equipment_breakdown.items():
            efficiency = data.get("efficiency_percent", 100)
            equipment_type = data.get("equipment_type", "unknown")
            
            if efficiency < 70:
                opportunities["efficiency_improvements"].append({
                    "equipment_id": equipment_id,
                    "current_efficiency": efficiency,
                    "target_efficiency": 85,
                    "potential_savings_kw": data.get("power_kw", 0) * 0.15
                })
        
        # Identify peak shaving opportunities
        if total_power > ENERGY_CONFIG["peak_demand_threshold_kw"]:
            # Calculate required load reduction
            target_reduction = total_power - ENERGY_CONFIG["peak_demand_threshold_kw"]
            
            # Prioritize equipment for load shedding
            for priority_type in ENERGY_CONFIG["load_shedding_priority"]:
                for equipment_id, data in equipment_breakdown.items():
                    if data.get("equipment_type") == priority_type and target_reduction > 0:
                        reduction_amount = min(data.get("power_kw", 0) * 0.5, target_reduction)
                        opportunities["peak_shaving"].append({
                            "equipment_id": equipment_id,
                            "reduction_kw": reduction_amount,
                            "priority": priority_type
                        })
                        target_reduction -= reduction_amount
        
        # Identify equipment staging opportunities
        equipment_by_type = defaultdict(list)
        for equipment_id, data in equipment_breakdown.items():
            equipment_type = data.get("equipment_type", "unknown")
            equipment_by_type[equipment_type].append({
                "equipment_id": equipment_id,
                "power_kw": data.get("power_kw", 0),
                "efficiency": data.get("efficiency_percent", 0)
            })
        
        # Suggest staging for equipment types with multiple units
        for equipment_type, equipment_list in equipment_by_type.items():
            if len(equipment_list) > 1 and equipment_type in ["chiller", "boiler", "pump"]:
                # Sort by efficiency (highest first)
                equipment_list.sort(key=lambda x: x["efficiency"], reverse=True)
                
                opportunities["equipment_staging"].append({
                    "equipment_type": equipment_type,
                    "recommended_order": [eq["equipment_id"] for eq in equipment_list],
                    "staging_strategy": "efficiency_priority"
                })
        
        total_opportunities = sum(len(opp_list) for opp_list in opportunities.values())
        influxdb3_local.info(f"[Energy Optimization] Location {location_id}: {total_opportunities} optimization opportunities identified")
        
        return opportunities
        
    except Exception as e:
        influxdb3_local.error(f"[Energy Optimization] Opportunity identification error for {location_id}: {e}")
        return {"load_shifting": [], "efficiency_improvements": [], "peak_shaving": [], "equipment_staging": []}

def generate_optimization_commands(influxdb3_local, location_id: str, opportunities: Dict) -> List[Dict]:
    """
    Generate specific optimization commands based on identified opportunities
    """
    try:
        commands = []
        
        # Generate load shifting commands
        for opportunity in opportunities.get("load_shifting", []):
            equipment_id = opportunity["equipment_id"]
            savings_kw = opportunity["potential_savings_kw"]
            
            command = {
                "equipment_id": equipment_id,
                "location_id": location_id,
                "command_type": "load_shift",
                "action": "reduce_power",
                "target_reduction_percent": 30,
                "duration_minutes": 60,
                "expected_savings_kw": savings_kw,
                "priority": "medium",
                "safety_check": validate_command_safety(equipment_id, "reduce_power", 30)
            }
            
            if command["safety_check"]:
                commands.append(command)
                influxdb3_local.info(f"[Energy Optimization] Load shift command for {equipment_id}: {savings_kw:.1f} kW reduction")
        
        # Generate peak shaving commands
        for opportunity in opportunities.get("peak_shaving", []):
            equipment_id = opportunity["equipment_id"]
            reduction_kw = opportunity["reduction_kw"]
            priority = opportunity["priority"]
            
            command = {
                "equipment_id": equipment_id,
                "location_id": location_id,
                "command_type": "peak_shave",
                "action": "temporary_reduction",
                "target_reduction_kw": reduction_kw,
                "duration_minutes": 15,
                "priority": "high",
                "load_shedding_priority": priority,
                "safety_check": validate_command_safety(equipment_id, "temporary_reduction", reduction_kw)
            }
            
            if command["safety_check"]:
                commands.append(command)
                influxdb3_local.info(f"[Energy Optimization] Peak shave command for {equipment_id}: {reduction_kw:.1f} kW reduction")
        
        # Generate efficiency optimization commands
        for opportunity in opportunities.get("efficiency_improvements", []):
            equipment_id = opportunity["equipment_id"]
            target_efficiency = opportunity["target_efficiency"]
            
            command = {
                "equipment_id": equipment_id,
                "location_id": location_id,
                "command_type": "efficiency_optimize",
                "action": "optimize_operation",
                "target_efficiency_percent": target_efficiency,
                "optimization_method": "automatic_tuning",
                "priority": "low",
                "safety_check": True
            }
            
            commands.append(command)
            influxdb3_local.info(f"[Energy Optimization] Efficiency optimization for {equipment_id}: target {target_efficiency}%")
        
        # Store commands for tracking
        optimization_commands.extend(commands)
        
        return commands
        
    except Exception as e:
        influxdb3_local.error(f"[Energy Optimization] Command generation error for {location_id}: {e}")
        return []

def write_energy_analytics(influxdb3_local, location_id: str, energy_analysis: Dict, opportunities: Dict, commands: List[Dict]):
    """
    Write energy analytics data to InfluxDB for reporting and tracking
    """
    try:
        timestamp = int(time.time() * 1_000_000_000)
        
        # Write energy consumption data
        consumption_line = create_line_protocol(
            measurement="energy_consumption",
            tags={
                "location_id": location_id,
                "period_type": "hourly",
                "rate_period": "peak" if energy_analysis.get("is_peak_period") else "off_peak"
            },
            fields={
                "total_power_kw": energy_analysis.get("total_power_kw", 0),
                "hourly_cost": energy_analysis.get("hourly_cost_usd", 0),
                "average_efficiency": energy_analysis.get("average_efficiency_percent", 0),
                "equipment_count": energy_analysis.get("equipment_count", 0),
                "carbon_footprint_kg": energy_analysis.get("carbon_footprint_kg_per_hour", 0)
            },
            timestamp=timestamp
        )
        
        # Write optimization opportunities
        total_opportunities = sum(len(opp_list) for opp_list in opportunities.values())
        opportunities_line = create_line_protocol(
            measurement="optimization_opportunities",
            tags={
                "location_id": location_id,
                "analysis_type": "real_time"
            },
            fields={
                "load_shifting_opportunities": len(opportunities.get("load_shifting", [])),
                "efficiency_opportunities": len(opportunities.get("efficiency_improvements", [])),
                "peak_shaving_opportunities": len(opportunities.get("peak_shaving", [])),
                "staging_opportunities": len(opportunities.get("equipment_staging", [])),
                "total_opportunities": total_opportunities
            },
            timestamp=timestamp
        )
        
        # Write optimization commands
        for command in commands:
            if command.get("safety_check", False):
                command_line = create_line_protocol(
                    measurement="optimization_commands",
                    tags={
                        "equipment_id": command["equipment_id"],
                        "location_id": location_id,
                        "command_type": command["command_type"],
                        "priority": command["priority"]
                    },
                    fields={
                        "action": command["action"],
                        "target_value": command.get("target_reduction_percent", command.get("target_reduction_kw", 0)),
                        "duration_minutes": command.get("duration_minutes", 0),
                        "expected_savings_kw": command.get("expected_savings_kw", 0)
                    },
                    timestamp=timestamp
                )
                influxdb3_local.write(command_line)
        
        # Write main analytics data
        for line in [consumption_line, opportunities_line]:
            influxdb3_local.write(line)
        
        influxdb3_local.info(f"[Energy Optimization] Analytics data written for location {location_id}")
        
    except Exception as e:
        influxdb3_local.error(f"[Energy Optimization] Write error for location {location_id}: {e}")

def calculate_equipment_power(equipment_id: str, metrics: Dict) -> float:
    """Calculate estimated power consumption for equipment"""
    equipment_type = determine_equipment_type(equipment_id)
    baselines = EQUIPMENT_POWER_BASELINES.get(equipment_type, {"min": 1.0, "max": 10.0, "optimal": 5.0})
    
    temperature_metrics = []
    for key, value in metrics.items():
        if "temp" in key.lower() and isinstance(value, (int, float)):
            temperature_metrics.append(float(value))
    
    if not temperature_metrics:
        return baselines["optimal"]
    
    avg_temp = sum(temperature_metrics) / len(temperature_metrics)
    
    # Estimate power based on operating conditions
    if equipment_type == "chiller":
        power_factor = min(1.5, max(0.5, (avg_temp - 60) / 20))
    elif equipment_type == "boiler":
        power_factor = min(1.5, max(0.5, (80 - avg_temp) / 30))
    else:
        power_factor = min(1.2, max(0.8, 1.0 + (avg_temp - 70) / 100))
    
    estimated_power = baselines["optimal"] * power_factor
    return round(max(baselines["min"], min(baselines["max"], estimated_power)), 2)

def calculate_energy_efficiency(equipment_id: str, metrics: Dict, power_consumption: float) -> float:
    """Calculate energy efficiency score for equipment"""
    equipment_type = determine_equipment_type(equipment_id)
    baselines = EQUIPMENT_POWER_BASELINES.get(equipment_type, {"optimal": 5.0})
    
    optimal_power = baselines["optimal"]
    
    if power_consumption <= optimal_power:
        efficiency = 100.0 - (optimal_power - power_consumption) / optimal_power * 20
    else:
        efficiency = 100.0 - (power_consumption - optimal_power) / optimal_power * 30
    
    return round(max(0, min(100, efficiency)), 1)

def determine_equipment_type(equipment_id: str) -> str:
    """Determine equipment type from equipment ID"""
    equipment_id_lower = equipment_id.lower()
    
    if "boiler" in equipment_id_lower:
        return "boiler"
    elif "chiller" in equipment_id_lower:
        return "chiller"
    elif "pump" in equipment_id_lower:
        return "pump"
    elif "ahu" in equipment_id_lower or "air" in equipment_id_lower:
        return "air-handler"
    elif "fancoil" in equipment_id_lower or "fan" in equipment_id_lower:
        return "fancoil"
    elif "geo" in equipment_id_lower:
        return "geo"
    else:
        return "unknown"

def get_current_utility_rate(hour: int) -> float:
    """Get current utility rate based on time of day"""
    if hour in UTILITY_RATES["peak"]["hours"]:
        return UTILITY_RATES["peak"]["rate"]
    elif hour in UTILITY_RATES["off_peak"]["hours"]:
        return UTILITY_RATES["off_peak"]["rate"]
    else:
        return UTILITY_RATES["standard"]["rate"]

def validate_command_safety(equipment_id: str, action: str, target_value: float) -> bool:
    """Validate that optimization commands are safe to execute"""
    equipment_type = determine_equipment_type(equipment_id)
    
    safety_limits = {
        "boiler": {"max_reduction_percent": 20, "min_operation_percent": 30},
        "chiller": {"max_reduction_percent": 30, "min_operation_percent": 40},
        "air-handler": {"max_reduction_percent": 40, "min_operation_percent": 20},
        "pump": {"max_reduction_percent": 50, "min_operation_percent": 25},
        "fancoil": {"max_reduction_percent": 60, "min_operation_percent": 10},
        "geo": {"max_reduction_percent": 25, "min_operation_percent": 35}
    }
    
    limits = safety_limits.get(equipment_type, {"max_reduction_percent": 30, "min_operation_percent": 30})
    
    if action in ["reduce_power", "temporary_reduction"]:
        if isinstance(target_value, (int, float)):
            if target_value > limits["max_reduction_percent"]:
                return False
    
    return True

def create_line_protocol(measurement: str, tags: Dict, fields: Dict, timestamp: int) -> object:
    """Create InfluxDB line protocol object"""
    class LineProtocolBuilder:
        def __init__(self, measurement_name):
            self.measurement_name = measurement_name
            self.tags_dict = {}
            self.fields_dict = {}
            self.timestamp_ns = None
        
        def tag(self, key, value):
            self.tags_dict[key] = str(value)
            return self
        
        def field(self, key, value):
            if isinstance(value, str):
                self.fields_dict[key] = f'"{value}"'
            else:
                self.fields_dict[key] = str(value)
            return self
        
        def timestamp(self, ts):
            self.timestamp_ns = ts
            return self
        
        def build(self):
            line = self.measurement_name
            
            if self.tags_dict:
                tag_str = ",".join([f"{k}={v}" for k, v in self.tags_dict.items()])
                line += f",{tag_str}"
            
            if self.fields_dict:
                field_str = ",".join([f"{k}={v}" for k, v in self.fields_dict.items()])
                line += f" {field_str}"
            
            if self.timestamp_ns:
                line += f" {self.timestamp_ns}"
            
            return line
    
    builder = LineProtocolBuilder(measurement)
    
    for key, value in tags.items():
        builder.tag(key, value)
    
    for key, value in fields.items():
        builder.field(key, value)
    
    builder.timestamp(timestamp)
    
    return builder
