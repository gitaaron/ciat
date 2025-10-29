#!/bin/bash

# Start debug mode for CIAT
# This script starts the stub backend and provides instructions for testing

echo "Starting CIAT Debug Mode..."
echo "=========================="

# Kill any existing servers on port 3108
echo "Stopping any existing servers on port 3108..."
lsof -ti:3108 | xargs kill -9 2>/dev/null || true

# Start stub server
echo "Starting stub backend server..."
cd /Users/asurty/PProject/ciat/backend
node src/stub-server.js &
STUB_PID=$!

# Wait for server to start
echo "Waiting for stub server to start..."
sleep 3

# Check if server is running
if lsof -i :3108 > /dev/null 2>&1; then
    echo "✅ Stub server is running on port 3108"
else
    echo "❌ Failed to start stub server"
    exit 1
fi

echo ""
echo "Debug Mode Setup Complete!"
echo "=========================="
echo ""
echo "To test the frontend with debug mode:"
echo "1. Open your browser and go to: http://localhost:5175?debug=true"
echo "2. You should see 'DEBUG MODE' in the header"
echo "3. Use the debug controls to navigate between steps"
echo "4. Step 3 (Rules Review) should show auto-generated rules"
echo ""
echo "To test the stub API directly:"
echo "curl -X POST http://localhost:3108/api/rules/auto-generate -H 'Content-Type: application/json' -d '{\"transactions\": []}'"
echo ""
echo "Press Ctrl+C to stop the stub server when done testing"

# Keep script running and handle cleanup
trap "echo 'Stopping stub server...'; kill $STUB_PID 2>/dev/null; exit 0" INT
wait $STUB_PID
