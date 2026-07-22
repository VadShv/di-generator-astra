#!/bin/bash
while true; do
  cd /home/z/my-project
  bun run dev &
  PID=$!
  # Wait for process to die
  wait $PID
  echo "Process died, restarting in 3 seconds..."
  sleep 3
done
