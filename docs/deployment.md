# Production Deployment Guide

## 🚀 Overview

Automata Controls Nexus BMS uses a sophisticated multi-service architecture designed for professional building management systems. This guide covers complete production deployment, from infrastructure setup to multi-location HVAC control system management.

## 🏗️ Architecture Overview

### **Service Architecture**
```
Production Environment
├── Core Services (ecosystem.config.js)
│   ├── Next.js Application (neural)
│   ├── Enhanced Equipment Worker (cluster mode)
│   └── System Monitoring Service
├── Location Processors (separate configs)
│   ├── Location A Smart Queue System (18 equipment pieces)
│   ├── Location B System (8 equipment pieces)
│   ├── Location C System (6 equipment pieces)
│   ├── Location D System (2 DOAS units)
│   ├── Location E (geothermal chiller)
│   └── Sample Location Logic Factory (template)
└── Infrastructure Services
    ├── InfluxDB 3.0 (time-series database)
    ├── Redis (queue management & caching)
    └── Firebase (authentication & security)
```

---

## 📋 Prerequisites

### **System Requirements**
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores (8+ recommended for production)
- **RAM**: 8GB minimum (16GB+ recommended)
- **Storage**: 100GB+ SSD storage
- **Network**: Static IP with firewall access

### **Software Dependencies**
```bash
# Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 Process Manager
npm install -g pm2

# Redis Server
sudo apt-get install redis-server

# Additional Tools
sudo apt-get install curl wget git build-essential
```

---

## 🗄️ Database Setup

### **InfluxDB 3.0 Installation**

#### **Automated Installation**
```bash
# Download the installation script
curl -sSL https://raw.githubusercontent.com/AutomataControls/AutomataControlsNexusBms-Production/main/scripts/install-influxdb3.sh -o install-influxdb3.sh
chmod +x install-influxdb3.sh

# Run installation
./install-influxdb3.sh
```

#### **Manual Installation Steps**
```bash
# Create installation directory
mkdir -p ~/.influxdb

# Download InfluxDB 3.0 (replace with appropriate architecture)
INFLUXDB_VERSION="3.0.1"
ARTIFACT="linux_amd64"  # or linux_arm64, darwin_arm64
URL="https://dl.influxdata.com/influxdb/releases/influxdb3-core-${INFLUXDB_VERSION}_${ARTIFACT}.tar.gz"

curl -sSL "${URL}" -o ~/.influxdb/influxdb3-core.tar.gz

# Verify SHA256 checksum
curl -sSL "${URL}.sha256" -o ~/.influxdb/influxdb3-core.tar.gz.sha256
sha256sum -c ~/.influxdb/influxdb3-core.tar.gz.sha256

# Extract and install
tar -xf ~/.influxdb/influxdb3-core.tar.gz -C ~/.influxdb/
chmod +x ~/.influxdb/influxdb3

# Add to PATH
echo 'export PATH="$PATH:~/.influxdb/"' >> ~/.bashrc
source ~/.bashrc
```

#### **Database Configuration**
```bash
# Start InfluxDB with file storage
influxdb3 serve \
  --object-store=file \
  --data-dir=/var/lib/influxdb3 \
  --http-bind=0.0.0.0:8181 \
  --node-id=production-node

# Or with in-memory storage (development)
influxdb3 serve \
  --object-store=memory \
  --http-bind=0.0.0.0:8181 \
  --node-id=dev-node
```

#### **Cloud Storage Configuration**

**AWS S3 Backend:**
```bash
influxdb3 serve \
  --object-store=s3 \
  --bucket=your-influxdb-bucket \
  --aws-default-region=us-east-1 \
  --aws-access-key-id=YOUR_ACCESS_KEY \
  --aws-secret-access-key=YOUR_SECRET_KEY \
  --http-bind=0.0.0.0:8181
```

**Azure Storage Backend:**
```bash
influxdb3 serve \
  --object-store=azure \
  --azure-storage-account=youraccount \
  --azure-storage-access-key=YOUR_ACCESS_KEY \
  --http-bind=0.0.0.0:8181
```

