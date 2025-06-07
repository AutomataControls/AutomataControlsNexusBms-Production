## 📝 Description
Brief description of what this PR accomplishes and why it's needed.

**Related Issue(s):** Fixes #(issue number)

## 🔧 Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] ⚙️ Equipment logic addition/modification
- [ ] 🏭 Location processor addition/modification
- [ ] 🎨 UI/UX improvement
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security enhancement
- [ ] 🔧 Configuration change

## 🏭 Equipment/Location Details (if applicable)
- **Location ID**: [e.g., 1, 4, 5]
- **Location Name**: [e.g., Sample Location A]
- **Equipment Types**: [e.g., boiler, pump, fancoil, chiller]
- **Equipment IDs**: [List specific equipment IDs affected]
- **Control Logic Files**: [List .js files modified]

## 🧪 Testing
### Test Environment
- [ ] **Local Development** - Tested on local development environment
- [ ] **Staging Environment** - Tested on staging/test environment
- [ ] **Production Environment** - Tested on production (if applicable)

### Test Coverage
- [ ] **Unit Tests** - Added/updated unit tests for new functionality
- [ ] **Integration Tests** - Tested integration with existing systems
- [ ] **Equipment Logic Tests** - Tested equipment control algorithms
- [ ] **API Tests** - Tested API endpoints and responses
- [ ] **UI Tests** - Tested user interface changes
- [ ] **Database Tests** - Tested database operations and queries

### Equipment Testing (if applicable)
- [ ] **Real Equipment** - Tested with actual HVAC equipment
- [ ] **Simulated Data** - Tested with simulated equipment data
- [ ] **Safety Testing** - Verified safety interlocks and limits
- [ ] **Performance Testing** - Verified performance requirements met

## 📋 Changes Made

### Code Changes
- [ ] **Frontend Changes** - React components, UI improvements
- [ ] **Backend Changes** - API endpoints, server logic
- [ ] **Database Changes** - Schema modifications, queries
- [ ] **Equipment Logic** - Control algorithms, safety logic
- [ ] **Configuration** - PM2 configs, environment variables
- [ ] **Documentation** - README, API docs, code comments

### Files Modified
List the main files that were changed:
- `path/to/file1.ts` - Brief description of changes
- `path/to/file2.js` - Brief description of changes
- `path/to/file3.tsx` - Brief description of changes

### Dependencies
- [ ] **Added Dependencies** - New npm packages added
- [ ] **Updated Dependencies** - Existing packages updated
- [ ] **Removed Dependencies** - Packages removed

**New Dependencies Added:**
```json
{
  "package-name": "version",
  "another-package": "version"
}
```

## 🔄 Database Changes (if applicable)
### InfluxDB Changes
- [ ] **New Measurements** - New data tables/measurements
- [ ] **Schema Updates** - Field or tag changes
- [ ] **Query Changes** - Modified database queries
- [ ] **Data Migration** - Migration scripts required

### Firestore Changes
- [ ] **Security Rules** - Updated Firestore security rules
- [ ] **Collection Changes** - New or modified collections
- [ ] **Index Changes** - Database index modifications

## 🔒 Security Considerations
- [ ] **Input Validation** - All user inputs properly validated
- [ ] **Authentication** - Authentication requirements verified
- [ ] **Authorization** - Proper role-based access control
- [ ] **Data Sanitization** - User data properly sanitized
- [ ] **No Hardcoded Secrets** - No secrets in code
- [ ] **Secure Dependencies** - Dependencies scanned for vulnerabilities

### Security Review
- [ ] **No SQL Injection** - Database queries use parameterized statements
- [ ] **No XSS Vulnerabilities** - User content properly escaped
- [ ] **CSRF Protection** - Cross-site request forgery protection in place
- [ ] **Rate Limiting** - API endpoints have appropriate rate limiting
- [ ] **Error Handling** - Errors don't expose sensitive information

## ⚡ Performance Impact
### Performance Considerations
- [ ] **Database Performance** - Queries optimized for performance
- [ ] **Memory Usage** - Memory impact considered and optimized
- [ ] **Loading Times** - Page load times not negatively impacted
- [ ] **API Response Times** - API endpoints respond within SLA
- [ ] **Equipment Processing** - Control logic executes within timing requirements

### Performance Metrics
- **Database Query Time**: [Before/After if measured]
- **API Response Time**: [Before/After if measured]
- **Memory Usage**: [Impact assessment]
- **Equipment Processing Time**: [Processing speed if applicable]

## 📚 Documentation Updates
- [ ] **README Updated** - Updated relevant README files
- [ ] **API Documentation** - Updated API documentation
- [ ] **Code Comments** - Added/updated code comments
- [ ] **Equipment Logic Documentation** - Documented control algorithms
- [ ] **Deployment Documentation** - Updated deployment procedures
- [ ] **User Documentation** - Updated user guides if applicable

## 🔄 Breaking Changes
If this PR introduces breaking changes, please describe:

### Breaking Changes Details
- **Change 1**: Description and migration path
- **Change 2**: Description and migration path

### Migration Guide
Steps for users to migrate from previous version:
1. Step 1
2. Step 2
3. Step 3

## 📸 Screenshots (if applicable)
Add screenshots for UI changes or new features:

### Before
[Screenshot or description of previous state]

### After
[Screenshot or description of new state]

## 🎯 Verification Steps
Steps for reviewers to verify this PR:

1. **Setup**: [Any special setup required]
2. **Test Step 1**: [Specific test to perform]
3. **Test Step 2**: [Another verification step]
4. **Expected Result**: [What should happen]

### Equipment Testing Steps (if applicable)
1. **Equipment Setup**: [Equipment configuration needed]
2. **Control Test**: [How to test equipment control]
3. **Safety Test**: [How to verify safety functions]
4. **Performance Test**: [How to verify performance]

## 🔗 Related PRs/Issues
- **Depends on**: #(PR number) - Description
- **Blocks**: #(issue number) - Description
- **Related to**: #(issue number) - Description

## 📅 Deployment Considerations
### Deployment Requirements
- [ ] **Database Migration** - Database changes require migration
- [ ] **Configuration Changes** - Environment variables need updates
- [ ] **Service Restart** - Services need restart for changes
- [ ] **Equipment Downtime** - Changes may cause temporary equipment downtime
- [ ] **User Communication** - Users should be notified of changes

### Rollback Plan
- **Rollback Strategy**: [How to rollback if issues arise]
- **Data Recovery**: [How to recover data if needed]
- **Service Recovery**: [How to restore services quickly]

## ✅ Pre-Submission Checklist
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

### Code Quality Checklist
- [ ] **Linting**: Code passes ESLint checks
- [ ] **Formatting**: Code formatted with Prettier
- [ ] **TypeScript**: No TypeScript errors
- [ ] **Build**: Application builds successfully
- [ ] **Tests**: All tests pass

### Equipment Logic Checklist (if applicable)
- [ ] **4-Parameter Interface**: Follows standard equipment interface
- [ ] **Error Handling**: Proper error handling implemented
- [ ] **Safety Checks**: Safety conditions properly handled
- [ ] **Input Validation**: Equipment inputs validated
- [ ] **Output Validation**: Control outputs within safe ranges

## 📞 Additional Information
Any additional information that reviewers should know:

### Known Issues
- [List any known issues or limitations]

### Future Improvements
- [List potential future improvements or technical debt]

### Questions for Reviewers
- [Any specific questions or areas you'd like feedback on]

---

**Thanks for contributing to Automata Controls Nexus BMS! 🚀**
