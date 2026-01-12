#!/bin/bash
# Start the React frontend development server

cd "$(dirname "$0")/frontend"

echo "Starting React frontend on http://localhost:5173..."
npm run dev
