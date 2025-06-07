# Development Setup Guide for Contributors

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Local Development](#local-development)
5. [Database Setup](#database-setup)
6. [Testing Your Setup](#testing-your-setup)
7. [Development Workflow](#development-workflow)
8. [VS Code Configuration](#vs-code-configuration)
9. [Common Issues](#common-issues)
10. [Contributing Guidelines](#contributing-guidelines)

## Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone and install
git clone https://github.com/AutomataControls/AutomataControlsNexusBms-Production.git
cd AutomataControlsNexusBms-Production
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials (see below)

# 3. Start development
npm run dev

# 4. Open browser
# http://localhost:3000
```

## Prerequisites

### Required Software

```bash
# Node.js 18+ (LTS recommended)
# Download from: https://nodejs.org/
node --version  # Should show v18.x.x or higher
npm --version   # Should show v9.x.x or higher

# Git
git --version

# Optional but recommended
npm install -g typescript ts-node
```

### System Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux
- **RAM**: 8GB minimum (development can be resource-intensive)
- **Storage**: 5GB free space for dependencies
- **Network**: Internet connection for dependencies and external APIs

## Environment Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/AutomataControlsNexusBms-Production.git
cd AutomataControlsNexusBms-Production

# Add upstream remote
git remote add upstream https://github.com/AutomataControls/AutomataControlsNexusBms-Production.git
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

```bash
# Copy the environment template
cp .env.example .env.local

# Edit with your configuration
code .env.local  # or nano/vim
```

**Development Environment Variables:**

```bash
# .env.local for Development
# ===============================================================================
# FIREBASE CONFIGURATION (Development Project)
# ===============================================================================
# Create a development Firebase project at https://console.firebase.google.com
NEXT_PUBLIC_FIREBASE_API_KEY=your_dev_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-dev-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-dev-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-dev-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-dev-project-default-rtdb.firebaseio.com/

# Firebase Admin (for server-side operations)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-dev-project"...}

# ===============================================================================
# INFLUXDB CONFIGURATION (Development)
# ===============================================================================
# You can use Docker or connect to a development InfluxDB instance
INFLUXDB_URL=http://localhost:8181
INFLUXDB_TOKEN=your_dev_token_here
INFLUXDB_ORG=DevOrganization
INFLUXDB_DATABASE=Locations
INFLUXDB_DATABASE3=UIControlCommands
INFLUXDB_DATABASE5=NeuralControlCommands

# ===============================================================================
# APPLICATION URLS (Development)
# ===============================================================================
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000/socket.io
NEXT_PUBLIC_BRIDGE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ===============================================================================
# OPTIONAL SERVICES (Development)
# ===============================================================================
# Email (for testing alarm notifications)
RESEND_API_KEY=your_resend_api_key_for_testing
DEFAULT_RECIPIENT=your-email@example.com

# Redis (if running locally)
REDIS_URL=redis://localhost:6379

# Log viewer (for debugging)
LOG_VIEWER_KEY=development_key_123
NEXT_PUBLIC_LOG_VIEWER_KEY=development_key_123

# ===============================================================================
# DEVELOPMENT FLAGS
# ===============================================================================
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
```

## Local Development

### 1. Start Development Server

```bash
# Start the Next.js development server
npm run dev

# The application will be available at:
# http://localhost:3000
```

### 2. Development Scripts

```bash
# Core development commands
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production build locally
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking

# Worker development
npm run build:workers     # Build TypeScript workers
npm run dev:workers      # Watch mode for workers
```

### 3. Development Workflow

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes, then test
npm run dev

# Build and test workers (if you modified worker files)
npm run build:workers

# Run linting
npm run lint

# Commit changes
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

## Database Setup

### Option 1: Docker InfluxDB (Recommended for Development)

```bash
# Install Docker if not already installed
# https://docs.docker.com/get-docker/

# Run InfluxDB in Docker
docker run -d \
  --name influxdb-dev \
  -p 8181:8086 \
  -e DOCKER_INFLUXDB_INIT_MODE=setup \
  -e DOCKER_INFLUXDB_INIT_USERNAME=admin \
  -e DOCKER_INFLUXDB_INIT_PASSWORD=password123 \
  -e DOCKER_INFLUXDB_INIT_ORG=DevOrganization \
  -e DOCKER_INFLUXDB_INIT_BUCKET=Locations \
  influxdb:2.7

# Wait for container to start, then create additional databases
# Access InfluxDB UI at http://localhost:8181
```

### Option 2: Local InfluxDB Installation

```bash
# macOS
brew install influxdb

# Ubuntu/Debian
wget -qO- https://repos.influxdata.com/influxdb.key | sudo apt-key add -
echo "deb https://repos.influxdata.com/ubuntu stable main" | sudo tee /etc/apt/sources.list.d/influxdb.list
sudo apt-get update && sudo apt-get install influxdb

# Start InfluxDB
influxd
```

### Option 3: Connect to Development Server

```bash
# If your team has a shared development InfluxDB server
INFLUXDB_URL=http://dev-server:8181
INFLUXDB_TOKEN=shared_dev_token

# Update .env.local with the shared server details
```

### Redis Setup (Optional)

```bash
# macOS
brew install redis
redis-server

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# Windows (WSL2)
sudo apt-get install redis-server
sudo service redis-server start

# Or use Docker
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
```

## Testing Your Setup

### 1. Basic Functionality Test

```bash
# Start the development server
npm run dev

# Open http://localhost:3000 in your browser
# You should see the login page
```

### 2. Create Test User

```bash
# If using Firebase Auth, create a test user through the UI
# Or use Firebase Console to create test users
```

### 3. Test Equipment Control

```bash
# Navigate to dashboard after login
# Try the controls overview page
# Check that equipment data loads (may show empty if no test data)
```

### 4. Test API Endpoints

```bash
# Test the health endpoint
curl http://localhost:3000/api/health

# Test InfluxDB connection
curl -X POST http://localhost:3000/api/influx/control-data \
  -H "Content-Type: application/json" \
  -d '{"locationIds":["1"],"timeRange":"5m"}'
```

### 5. Test Worker Building

```bash
# Build TypeScript workers
npm run build:workers

# Check that workers compiled successfully
ls -la dist/workers/
```

## Development Workflow

### 1. Working with Equipment Logic

```bash
# Equipment logic files are in:
lib/equipment-logic/locations/

# When adding new equipment logic:
# 1. Create new .ts/.js file in appropriate location folder
# 2. Follow the 4-parameter interface pattern
# 3. Test locally before committing

# Example: Adding new location equipment
mkdir -p lib/equipment-logic/locations/new-location
touch lib/equipment-logic/locations/new-location/boiler.js
```

### 2. Frontend Development

```bash
# Frontend structure:
app/                    # Next.js App Router pages
components/             # Reusable React components
components/controls/    # Equipment-specific controls
components/ui/          # shadcn/ui components

# When adding new pages:
# 1. Create in app/ directory following App Router conventions
# 2. Use TypeScript for all new files
# 3. Follow existing component patterns
```

### 3. API Development

```bash
# API routes are in:
app/api/

# When adding new API routes:
# 1. Follow Next.js App Router API conventions
# 2. Add proper TypeScript types
# 3. Include error handling
# 4. Document the endpoint
```

### 4. Testing Changes

```bash
# Always test your changes:
npm run dev          # Frontend changes
npm run build:workers # Worker changes
npm run lint         # Code quality
npm run type-check   # TypeScript validation
```

## VS Code Configuration

### Recommended Extensions

Create `.vscode/extensions.json`:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-typescript.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Next.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "env": {
        "NODE_OPTIONS": "--inspect"
      },
      "console": "integratedTerminal",
      "serverReadyAction": {
        "pattern": "ready - started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    }
  ]
}
```

## Common Issues

### Node.js Version Issues

```bash
# If you get Node.js version errors:
# Install Node Version Manager (nvm)

# macOS/Linux
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Windows
# Use nvm-windows: https://github.com/coreybutler/nvm-windows
```

### Port Already in Use

```bash
# If port 3000 is already in use:
# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

### TypeScript Errors

```bash
# If you get TypeScript compilation errors:
# Check your TypeScript version
npx tsc --version

# Clear TypeScript cache
rm -rf .next/types
npm run type-check
```

### Firebase Connection Issues

```bash
# If Firebase authentication isn't working:
# 1. Check your Firebase configuration in .env.local
# 2. Ensure your Firebase project has Auth enabled
# 3. Check the browser console for errors
# 4. Verify your domain is authorized in Firebase Console
```

### InfluxDB Connection Issues

```bash
# If InfluxDB queries fail:
# 1. Check if InfluxDB is running
curl http://localhost:8181/health

# 2. Verify your credentials in .env.local
# 3. Check database exists
curl http://localhost:8181/api/v2/buckets

# 4. For Docker setup, check container status
docker ps | grep influxdb
```

## Contributing Guidelines

### Code Style

```bash
# Follow these conventions:
# 1. Use TypeScript for all new files
# 2. Follow existing naming conventions
# 3. Use Prettier for formatting
# 4. Use ESLint rules defined in the project
# 5. Write meaningful commit messages

# Before submitting PR:
npm run lint        # Fix linting issues
npm run type-check  # Fix TypeScript errors
npm run build       # Ensure build succeeds
```

### Git Workflow

```bash
# Keep your fork updated
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: description of your changes"

# Push to your fork
git push origin feature/your-feature

# Create Pull Request on GitHub
```

### Testing Your Contribution

```bash
# Before submitting a PR, test:
# 1. The application starts without errors
npm run dev

# 2. Your changes work as expected
# 3. No existing functionality is broken
# 4. Build succeeds
npm run build

# 5. Workers compile (if you modified them)
npm run build:workers
```

### Equipment Logic Contributions

```bash
# When contributing equipment logic:
# 1. Follow the 4-parameter interface:
function processEquipment(metricsInput, settingsInput, currentTemp, stateStorage) {
  // Your logic here
  return [{ /* control outputs */ }];
}

# 2. Add proper TypeScript types
# 3. Include error handling
# 4. Test with sample data
# 5. Document any special requirements
```

### Pull Request Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally
- [ ] No console errors
- [ ] Build succeeds
- [ ] Workers compile (if applicable)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
```

## Getting Help

### Resources

- **Documentation**: Check the `/docs` folder for detailed guides
- **Examples**: Look at `/examples` for implementation patterns
- **Issues**: Search existing GitHub issues before creating new ones

### Community Support

- **GitHub Discussions**: For questions and feature discussions
- **Issues**: For bug reports and feature requests
- **Discord**: Real-time community chat (if available)

### Reporting Issues

When reporting issues, include:

```bash
# System information
node --version
npm --version
git --version

# Error messages (full stack trace if available)
# Steps to reproduce
# Expected vs actual behavior
# Screenshots if applicable
```

This development setup guide provides everything new contributors need to get started with local development on the Automata Controls Nexus BMS project! 🚀
