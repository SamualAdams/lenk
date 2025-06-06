#!/bin/bash

# Clean up synthesis-related backup files
echo "Cleaning up synthesis backup files..."

cd /Users/jon/lenk/lenk/backend/api/migrations

# Remove synthesis backup migration files
rm -f *synthesis*.backup*
rm -f 0006_*.backup*

echo "Cleanup complete!"
echo "Synthesis system removed, widget system ready to use!"
