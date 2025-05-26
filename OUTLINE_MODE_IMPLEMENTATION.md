 Outline Mode Implementation for Lenk Project

## Overview
This implementation adds a new "Outline Mode" to the Lenk application, allowing users to edit nodes incrementally with automatic saving.

## Files Modified

### 1. Frontend Components

- **Created new component**: `/frontend/src/components/Cognition/Outline/OutlineMode.js`
  - Provides a dedicated interface for node-by-node editing
  - Implements incremental saving with debounce
  - Supports adding and deleting nodes
  - Uses Timeline for navigation between nodes

- **Added styling**: `/frontend/src/components/Cognition/Outline/OutlineMode.css`
  - Consistent styling with the rest of the application
  - Responsive design for mobile and desktop
  - Visual feedback for saving status

- **Updated Navigation component**: `/frontend/src/components/Navigation.js`
  - Added Outline option to the navigation menu

- **Updated App routes**: `/frontend/src/App.js`
  - Added new route for OutlineMode: `/outline/:id`

- **Enhanced Dump component**: `/frontend/src/components/Cognition/Compose/Dump.js`
  - Added edit button for each cognition
  - Implemented handler to navigate to outline mode

- **Updated Dump CSS**: `/frontend/src/components/Cognition/Compose/Dump.css`
  - Added styling for the new edit button

### 2. Backend Enhancement

- **Created updated node endpoint**: `/backend/api/updated_node_view.py`
  - Enhanced version of the existing add_or_update_node function
  - Added proper authentication and permission checks
  - Updates character count automatically
  - Improved error handling and response structure

## Key Features

1. **Incremental Saving**
   - Changes are automatically saved after typing stops
   - Visual feedback shows saving status: saved/saving/error
   - Debouncing prevents excessive API calls

2. **Node Navigation**
   - Timeline component for visual navigation between nodes
   - Preserves the existing Timeline functionality

3. **Node Management**
   - Add new nodes at any position
   - Delete nodes with confirmation dialog
   - Cannot delete the last remaining node

4. **Easy Access**
   - Edit button on each cognition in the list view
   - Navigation menu option for outline mode

## Implementation Details

### Incremental Saving Logic
```javascript
const handleNodeContentChange = (e) => {
  const updatedContent = e.target.value;
  const nodeId = nodes[currentNodeIndex]?.id;
  
  // Update local state immediately
  const updatedNodes = [...nodes];
  updatedNodes[currentNodeIndex] = {
    ...updatedNodes[currentNodeIndex],
    content: updatedContent
  };
  setNodes(updatedNodes);
  
  // Set saving status
  setSaveStatus('saving');
  
  // Debounce the actual save
  const timer = setTimeout(() => {
    saveNode(nodeId, updatedContent);
  }, 1000);
  
  return () => clearTimeout(timer);
};
```

### Backend API Enhancement
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_or_update_node(request):
    node_id = request.data.get("node_id")
    content = request.data.get("content")

    try:
        node = Node.objects.get(id=node_id)
        
        # Ensure the user has permission
        if node.cognition.user != request.user:
            return Response({'error': 'Permission denied'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Update content and character count
        node.content = content or ''
        node.character_count = len(content) if content else 0
        node.save()
        
        return Response({
            'status': 'success',
            'node': NodeSerializer(node).data
        })
    except Exception as e:
        return Response({'error': str(e)}, 
                      status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

## Next Steps

1. **Backend Integration**
   - Replace the existing `add_or_update_node` function with the enhanced version
   - Ensure proper permission checks are in place

2. **Testing**
   - Test incremental saving functionality
   - Verify node adding and deletion
   - Check permission handling

3. **Future Enhancements**
   - Drag and drop reordering of nodes
   - Bulk operations on multiple nodes
   - Rich text editing capabilities
