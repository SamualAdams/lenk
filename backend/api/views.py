# api/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc
from .serializers import (
    CognitionSerializer, CognitionDetailSerializer, 
    NodeSerializer, SynthesisSerializer, PresetResponseSerializer,
    ArcSerializer
)
import re

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "Hello, world!"})

from rest_framework import permissions

@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny])
def create_cognition(request):
    # Create the cognition
    serializer = CognitionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    cognition = serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)

class CognitionViewSet(viewsets.ModelViewSet):
    queryset = Cognition.objects.all().order_by('-created_at')
    permission_classes = [permissions.AllowAny]  # Explicitly set permissions
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CognitionDetailSerializer
        return CognitionSerializer
    
    def create(self, request, *args, **kwargs):
        # Log the incoming request data for debugging
        print(f"Received data: {request.data}")
        
        # Create the cognition
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def process_text(self, request, pk=None):
        cognition = self.get_object()
        text = cognition.raw_content
        
        # Parse text into paragraphs/nodes
        paragraphs = [p.strip() for p in re.split(r'\n\n+', text) if p.strip()]
        
        # If we have very few paragraphs, try splitting by single newlines
        if len(paragraphs) <= 1:
            paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
            
            # If still few paragraphs, try splitting by sentences
            if len(paragraphs) <= 3:
                sentences = re.split(r'\.(?=\s)', text)
                paragraphs = []
                current_para = []
                
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    
                    if not sentence.endswith(('.', '?', '!', ':', ';')):
                        if len(sentence) > 30 or any(p in sentence for p in ',.;:?!'):
                            sentence += '.'
                    
                    current_para.append(sentence)
                    # Create new paragraph every 3-5 sentences
                    if len(current_para) >= 3 + (hash(sentence) % 3):
                        paragraphs.append(' '.join(current_para))
                        current_para = []
                
                # Add remaining sentences
                if current_para:
                    paragraphs.append(' '.join(current_para))
        
        # Delete existing nodes
        cognition.nodes.all().delete()
        
        # Create new nodes
        for i, paragraph in enumerate(paragraphs):
            Node.objects.create(
                cognition=cognition,
                content=paragraph,
                position=i,
                character_count=len(paragraph)
            )
        
        return Response({
            'status': 'success',
            'nodes_created': len(paragraphs)
        })

    @action(detail=True, methods=['post'])
    def append_text(self, request, pk=None):
        cognition = self.get_object()
        new_text = request.data.get('text', '')
        
        if not new_text.strip():
            return Response(
                {'error': 'No text provided to append'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Append the new text to the existing raw_content with a separator
        separator = "\n\n"
        if not cognition.raw_content.endswith('\n'):
            separator = "\n\n"
        
        # Update the raw_content field
        cognition.raw_content += separator + new_text
        cognition.save()
        
        # Get the current highest node position
        last_position = 0
        if cognition.nodes.exists():
            last_position = cognition.nodes.order_by('-position').first().position
        
        # Process only the new text into paragraphs/nodes
        paragraphs = [p.strip() for p in re.split(r'\n\n+', new_text) if p.strip()]
        
        # If we have very few paragraphs, try splitting by single newlines
        if len(paragraphs) <= 1:
            paragraphs = [p.strip() for p in new_text.split('\n') if p.strip()]
            
            # If still few paragraphs, try splitting by sentences
            if len(paragraphs) <= 3:
                sentences = re.split(r'\.(?=\s)', new_text)
                paragraphs = []
                current_para = []
                
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    
                    if not sentence.endswith(('.', '?', '!', ':', ';')):
                        if len(sentence) > 30 or any(p in sentence for p in ',.;:?!'):
                            sentence += '.'
                    
                    current_para.append(sentence)
                    # Create new paragraph every 3-5 sentences
                    if len(current_para) >= 3 + (hash(sentence) % 3):
                        paragraphs.append(' '.join(current_para))
                        current_para = []
                
                # Add remaining sentences
                if current_para:
                    paragraphs.append(' '.join(current_para))
        
        # Create new nodes starting after the last position
        new_nodes = []
        for i, paragraph in enumerate(paragraphs):
            new_node = Node.objects.create(
                cognition=cognition,
                content=paragraph,
                position=last_position + 1 + i,
                character_count=len(paragraph)
            )
            new_nodes.append(new_node)
        
        return Response({
            'status': 'success',
            'raw_content_updated': True,
            'nodes_added': len(new_nodes),
            'new_total_nodes': cognition.nodes.count()
        })


class NodeViewSet(viewsets.ModelViewSet):
    queryset = Node.objects.all()
    serializer_class = NodeSerializer
    
    @action(detail=True, methods=['post'])
    def toggle_illumination(self, request, pk=None):
        node = self.get_object()
        node.is_illuminated = not node.is_illuminated
        node.save()
        return Response({'status': 'success', 'is_illuminated': node.is_illuminated})

class SynthesisViewSet(viewsets.ModelViewSet):
    queryset = Synthesis.objects.all()
    serializer_class = SynthesisSerializer
    
    @action(detail=False, methods=['post'])
    def add_or_update(self, request):
        node_id = request.data.get('node_id')
        content = request.data.get('content')
        
        if not node_id:
            return Response(
                {'error': 'node_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            node = Node.objects.get(id=node_id)
            synthesis, created = Synthesis.objects.update_or_create(
                node=node,
                defaults={'content': content or ''}
            )
            return Response(SynthesisSerializer(synthesis).data)
        except Node.DoesNotExist:
            return Response(
                {'error': 'Node not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def add_preset(self, request, pk=None):
        """Add a preset response to a synthesis"""
        synthesis = self.get_object()
        preset_id = request.data.get('preset_id')
        position = request.data.get('position', 
                                   synthesis.preset_links.count())  # Default to end
        
        if not preset_id:
            return Response(
                {'error': 'preset_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            preset = PresetResponse.objects.get(id=preset_id)
            link, created = SynthesisPresetLink.objects.get_or_create(
                synthesis=synthesis,
                preset_response=preset,
                defaults={'position': position}
            )
            
            if not created:
                link.position = position
                link.save()
            
            # Fix positions of other links if needed
            self._reorder_preset_links(synthesis)
            
            return Response(SynthesisSerializer(synthesis).data)
        except PresetResponse.DoesNotExist:
            return Response(
                {'error': 'Preset response not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def remove_preset(self, request, pk=None):
        """Remove a preset response from a synthesis"""
        synthesis = self.get_object()
        preset_id = request.data.get('preset_id')
        
        if not preset_id:
            return Response(
                {'error': 'preset_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            link = synthesis.preset_links.get(preset_response_id=preset_id)
            link.delete()
            
            # Fix positions of other links
            self._reorder_preset_links(synthesis)
            
            return Response(SynthesisSerializer(synthesis).data)
        except SynthesisPresetLink.DoesNotExist:
            return Response(
                {'error': 'Preset not found in this synthesis'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    def _reorder_preset_links(self, synthesis):
        """Helper to ensure preset links have sequential positions"""
        for i, link in enumerate(synthesis.preset_links.all().order_by('position')):
            if link.position != i:
                link.position = i
                link.save()

class PresetResponseViewSet(viewsets.ModelViewSet):
    queryset = PresetResponse.objects.all().order_by('category', 'title')
    serializer_class = PresetResponseSerializer
    
    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Group preset responses by category"""
        categories = {}
        
        for preset in self.get_queryset():
            category = preset.category or "Uncategorized"
            if category not in categories:
                categories[category] = []
            
            categories[category].append(PresetResponseSerializer(preset).data)
        
        return Response(categories)

class ArcViewSet(viewsets.ModelViewSet):
    queryset = Arc.objects.all()
    serializer_class = ArcSerializer