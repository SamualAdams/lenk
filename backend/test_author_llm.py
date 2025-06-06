#!/usr/bin/env python
"""
Test script to verify author LLM widget functionality
"""

import os
import sys
import django
from django.conf import settings

# Add the backend directory to the Python path
sys.path.insert(0, '/Users/jon/lenk/lenk/backend')

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from api.models import Widget

def test_widget_choices():
    """Test that author_llm is in widget type choices"""
    widget_types = [choice[0] for choice in Widget.WIDGET_TYPE_CHOICES]
    llm_presets = [choice[0] for choice in Widget.LLM_PRESET_CHOICES]
    
    print("Widget Types Available:")
    for widget_type in widget_types:
        print(f"  - {widget_type}")
    
    print("\nLLM Presets Available:")
    for preset in llm_presets:
        print(f"  - {preset}")
    
    # Check if author_llm is available
    if 'author_llm' in widget_types:
        print("\n✅ SUCCESS: author_llm widget type is available")
    else:
        print("\n❌ ERROR: author_llm widget type is NOT available")
    
    # Check for author presets
    author_presets = ['explain', 'examples', 'context', 'connections', 'deeper_dive', 'clarify', 'applications']
    missing_presets = [preset for preset in author_presets if preset not in llm_presets]
    
    if not missing_presets:
        print("✅ SUCCESS: All author LLM presets are available")
    else:
        print(f"❌ ERROR: Missing author LLM presets: {missing_presets}")

if __name__ == '__main__':
    test_widget_choices()
