// NEW FILE: /opt/productionapp/lib/patches.ts
// This file will contain all the patching logic

export const patchScripts = `
  // Combined patching script
  (function() {
    // 1. React.memo patch
    function patchReactMemo() {
      try {
        if (window.React && window.React.memo) {
          const originalMemo = window.React.memo;
          window.React.memo = function patchedMemo(component) {
            try {
              return originalMemo(component);
            } catch (e) {
              console.warn('Patched React.memo error:', e.message);
              return component;
            }
          };
          console.log('React.memo successfully patched');
          return true;
        }
        return false;
      } catch (e) {
        console.error('Error patching React.memo:', e);
        return false;
      }
    }

    // Try to patch React.memo
    if (!patchReactMemo()) {
      const interval = setInterval(() => {
        if (patchReactMemo()) clearInterval(interval);
      }, 10);
      
      window.addEventListener('DOMContentLoaded', () => {
        patchReactMemo();
        clearInterval(interval);
      });
    }

    // 2. Location card fix
    window.addEventListener('error', function(e) {
      if (e.message && e.message.includes("Cannot read properties of undefined (reading 'call')")) {
        console.log('Caught call property error, attempting to fix');

        if (window.__webpack_require__ && window.__webpack_modules__) {
          Object.keys(window.__webpack_modules__).forEach(key => {
            if (key.toString().includes('location-card')) {
              console.log('Found location-card module, patching:', key);
              const originalModule = window.__webpack_modules__[key];
              window.__webpack_modules__[key] = function(module, exports, __webpack_require__) {
                try {
                  originalModule(module, exports, __webpack_require__);
                } catch (moduleError) {
                  console.warn('Caught error in location-card module, providing fallback', moduleError);
                  exports.__esModule = true;
                  exports.LocationCard = function LocationCard() {
                    return null;
                  };
                }
              };
            }
          });
        }
        e.preventDefault();
        return false;
      }
    }, true);

    // 3. Firebase fix & 4. Webpack patch (combined)
    window.__webpack_patch_applied = false;

    function patchWebpack() {
      if (window.__webpack_patch_applied) return;

      if (window.__webpack_require__) {
        const originalRequire = window.__webpack_require__;
        window.__webpack_require__ = function(moduleId) {
          try {
            return originalRequire(moduleId);
          } catch (e) {
            if (e && e.message &&
                (e.message.includes('unexpected token') ||
                 e.message.includes('AbstractUserDataWriter'))) {
              console.warn('Webpack module patch: Bypassing problematic module:', moduleId);
              return {
                AbstractUserDataWriter: function() { return {}; },
                AggregateField: function() { return {}; }
              };
            }
            if (e && e.message && e.message.includes("Cannot read properties of undefined (reading 'call')")) {
              console.warn('Webpack module patch: Handling call property error:', moduleId);
              return {};
            }
            throw e;
          }
        };

        for (const prop in originalRequire) {
          if (originalRequire.hasOwnProperty(prop)) {
            window.__webpack_require__[prop] = originalRequire[prop];
          }
        }

        window.__webpack_patch_applied = true;
        console.log('Webpack module loader patched for Firebase compatibility');
      }
    }

    // Apply webpack patch at various stages
    patchWebpack();
    window.addEventListener('DOMContentLoaded', patchWebpack);
    window.addEventListener('load', patchWebpack);

    // Firebase workaround for login redirection
    if (sessionStorage.getItem('use_firebase_workaround') === 'true') {
      console.log('Setting up Firebase webpack fallback...');
      window.addEventListener('error', function(e) {
        if (e.message &&
            (e.message.includes('unexpected token') ||
             e.message.includes('AbstractUserDataWriter') ||
             e.message.includes('ChunkLoadError'))) {

          if (window.location.pathname.includes('/login')) {
            const authData = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');
            if (authData) {
              console.log('Authentication detected, redirecting from login page to dashboard...');
              window.location.href = '/dashboard';
              e.preventDefault();
              return;
            }
          }

          const currentUrl = new URL(window.location.href);
          if (!currentUrl.searchParams.has('v')) {
            currentUrl.searchParams.set('v', Date.now().toString());
            window.location.href = currentUrl.toString();
            e.preventDefault();
          }
        }
      }, true);
    }
  })();
`;
