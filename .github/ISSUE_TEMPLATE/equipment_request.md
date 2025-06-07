---
name: Equipment Support Request
about: Request support for new equipment type or location setup
title: '[EQUIPMENT] '
labels: 'equipment', 'enhancement'
assignees: ''
---

## 🏭 Equipment Request Overview
Brief description of the equipment or location you need support for.

## 📍 Location Information
- **Location Name**: 
- **Location ID**: [If known, or request new ID]
- **Building Type**: [Office, Hospital, School, Industrial, etc.]
- **Square Footage**: 
- **Number of Floors**: 
- **Geographic Location**: [City, State for weather considerations]

## ⚙️ Equipment Details

### Equipment Inventory
Please list all equipment that needs control integration:

| Equipment Type | Quantity | Model/Brand | Control Points | Notes |
|----------------|----------|-------------|----------------|-------|
| Boilers | | | | |
| Chillers | | | | |
| Air Handlers | | | | |
| Fan Coils | | | | |
| Pumps | | | | |
| DOAS Units | | | | |
| Other | | | | |

### Specific Equipment Details

#### **Primary Equipment (Most Critical)**
1. **Equipment Type**: [e.g., Chiller, Boiler, AHU]
   - **Manufacturer**: 
   - **Model Number**: 
   - **Capacity/Size**: 
   - **Year Installed**: 
   - **Control Protocol**: [BACnet, Modbus, Proprietary, etc.]
   - **Current Control System**: [Existing BMS, standalone, etc.]

2. **Equipment Type**: [Second most critical piece]
   - **Manufacturer**: 
   - **Model Number**: 
   - **Capacity/Size**: 
   - **Year Installed**: 
   - **Control Protocol**: 
   - **Current Control System**: 

#### **Secondary Equipment**
List remaining equipment with basic details:
- [Equipment type, quantity, basic specs]
- [Equipment type, quantity, basic specs]

## 🔧 Control Requirements

### Operating Modes
- [ ] **24/7 Operation** - Continuous operation required
- [ ] **Scheduled Operation** - Normal business hours only
- [ ] **Seasonal Operation** - Heating/cooling seasons only
- [ ] **On-Demand Operation** - Manual or event-triggered

### Control Strategies
- [ ] **Lead-Lag Control** - Multiple units with rotation
- [ ] **Staging Control** - Sequential equipment operation
- [ ] **Variable Speed Control** - VFD or modulating control
- [ ] **Temperature Reset** - Outdoor air temperature reset
- [ ] **Demand-Based Control** - Load-based operation
- [ ] **Optimization Control** - Energy efficiency optimization

### Safety Requirements
- [ ] **High/Low Limits** - Temperature, pressure safety limits
- [ ] **Interlock Systems** - Equipment safety interlocks
- [ ] **Emergency Stops** - Manual override capabilities
- [ ] **Alarm Systems** - Critical alarm notifications
- [ ] **Backup Systems** - Redundancy requirements

## 📊 Data Points & Monitoring

### Required Sensor Data
- [ ] **Temperatures** - Supply, return, outdoor, space temperatures
- [ ] **Pressures** - Water, steam, air pressures
- [ ] **Flow Rates** - Water, air flow measurements
- [ ] **Energy Consumption** - Electrical, gas, steam consumption
- [ ] **Status Points** - On/off, alarm, fault status
- [ ] **Position Feedback** - Valve, damper positions

### Control Outputs Needed
- [ ] **Temperature Setpoints** - Heating, cooling setpoints
- [ ] **Equipment Enable/Disable** - Start/stop commands
- [ ] **Speed Control** - Fan, pump speed commands
- [ ] **Valve/Damper Control** - Position commands
- [ ] **Mode Selection** - Operating mode commands
- [ ] **Reset Commands** - Equipment reset functions

## 🖥️ Integration Requirements

