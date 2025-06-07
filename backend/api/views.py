# api/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from .models import (
    Cognition, Node, PresetResponse, Arc, UserProfile, Widget, WidgetInteraction,
    DocumentAnalysisResult, SemanticSegment
)
from .serializers import (
    CognitionSerializer, CognitionDetailSerializer, 
    NodeSerializer, PresetResponseSerializer,
    ArcSerializer, WidgetSerializer, WidgetInteractionSerializer,
    DocumentAnalysisResultSerializer, SemanticSegmentSerializer
)
# SynthesisSerializer removed - functionality consolidated into widgets
from .serializers import UserProfileSerializer, CognitionCollectiveSerializer
from .semantic_service import semantic_service, SemanticAnalysisError
from .semantic_models import SegmentationPreferences
from django.utils import timezone
from rest_framework import filters
import re
import os
import openai
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated
from .permissions import IsOwnerOrReadOnlyIfPublic
from django.db import models, transaction

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

@api_view(['POST'])
@csrf_exempt
@permission_classes([AllowAny])
def add_or_update_node(request):
    node_id = request.data.get("node_id")
    content = request.data.get("content")

    if not node_id:
        return Response({'error': 'node_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        node = Node.objects.get(id=node_id)
        node.content = content or ''
        node.save()
        return Response(NodeSerializer(node).data)
    except Node.DoesNotExist:
        return Response({'error': 'Node not found'}, status=status.HTTP_404_NOT_FOUND)

class CognitionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnlyIfPublic]
    
    def get_queryset(self):
        user = self.request.user
        if self.action == 'list':
            return Cognition.objects.filter(user=user).order_by('-created_at')
        return Cognition.objects.filter(
            models.Q(user=user) | models.Q(is_public=True)
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CognitionDetailSerializer
        return CognitionSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user and not instance.is_public:
            return Response(
                {'error': 'You do not have permission to view this cognition'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        # Log the incoming request data for debugging
        print(f"Received data: {request.data}")

        # Create the cognition
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response({'error': 'You do not have permission to edit this cognition'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response({'error': 'You do not have permission to edit this cognition'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user:
            return Response({'error': 'You do not have permission to delete this cognition'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def star(self, request, pk=None):
        cognition = self.get_object()
        cognition.is_starred = not cognition.is_starred
        cognition.save()
        return Response({
            'status': 'success',
            'starred': cognition.is_starred
        })

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        original = self.get_object()
        duplicated = Cognition.objects.create(raw_content=original.raw_content)

        for node in original.nodes.all():
            Node.objects.create(
                cognition=duplicated,
                content=node.content,
                position=node.position,
                character_count=node.character_count,
                is_illuminated=node.is_illuminated,
            )

        return Response({
            'status': 'success',
            'duplicated_cognition_id': duplicated.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def toggle_share(self, request, pk=None):
        cognition = self.get_object()
        if cognition.user != request.user:
            return Response({'error': 'You do not have permission to share this cognition'},
                            status=status.HTTP_403_FORBIDDEN)
        if cognition.is_public:
            cognition.is_public = False
            cognition.share_date = None
            message = "Cognition is now private"
        else:
            cognition.is_public = True
            cognition.share_date = timezone.now()
            message = "Cognition is now shared publicly"
        cognition.save()
        return Response({'status': 'success', 'is_public': cognition.is_public, 'message': message})

    @action(detail=True, methods=['post'])
    def process_text(self, request, pk=None):
        cognition = self.get_object()
        text = cognition.raw_content

        # Clean up text first - normalize line breaks
        text = re.sub(r'\r\n', '\n', text)  # Windows line endings
        text = re.sub(r'\r', '\n', text)    # Mac line endings
        
        # Split by double newlines first (proper paragraphs)
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
        
        # If we got very few paragraphs, try single newlines but be more conservative
        if len(paragraphs) <= 2:
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            
            # Group lines into paragraphs more intelligently
            paragraphs = []
            current_para = []
            
            for line in lines:
                # If line looks like a header (short, no ending punctuation)
                if len(line) < 80 and not re.search(r'[.!?]\s*$', line) and len(current_para) > 0:
                    # Save current paragraph and start new one with header
                    if current_para:
                        paragraphs.append(' '.join(current_para))
                        current_para = []
                    paragraphs.append(line)  # Header as its own paragraph
                else:
                    current_para.append(line)
                    
                    # End paragraph if line ends with sentence-ending punctuation
                    # and meets minimum length requirement
                    if (re.search(r'[.!?]\s*$', line) and 
                        len(' '.join(current_para)) > 100):  # Minimum paragraph length
                        paragraphs.append(' '.join(current_para))
                        current_para = []
            
            # Add any remaining content
            if current_para:
                paragraphs.append(' '.join(current_para))
        
        # Final cleanup and merging of very short paragraphs
        final_paragraphs = []
        i = 0
        while i < len(paragraphs):
            current = paragraphs[i].strip()
            
            # If current paragraph is very short and doesn't end with punctuation,
            # try to merge with next
            if (i + 1 < len(paragraphs) and 
                len(current) < 80 and 
                not re.search(r'[.!?;:]\s*$', current)):
                next_para = paragraphs[i + 1].strip()
                merged = f"{current}\n\n{next_para}"
                final_paragraphs.append(merged)
                i += 2  # Skip next paragraph since we merged it
            else:
                final_paragraphs.append(current)
                i += 1
        
        paragraphs = final_paragraphs
        
        # Remove empty paragraphs and very short ones (unless they look like headers)
        filtered_paragraphs = []
        for para in paragraphs:
            # Keep if it's substantial content OR looks like a meaningful header
            if (len(para.strip()) > 20 or 
                (len(para.strip()) > 5 and len(para.split()) <= 5)):
                filtered_paragraphs.append(para.strip())
        
        paragraphs = filtered_paragraphs

        # Delete existing nodes
        cognition.nodes.all().delete()

        # Create new nodes
        created_count = 0
        for i, paragraph in enumerate(paragraphs):
            if paragraph.strip():  # Only create nodes for non-empty content
                Node.objects.create(
                    cognition=cognition,
                    content=paragraph,
                    position=i,
                    character_count=len(paragraph)
                )
                created_count += 1

        return Response({
            'status': 'success',
            'nodes_created': created_count
        })
    
    @action(detail=True, methods=['post'])
    def quick_segment(self, request, pk=None):
        """
        Perform quick semantic segmentation without full analysis
        """
        cognition = self.get_object()
        
        # Check permissions
        if cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to segment this cognition'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if not cognition.raw_content.strip():
            return Response(
                {'error': 'Cannot segment empty content'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        max_segments = request.data.get('max_segments', None)
        create_nodes = request.data.get('create_nodes', True)
        
        try:
            # Perform quick segmentation
            result, processing_time = semantic_service.quick_segmentation(
                cognition.raw_content,
                max_segments
            )
            
            if create_nodes:
                with transaction.atomic():
                    # Delete existing nodes
                    cognition.nodes.all().delete()
                    
                    # Create nodes from segments
                    for i, segment in enumerate(result.segments):
                        content = cognition.raw_content[segment.start_position:segment.end_position]
                        Node.objects.create(
                            cognition=cognition,
                            content=content.strip(),
                            position=i,
                            character_count=len(content)
                        )
            
            return Response({
                'status': 'success',
                'document_type': result.document_type.value,
                'overall_summary': result.overall_summary,
                'estimated_total_read_time': result.estimated_total_read_time,
                'segments_created': len(result.segments),
                'nodes_created': len(result.segments) if create_nodes else 0,
                'processing_time_ms': processing_time,
                'segments': [
                    {
                        'title': seg.title,
                        'summary': seg.summary,
                        'start_position': seg.start_position,
                        'end_position': seg.end_position,
                        'importance_level': seg.importance_level.value,
                        'estimated_reading_time': seg.estimated_reading_time
                    } for seg in result.segments
                ]
            })
            
        except SemanticAnalysisError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Better error handling for debugging
            import traceback
            error_details = {
                'error': f'Unexpected error during quick analysis: {str(e)}',
                'error_type': type(e).__name__,
                'traceback': traceback.format_exc()
            }
            print(f"Quick segmentation error: {error_details}")  # For debugging
            return Response(
                {'error': f'Unexpected error during quick analysis: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def bulk_create_nodes(self, request, pk=None):
        """
        Create multiple nodes from a list of paragraphs
        """
        cognition = self.get_object()
        
        # Check permissions
        if cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to add nodes to this cognition'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        paragraphs = request.data.get('paragraphs', [])
        
        if not paragraphs or not isinstance(paragraphs, list):
            return Response(
                {'error': 'paragraphs must be a non-empty list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(paragraphs) > 100:  # Reasonable limit
            return Response(
                {'error': 'Too many paragraphs (max 100)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            created_nodes = []
            
            # Get the next position for ordering
            last_position = Node.objects.filter(cognition=cognition).aggregate(
                max_pos=models.Max('position')
            )['max_pos'] or 0
            
            # Create nodes in bulk
            with transaction.atomic():
                for i, paragraph in enumerate(paragraphs):
                    content = paragraph.strip()
                    if content:  # Only create nodes with actual content
                        node = Node.objects.create(
                            cognition=cognition,
                            content=content,
                            position=last_position + i + 1,
                            is_illuminated=False
                        )
                        created_nodes.append(node)
            
            return Response({
                'success': True,
                'nodes_created': len(created_nodes),
                'message': f'Successfully created {len(created_nodes)} nodes'
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to create nodes: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def collective(self, request):
        print(f"Collective endpoint called by user: {request.user.username}")
        queryset = Cognition.objects.filter(is_public=True).order_by('-share_date')
        print(f"Public cognitions count: {queryset.count()}")
        print(f"Query SQL: {queryset.query}")
        following_profiles = request.user.profile.following.all()
        following_users = [profile.user.id for profile in following_profiles]
        following_only = request.query_params.get('following_only', 'false').lower() == 'true'
        if following_only and following_users:
            queryset = queryset.filter(user__in=following_users)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = CognitionCollectiveSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = CognitionCollectiveSerializer(queryset, many=True)
        return Response(serializer.data)


class UserProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['user__username']

    @action(detail=True, methods=['post'])
    def follow(self, request, pk=None):
        profile_to_follow = self.get_object()
        user_profile = request.user.profile
        if profile_to_follow.user == request.user:
            return Response({'error': 'You cannot follow yourself'}, status=status.HTTP_400_BAD_REQUEST)
        user_profile.follow(profile_to_follow)
        return Response({'status': 'success', 'message': f'You are now following {profile_to_follow.user.username}'})

    @action(detail=True, methods=['post'])
    def unfollow(self, request, pk=None):
        profile_to_unfollow = self.get_object()
        user_profile = request.user.profile
        user_profile.unfollow(profile_to_unfollow)
        return Response({'status': 'success', 'message': f'You have unfollowed {profile_to_unfollow.user.username}'})

    @action(detail=False, methods=['get'])
    def my_profile(self, request):
        serializer = self.get_serializer(request.user.profile)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def following(self, request):
        following = request.user.profile.get_following()
        page = self.paginate_queryset(following)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(following, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def followers(self, request):
        followers = request.user.profile.get_followers()
        page = self.paginate_queryset(followers)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)


class NodeViewSet(viewsets.ModelViewSet):
    serializer_class = NodeSerializer
    http_method_names = ['get', 'post', 'patch', 'delete']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Node.objects.filter(
            models.Q(cognition__user=user) | models.Q(cognition__is_public=True)
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.cognition.user != request.user and not instance.cognition.is_public:
            return Response(
                {'error': 'You do not have permission to view this node'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.cognition.user != request.user:
            return Response({'error': 'You do not have permission to edit this node'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.cognition.user != request.user:
            return Response({'error': 'You do not have permission to edit this node'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.cognition.user != request.user:
            return Response({'error': 'You do not have permission to delete this node'}, status=status.HTTP_403_FORBIDDEN)
        
        with transaction.atomic():
            position_to_delete = instance.position
            cognition = instance.cognition
            
            # Get nodes that need to be shifted down
            nodes_to_shift = Node.objects.filter(
                cognition=cognition,
                position__gt=position_to_delete
            ).order_by('position')
            
            # Delete the node
            instance.delete()
            
            # Shift subsequent nodes down manually
            for shift_node in nodes_to_shift:
                shift_node.position = shift_node.position - 1
                shift_node.save()
        
        return Response({'status': 'deleted'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def toggle_illumination(self, request, pk=None):
        node = self.get_object()
        node.is_illuminated = not node.is_illuminated
        node.save()
        return Response({'status': 'success', 'is_illuminated': node.is_illuminated})


class PresetResponseViewSet(viewsets.ModelViewSet):
    queryset = PresetResponse.objects.all().order_by('category', 'title')
    serializer_class = PresetResponseSerializer
    permission_classes = [IsAuthenticated]
    
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
    permission_classes = [IsAuthenticated]


class WidgetViewSet(viewsets.ModelViewSet):
    serializer_class = WidgetSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        # Users can see:
        # 1. Author widgets on nodes they can access
        # 2. Their own reader widgets
        return Widget.objects.filter(
            models.Q(node__cognition__user=user) | 
            models.Q(node__cognition__is_public=True) |
            models.Q(user=user)
        ).distinct()
    
    def perform_create(self, serializer):
        # Auto-set user and validate permissions
        node = serializer.validated_data['node']
        widget_type = serializer.validated_data['widget_type']
        
        # Check permissions for author widgets
        if widget_type.startswith('author_'):
            if node.cognition.user != self.request.user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Only the author can create author widgets")
        
        # Check permissions for reader widgets
        if widget_type.startswith('reader_'):
            if not (node.cognition.user == self.request.user or node.cognition.is_public):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Cannot create reader widgets on inaccessible nodes")
        
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def interact(self, request, pk=None):
        """Record user interaction with widget"""
        widget = self.get_object()
        
        # Create or update interaction
        interaction, created = WidgetInteraction.objects.update_or_create(
            widget=widget,
            user=request.user,
            defaults={
                'completed': request.data.get('completed', False),
                'quiz_answer': request.data.get('quiz_answer', ''),
                'interaction_data': request.data.get('interaction_data', {})
            }
        )
        
        return Response(WidgetInteractionSerializer(interaction).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convert_text_to_markdown(request):
    """
    Convert raw text to properly formatted markdown using AI.
    """
    raw_text = request.data.get('raw_text', '').strip()
    
    if not raw_text:
        return Response(
            {'error': 'Raw text is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(raw_text) > 50000:  # Reasonable limit
        return Response(
            {'error': 'Text too long (max 50,000 characters)'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Use OpenAI to convert text to proper markdown
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        system_prompt = """You are an expert at converting raw text into well-formatted markdown.

Your task is to take raw, unformatted text and convert it into clean, readable markdown with appropriate structure.

Guidelines:
- Add proper headers (# ## ###) where appropriate to create document structure
- Format lists, both numbered and bulleted, correctly
- Add emphasis (*italic*, **bold**) where it improves readability
- Create proper paragraph breaks
- Format code blocks with ``` if any code is present
- Add horizontal rules (---) to separate major sections if appropriate
- Preserve the original meaning and content exactly
- Don't add new information or content
- Don't remove any important information
- Make the text more readable and well-structured

Return only the formatted markdown, no explanations or additional text."""

        user_prompt = f"Convert this raw text to well-formatted markdown:\n\n{raw_text}"
        
        # Calculate appropriate max_tokens based on input length
        # Input tokens ~= chars/4, leave room for system prompt and formatting expansion
        estimated_input_tokens = len(raw_text) // 4 + 500  # +500 for system prompt
        # Allow output to be 1.5x input size (for markdown formatting) + buffer
        max_output_tokens = min(16000, max(8000, int(len(raw_text) // 2.5)))
        
        print(f"Markdown conversion: input_chars={len(raw_text)}, estimated_input_tokens={estimated_input_tokens}, max_output_tokens={max_output_tokens}")
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=max_output_tokens
        )
        
        markdown_text = response.choices[0].message.content.strip()
        
        # Check if response was truncated
        finish_reason = response.choices[0].finish_reason
        if finish_reason == 'length':
            print(f"Warning: OpenAI response was truncated (finish_reason: {finish_reason})")
            # Could fallback to original text here, but let's try with the partial result
        
        # Basic validation - check if result looks reasonable
        if len(markdown_text) < len(raw_text) * 0.3:  # Result is suspiciously short
            print(f"Warning: Markdown result seems too short (original: {len(raw_text)}, result: {len(markdown_text)})")
        
        return Response({
            'markdown_text': markdown_text,
            'original_length': len(raw_text),
            'formatted_length': len(markdown_text),
            'finish_reason': finish_reason
        })
        
    except Exception as e:
        print(f"Markdown conversion error: {str(e)}")
        return Response(
            {'error': f'Failed to convert text to markdown: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
