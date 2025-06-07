# Contributing Guide

## 🤝 Welcome Contributors

Thank you for your interest in contributing to Automata Controls Nexus BMS! This guide will help you understand our development workflow, coding standards, and how to contribute effectively to this professional building management system.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Equipment Logic Development](#equipment-logic-development)
- [Testing Guidelines](#testing-guidelines)
- [Contribution Workflow](#contribution-workflow)
- [Code Review Process](#code-review-process)
- [Documentation Standards](#documentation-standards)
- [Security Guidelines](#security-guidelines)

---

## 🚀 Getting Started

### **Prerequisites**
- **Node.js**: 18+ (LTS recommended)
- **Git**: Latest version
- **Code Editor**: VS Code recommended with TypeScript support
- **Database Access**: InfluxDB 3.0 and Redis for development
- **Firebase Account**: For authentication testing

### **First-Time Setup**
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/AutomataControlsNexusBms-Production.git
cd AutomataControlsNexusBms-Production

# Add upstream remote
git remote add upstream https://github.com/AutomataControls/AutomataControlsNexusBms-Production.git

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Build TypeScript workers
npx tsc -p tsconfig.workers.json

# Start development server
npm run dev
```

### **Environment Configuration**
Update `.env.local` with your development settings:
```bash
# InfluxDB (local development)
INFLUXDB_URL=http://localhost:8181
INFLUXDB_DATABASE=Locations
INFLUXDB_DEBUG=true

# Firebase (create test project)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-test-project
NEXT_PUBLIC_FIREBASE_API_KEY=your-test-api-key

# Redis (local)
REDIS_URL=redis://localhost:6379
```

---

## 🏗️ Development Environment

### **Recommended VS Code Extensions**
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-eslint"
  ]
}
```

### **Development Workflow**
```bash
# Start all development services
npm run dev          # Next.js development server
npm run monitor      # Start monitoring service
npm run build        # Build for production testing

# TypeScript compilation
npx tsc -p tsconfig.workers.json --watch  # Watch mode for workers
```

### **Local Testing Setup**
```bash
# Start local InfluxDB (if not using Docker)
influxdb3 serve --object-store=memory --http-bind=localhost:8181

# Start Redis
redis-server

# Run development stack
npm run dev
```

---

## 📁 Project Structure

### **Key Directories**
```
AutomataControlsNexusBms-Production/
├── app/                          # Next.js 13+ app directory
│   ├── api/                      # API routes
│   ├── (dashboard)/              # Dashboard pages
│   └── components/               # Page-specific components
├── components/                   # Reusable UI components
│   ├── ui/                       # Shadcn/ui components
│   └── equipment/                # Equipment-specific components
├── lib/                          # Core library code
│   ├── workers/                  # Background workers
│   │   ├── location-processors/  # Location-specific processors
│   │   └── logic-factories/      # Equipment logic factories
│   ├── equipment-logic/          # Equipment control algorithms
│   │   └── locations/            # Location-specific equipment logic
│   ├── influxdb-client.ts        # InfluxDB integration
│   └── utils.ts                  # Utility functions
├── docs/                         # Documentation
├── templates/                    # Template files for new locations
└── examples/                     # Code examples
```

### **Important Files**
- **`ecosystem.config.js`**: PM2 core services configuration
- **`tsconfig.workers.json`**: TypeScript config for workers
- **`lib/influxdb-client.ts`**: InfluxDB 3.0 client implementation
- **`lib/workers/enhanced-equipment-worker.ts`**: UI command processor

---

## 📝 Coding Standards

### **TypeScript Guidelines**

#### **Type Definitions**
```typescript
// Use interfaces for object shapes
interface EquipmentMetrics {
  equipmentId: string;
  temperature: number;
  pressure?: number;  // Optional properties with ?
  timestamp: Date;
}

// Use type aliases for unions
type EquipmentType = 'boiler' | 'pump' | 'fancoil' | 'chiller';

// Use generics for reusable functions
function processEquipment<T extends EquipmentMetrics>(
  equipment: T,
  processor: (data: T) => void
): void {
  processor(equipment);
}
```

#### **Error Handling**
```typescript
// Use Result pattern for operations that can fail
interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

async function queryInfluxDB(query: string): Promise<Result<any[]>> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      return {
        success: false,
        error: `Query failed: ${response.status}`,
        statusCode: response.status
      };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      statusCode: 500
    };
  }
}
```

### **Naming Conventions**

#### **File Naming**
```bash
# Components: PascalCase
components/EquipmentControls.tsx
components/ui/DataTable.tsx

# Pages: kebab-case
app/equipment-control/page.tsx
app/dashboard/locations/page.tsx

# Workers: kebab-case with descriptive names
lib/workers/enhanced-equipment-worker.ts
lib/workers/location-processors/sample-location-processor.ts

# Equipment Logic: kebab-case
lib/equipment-logic/locations/sample/boiler.js
lib/equipment-logic/locations/sample/fan-coil.js
```

#### **Variable Naming**
```typescript
// Use camelCase for variables and functions
const equipmentMetrics = await getEquipmentData();
const processedResults = await processEquipmentLogic();

// Use PascalCase for classes and interfaces
class EquipmentProcessor {
  private influxClient: InfluxDBClient;
}

interface EquipmentConfig {
  equipmentId: string;
  locationId: string;
}

// Use UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 30000;
```

### **Code Formatting**

#### **Prettier Configuration**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

#### **ESLint Rules**
```json
{
  "extends": ["next/core-web-vitals", "@typescript-eslint/recommended"],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

## ⚙️ Equipment Logic Development

### **4-Parameter Interface Standard**

All equipment logic functions must follow this signature:
```javascript
function equipmentControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  // metricsInput: Real-time data from InfluxDB
  // settingsInput: Equipment configuration
  // currentTempArgument: Control temperature (equipment-specific)
  // stateStorageInput: PID state and persistent data
  
  return {
    // Control commands (varies by equipment type)
    unitEnable: true,
    temperatureSetpoint: 75,
    // ... other commands
  };
}
```

### **Equipment Logic Template**
```javascript
// lib/equipment-logic/locations/sample/boiler.js
"use strict";

/**
 * Sample Boiler Control Logic
 * Location: Sample Location
 * Equipment Type: Boiler
 * 4-Parameter Interface: ✓
 */

function boilerControl(metricsInput, settingsInput, currentTempArgument, stateStorageInput) {
  // Input validation
  if (!metricsInput || !settingsInput) {
    console.warn('[Boiler] Missing required inputs');
    return { unitEnable: false };
  }

  // Extract metrics with fallbacks
  const supplyTemp = parseFloat(metricsInput.H20Supply || 0);
  const outdoorTemp = parseFloat(currentTempArgument || 50);
  const targetTemp = parseFloat(settingsInput.temperatureSetpoint || 140);

  // Control logic
  const tempError = targetTemp - supplyTemp;
  const shouldFire = tempError > 5.0; // 5°F deadband

  // Safety checks
  if (supplyTemp > 200) {
    console.warn('[Boiler] High supply temperature - safety shutdown');
    return {
      unitEnable: false,
      firing: false,
      safetyShutoff: true,
      safetyReason: 'High supply temperature'
    };
  }

  // Return control commands
  return {
    unitEnable: true,
    firing: shouldFire,
    waterTempSetpoint: targetTemp,
    temperatureSetpoint: targetTemp,
    supplyTemp: supplyTemp,
    outdoorTemp: outdoorTemp,
    tempError: tempError
  };
}

// Export patterns for compatibility
module.exports = { boilerControl };
module.exports.default = boilerControl;
module.exports.processEquipment = boilerControl;
```

### **Location Processor Template**
```typescript
// lib/workers/location-processors/sample-location-processor.ts
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

const equipmentQueue = new Queue('equipment-logic-1', { connection: redis });

// Equipment configuration
const EQUIPMENT_CONFIG = {
  'sample-boiler-1': {
    interval: 2 * 60 * 1000,  // 2 minutes
    file: 'boiler.js',
    equipmentId: 'SAMPLE_BOILER_001'
  },
  'sample-pump-1': {
    interval: 30 * 1000,      // 30 seconds
    file: 'pump.js',
    equipmentId: 'SAMPLE_PUMP_001'
  }
};

// Smart queue processing
async function addEquipmentToQueue(equipmentId: string, locationId: string, equipmentType: string) {
  const jobData = {
    equipmentId,
    locationId,
    type: equipmentType,
    timestamp: Date.now()
  };

  await equipmentQueue.add(`process-${equipmentType}`, jobData);
  console.log(`[Sample Location] Queued ${equipmentType} (${equipmentId})`);
}

// Initialize processors
function initializeProcessors() {
  for (const [equipmentType, config] of Object.entries(EQUIPMENT_CONFIG)) {
    setInterval(async () => {
      await addEquipmentToQueue(
        config.equipmentId,
        '1', // Sample location ID
        equipmentType
      );
    }, config.interval);

    console.log(`[Sample Location] Started ${equipmentType} processor`);
  }
}

// Start the processor
initializeProcessors();
console.log('[Sample Location] All processors started');
```

---

## 🧪 Testing Guidelines

### **Unit Testing**
```typescript
// tests/equipment-logic/boiler.test.ts
import { boilerControl } from '../../lib/equipment-logic/locations/sample/boiler';

describe('Boiler Control Logic', () => {
  const mockMetrics = {
    H20Supply: 120,
    equipmentId: 'TEST_BOILER_001'
  };

  const mockSettings = {
    equipmentId: 'TEST_BOILER_001',
    temperatureSetpoint: 140,
    locationId: '1'
  };

  test('should enable firing when below setpoint', () => {
    const result = boilerControl(mockMetrics, mockSettings, 50, {});
    
    expect(result.unitEnable).toBe(true);
    expect(result.firing).toBe(true);
    expect(result.tempError).toBe(20); // 140 - 120
  });

  test('should disable firing when at setpoint', () => {
    const highTempMetrics = { ...mockMetrics, H20Supply: 140 };
    const result = boilerControl(highTempMetrics, mockSettings, 50, {});
    
    expect(result.firing).toBe(false);
  });

  test('should trigger safety shutdown on high temperature', () => {
    const dangerousMetrics = { ...mockMetrics, H20Supply: 210 };
    const result = boilerControl(dangerousMetrics, mockSettings, 50, {});
    
    expect(result.unitEnable).toBe(false);
    expect(result.safetyShutoff).toBe(true);
  });
});
```

### **Integration Testing**
```typescript
// tests/api/equipment.test.ts
import { POST } from '../../app/api/equipment/[id]/command/route';

describe('Equipment Command API', () => {
  test('should process equipment command', async () => {
    const request = new Request('http://localhost/api/equipment/TEST001/command', {
      method: 'POST',
      body: JSON.stringify({
        command: 'setpoint',
        value: 75,
        userId: 'test-user'
      })
    });

    const response = await POST(request, { params: { id: 'TEST001' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
```

### **Running Tests**
```bash
# Install testing dependencies
npm install --save-dev jest @types/jest ts-jest

# Run tests
npm test

# Run specific test
npm test -- boiler.test.ts

# Run with coverage
npm test -- --coverage
```

---

## 🔄 Contribution Workflow

### **Branch Strategy**
```bash
# Create feature branch
git checkout -b feature/equipment-type-xyz

# Create bugfix branch
git checkout -b bugfix/influxdb-connection

# Create location branch
git checkout -b location/new-facility-setup
```

### **Commit Messages**
Follow conventional commits format:
```bash
# Feature additions
git commit -m "feat: add boiler control logic for sample location"
git commit -m "feat(api): implement equipment status endpoint"

# Bug fixes
git commit -m "fix: resolve InfluxDB connection timeout issue"
git commit -m "fix(ui): correct temperature display formatting"

# Documentation
git commit -m "docs: update equipment logic development guide"
git commit -m "docs(api): add examples for equipment commands"

# Refactoring
git commit -m "refactor: improve equipment queue processing logic"
git commit -m "refactor(types): standardize equipment interface types"
```

### **Pull Request Process**

#### **Before Submitting**
```bash
# Update your branch
git fetch upstream
git rebase upstream/main

# Run quality checks
npm run lint
npm run type-check
npm test
npm run build

# Test TypeScript workers
npx tsc -p tsconfig.workers.json
```

#### **PR Template**
```markdown
## 📝 Description
Brief description of changes and motivation.

## 🔧 Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Equipment logic addition
- [ ] Location processor addition

## 🧪 Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Equipment logic tested with real data

## 📋 Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)

## 🏭 Equipment/Location Details (if applicable)
- Location ID: 
- Equipment Types: 
- Special Configuration: 

## 📸 Screenshots (if applicable)
Add screenshots for UI changes.
```

---

## 👀 Code Review Process

### **Review Criteria**

#### **Code Quality**
- ✅ Follows TypeScript best practices
- ✅ Proper error handling implemented
- ✅ No hardcoded values (use configuration)
- ✅ Performance considerations addressed
- ✅ Security implications reviewed

#### **Equipment Logic Review**
- ✅ 4-parameter interface compliance
- ✅ Safety checks implemented
- ✅ Proper fallback values
- ✅ Input validation present
- ✅ Equipment-specific requirements met

#### **Testing Requirements**
- ✅ Unit tests for new functions
- ✅ Integration tests for API changes
- ✅ Equipment logic tested with sample data
- ✅ Error conditions tested

### **Review Checklist for Reviewers**
```markdown
## Code Review Checklist

### General
- [ ] Code is readable and well-documented
- [ ] No obvious bugs or security issues
- [ ] Performance impact considered
- [ ] Breaking changes properly documented

### Equipment Logic Specific
- [ ] 4-parameter interface followed
- [ ] Safety mechanisms in place
- [ ] Proper error handling
- [ ] Equipment type correctly identified

### API Changes
- [ ] Backwards compatibility maintained
- [ ] Proper HTTP status codes
- [ ] Error responses well-formatted
- [ ] Authentication/authorization correct

### Database Changes
- [ ] InfluxDB queries optimized
- [ ] No SQL injection vulnerabilities
- [ ] Proper indexing considered
- [ ] Data retention policies followed
```

---

## 📚 Documentation Standards

### **Code Comments**
```typescript
/**
 * Processes equipment control logic using the 4-parameter interface
 * 
 * @param metricsInput - Real-time equipment data from InfluxDB
 * @param settingsInput - Equipment configuration and setpoints
 * @param currentTempArgument - Control temperature (equipment-specific source)
 * @param stateStorageInput - PID state and persistent control data
 * @returns Equipment control commands object
 * 
 * @example
 * const result = processEquipmentLogic(
 *   { temperature: 72, pressure: 14.7 },
 *   { equipmentId: 'BOILER_001', setpoint: 140 },
 *   75, // outdoor temperature
 *   { pidIntegral: 0, lastError: 0 }
 * );
 */
function processEquipmentLogic(
  metricsInput: any,
  settingsInput: any,
  currentTempArgument: number,
  stateStorageInput: any
): any {
  // Implementation...
}
```

### **README Updates**
When adding new features, update relevant README sections:
- Equipment types supported
- API endpoints available
- Configuration options
- Deployment instructions

### **API Documentation**
```typescript
/**
 * @api {POST} /api/equipment/:id/command Send Equipment Command
 * @apiName SendEquipmentCommand
 * @apiGroup Equipment
 * 
 * @apiParam {String} id Equipment unique ID
 * @apiParam {String} command Command type (setpoint, enable, disable)
 * @apiParam {Number} value Command value
 * @apiParam {String} userId User ID issuing command
 * 
 * @apiSuccess {Boolean} success Command execution status
 * @apiSuccess {String} jobId BullMQ job ID for tracking
 * 
 * @apiError {String} error Error message
 * @apiError {Number} statusCode HTTP status code
 */
```

---

## 🔒 Security Guidelines

### **Data Handling**
```typescript
// ✅ Good: Validate and sanitize inputs
function processEquipmentCommand(equipmentId: string, command: any) {
  // Validate equipment ID format
  if (!/^[A-Z0-9_]{3,20}$/.test(equipmentId)) {
    throw new Error('Invalid equipment ID format');
  }
  
  // Sanitize command values
  const sanitizedValue = Math.max(0, Math.min(100, Number(command.value)));
  
  return { equipmentId, value: sanitizedValue };
}

// ❌ Bad: Direct usage without validation
function unsafeProcessing(equipmentId: string, command: any) {
  return database.query(`SELECT * FROM equipment WHERE id = '${equipmentId}'`);
}
```

### **Authentication**
```typescript
// Always verify user authentication in API routes
export async function POST(request: Request) {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Proceed with authorized request
}
```

### **Environment Variables**
```typescript
// ✅ Good: Use environment variables for secrets
const influxUrl = process.env.INFLUXDB_URL || 'http://localhost:8181';
const apiKey = process.env.INFLUXDB_TOKEN;

// ❌ Bad: Hardcoded credentials
const influxUrl = 'http://production-server:8181';
const apiKey = 'secret-token-here';
```

### **Input Validation**
```typescript
// Use Zod for runtime type validation
import { z } from 'zod';

const EquipmentCommandSchema = z.object({
  command: z.enum(['setpoint', 'enable', 'disable']),
  value: z.number().min(0).max(1000),
  userId: z.string().min(1),
  equipmentId: z.string().regex(/^[A-Z0-9_]{3,20}$/)
});

function validateCommand(data: unknown) {
  return EquipmentCommandSchema.parse(data);
}
```

---

## 🎯 Contribution Areas

### **High Priority**
- **Equipment Logic**: New HVAC equipment types and control algorithms
- **Location Processors**: Setup for new facilities and buildings
- **API Improvements**: Enhanced equipment control endpoints
- **Performance**: InfluxDB query optimization and caching

### **Medium Priority**
- **UI Components**: Equipment control interfaces and dashboards
- **Documentation**: Equipment setup guides and tutorials
- **Testing**: Unit and integration test coverage
- **Monitoring**: System health and performance metrics

### **Good First Issues**
- **Template Creation**: New location and equipment templates
- **Documentation**: Fix typos and improve clarity
- **Code Cleanup**: Remove deprecated code and improve formatting
- **Examples**: Add code examples for common use cases

---

## 📞 Getting Help

### **Community Resources**
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share ideas
- **Documentation**: Check docs/ directory for guides
- **Code Examples**: See examples/ directory for reference

### **Development Questions**
1. **Equipment Logic**: Check existing equipment files in `lib/equipment-logic/locations/`
2. **API Usage**: Review API documentation in `docs/api.md`
3. **Database**: See InfluxDB integration guide in `docs/influxdb.md`
4. **Deployment**: Follow deployment guide in `docs/deployment.md`

### **Before Asking for Help**
- Search existing GitHub issues
- Check documentation thoroughly
- Review similar equipment logic implementations
- Test with minimal reproduction case

---

## 🏆 Recognition

Contributors who follow these guidelines and make valuable contributions will be:
- Recognized in release notes
- Added to the contributors list
- Considered for maintainer status
- Invited to provide feedback on project direction

---

Thank you for contributing to Automata Controls Nexus BMS! Your contributions help improve building management systems worldwide and advance the state of HVAC control technology.