### Communication Methods
- [ ] **Physical Points** - Hardwired I/O connections
- [ ] **BACnet IP** - Network-based BACnet communication
- [ ] **BACnet MS/TP** - Serial BACnet communication
- [ ] **Modbus TCP** - Ethernet Modbus communication
- [ ] **Modbus RTU** - Serial Modbus communication
- [ ] **Proprietary Protocol** - Manufacturer-specific protocol
- [ ] **LON** - LonWorks protocol
- [ ] **Other**: [Specify protocol]

### Network Infrastructure
- **Existing Network**: [Description of current network setup]
- **IP Address Range**: [Available IP addresses for devices]
- **Network Security**: [Firewall rules, VLANs, etc.]
- **Bandwidth Considerations**: [Network capacity concerns]

## 🎯 Project Requirements

### Timeline
- **Desired Start Date**: 
- **Required Completion Date**: 
- **Critical Milestones**: 
- **Seasonal Considerations**: [HVAC seasonality factors]

### Budget Considerations
- **Hardware Budget**: [If known]
- **Software Licensing**: [Commercial license requirements]
- **Installation/Labor**: [Professional installation needed]
- **Training Requirements**: [Staff training needs]

### Success Criteria
- [ ] **Equipment Control** - All equipment controllable from system
- [ ] **Monitoring** - Real-time status and data collection
- [ ] **Alarms** - Critical alarms and notifications working
- [ ] **Scheduling** - Automated scheduling operational
- [ ] **Energy Reporting** - Energy consumption tracking
- [ ] **User Training** - Staff trained on system operation

## 📋 Current System Information

### Existing Building Management System
- **Current BMS**: [Brand/model of existing system]
- **Integration Required**: [Does this need to integrate with existing BMS?]
- **Data Export**: [Can current system export historical data?]
- **Migration Plan**: [Replacing or supplementing existing system?]

### Existing Infrastructure
- **Control Panels**: [Current control equipment locations]
- **Wiring**: [Existing control wiring infrastructure]
- **Power Availability**: [Electrical power for new equipment]
- **Space Constraints**: [Physical space limitations]

## 🔍 Special Considerations

### Building-Specific Requirements
- **Code Compliance**: [Local building codes or requirements]
- **Industry Standards**: [Healthcare, education, manufacturing standards]
- **Environmental Concerns**: [Clean rooms, sensitive areas]
- **Security Requirements**: [Physical or cyber security needs]

### Operational Constraints
- **Maintenance Windows**: [When can work be performed?]
- **Critical Operations**: [Areas that cannot have downtime]
- **Access Restrictions**: [Security clearances, escort requirements]
- **Documentation Requirements**: [As-built drawings, O&M manuals]

## 🤝 Support & Resources

### Available Resources
- [ ] **Technical Staff** - In-house technical support available
- [ ] **Contractor Support** - Preferred contractors for installation
- [ ] **Manufacturer Support** - Equipment manufacturer assistance
- [ ] **Consulting Engineers** - Engineering design support

### Implementation Assistance
- [ ] **Remote Support** - Can provide remote system access
- [ ] **On-Site Support** - Can provide on-site installation assistance
- [ ] **Documentation** - Can provide equipment documentation
- [ ] **Testing Support** - Can assist with system testing and commissioning

## 📞 Contact Information
- **Primary Contact**: 
- **Title/Role**: 
- **Organization**: 
- **Phone**: 
- **Email**: 
- **Best Time to Contact**: 
- **Time Zone**: 

### Additional Contacts
- **Technical Contact**: [If different from primary]
- **Project Manager**: [If applicable]
- **Facilities Manager**: [If applicable]

## 📁 Attachments
Please attach any relevant documentation:
- [ ] **Equipment Specifications** - Cut sheets, manuals
- [ ] **Building Drawings** - Floor plans, mechanical drawings
- [ ] **Network Diagrams** - Current network topology
- [ ] **Control Sequences** - Existing control logic documentation
- [ ] **Point Lists** - Current BMS point lists
- [ ] **Photos** - Equipment photos for identification

---

**Checklist before submitting:**
- [ ] I have provided complete equipment information
- [ ] I have identified all control requirements
- [ ] I have specified integration needs
- [ ] I have defined project timeline and success criteria
- [ ] I have attached relevant documentation
