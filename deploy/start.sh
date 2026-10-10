#!/bin/sh
# Starts the API (internal, 127.0.0.1:3000) then the website on $PORT. Exits if either one dies,
# so the host restarts the container.
set -e
PUBLIC_URL="${ORIGIN:-${RENDER_EXTERNAL_URL:-http://localhost:${PORT:-10000}}}"

cd /app/api
PORT=3000 PUBLIC_API_URL="$PUBLIC_URL/api" UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}" node dist/main.js &
API_PID=$!

# Wait for the API (it runs migrations first) before taking traffic.
i=0
until node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  i=$((i+1))
  if [ $i -gt 90 ]; then echo "API did not start"; exit 1; fi
  if ! kill -0 $API_PID 2>/dev/null; then echo "API exited during start-up"; exit 1; fi
  sleep 1
done

cd /app/web
ORIGIN="$PUBLIC_URL" API_URL="http://127.0.0.1:3000" PORT="${PORT:-10000}" node build &
WEB_PID=$!

# If either process stops, stop the container.
while kill -0 $API_PID 2>/dev/null && kill -0 $WEB_PID 2>/dev/null; do sleep 5; done
echo "A process exited; shutting down"
kill $API_PID $WEB_PID 2>/dev/null || true
exit 1
