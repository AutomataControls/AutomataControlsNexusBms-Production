// /server/influx-metric-mappings.js
// Mapping threshold names to actual InfluxDB3 column names

const influxMetricMappings = {
  // Temperature mappings
  'Zone temperature': 'spaceTemp',
  'zone temperature': 'spaceTemp',
  'Space temperature': 'spaceTemp',
  'space temperature': 'spaceTemp',
  'Room temperature': 'spaceTemp',
  'room temperature': 'spaceTemp',
  
  'Supply Air temperature': 'supply',
  'supply air temperature': 'supply',
  'Supply temperature': 'supply', 
  'supply temperature': 'supply',
  'SupplyTemp': 'supply',
  'Supply Air': 'supply',
  'supply air': 'supply',
  
  'Return temperature': 'ReturnTemp',
  'return temperature': 'ReturnTemp',
  'Return Air temperature': 'ReturnTemp',
  'return air temperature': 'ReturnTemp',
  
  'Outdoor temperature': 'outdoorAir',
  'outdoor temperature': 'outdoorAir',
  'Outdoor Air temperature': 'Outdoor_Air',
  'outdoor air temperature': 'outdoorAir',
  'Outside temperature': 'outdoorAir',
  'outside temperature': 'outdoorAir',
  
  'Mixed Air temperature': 'mixedAir',
  'mixed air temperature': 'mixedAir',
  'Mixed temperature': 'mixedAir',
  'mixed temperature': 'mixedAir',
  
  'Supply temperature': 'SupplyTemp',
  'Temperature setpoint': 'TemperatureSetpoint',
  'temperature setpoint': 'TemperatureSetpoint',
  'Setpoint': 'Setpoint',
  'setpoint': 'Setpoint',
  'Global setpoint': 'globalSetpoint',
  'global setpoint': 'globalSetpoint',
  
  // Status mappings
  'Fan status': 'fanStatus',
  'fan status': 'fanStatus',
  'IsEnabled': 'IsEnabled',
  'Enabled': 'IsEnabled',
  'enabled': 'IsEnabled',
  'Is Enabled': 'IsEnabled',
  'is enabled': 'IsEnabled',
  
  // Actuator mappings
  'HW actuator': 'hwActuator',
  'hw actuator': 'hwActuator',
  'Heating valve': 'hwActuator',
  'heating valve': 'hwActuator',
  'Heating actuator': 'hwActuator',
  'heating actuator': 'hwActuator',
  
  'CW actuator': 'cwActuator',
  'cw actuator': 'cwActuator',
  'Cooling valve': 'cwActuator',
  'cooling valve': 'cwActuator',
  'Cooling actuator': 'cwActuator',
  'cooling actuator': 'cwActuator',
  
  'OA actuator': 'oaActuator',
  'oa actuator': 'oaActuator',
  'Outdoor air damper': 'oaActuator',
  'outdoor air damper': 'oaActuator',
  'Outdoor Air actuator': 'oaActuator',
  'outdoor air actuator': 'oaActuator',
  
  // VFD mappings
  'VFD speed': 'VFDSpeed',
  'vfd speed': 'VFDSpeed',
  'Fan speed': 'VFDSpeed',
  'fan speed': 'VFDSpeed',
  'VFD Speed': 'VFDSpeed',
  
  // Amp readings
  'Fan amps': 'fanAmps',
  'fan amps': 'fanAmps',
  'Fan Amps': 'fanAmps',
  
  // Other status fields
  'Freeze stat': 'FreezeStat',
  'freeze stat': 'FreezeStat',
  'FreezeStat': 'FreezeStat',
  'Freeze Stat': 'FreezeStat',
  
  'Occupied': 'Occupied',
  'occupied': 'Occupied',
  'Occupancy': 'Occupied',
  'occupancy': 'Occupied',
  
  'Custom logic': 'CustomLogicEnabled',
  'custom logic': 'CustomLogicEnabled',
  'Custom Logic': 'CustomLogicEnabled',
  'CustomLogicEnabled': 'CustomLogicEnabled',
  
  // Temperature source
  'Temperature source': 'TemperatureSource',
  'temperature source': 'TemperatureSource',
  'TemperatureSource': 'TemperatureSource',
  
  // Equipment type specific mappings
  'Equipment type': 'equipment_type',
  'equipment type': 'equipment_type',
  'Type': 'equipment_type',
  'type': 'equipment_type'
}

// Function to map threshold metric names to actual InfluxDB column names
function mapMetricNameToInfluxColumn(metricName) {
  // Try exact match first
  if (influxMetricMappings[metricName]) {
    return influxMetricMappings[metricName]
  }
  
  // Try case variations
  const variations = [
    metricName,
    metricName.toLowerCase(),
    metricName.toUpperCase(),
    metricName.replace(/\s+/g, ''), // Remove spaces
    metricName.replace(/\s+/g, '_'), // Replace spaces with underscores
    metricName.replace(/\s+/g, '').toLowerCase(), // Remove spaces and lowercase
    metricName.charAt(0).toLowerCase() + metricName.slice(1) // First letter lowercase
  ]
  
  for (const variation of variations) {
    if (influxMetricMappings[variation]) {
      return influxMetricMappings[variation]
    }
  }
  
  // If no mapping found, return original name
  return metricName
}

// Function to get alternative column names to try
function getAlternativeColumnNames(metricName) {
  const mappedName = mapMetricNameToInfluxColumn(metricName)
  
  const alternatives = [
    mappedName,
    metricName,
    metricName.toLowerCase(),
    metricName.toUpperCase(),
    metricName.replace(/\s+/g, ''),
    metricName.replace(/\s+/g, '_'),
    metricName.replace(/\s+/g, '').toLowerCase(),
    metricName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
    metricName.charAt(0).toLowerCase() + metricName.slice(1)
  ]
  
  // Remove duplicates
  return [...new Set(alternatives)]
}

module.exports = {
  influxMetricMappings,
  mapMetricNameToInfluxColumn,
  getAlternativeColumnNames
}
