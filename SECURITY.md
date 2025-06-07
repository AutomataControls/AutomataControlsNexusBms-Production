# Security Policy

## 🔒 Security Overview

Automata Controls Nexus BMS takes security seriously. This document outlines our security practices, supported versions, and how to report security vulnerabilities.

## 📋 Supported Versions

We provide security updates for the following versions:

| Version | Supported          | End of Life |
| ------- | ------------------ | ----------- |
| 1.0.x   | ✅ Active support  | TBD         |
| 0.9.x   | ⚠️ Critical fixes only | 2025-12-31  |
| < 0.9   | ❌ No longer supported | 2025-06-30  |

## 🚨 Reporting a Vulnerability

### Quick Report
If you discover a security vulnerability, please report it responsibly:

**📧 Email:** security@automatacontrols.com  
**🔐 PGP Key:** Available on request  
**⏱️ Response Time:** Within 48 hours  

### What to Include
Please provide:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if available)
- Your contact information

### What NOT to Include
Please do not:
- Post vulnerabilities in public issues
- Share vulnerabilities on social media
- Test vulnerabilities on production systems
- Access data that doesn't belong to you

## 🛡️ Security Measures

### Authentication & Authorization
- **Firebase Authentication** with email/password and MFA support
- **Role-based access control** (User, Admin, DevOps roles)
- **JWT token validation** for all API requests
- **Session management** with automatic token refresh

### Data Protection
- **InfluxDB 3.0** with configurable authentication
- **Redis security** with password protection and network restrictions
- **Environment variables** for sensitive configuration
- **Input validation** and sanitization on all endpoints

### Network Security
- **HTTPS enforcement** in production
- **Firewall rules** for database access restriction
- **Rate limiting** on API endpoints
- **CORS configuration** for cross-origin requests

### Infrastructure Security
- **Process isolation** with PM2 process management
- **File system permissions** with least privilege access
- **Docker security** best practices for containerized deployments
- **Regular security updates** for dependencies

## 🔍 Security Best Practices

### For Developers
```typescript
// ✅ Good: Input validation
const equipmentId = z.string().regex(/^[A-Z0-9_]{3,20}$/).parse(input);

// ✅ Good: Environment variables
const dbUrl = process.env.INFLUXDB_URL || 'http://localhost:8181';

// ✅ Good: Error handling without information disclosure
catch (error) {
  console.error('Database error:', error);
  return { error: 'Internal server error' };
}

// ❌ Bad: SQL injection vulnerability
const query = `SELECT * FROM equipment WHERE id = '${userInput}'`;

// ❌ Bad: Hardcoded secrets
const apiKey = 'secret-key-12345';

// ❌ Bad: Information disclosure
catch (error) {
  return { error: error.message, stack: error.stack };
}
```

### For System Administrators
```bash
# ✅ Secure firewall configuration
sudo ufw allow ssh
sudo ufw allow 443
sudo ufw deny 8181  # Restrict InfluxDB access
sudo ufw enable

# ✅ Secure file permissions
chmod 600 .env.local
chown appuser:appgroup /opt/productionapp

# ✅ Regular updates
apt update && apt upgrade
npm audit fix
```

### For Equipment Logic Development
```javascript
// ✅ Good: Input validation in equipment logic
function boilerControl(metricsInput, settingsInput, currentTemp, state) {
  // Validate inputs
  if (!metricsInput || typeof metricsInput !== 'object') {
    return { unitEnable: false, error: 'Invalid metrics input' };
  }
  
  // Sanitize temperature values
  const supplyTemp = Math.max(0, Math.min(250, parseFloat(metricsInput.supplyTemp) || 0));
  const setpoint = Math.max(60, Math.min(200, parseFloat(settingsInput.setpoint) || 140));
  
  // Safety checks
  if (supplyTemp > 200) {
    return { 
      unitEnable: false, 
      safetyShutoff: true,
      reason: 'High temperature safety shutdown' 
    };
  }
  
  return { unitEnable: true, temperatureSetpoint: setpoint };
}
```

