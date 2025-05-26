# Updated version of add_or_update_node function for incremental node saving
@api_view(['POST'])
@csrf_exempt
@permission_classes([IsAuthenticated])  # Ensure only authenticated users can update nodes
def add_or_update_node(request):
    """
    Add or update a node's content.
    Used for incremental saving in the outline mode.
    """
    node_id = request.data.get("node_id")
    content = request.data.get("content")

    if not node_id:
        return Response({'error': 'node_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        node = Node.objects.get(id=node_id)
        
        # Ensure the user has permission to modify this node
        if node.cognition.user != request.user:
            return Response({'error': 'You do not have permission to edit this node'}, 
                           status=status.HTTP_403_FORBIDDEN)
        
        # Update the node content
        node.content = content or ''
        
        # Update character count
        node.character_count = len(content) if content else 0
        
        node.save()
        
        # Return success response with updated node data
        return Response({
            'status': 'success',
            'node': NodeSerializer(node, context={'request': request}).data
        })
    except Node.DoesNotExist:
        return Response({'error': 'Node not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': f'Failed to update node: {str(e)}'}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)