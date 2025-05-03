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

@api_view(['GET'])
def hello_world(request):
    return Response({"message": "Hello, world!"})

class CognitionViewSet(viewsets.ModelViewSet):
    queryset = Cognition.objects.all().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CognitionDetailSerializer
        return CognitionSerializer
    
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