## 🔧 Security Configuration

### Firebase Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Require authentication for all operations
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Role-based access control
    function isAdmin() {
      return isSignedIn() && 
        'admin' in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.roles;
    }
    
    // Default deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users can only access their own data or admins can access all
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId || isAdmin();
    }
  }
}
```

### InfluxDB Security
```bash
# Enable authentication
influxdb3 serve \
  --auth-enabled \
  --http-bind=127.0.0.1:8181 \
  --object-store=file \
  --data-dir=/var/lib/influxdb3

# Create admin user
influxdb3 user create --username admin --password "secure-password"

# Create limited user for application
influxdb3 user create --username app --password "app-password" --read-only
```

### Redis Security
```bash
# Configure Redis authentication
echo "requirepass your-secure-password" >> /etc/redis/redis.conf

# Bind to localhost only
echo "bind 127.0.0.1" >> /etc/redis/redis.conf

# Disable dangerous commands
echo "rename-command FLUSHDB \"\"" >> /etc/redis/redis.conf
echo "rename-command FLUSHALL \"\"" >> /etc/redis/redis.conf
```

## 🚨 Incident Response

### If You Suspect a Security Breach
1. **Immediate Action**
   - Disconnect affected systems from the network
   - Preserve evidence and log files
   - Contact security@automatacontrols.com immediately

2. **Assessment**
   - Determine scope and impact of the breach
   - Identify compromised data or systems
   - Document timeline of events

3. **Containment**
   - Patch vulnerabilities immediately
   - Reset passwords and API keys
   - Update firewall rules as needed

4. **Recovery**
   - Restore from clean backups if necessary
   - Implement additional monitoring
   - Conduct security review

## 📊 Security Monitoring

### Automated Monitoring
- **Failed login attempts** monitoring
- **Unusual API access patterns** detection
- **Database connection anomalies** alerting
- **File system integrity** checking

### Log Analysis
- **Application logs** for security events
- **Database access logs** for unauthorized queries
- **System logs** for privilege escalations
- **Network logs** for suspicious connections

### Regular Security Tasks
- **Dependency vulnerability scanning** with `npm audit`
- **Security updates** for operating system and packages
- **Access review** for user accounts and permissions
- **Backup verification** and disaster recovery testing

## 🏆 Security Recognition

We appreciate responsible disclosure of security vulnerabilities. Contributors who report valid security issues may be:

- Listed in our security acknowledgments (with permission)
- Eligible for bug bounty rewards (for critical vulnerabilities)
- Invited to participate in our security advisory program
- Recognized in release notes and security bulletins

## 📚 Security Resources

### Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Next.js Security Documentation](https://nextjs.org/docs/advanced-features/security-headers)
- [InfluxDB Security Guide](https://docs.influxdata.com/influxdb/cloud/security/)

### Security Tools
- **Static Analysis:** ESLint security plugins
- **Dependency Scanning:** npm audit, Dependabot
- **Runtime Protection:** Helmet.js for HTTP headers
- **Vulnerability Database:** GitHub Security Advisories

### Training Resources
- **Secure Coding Practices** for JavaScript/TypeScript
- **Building Management System Security** considerations
- **Infrastructure Security** for production deployments
- **Incident Response** procedures and protocols

## 📞 Contact Information

### Security Team
- **Email:** security@automatacontrols.com
- **Response Time:** Within 48 hours
- **PGP Key:** Available on request

### Emergency Contact
For critical security issues requiring immediate attention:
- **Priority Email:** critical-security@automatacontrols.com
- **Response Time:** Within 4 hours during business days

---

**Last Updated:** January 1, 2025  
**Next Review:** July 1, 2025

*This security policy is reviewed and updated regularly. Check our repository for the most current version.*