**Google Cloud Storage Backend:**
```bash
influxdb3 serve \
  --object-store=google \
  --google-service-account=/path/to/service-account.json \
  --http-bind=0.0.0.0:8181
```

### **Database Creation**
```bash
# Create required databases
curl -X POST "http://localhost:8181/api/v3/databases" \
  -H "Content-Type: application/json" \
  -d '{"name": "Locations"}'

curl -X POST "http://localhost:8181/api/v3/databases" \
  -H "Content-Type: application/json" \
  -d '{"name": "UIControlCommands"}'

curl -X POST "http://localhost:8181/api/v3/databases" \
  -H "Content-Type: application/json" \
  -d '{"name": "NeuralControlCommands"}'
```

### **Redis Configuration**
```bash
# Install and configure Redis
sudo apt-get install redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf

# Key settings:
# maxmemory 2gb
# maxmemory-policy allkeys-lru
# save 900 1
# save 300 10
# save 60 10000

# Start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Verify Redis is running
redis-cli ping  # Should return PONG
```

---

## 🔐 Security Configuration

### **Firebase Setup**

#### **Project Configuration**
1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication with Email/Password
3. Set up Firestore Database
4. Download service account key

#### **Firestore Security Rules**
```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Authentication functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        'admin' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roles;
    }

    function isDevOps() {
      return isSignedIn() && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        'devops' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roles;
    }
    
    function isOwnerOrAdmin(userId) {
      return isSignedIn() && (request.auth.uid == userId || isAdmin() || isDevOps());
    }
    
    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users collection - Role-based access
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() || !exists(/databases/$(database)/documents/users/$(request.auth.uid));
      allow delete: if isAdmin() || isDevOps();
      allow update: if isOwnerOrAdmin(userId);
    }
    
    // Equipment & Locations - Admin control
    match /locations/{locationId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isDevOps();
    }
    
    match /equipment/{equipmentId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isDevOps();
    }
    
    // Metrics - Read-only historical data
    match /metrics/{metricId} {
      allow read: if isSignedIn();
      allow create: if isAdmin() || isDevOps();
      allow update, delete: if false; // Immutable
    }
    
    // System configuration
    match /system_config/{configId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isDevOps();
    }
  }
}
```

#### **Deploy Security Rules**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

---

## 📦 Application Deployment

### **Environment Configuration**
Create `.env.local` file:
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# InfluxDB Configuration
INFLUXDB_URL=http://your-influxdb-server:8181
INFLUXDB_DATABASE=Locations
INFLUXDB_DATABASE3=UIControlCommands
INFLUXDB_DATABASE5=NeuralControlCommands
INFLUXDB_TIMEOUT=30000
INFLUXDB_MAX_RETRIES=3
INFLUXDB_RETRY_DELAY=1000

# Application URLs
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Email Configuration (optional)
RESEND_API_KEY=your_resend_api_key
LOG_VIEWER_SECRET=your_secret_key

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### **Build and Install**
```bash
# Clone repository
git clone https://github.com/AutomataControls/AutomataControlsNexusBms-Production.git
cd AutomataControlsNexusBms-Production

# Install dependencies
npm install

# Build application
npm run build

# Build TypeScript workers
npx tsc -p tsconfig.workers.json
```

---

## 🔧 PM2 Process Management

### **Core Services Configuration**
`ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'neural',
      script: '/usr/bin/bash',
      args: '-c "npx next start -p 3000"',
      cwd: '/opt/productionapp',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'monitoring-service',
      script: './scripts/start-monitoring.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'enhanced-equipment-worker',
      script: './dist/workers/enhanced-equipment-worker.js',
      watch: false,
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '300M',
      out_file: './logs/ui-worker.log',
      error_file: './logs/ui-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        INFLUXDB_URL: 'http://your-server:8181',
        INFLUXDB_DATABASE3: 'UIControlCommands',
        INFLUXDB_DATABASE5: 'NeuralControlCommands',
        INFLUXDB_LOCATIONS_BUCKET: 'Locations'
      }
    }
  ]
}
```

