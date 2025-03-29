#!/bin/bash
# Save this as debug.sh in your server and run it with bash debug.sh

echo "===== CHECKING NGINX CONFIGURATION ====="
nginx -t

echo -e "\n===== CHECKING IF NEXT.JS SERVER IS RUNNING ====="
netstat -tulpn | grep 3000

echo -e "\n===== CHECKING IF SOCKET.IO BRIDGE IS RUNNING ====="
netstat -tulpn | grep 3099

echo -e "\n===== TRYING TO ACCESS NEXT.JS SERVER DIRECTLY ====="
curl -I http://localhost:3000

echo -e "\n===== CHECKING STATIC ASSETS ON NEXT.JS SERVER ====="
echo "Note: The next test will probably fail, but it's useful to see the error"
curl -I http://localhost:3000/_next/static/chunks/main-app-598a5faf836531d6.js 2>/dev/null

echo -e "\n===== CHECKING PM2 STATUS ====="
pm2 list

echo -e "\n===== CHECKING FIREWALL STATUS ====="
ufw status

echo -e "\n===== CHECKING SYSTEM RESOURCES ====="
free -h
df -h

echo -e "\n===== TESTING COMPLETE ====="
echo "Next steps:"
echo "1. Apply the ultra-simple Nginx configuration"
echo "2. Rebuild Next.js app with: rm -rf .next && npm run build"
echo "3. Restart PM2 processes: pm2 restart automataneuralbms automataneuralbms-bridge"
echo "4. Try accessing your app in an incognito window"
