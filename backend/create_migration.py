#!/usr/bin/env python3
"""
Create migration for semantic analysis models
"""
import subprocess
import os
import sys

# Change to the backend directory
backend_dir = '/Users/jon/lenk/lenk/backend'
os.chdir(backend_dir)

# Create the migration
try:
    result = subprocess.run([
        sys.executable, 'manage.py', 'makemigrations', 'api', 
        '--name', 'add_semantic_analysis_models'
    ], check=True, capture_output=True, text=True)
    
    print("Migration created successfully:")
    print(result.stdout)
    
    if result.stderr:
        print("Warnings/Errors:")
        print(result.stderr)
        
except subprocess.CalledProcessError as e:
    print(f"Error creating migration: {e}")
    print(f"stdout: {e.stdout}")
    print(f"stderr: {e.stderr}")