### **Location-Specific Processors**

#### **Sample Location Configuration**
`location-processor-template.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'location-processor-1',
      script: './dist/workers/location-processors/sample-location-processor.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        LOCATION_ID: '1',
        LOCATION_NAME: 'sample-location'
      }
    },
    {
      name: 'location-factory-1',
      script: './dist/workers/logic-factories/sample-logic-factory-worker.js',
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
```

#### **Multi-Location Deployment**
```bash
# Location A Smart Queue System (18 equipment pieces)
pm2 start location-a.config.js

# Location B System (8 equipment pieces) 
pm2 start location-b.config.js

# Location C System (6 equipment pieces)
pm2 start location-c.config.js

# Location D System (2 DOAS units)
pm2 start location-d.config.js

# Location E (geothermal chiller)
pm2 start location-e.config.js

# Sample Location Logic Factory
pm2 start sample-location.config.js

# Core services
pm2 start ecosystem.config.js
```

---

## 🚀 Deployment Process

### **Automated Deployment Script**
`restart-system.sh`:
```bash
#!/bin/bash
echo "▶ Starting complete system restart..."

# Stop all processes
pm2 stop all
pm2 kill
pkill -f "next-server"

# Clear caches
redis-cli FLUSHALL
rm -rf .next
rm -rf node_modules/.cache

# Fresh build
npm run build
npx tsc -p tsconfig.workers.json

# Start services in order
pm2 start location-a.config.js
sleep 3
pm2 start location-b.config.js  
sleep 3
pm2 start location-c.config.js
sleep 3
pm2 start location-d.config.js
sleep 3
pm2 start location-e.config.js
sleep 3
pm2 start sample-location.config.js
sleep 3
pm2 start ecosystem.config.js

echo "✓ All systems operational!"
pm2 status
```

### **Manual Deployment Steps**
```bash
# 1. Stop existing services
pm2 stop all

# 2. Pull latest code
git pull origin main

# 3. Install dependencies
npm install

# 4. Build application
npm run build
npx tsc -p tsconfig.workers.json

# 5. Start services
pm2 start ecosystem.config.js
pm2 start sample-location.config.js
# ... other location configs

# 6. Save PM2 configuration
pm2 save

# 7. Setup startup script
pm2 startup
```

---

## 📊 Monitoring & Maintenance

### **Process Monitoring**
```bash
# View all processes
pm2 status

# Monitor resource usage
pm2 monit

# View logs
pm2 logs neural
pm2 logs location-processor-1

# Restart specific service
pm2 restart neural
pm2 reload enhanced-equipment-worker
```

### **Health Checks**
```bash
# Application health
curl http://localhost:3000/api/health

# InfluxDB health  
curl http://localhost:8181/health

# Redis health
redis-cli ping

# System resources
pm2 monit
htop
df -h
```

### **Log Management**
```bash
# Install log rotation
pm2 install pm2-logrotate

# Configure rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true

# View logs
pm2 logs --lines 100
pm2 flush  # Clear logs
```

---

## 🔧 Performance Optimization

### **System Tuning**
```bash
# Increase file descriptor limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# Optimize kernel parameters
echo "net.core.somaxconn = 65536" >> /etc/sysctl.conf
echo "vm.swappiness = 10" >> /etc/sysctl.conf
sysctl -p
```

### **Node.js Optimization**
```bash
# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable production optimizations
export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
```

### **Database Optimization**
```bash
# InfluxDB performance tuning
influxdb3 serve \
  --object-store=file \
  --data-dir=/var/lib/influxdb3 \
  --http-bind=0.0.0.0:8181 \
  --cache-max-memory-size=1GB \
  --wal-max-write-buffer-size=128MB
```

---

## 🔒 Security Hardening

### **Firewall Configuration**
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application port
sudo ufw allow 3000

# Restrict InfluxDB access (internal only)
sudo ufw deny 8181
sudo ufw allow from 10.0.0.0/8 to any port 8181

