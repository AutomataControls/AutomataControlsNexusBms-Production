/**
 * Enhanced Metric mappings for the monitoring service
 * Updated on 2025-05-11
 *
 * Complete revision based on actual RTDB structure and Firestore equipment
 * Optimized to improve detection rate from 38/90 to closer to 65/90 thresholds
 */

// Specific location-based mappings - EXPANDED
const specificLocationMappings = {
  // Mapping based on the actual RTDB structure seen in the screenshot

  // HopbridgeAutismCenter (id: "5") specific mappings
  HopbridgeAutismCenter: {
    "Supply Air temperature": ["SupplyAirTemp", "Supply Temperature", "SAT", "SupplyTemp", "SupplyAirTemperature", "Supply"],
    "Return Air temperature": ["ReturnAirTemp", "Return Temperature", "RAT", "ReturnTemp", "ReturnAirTemperature", "Return"],
    "Water Supply temperature": ["WaterSupplyTemp", "WST", "H2OSupply", "Supply", "Supply Temperature", "WaterSupplyTemperature"],
    "Water Return temperature": ["WaterReturnTemp", "WRT", "H2OReturn", "Return", "Return Temperature", "WaterReturnTemperature"],
    "Boiler temperature": ["Supply Temperature", "BoilerTemp", "Supply", "BoilerTemperature"],
    // System-specific mappings
    "AHU-1 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "AHU-2 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "AHU-3 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "Boilers temperature": ["Supply", "BoilerTemp", "Supply Temperature", "Temp"],
  },

  // ID "5" direct mappings
  "5": {
    "Supply Air temperature": ["SupplyAirTemp", "Supply Temperature", "SAT", "SupplyTemp", "SupplyAirTemperature", "Supply"],
    "Return Air temperature": ["ReturnAirTemp", "Return Temperature", "RAT", "ReturnTemp", "ReturnAirTemperature", "Return"],
    "Water Supply temperature": ["WaterSupplyTemp", "WST", "H2OSupply", "Supply", "Supply Temperature", "WaterSupplyTemperature"],
    "Water Return temperature": ["WaterReturnTemp", "WRT", "H2OReturn", "Return", "Return Temperature", "WaterReturnTemperature"],
    "Boiler temperature": ["Supply Temperature", "BoilerTemp", "Supply", "BoilerTemperature"],
    // System-specific mappings
    "AHU-1 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "AHU-2 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "AHU-3 Supply temperature": ["Supply", "SupplyTemp", "Supply Temperature", "Temp"],
    "Boilers temperature": ["Supply", "BoilerTemp", "Supply Temperature", "Temp"],
  },

  // NERealtyGroup (id: "10") specific mappings
  NERealtyGroup: {
    "Water Supply Temperature": ["H20SupplyTemp", "H2O Supply Temperature", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return Temperature": ["H20ReturnTemp", "H2O Return Temperature", "H20Return", "Return", "WaterReturnTemperature"],
    "Ambient Temperature": ["AmbientTemp", "ZoneTemp", "SpaceTemp", "AmbientTemperature"],
    "Outdoor Air Temperature": ["OutdoorAirTemp", "OutdoorTemp", "OutdoorAir", "Outdoor Temperature", "OutdoorAirTemperature"],
    "Target Temperature": ["TargetTemp", "Setpoint", "SetPoint", "Global Setpoint", "GlobalSetpoint", "TargetTemperature"],
    "Freeze Status": ["FreezeStat", "FreezeStatus", "FrzStat", "Freezestat", "FreezeStatStatus"],
    "Alarm Status": ["AlarmStatus", "Alarm", "AlarmState", "AlarmStatusState"],
    "HVAC State": ["HvacState", "Mode", "SystemMode", "HVACState"],
    "Active Switch State": ["ActiveSwitchState", "Switch", "ActiveState", "SwitchState"],
    // System-specific mappings
    "Geo-1 temperature": ["Supply", "Return", "Temperature", "Temp"],
    "GeoLoop temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // ID "10" direct mappings
  "10": {
    "Water Supply Temperature": ["H20SupplyTemp", "H2O Supply Temperature", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return Temperature": ["H20ReturnTemp", "H2O Return Temperature", "H20Return", "Return", "WaterReturnTemperature"],
    "Ambient Temperature": ["AmbientTemp", "ZoneTemp", "SpaceTemp", "AmbientTemperature"],
    "Outdoor Air Temperature": ["OutdoorAirTemp", "OutdoorTemp", "OutdoorAir", "Outdoor Temperature", "OutdoorAirTemperature"],
    "Target Temperature": ["TargetTemp", "Setpoint", "SetPoint", "Global Setpoint", "GlobalSetpoint", "TargetTemperature"],
    "Freeze Status": ["FreezeStat", "FreezeStatus", "FrzStat", "Freezestat", "FreezeStatStatus"],
    "Alarm Status": ["AlarmStatus", "Alarm", "AlarmState", "AlarmStatusState"],
    "HVAC State": ["HvacState", "Mode", "SystemMode", "HVACState"],
    "Active Switch State": ["ActiveSwitchState", "Switch", "ActiveState", "SwitchState"],
    // System-specific mappings
    "Geo-1 temperature": ["Supply", "Return", "Temperature", "Temp"],
    "GeoLoop temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // Residential (id: "12") specific mappings
  Residential: {
    "Water Supply temperature": ["H2O Supply", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return temperature": ["H2O Return", "H20Return", "Return", "WaterReturnTemperature"],
    "Zone temperature": ["Thermostat Ambient Temperature", "Average Temperature", "ZoneTemperature"],
    "Boiler temperature": ["H2O Supply", "Supply", "BoilerTemperature"],
    // System-specific mappings
    "RRCottage temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // ID "12" direct mappings
  "12": {
    "Water Supply temperature": ["H2O Supply", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return temperature": ["H2O Return", "H20Return", "Return", "WaterReturnTemperature"],
    "Zone temperature": ["Thermostat Ambient Temperature", "Average Temperature", "ZoneTemperature"],
    "Boiler temperature": ["H2O Supply", "Supply", "BoilerTemperature"],
    // System-specific mappings
    "RRCottage temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // StJohnCatholicSchool (id: "11") specific mappings
  StJohnCatholicSchool: {
    "Water Supply temperature": ["H2O Supply", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return temperature": ["H2O Return", "H20Return", "Return", "WaterReturnTemperature"],
    "Supply Air temperature": ["Supply Air", "SupplyAir", "SupplyAirTemperature", "Supply"],
    "Ambient Temperature": ["Ambient Temperature", "Space Temperature", "AmbientTemperature"],
    // System-specific mappings
    "Chiller temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // ID "11" direct mappings
  "11": {
    "Water Supply temperature": ["H2O Supply", "H20Supply", "Supply", "WaterSupplyTemperature"],
    "Water Return temperature": ["H2O Return", "H20Return", "Return", "WaterReturnTemperature"],
    "Supply Air temperature": ["Supply Air", "SupplyAir", "SupplyAirTemperature", "Supply"],
    "Ambient Temperature": ["Ambient Temperature", "Space Temperature", "AmbientTemperature"],
    // System-specific mappings
    "Chiller temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // StJudeCatholicSchool (id: "2") specific mappings
  StJudeCatholicSchool: {
    "Zone temperature": ["Space Temperature", "SpaceTemp", "ZoneTemperature"],
    "Supply Air temperature": ["Supply Temperature", "SupplyTemp", "SupplyAirTemperature", "Supply"],
    // System-specific mappings
    "Room110_FCU-110 temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // ID "2" direct mappings
  "2": {
    "Zone temperature": ["Space Temperature", "SpaceTemp", "ZoneTemperature"],
    "Supply Air temperature": ["Supply Temperature", "SupplyTemp", "SupplyAirTemperature", "Supply"],
    // System-specific mappings
    "Room110_FCU-110 temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // TaylorUniversity (id: "7") specific mappings
  TaylorUniversity: {
    "Zone temperature": ["Average Temperature", "Zone 1 Temperature", "Temperature 1", "ZoneTemp", "Zone1Temp", "ZoneTemperature"],
    "Zone humidity": ["Zone 1 Humidity", "Average Humidity", "ZoneHumidity", "Zone1Humidity"],
    "Supply Air temperature": ["Temperature 1", "SupplyTemp", "SupplyAir", "SupplyAirTemperature", "Supply"],
    "Supply Air humidity": ["Humidity 1", "SupplyHumidity", "SupplyRH", "SupplyAirHumidity"],
    "Outdoor temperature": ["Outside Temperature", "OutdoorTemp", "OutdoorAir", "Outdoor Temperature", "OutdoorTemperature"],
    "Outdoor humidity": ["Outdoor Humidity", "OutdoorHumidity", "OutdoorRH"],
    // System-specific mappings
    "Greenhouse temperature": ["Supply", "Return", "Temperature", "Temp"],
  },

  // ID "7" direct mappings
  "7": {
    "Zone temperature": ["Average Temperature", "Zone 1 Temperature", "Temperature 1", "ZoneTemp", "Zone1Temp", "ZoneTemperature"],
    "Zone humidity": ["Zone 1 Humidity", "Average Humidity", "ZoneHumidity", "Zone1Humidity"],
    "Supply Air temperature": ["Temperature 1", "SupplyTemp", "SupplyAir", "SupplyAirTemperature", "Supply"],
    "Supply Air humidity": ["Humidity 1", "SupplyHumidity", "SupplyRH", "SupplyAirHumidity"],
    "Outdoor temperature": ["Outside Temperature", "OutdoorTemp", "OutdoorAir", "Outdoor Temperature", "OutdoorTemperature"],
    "Outdoor humidity": ["Outdoor Humidity", "OutdoorHumidity", "OutdoorRH"],
    // System-specific mappings
    "Greenhouse temperature": ["Supply", "Return", "Temperature", "Temp"],
  },
};

// Enhanced system name mappings - updated based on RTDB structure
const systemNameMappings = {
  // From the screenshot - HopbridgeAutismCenter systems
  "AHU-1": ["AHU1", "AHU-1", "Air Handler 1", "Air Handling Unit 1"],
  "AHU-2": ["AHU2", "AHU-2", "Air Handler 2", "Air Handling Unit 2"],
  "AHU-3": ["AHU3", "AHU-3", "Air Handler 3", "Air Handling Unit 3"],
  "Boilers": ["Boiler", "Boiler-1", "Boiler1", "Boiler-2", "Boiler2", "Boiler 1", "Boiler 2"],

  // From the screenshot - NERealtyGroup systems
  "Geo-1": ["GeoLoop", "Geo1", "Geo-1", "Geo Loop 1"],
  "GeoLoop": ["Geo-1", "Geo1", "GeoLoop", "Geo Loop"],

  // From the screenshot - Residential systems
  "RRCottage": ["RRCottage", "Residential", "Cottage"],

  // From the screenshot - StJohnCatholicSchool systems
  "Chiller": ["Chiller", "ChillerSystem", "Chiller-1", "Chiller1"],

  // From the screenshot - StJudeCatholicSchool systems
  "Room110_FCU-110": ["Room110FCU110", "FCU-110", "FCU110", "Room110", "Room 110 FCU"],

  // Other known systems (based on test results)
  "Greenhouse": ["Greenhouse", "GreenHouse", "Green House"],

  // Generic Fallbacks - grouped by type
  "Fan Coil": [
    "FCU", "AHU", "Fan Coil Unit", "Air Handler", "Air Handling Unit",
    "FCU-1", "FCU-2", "FCU-3", "FCU-4", "FCU-5", "FCU-6", "FCU-7", "FCU-8",
    "FanCoil1", "FanCoil2", "FanCoil3", "FanCoil4", "FanCoil5", "FanCoil6", "FanCoil7", "FanCoil8",
    "AHU-1", "AHU-2", "AHU-3", "AHU-4", "AHU-5", "AHU-6", "AHU-7", "AHU-8"
  ],
  "Boiler": [
    "ComfortBoiler-1", "ComfortBoiler-2", "DomesticBoiler-1", "DomesticBoiler-2",
    "Boiler-1", "Boiler-2", "Boilers", "RehabBoilers"
  ],
  "Pump": [
    "HWPump-1", "HWPump-2", "CWPump-1", "CWPump-2",
    "HWP-1", "HWP-2", "CWP-1", "CWP-2",
    "Pump-1", "Pump-2", "Pump-3", "Pump-4"
  ]
};

// Enhanced temperature metric mappings
const temperatureMetricMappings = {
  // Supply air temperature mappings
  "Supply Air temperature": [
    "SupplyTemp",
    "Supply Temperature",
    "supply",
    "supplyTemp",
    "DischargeAir",
    "Discharge Air",
    "DischargeAIr",
    "Supply",
    "SupplyAIr",
    "Supply Air Temperature",
    "SAT",
    "Temperature 1",
    "SupplyAirTemp",
    "Supply_Temperature",
    "SA_Temp",
    "H2O Supply Temperature",
    "SupplyTemperature",
    "DischargeAir",
    "SupplyAir",
    "SATemp",
    "Temperature1",
    "Temp1",
    "H2OSupplyTemperature",
    "H20Supply"
  ],

  // Return air temperature mappings
  "Return Air temperature": [
    "ReturnTemp",
    "Return Temperature",
    "return",
    "ReturnAir",
    "ReturnAIr",
    "Return Air Temperature",
    "RAT",
    "Temperature 2",
    "ReturnAirTemp",
    "Return_Temperature",
    "RA_Temp",
    "H2O Return Temperature",
    "ReturnTemp",
    "ReturnTemperature",
    "Return",
    "ReturnAir",
    "RATemp",
    "Temperature2",
    "Temp2",
    "H2OReturnTemperature",
    "H20Return"
  ],

  // Mixed air temperature mappings
  "Mixed Air temperature": [
    "MixedAirTemp",
    "Mixed Air Temperature",
    "mixedAir",
    "MixedAir",
    "Mixed Air",
    "MAT",
    "Mixed_Air_Temperature",
    "MixedAirTemp",
    "MixedAirTemperature",
    "MixedAir",
    "MATemp"
  ],

  // Outdoor air temperature mappings
  "Outdoor Air temperature": [
    "OutdoorTemp",
    "Outdoor Temperature",
    "outdoorTemp",
    "OutdoorAirTemp",
    "outsideTemp",
    "Outdoor Air Temperature",
    "IntakeAir",
    "Outside Temperature",
    "OAT",
    "Outside_Temp",
    "Outdoor_Air",
    "OutdoorTemp",
    "OutdoorTemperature",
    "OutdoorAirTemp",
    "OutsideTemp",
    "OutdoorAirTemperature",
    "IntakeAir",
    "OutsideTemperature",
    "OATemp"
  ],

  // Space/Zone temperature mappings 
  "Zone temperature": [
    "SpaceTemp",
    "Space Temperature",
    "spaceTemp",
    "ZoneTemp",
    "Zone Temperature",
    "indoorTemp",
    "ambient_temperature",
    "temp1",
    "temp2",
    "zones/zone1/temp",
    "zones/zone2/temp",
    "spaceTemp1",
    "spaceTemp2",
    "SouthOffice",
    "NorthUpstairs",
    "SouthDropRoomTemp",
    "NorthDropRoomTemp",
    "Average Temperature",
    "Zone 1 Temperature",
    "Zone 2 Temperature",
    "Temperature 1",
    "Temperature 2",
    "Thermostat Ambient Temperature",
    "Lab Temperature",
    "AmbientTemp",
    "Zone1Temp",
    "Zone2Temp",
    "Room_Temperature",
    "North Zone",
    "South Zone",
    "NorthZone",
    "SouthZone",
    "Zone1",
    "Zone2",
    "SpaceTemp",
    "SpaceTemperature",
    "ZoneTemp",
    "ZoneTemperature",
    "IndoorTemp",
    "AmbientTemperature",
    "Temperature1",
    "Temperature2",
    "Zone1Temp",
    "Zone2Temp",
    "AverageTemperature",
    "Zone1Temperature",
    "Zone2Temperature",
    "RoomTemperature",
    "LabTemp",
    "coveTemp",
    "kitchenTemp",
    "mailroomTemp",
    "chapelTemp",
    "CoveTemp",
    "KitchenTemp",
    "MailroomTemp",
    "ChapelTemp"
  ],

  // Water temperature mappings
  "Water Supply temperature": [
    "H20Supply",
    "Water Supply Temperature",
    "H20SupplyTemp",
    "HeatingLoopSupplyTemp",
    "CoolingLoopSupplyTemp",
    "Supply",
    "BoilerLoopTemp",
    "H2O Supply",
    "H2O Supply Temperature",
    "H2O Supply Alt",
    "Boiler Loop Temperature",
    "WST",
    "WaterSupplyTemp",
    "Hot_Water_Supply",
    "Chilled_Water_Supply",
    "H20Supply",
    "WaterSupplyTemperature",
    "H20SupplyTemp",
    "HeatingLoopSupply",
    "CoolingLoopSupply",
    "Supply",
    "BoilerLoopTemp",
    "H2OSupply",
    "H2OSupplyTemperature",
    "BoilerLoopTemperature",
    "WSTemp",
    "WaterSupply",
    "HotWaterSupply",
    "ChilledWaterSupply"
  ],

  "Water Return temperature": [
    "H20Return",
    "Water Return Temperature",
    "H20ReturnTemp",
    "HeatingLoopReturnTemp",
    "CoolingLoopReturnTemp",
    "Return",
    "H2O Return",
    "H2O Return Temperature",
    "WRT",
    "WaterReturnTemp",
    "Hot_Water_Return",
    "Chilled_Water_Return",
    "H20Return",
    "WaterReturnTemperature",
    "H20ReturnTemp",
    "HeatingLoopReturn",
    "CoolingLoopReturn",
    "Return",
    "H2OReturn",
    "H2OReturnTemperature",
    "WRTemp",
    "WaterReturn",
    "HotWaterReturn",
    "ChilledWaterReturn"
  ],

  // Boiler temperature mappings
  "Boiler temperature": [
    "BoilerTemp",
    "Boiler Temperature",
    "boilerTemp",
    "Boiler Loop Temperature",
    "Supply Temperature",
    "H2O Supply",
    "H20Supply",
    "Supply",
    "HeatingLoopSupplyTemp",
    "Heating Loop Supply Temperature",
    "BTL",
    "Boiler_Temp",
    "Boiler_Out_Temp",
    "Boiler_Leaving_Temperature",
    "BoilerTemp",
    "BoilerTemperature",
    "BoilerLoopTemperature",
    "SupplyTemperature",
    "H2OSupply",
    "H20Supply",
    "Supply",
    "HeatingLoopSupply",
    "BoilerOutTemp",
    "BoilerLeavingTemperature"
  ],

  // Freeze Stat temperature mappings
  "Freeze Stat temperature": [
    "FreezeStatTemp",
    "FreezeStat Temperature",
    "Freeze Temperature",
    "Freezestat Temp",
    "FrzTemp",
    "Freeze_Temperature",
    "Low Limit Temperature",
    "LowLimitTemp",
    "FreezeStatTemp",
    "FreezeStatTemperature",
    "FreezeTemperature",
    "FreezeStat",
    "FrzTemp",
    "LowLimitTemperature",
    "LowLimitTemp",
    "Freezestat",
    "Freeze Status",
    "Freeze Stat"
  ],

  // Steam temperature mappings
  "Steam temperature": [
    "SteamTemp",
    "Steam Temperature",
    "steamTemp",
    "Supply Temperature",
    "Supply",
    "SteamPressure",
    "Steam_Temperature",
    "SteamTemp",
    "SteamTemperature",
    "SupplyTemperature",
    "Supply",
    "SteamPressure"
  ]
};

// Humidity metric mappings with both spaced and non-spaced versions
const humidityMetricMappings = {
  "Humidity": [
    "humidity",
    "Humidity",
    "spaceHumidity",
    "spaceRH",
    "spaceRH1",
    "spaceRH2",
    "LabRH",
    "OutdoorHumidity",
    "zones/zone1/humidity",
    "zones/zone2/humidity",
    "humidity1",
    "humidity2",
    "averagehumidity",
    "Humidity",
    "SpaceHumidity",
    "SpaceRH",
    "SpaceRH1",
    "SpaceRH2",
    "LabRH",
    "OutdoorHumidity",
    "Zone1Humidity",
    "Zone2Humidity",
    "Humidity1",
    "Humidity2",
    "AverageHumidity"
  ],

  // Zone humidity mappings
  "Zone humidity": [
    "Zone Humidity",
    "Zone 1 Humidity",
    "Zone 2 Humidity",
    "Average Humidity",
    "Humidity 1",
    "Humidity 2",
    "Space Humidity",
    "Space RH",
    "Space RH 1",
    "Space RH 2",
    "Space RH 3",
    "Space RH 4",
    "Space RH 5",
    "Lab RH",
    "Zone1RH",
    "Zone2RH",
    "Room_Humidity",
    "ZoneHumidity",
    "Zone1Humidity",
    "Zone2Humidity",
    "AverageHumidity",
    "Humidity1",
    "Humidity2",
    "SpaceHumidity",
    "SpaceRH",
    "SpaceRH1",
    "SpaceRH2",
    "SpaceRH3",
    "SpaceRH4",
    "SpaceRH5",
    "LabRH",
    "Zone1RH",
    "Zone2RH",
    "RoomHumidity"
  ],

  // Supply Air humidity mappings
  "Supply Air humidity": [
    "Supply Air Humidity",
    "Supply Humidity",
    "SupplyHumidity",
    "SAH",
    "DischargeHumidity",
    "SA_Humidity",
    "Supply_RH",
    "Humidity 1",
    "Zone 1 Humidity",
    "SupplyAirHumidity",
    "SupplyHumidity",
    "SAHumidity",
    "DischargeHumidity",
    "SupplyRH",
    "Humidity1",
    "Zone1Humidity"
  ],

  // Outdoor humidity mappings
  "Outdoor humidity": [
    "Outdoor Humidity",
    "OutdoorHumidity",
    "OutdoorRH",
    "Outside Humidity",
    "Outside RH",
    "OutdoorRelativeHumidity",
    "OAH",
    "Outdoor_Humidity",
    "OutsideHumidity"
  ]
};

// Status metric mappings
const statusMetricMappings = {
  // Fan status mappings
  "Fan Status": [
    "FanStatus",
    "Fan Status",
    "FanRunning",
    "FanEnabled",
    "VFDStatus",
    "VFDEnable",
    "VFDspeed",
    "VFDSpeed",
    "vfd",
    "Fan Running",
    "Fan Enabled",
    "VFD Speed",
    "FanStatus",
    "FanRunning",
    "FanEnabled",
    "VFDStatus",
    "VFDEnable",
    "VFDSpeed",
    "FanAmp",
    "FanCurrent",
    "Fan Amps",
    "Supply Fan Status",
    "SupplyFanStatus",
    "Exhaust Fan Status",
    "ExhaustFanStatus"
  ],

  // Pump status mappings with additional amps metrics
  "Pump Status": [
    "PumpStatus",
    "Pump Status",
    "PumpRunning",
    "hwp1_status",
    "hwp2_status",
    "cwp1_status",
    "cwp2_status",
    "HWPump1Status",
    "HWPump2Status",
    "Pump1Status",
    "Pump2Status",
    "activePump",
    "Pump Running",
    "HW Pump 1 Status",
    "HW Pump 2 Status",
    "Aux Pump Status",
    "VAV Pump Status",
    "Pump 1 Status",
    "Pump 2 Status",
    "Pump 3 Status",
    "Pump 4 Status",
    "PumpStatus",
    "PumpRunning",
    "HWP1Status",
    "HWP2Status",
    "CWP1Status",
    "CWP2Status",
    "HWPump1Status",
    "HWPump2Status",
    "Pump1Status",
    "Pump2Status",
    "ActivePump",
    "HWP1Amps",
    "HWP2Amps",
    "CWP1Amps",
    "CWP2Amps",
    "HWPump1Amps",
    "HWPump2Amps",
    "CWPump1Amps",
    "CWPump2Amps",
    "Pump 1 Amps",
    "Pump 2 Amps",
    "Pump Amps",
    "Pump Running"
  ],

  // Freeze status mappings
  "Freeze Status": [
    "FreezeStat",
    "Freeze Status",
    "Freezestat",
    "freezeStatus",
    "freezeTrip",
    "FreezeTrip",
    "Freeze Stat",
    "Freeze Trip",
    "FreezeStat",
    "FreezeStatus",
    "FreezeTrip",
    "Freeze Alarm",
    "FreezeAlarm"
  ],

  // Compressor status mappings
  "Compressor Status": [
    "CompStatus",
    "Compressor Status",
    "stage1Enabled",
    "stage2Enabled",
    "Stage1Enabled",
    "Stage2Enabled",
    "Stage 1 Enabled",
    "Stage 2 Enabled",
    "CompStatus",
    "CompressorStatus",
    "Stage1Enabled",
    "Stage2Enabled",
    "Stage1",
    "Stage2",
    "Cooling Stage 1",
    "Cooling Stage 2",
    "CoolingStage1",
    "CoolingStage2"
  ],

  // Boiler status mappings
  "Boiler Status": [
    "Boiler1Status",
    "Boiler2Status",
    "b1boiler_status",
    "b2boiler_status",
    "boiler1Enable",
    "boiler2Enable",
    "boiler3Enable",
    "boiler4Enable",
    "Boiler 1 Enabled",
    "Boiler 2 Enabled",
    "Boiler 2 Status",
    "Boiler Enable",
    "Boiler1Status",
    "Boiler2Status",
    "Boiler1Enable",
    "Boiler2Enable",
    "Boiler3Enable",
    "Boiler4Enable",
    "BoilerEnable",
    "Boiler 1 Status",
    "Boiler Status",
    "BoilerStatus"
  ],

  // Chiller status mappings
  "Chiller Status": [
    "chiller1Enable",
    "chiller2Enable",
    "Chiller 1 Status",
    "Chiller 2 Status",
    "Chiller Status",
    "Chiller1Enable",
    "Chiller2Enable",
    "Chiller1Status",
    "Chiller2Status",
    "ChillerStatus",
    "Chiller Enable",
    "ChillerEnable"
  ],

  // Alarm status mappings
  "Alarm Status": [
    "AlarmStatus",
    "Alarm Status",
    "alarmStatus",
    "AlarmStatus",
    "Alarm",
    "Alert",
    "FaultStatus",
    "Fault",
    "Cooling Alarm",
    "CoolingAlarm",
    "Heating Alarm",
    "HeatingAlarm",
    "H2O Alarm",
    "H2OAlarm"
  ],

  // HVAC state mappings
  "HVAC State": [
    "HvacState",
    "HVAC State",
    "hvacState",
    "Mode",
    "SystemMode",
    "HVACState",
    "Thermostat Mode",
    "ThermostatMode",
    "Operating Mode",
    "OperatingMode"
  ],

  // Valve position mappings
  "Valve Position": [
    "Valve1Percent",
    "Valve2Percent",
    "Valve Position",
    "ValvePosition",
    "1/3Act",
    "2/3Act",
    "OneThird Actuator",
    "TwoThirds Actuator",
    "ValvePos",
    "Valve_Position",
    "Valve_Opening",
    "ValvePosition",
    "ValvePercent",
    "ValveOpening",
    "ActuatorPosition",
    "Cooling Actuator",
    "CoolingActuator",
    "Heating Actuator",
    "HeatingActuator",
    "HW Actuator",
    "HWActuator",
    "CW Actuator",
    "CWActuator",
    "Valve 1 Percent",
    "Valve 2 Percent"
  ]
};

// Pressure and Flow Metric Mappings
const pressureAndFlowMetricMappings = {
  // Pressure metrics
  "Differential Pressure": [
    "Differential Pressure",
    "DifferentialPressure",
    "Diff Pressure",
    "DiffPressure",
    "DP",
    "Static Pressure",
    "StaticPressure",
    "BuildingPressure",
    "Building Pressure"
  ],

  "Pump Pressure": [
    "Pump Pressure",
    "Pump Pressure (alt)",
    "PumpPressure",
    "Pump Discharge Pressure",
    "PumpDischargePressure",
    "Discharge Pressure",
    "DischargePressure"
  ],

  // Flow metrics
  "Flow Rate": [
    "Flow Rate",
    "FlowRate",
    "Flow",
    "CFM",
    "GPM",
    "cfm",
    "gpm",
    "AirFlow",
    "Air Flow",
    "WaterFlow",
    "Water Flow"
  ]
};

// Specialized Metric Mappings
const specializedMetricMappings = {
  // Temperature setpoints
  "Setpoint": [
    "Setpoint",
    "setpoint",
    "SetPoint",
    "Set Point",
    "TargetTemp",
    "TargetTemperature",
    "Target Temperature",
    "target_temperature",
    "GlobalSetpoint",
    "Global Setpoint"
  ],

  "Temperature Differential": [
    "TempDifferential",
    "Temperature Differential",
    "SetpointDifferential",
    "Setpoint Differential",
    "CoolingDifferential",
    "Cooling Differential",
    "HeatingDifferential",
    "Heating Differential",
    "DM Temperature Differential"
  ],

  // Actuator position metrics
  "Cooling Actuator": [
    "ClgAct",
    "Cooling Actuator",
    "cwActuator",
    "CW Actuator",
    "CW_Actuator",
    "Cooling_Valve",
    "CoolingActuator",
    "CWActuator",
    "CoolingValve",
    "CWValve"
  ],

  "Heating Actuator": [
    "HtgAct",
    "Heating Actuator",
    "hwActuator",
    "htg_Actuator",
    "preheatValve",
    "reheatValve",
    "HW Actuator",
    "Preheat Valve",
    "Reheat Valve",
    "HW_Actuator",
    "Heating_Valve",
    "HeatingActuator",
    "HWActuator",
    "PreheatValve",
    "ReheatValve",
    "HeatingValve"
  ],

  "Outdoor Air Actuator": [
    "OAAct",
    "Outdoor Air Actuator",
    "oaActuator",
    "OutdoorAct",
    "OA_Actuator",
    "oa_Actuator",
    "OA Actuator",
    "Outdoor Actuator",
    "Fresh_Air_Damper",
    "OAD",
    "OutdoorAirActuator",
    "OAActuator",
    "OutdoorActuator",
    "FreshAirDamper",
    "OADamper"
  ],

  "Return Air Actuator": [
    "ReturnAct",
    "Return Air Actuator",
    "ra_Actuator",
    "RA_Actuator",
    "Return Actuator",
    "RAD",
    "Return_Air_Damper",
    "ReturnAirActuator",
    "RAActuator",
    "ReturnActuator",
    "RADamper",
    "ReturnAirDamper"
  ]
};

/**
 * Determine the likely type of a metric based on its name
 * @param {string} metricName - The metric name
 * @returns {string|null} - The likely metric type or null if unknown
 */
function getMetricType(metricName) {
  const nameLower = metricName.toLowerCase();

  // Check for temperature metrics
  if (
    nameLower.includes("temp") ||
    nameLower.includes("discharge") ||
    (nameLower.includes("air") && !nameLower.includes("actuator")) ||
    (nameLower.includes("supply") && !nameLower.includes("actuator")) ||
    (nameLower.includes("return") && !nameLower.includes("actuator")) ||
    nameLower.includes("h20") ||
    nameLower.includes("loop") ||
    nameLower.includes("boiler") ||
    nameLower.includes("steam") ||
    nameLower.includes("cove") ||
    nameLower.includes("kitchen") ||
    nameLower.includes("chapel") ||
    nameLower.includes("mailroom")
  ) {
    return "temperature";
  }
  // Check for humidity metrics
  else if (nameLower.includes("humid") || nameLower.includes("rh")) {
    return "humidity";
  }
  // Check for actuator metrics
  else if (
    nameLower.includes("actuator") ||
    nameLower.includes("valve") ||
    (nameLower.includes("act") && !nameLower.includes("active"))
  ) {
    return "actuator";
  }
  // Check for status metrics
  else if (
    nameLower.includes("status") ||
    nameLower.includes("state") ||
    nameLower.includes("enabled") ||
    nameLower.includes("running")
  ) {
    return "status";
  }
  // Check for current/amps metrics
  else if (nameLower.includes("amp") || nameLower.includes("current")) {
    return "current";
  }
  // Check for pressure metrics
  else if (nameLower.includes("pressure") || nameLower.includes("psi")) {
    return "pressure";
  }
  // Check for flow metrics
  else if (nameLower.includes("flow") || nameLower.includes("cfm") || nameLower.includes("gpm")) {
    return "flow";
  }
  // Check for setpoint metrics
  else if (nameLower.includes("setpoint") || nameLower.includes("target")) {
    return "setpoint";
  }
  // Check for power metrics
  else if (nameLower.includes("power") || nameLower.includes("kw") || nameLower.includes("watt")) {
    return "power";
  }
  // Check for energy metrics
  else if (nameLower.includes("energy") || nameLower.includes("kwh")) {
    return "energy";
  }
  // Check for voltage metrics
  else if (nameLower.includes("voltage") || nameLower.includes("volt")) {
    return "voltage";
  }

  return null;
}

/**
 * Get a metric value using the mapping strategy
 * @param {string} locationId - The location ID
 * @param {string} systemId - The system/equipment ID
 * @param {string} metricName - The metric name to look for
 * @param {Object} rtdbData - The RTDB data
 * @returns {number|null} - The metric value or null if not found
 */
function getMetricValue(locationId, systemId, metricName, rtdbData) {
  if (!rtdbData) {
    console.log("No RTDB data available");
    return null;
  }

  try {
    // Find the location key that matches the locationId
    let locationKey = null;

    // Try direct match first
    if (rtdbData[locationId]) {
      locationKey = locationId;
    } else {
      // If not found directly, search through all locations
      console.log(`Location ${locationId} not found directly, searching through all locations`);

      // Try to find a location with a matching ID property
      for (const [key, value] of Object.entries(rtdbData)) {
        if (value.id === locationId) {
          locationKey = key;
          console.log(`Found location with matching ID: ${key}`);
          break;
        }
      }

      if (!locationKey) {
        console.log(`No location found for ID: ${locationId}`);
        return null;
      }
    }

    // Check if location has systems
    if (!rtdbData[locationKey].systems) {
      console.log(`No systems found for location ${locationKey}`);
      return null;
    }

    // Check if system exists directly
    if (!rtdbData[locationKey].systems[systemId]) {
      console.log(`System ${systemId} not found in location ${locationKey}`);

      // Try to find a system with a similar name using our mappings
      const systemKeys = Object.keys(rtdbData[locationKey].systems);
      console.log(`Available systems in ${locationKey}: ${systemKeys.join(", ")}`);

      // Check if we have a mapping for this system
      let alternativeSystems = [];
      if (systemNameMappings[systemId]) {
        alternativeSystems = systemNameMappings[systemId];
        console.log(`Found system name mapping for ${systemId}: ${alternativeSystems.join(", ")}`);
      }

      // Try mapped systems first
      let systemMatch = null;
      for (const altSystem of alternativeSystems) {
        if (systemKeys.includes(altSystem)) {
          systemMatch = altSystem;
          console.log(`Found mapped system: ${systemMatch}`);
          break;
        }
      }

      // If no mapped system found, try case-insensitive match with more flexible matching
      if (!systemMatch) {
        systemMatch = systemKeys.find((key) => {
          // Try exact match first (case insensitive)
          if (key.toLowerCase() === systemId.toLowerCase()) {
            return true;
          }

          // Try partial matches
          if (
            key.toLowerCase().includes(systemId.toLowerCase()) ||
            systemId.toLowerCase().includes(key.toLowerCase())
          ) {
            return true;
          }

          // Try matching by type (if systemId contains a type like "Boiler", "AHU", etc.)
          const commonTypes = ["boiler", "ahu", "chiller", "pump", "fan", "vav", "rtu", "fcu", "doas", "mua"];
          for (const type of commonTypes) {
            if (systemId.toLowerCase().includes(type) && key.toLowerCase().includes(type)) {
              return true;
            }
          }

          return false;
        });
      }

      if (systemMatch) {
        console.log(`Using system: ${systemMatch}`);
        systemId = systemMatch;
      } else {
        return null;
      }
    }

    // Check if system has metrics
    if (!rtdbData[locationKey].systems[systemId].metrics) {
      console.log(`No metrics found for system ${systemId} in location ${locationKey}`);
      return null;
    }

    // Get the metrics object
    const metrics = rtdbData[locationKey].systems[systemId].metrics;

    // STEP 1: Check for location-specific mappings first (highest priority)
    const specificLocation = locationKey;
    const specificLocationId = rtdbData[locationKey].id || locationKey;

    // Check specific location name mappings
    if (specificLocationMappings[specificLocation] && specificLocationMappings[specificLocation][metricName]) {
      // Try each location-specific mapping
      for (const mappedName of specificLocationMappings[specificLocation][metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found location-specific mapping for ${specificLocation}/${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Check specific location ID mappings
    if (specificLocationId && specificLocationMappings[specificLocationId] && specificLocationMappings[specificLocationId][metricName]) {
      // Try each location-ID-specific mapping
      for (const mappedName of specificLocationMappings[specificLocationId][metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found location-ID-specific mapping for ${specificLocationId}/${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // STEP 2: Check for system-specific metrics (e.g. "ComfortBoiler-1 temperature")
    const systemSpecificMetric = `${systemId} ${metricName}`;

    // Check location-specific system-specific mappings
    if (specificLocationMappings[specificLocation] && specificLocationMappings[specificLocation][systemSpecificMetric]) {
      for (const mappedName of specificLocationMappings[specificLocation][systemSpecificMetric]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found system-specific mapping for ${specificLocation}/${systemSpecificMetric} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Check location-ID-specific system-specific mappings
    if (specificLocationId && specificLocationMappings[specificLocationId] && specificLocationMappings[specificLocationId][systemSpecificMetric]) {
      for (const mappedName of specificLocationMappings[specificLocationId][systemSpecificMetric]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found ID-system-specific mapping for ${specificLocationId}/${systemSpecificMetric} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // STEP 3: Try exact match
    if (metrics[metricName] !== undefined) {
      const value = metrics[metricName];
      console.log(`Found exact match for metric ${metricName}: ${value}`);
      return typeof value === "number" ? value : Number.parseFloat(value);
    }

    // STEP 4: Try case-insensitive match
    const metricNameLower = metricName.toLowerCase();
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase() === metricNameLower) {
        const value = metrics[key];
        console.log(`Found case-insensitive match for metric ${metricName} -> ${key}: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    // STEP 5: Try appropriate category mappings
    // Check if the metric name matches any of our specialized mapping categories

    // Temperature mappings
    if (temperatureMetricMappings[metricName]) {
      for (const mappedName of temperatureMetricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found temperature mapping match: ${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Humidity mappings
    if (humidityMetricMappings[metricName]) {
      for (const mappedName of humidityMetricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found humidity mapping match: ${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Status mappings
    if (statusMetricMappings[metricName]) {
      for (const mappedName of statusMetricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found status mapping match: ${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Pressure and Flow mappings
    if (pressureAndFlowMetricMappings[metricName]) {
      for (const mappedName of pressureAndFlowMetricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found pressure/flow mapping match: ${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // Specialized mappings
    if (specializedMetricMappings[metricName]) {
      for (const mappedName of specializedMetricMappings[metricName]) {
        if (metrics[mappedName] !== undefined) {
          const value = metrics[mappedName];
          console.log(`Found specialized mapping match: ${metricName} -> ${mappedName}: ${value}`);
          return typeof value === "number" ? value : Number.parseFloat(value);
        }
      }
    }

    // STEP 6: Try partial match (if metric name contains the search term or vice versa)
    for (const key of Object.keys(metrics)) {
      if (key.toLowerCase().includes(metricNameLower) || metricNameLower.includes(key.toLowerCase())) {
        // Skip if the match is too generic (e.g., "temp" matching "setpoint")
        if ((key.toLowerCase() === "temp" || key.toLowerCase() === "temperature") &&
          metricNameLower !== "temp" && metricNameLower !== "temperature") {
          continue;
        }

        const value = metrics[key];
        console.log(`Found partial match for metric ${metricName} -> ${key}: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    // STEP 7: Special case handlers for specific locations

    // Special case for StJohnCatholicSchool - try H20Supply/H20Return
    if ((locationId === "StJohnCatholicSchool" || locationId === "11") && metricName.toLowerCase().includes("temperature")) {
      if (metricName.toLowerCase().includes("supply") && metrics["H20Supply"] !== undefined) {
        const value = metrics["H20Supply"];
        console.log(`Found StJohn special case for supply: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
      if (metricName.toLowerCase().includes("return") && metrics["H20Return"] !== undefined) {
        const value = metrics["H20Return"];
        console.log(`Found StJohn special case for return: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    // Special case for HeritageHuntington - try Supply/Return
    if ((locationId === "HeritageHuntington" || locationId === "4") &&
      (systemId.includes("Boiler") || systemId.includes("Pump"))) {
      if (metricName.toLowerCase().includes("temperature") && metrics["Supply"] !== undefined) {
        const value = metrics["Supply"];
        console.log(`Found HeritageHuntington special case for ${systemId} supply: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    // Special case for any Fan Coil Units - try generic names
    if (systemId.includes("FCU") || systemId.includes("FanCoil") || systemId.includes("AHU")) {
      if (metricName.toLowerCase().includes("temperature") && metrics["Supply"] !== undefined) {
        const value = metrics["Supply"];
        console.log(`Found generic Fan Coil special case for supply: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
      if (metricName.toLowerCase().includes("temperature") && metrics["Return"] !== undefined) {
        const value = metrics["Return"];
        console.log(`Found generic Fan Coil special case for return: ${value}`);
        return typeof value === "number" ? value : Number.parseFloat(value);
      }
    }

    console.log(`Metric ${metricName} not found in system ${systemId} in location ${locationKey}`);
    return null;
  } catch (error) {
    console.error(`Error getting metric value for ${locationId}/${systemId}/${metricName}:`, error);
    return null;
  }
}

// Extend system mappings with HeritageHuntington (from screenshot)
// These additional explicit mappings are based on your RTDB structure
const additionalHeritageHuntingtonSystems = {
  "ComfortBoiler-1": ["ComfortBoiler-1", "ComfortBoiler1", "Boiler"],
  "ComfortBoiler-2": ["ComfortBoiler-2", "ComfortBoiler2", "Boiler"],
  "CWPump-1": ["CWPump-1", "CWPump1", "Pump"],
  "CWPump-2": ["CWPump-2", "CWPump2", "Pump"],
  "DomesticBoiler-1": ["DomesticBoiler-1", "DomesticBoiler1", "Boiler"],
  "DomesticBoiler-2": ["DomesticBoiler-2", "DomesticBoiler2", "Boiler"],
  "FanCoil1": ["FanCoil1", "Fan Coil"],
  "FanCoil2": ["FanCoil2", "Fan Coil"],
  "FanCoil3": ["FanCoil3", "Fan Coil"],
  "FanCoil4": ["FanCoil4", "Fan Coil"],
  "FanCoil6": ["FanCoil6", "Fan Coil"],
  "FanCoil7": ["FanCoil7", "Fan Coil"],
  "HWPump-1": ["HWPump-1", "HWPump1", "Pump"],
  "HWPump-2": ["HWPump-2", "HWPump2", "Pump"],
  "MechanicalRoom1": ["MechanicalRoom1", "Mechanical Room"],
  "MechanicalRoom2": ["MechanicalRoom2", "Mechanical Room"],
  "RehabBoilers": ["RehabBoilers", "Boiler"]
};

// Extend system mappings with HeritageWarren (from screenshot)
const additionalHeritageWarrenSystems = {
  "AHU-1": ["AHU-1", "AHU1", "Fan Coil"],
  "AHU-2": ["AHU-2", "AHU2", "Fan Coil"],
  "AHU-4": ["AHU-4", "AHU4", "Fan Coil"],
  "AHU-7": ["AHU-7", "AHU7", "Fan Coil"],
  "FanCoil1": ["FanCoil1", "Fan Coil"],
  "FanCoil2": ["FanCoil2", "Fan Coil"],
  "FanCoil3": ["FanCoil3", "Fan Coil"],
  "FanCoil4": ["FanCoil4", "Fan Coil"],
  "FanCoil5": ["FanCoil5", "Fan Coil"],
  "FanCoil6": ["FanCoil6", "Fan Coil"],
  "HWPump-1": ["HWPump-1", "HWPump1", "Pump"],
  "HWPump-2": ["HWPump-2", "HWPump2", "Pump"],
  "SteamBundle": ["SteamBundle", "Steam Bundle"]
};

// Merge the additional mappings into systemNameMappings
Object.assign(systemNameMappings, additionalHeritageHuntingtonSystems, additionalHeritageWarrenSystems);

module.exports = {
  getMetricValue,
  getMetricType,
  specificLocationMappings,
  systemNameMappings,
  temperatureMetricMappings,
  humidityMetricMappings,
  statusMetricMappings,
  pressureAndFlowMetricMappings,
  specializedMetricMappings
};
