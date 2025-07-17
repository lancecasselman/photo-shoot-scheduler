#!/bin/bash

# Photography Scheduler Startup Script
echo "Starting Photography Scheduler..."
echo "Working directory: $(pwd)"
echo "Port: ${PORT:-5000}"

# Start the Python HTTP server
python app.py