# Restrict Redis access
sudo ufw deny 6379
sudo ufw allow from 127.0.0.1 to any port 6379
```

### **SSL/TLS Configuration**
```bash
# Install Certbot
sudo apt-get install certbot

# Obtain SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/nexus-bms
```

Nginx configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 📚 System Administration

### **Backup Procedures**
```bash
# Create backup script
cat > backup-system.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/"

# Backup application
tar -czf "$BACKUP_DIR/application.tar.gz" /opt/productionapp

# Backup InfluxDB data
tar -czf "$BACKUP_DIR/influxdb.tar.gz" /var/lib/influxdb3

# Backup Redis data
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/"

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x backup-system.sh
```

### **System Recovery**
```bash
# Restore from backup
BACKUP_DIR="/backup/20241201_120000"  # Replace with actual backup

# Stop services
pm2 stop all

# Restore application
tar -xzf "$BACKUP_DIR/application.tar.gz" -C /

# Restore InfluxDB
sudo systemctl stop influxdb3
tar -xzf "$BACKUP_DIR/influxdb.tar.gz" -C /
sudo systemctl start influxdb3

# Restore Redis
sudo systemctl stop redis-server
cp "$BACKUP_DIR/dump.rdb" /var/lib/redis/
sudo systemctl start redis-server

# Restore PM2 configuration
pm2 resurrect "$BACKUP_DIR/dump.pm2"
```

### **Update Procedures**
```bash
# Update application
git fetch origin
git checkout main
git pull origin main

# Update dependencies
npm update

# Rebuild application
npm run build
npx tsc -p tsconfig.workers.json

# Rolling restart (zero downtime)
pm2 reload all
```

---

## 🚨 Troubleshooting

### **Common Issues**

#### **Service Won't Start**
```bash
# Check process status
pm2 status

# Check logs for errors
pm2 logs neural --lines 50

# Check system resources
free -h
df -h

# Check port conflicts
netstat -tlnp | grep 3000
```

#### **Database Connection Issues**
```bash
# Test InfluxDB connection
curl http://localhost:8181/health

# Check InfluxDB logs
journalctl -u influxdb3 -f

# Test Redis connection
redis-cli ping

# Check Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

#### **Performance Issues**
```bash
# Monitor system resources
pm2 monit
htop
iotop

# Check Node.js memory usage
pm2 show neural

# Analyze slow queries
# Check InfluxDB query performance
```

### **Emergency Procedures**

#### **Complete System Reset**
```bash
# Stop all services
pm2 delete all
pm2 kill

# Clear all caches
redis-cli FLUSHALL
rm -rf .next node_modules/.cache

# Reinstall and restart
npm install
npm run build
npx tsc -p tsconfig.workers.json
./restart-system.sh
```

#### **Database Recovery**
```bash
# If InfluxDB is corrupted
sudo systemctl stop influxdb3
sudo rm -rf /var/lib/influxdb3/*
sudo systemctl start influxdb3

# Recreate databases
curl -X POST "http://localhost:8181/api/v3/databases" \
  -H "Content-Type: application/json" \
  -d '{"name": "Locations"}'
```

---

## 📞 Support & Resources

### **System Information**
- **Application**: Automata Controls Nexus BMS
- **Architecture**: Multi-location HVAC control system
- **Technology Stack**: Next.js, InfluxDB 3.0, Redis, Firebase
- **Process Manager**: PM2 with cluster mode
- **Documentation**: https://docs.automatacontrols.com

### **Monitoring URLs**
- **Application**: https://your-domain.com
- **PM2 Monitor**: `pm2 monit`
- **InfluxDB Health**: http://localhost:8181/health
- **System Logs**: `pm2 logs --timestamp`

### **Emergency Contacts**
- **Technical Support**: support@automatacontrols.com
- **System Status**: Create support ticket for system issues
- **Documentation**: Check docs for additional troubleshooting

---

This deployment guide provides comprehensive instructions for setting up and maintaining a production Automata Controls Nexus BMS installation. Follow the sections in order for a complete deployment, or reference specific sections for maintenance and troubleshooting tasks.
