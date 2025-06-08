# api/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import (
    Cognition, Node, PresetResponse, Arc, UserProfile, Widget, WidgetInteraction,
    DocumentAnalysisResult, SemanticSegment, Group, GroupMembership, GroupInvitation
)
from .serializers import (
    CognitionSerializer, CognitionDetailSerializer, 
    NodeSerializer, PresetResponseSerializer,
    ArcSerializer, WidgetSerializer, WidgetInteractionSerializer,
    DocumentAnalysisResultSerializer, SemanticSegmentSerializer,
    GroupSerializer, GroupDetailSerializer, GroupMembershipSerializer, GroupInvitationSerializer
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
        """Process text with AI semantic segmentation first, fallback to manual splitting"""
        cognition = self.get_object()
        
        if not cognition.raw_content.strip():
            return Response(
                {'error': 'Cannot process empty content'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Try AI semantic segmentation first for substantial text
        if len(cognition.raw_content) > 200:
            try:
                print(f"Attempting AI segmentation for cognition {cognition.id}")
                
                # Use semantic service for intelligent segmentation
                result, processing_time = semantic_service.quick_segmentation(
                    cognition.raw_content,
                    max_segments=20
                )
                
                with transaction.atomic():
                    # Delete existing nodes
                    cognition.nodes.all().delete()
                    
                    # Create nodes from AI segments
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
                    'method': 'ai_segmentation',
                    'nodes_created': len(result.segments),
                    'document_type': result.document_type.value,
                    'processing_time_ms': processing_time
                })
                
            except (SemanticAnalysisError, Exception) as e:
                print(f"AI segmentation failed for cognition {cognition.id}: {str(e)}")
                # Continue to fallback method below
        
        # Fallback to manual paragraph splitting
        print(f"Using fallback paragraph splitting for cognition {cognition.id}")
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
            'method': 'fallback_splitting',
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

    @action(detail=True, methods=['post'])
    def generate_toc(self, request, pk=None):
        """
        Generate a Table of Contents for this cognition using AI analysis.
        """
        from .toc_processor import toc_processor
        
        cognition = self.get_object()
        
        # Check permissions
        if cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to generate TOC for this cognition'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Check if regeneration is requested
            regenerate = request.data.get('regenerate', False)
            
            if regenerate:
                result = toc_processor.regenerate_toc_for_cognition(cognition)
            else:
                result = toc_processor.generate_toc_for_cognition(cognition)
            
            return Response(result)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            print(f"TOC generation error: {str(e)}")
            return Response(
                {'error': f'Failed to generate TOC: {str(e)}'},
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
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            from .serializers import UserProfileDetailSerializer
            return UserProfileDetailSerializer
        return UserProfileSerializer

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

    @action(detail=True, methods=['get'])
    def following(self, request, pk=None):
        """Get list of users this profile is following"""
        profile = self.get_object()
        following = profile.get_following()
        page = self.paginate_queryset(following)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(following, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def followers(self, request, pk=None):
        """Get list of users following this profile"""
        profile = self.get_object()
        followers = profile.get_followers()
        page = self.paginate_queryset(followers)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(followers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def cognitions(self, request, pk=None):
        """Get user's public cognitions"""
        profile = self.get_object()
        user_cognitions = Cognition.objects.filter(
            user=profile.user, 
            is_public=True
        ).order_by('-created_at')
        
        page = self.paginate_queryset(user_cognitions)
        if page is not None:
            from .serializers import CognitionCollectiveSerializer
            serializer = CognitionCollectiveSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        from .serializers import CognitionCollectiveSerializer
        serializer = CognitionCollectiveSerializer(user_cognitions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def update_bio(self, request, pk=None):
        """Update user bio - only for own profile"""
        profile = self.get_object()
        if profile.user != request.user:
            return Response(
                {'error': 'You can only update your own bio'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        bio = request.data.get('bio', '')
        if len(bio) > 500:  # Reasonable limit
            return Response(
                {'error': 'Bio must be 500 characters or less'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        profile.bio = bio
        profile.save()
        
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def search_users(self, request):
        """Search users by username or bio"""
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 2:
            return Response({'results': []})
        
        # Search by username or bio
        profiles = UserProfile.objects.filter(
            models.Q(user__username__icontains=query) |
            models.Q(bio__icontains=query)
        ).select_related('user').order_by('user__username')
        
        # Exclude current user
        if request.user.is_authenticated:
            profiles = profiles.exclude(user=request.user)
        
        page = self.paginate_queryset(profiles)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = self.get_serializer(profiles, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's detailed profile"""
        from .serializers import UserProfileDetailSerializer
        serializer = UserProfileDetailSerializer(request.user.profile, context={'request': request})
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

    @action(detail=True, methods=['post'])
    def merge_with_next(self, request, pk=None):
        """Merge this node with the next node"""
        node = self.get_object()
        
        # Check permissions
        if node.cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to edit this node'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Find the next node
        try:
            next_node = Node.objects.get(
                cognition=node.cognition,
                position=node.position + 1
            )
        except Node.DoesNotExist:
            return Response(
                {'error': 'No next node to merge with'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get separator from request data
        separator = request.data.get('separator', ' ')
        
        with transaction.atomic():
            # Merge content
            merged_content = node.content + separator + next_node.content
            node.content = merged_content
            node.character_count = len(merged_content)
            node.save()
            
            # Get nodes that need to be shifted
            nodes_to_shift = Node.objects.filter(
                cognition=node.cognition,
                position__gt=next_node.position
            ).order_by('position')
            
            # Delete the next node
            next_node.delete()
            
            # Shift subsequent nodes
            for shift_node in nodes_to_shift:
                shift_node.position = shift_node.position - 1
                shift_node.save()
        
        return Response({
            'status': 'success',
            'merged_content': merged_content,
            'message': 'Nodes merged successfully'
        })

    @action(detail=True, methods=['post'])
    def split_node(self, request, pk=None):
        """Split a node at a specified position"""
        node = self.get_object()
        
        # Check permissions
        if node.cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to edit this node'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        split_position = request.data.get('split_position')
        if split_position is None:
            return Response(
                {'error': 'split_position is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        content = node.content
        if split_position < 0 or split_position >= len(content):
            return Response(
                {'error': 'Invalid split position'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        before_content = content[:split_position].strip()
        after_content = content[split_position:].strip()
        
        if not before_content or not after_content:
            return Response(
                {'error': 'Split would create empty node'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Update current node with first part
            node.content = before_content
            node.character_count = len(before_content)
            node.save()
            
            # Shift all subsequent nodes forward
            nodes_to_shift = Node.objects.filter(
                cognition=node.cognition,
                position__gt=node.position
            ).order_by('-position')  # Reverse order to avoid conflicts
            
            for shift_node in nodes_to_shift:
                shift_node.position = shift_node.position + 1
                shift_node.save()
            
            # Create new node with second part
            new_node = Node.objects.create(
                cognition=node.cognition,
                content=after_content,
                position=node.position + 1,
                character_count=len(after_content),
                is_illuminated=False
            )
        
        return Response({
            'status': 'success',
            'original_node': NodeSerializer(node).data,
            'new_node': NodeSerializer(new_node).data,
            'message': 'Node split successfully'
        })

    @action(detail=True, methods=['post'])
    def reorder_position(self, request, pk=None):
        """Move a node to a new position"""
        node = self.get_object()
        
        # Check permissions
        if node.cognition.user != request.user:
            return Response(
                {'error': 'You do not have permission to edit this node'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        new_position = request.data.get('new_position')
        if new_position is None:
            return Response(
                {'error': 'new_position is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get total node count for validation
        total_nodes = Node.objects.filter(cognition=node.cognition).count()
        if new_position < 0 or new_position >= total_nodes:
            return Response(
                {'error': f'Invalid position. Must be between 0 and {total_nodes - 1}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        old_position = node.position
        if old_position == new_position:
            return Response({'status': 'success', 'message': 'Node already at target position'})
        
        with transaction.atomic():
            if new_position > old_position:
                # Moving down: shift nodes between old and new position up
                nodes_to_shift = Node.objects.filter(
                    cognition=node.cognition,
                    position__gt=old_position,
                    position__lte=new_position
                ).order_by('position')
                
                for shift_node in nodes_to_shift:
                    shift_node.position = shift_node.position - 1
                    shift_node.save()
            else:
                # Moving up: shift nodes between new and old position down
                nodes_to_shift = Node.objects.filter(
                    cognition=node.cognition,
                    position__gte=new_position,
                    position__lt=old_position
                ).order_by('-position')
                
                for shift_node in nodes_to_shift:
                    shift_node.position = shift_node.position + 1
                    shift_node.save()
            
            # Update the node's position
            node.position = new_position
            node.save()
        
        return Response({
            'status': 'success',
            'old_position': old_position,
            'new_position': new_position,
            'message': f'Node moved from position {old_position} to {new_position}'
        })


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

    @action(detail=False, methods=['post'])
    def create_llm_widget(self, request):
        """Create a widget using LLM generation"""
        import openai
        import os
        
        node_id = request.data.get('node_id')
        llm_preset = request.data.get('llm_preset')
        custom_prompt = request.data.get('custom_prompt', '')
        widget_type = request.data.get('widget_type')
        
        if not node_id:
            return Response(
                {'error': 'node_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not widget_type:
            return Response(
                {'error': 'widget_type is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            node = Node.objects.get(id=node_id)
        except Node.DoesNotExist:
            return Response(
                {'error': 'Node not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check permissions
        if widget_type.startswith('author_') and node.cognition.user != request.user:
            return Response(
                {'error': 'Only the author can create author widgets'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if widget_type.startswith('reader_') and not (node.cognition.user == request.user or node.cognition.is_public):
            return Response(
                {'error': 'Cannot create reader widgets on inaccessible nodes'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Use OpenAI to generate widget content
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            
            # Determine the prompt based on preset and widget type
            if llm_preset == 'quiz':
                system_prompt = """You are an expert educator. Create a thoughtful quiz question based on the provided text content. The question should test understanding of key concepts or ideas."""
                user_prompt = f"Create a quiz question for this content:\n\n{node.content}\n\nCustom instructions: {custom_prompt}"
            elif llm_preset == 'summary':
                system_prompt = """You are an expert at creating concise summaries. Create a brief, accurate summary of the provided content."""
                user_prompt = f"Summarize this content:\n\n{node.content}\n\nCustom instructions: {custom_prompt}"
            elif llm_preset == 'analysis':
                system_prompt = """You are an expert analyst. Provide insightful analysis of the provided content, highlighting key themes, implications, or significance."""
                user_prompt = f"Analyze this content:\n\n{node.content}\n\nCustom instructions: {custom_prompt}"
            elif llm_preset == 'discussion':
                system_prompt = """You are a discussion facilitator. Create thought-provoking discussion points or questions to help readers engage deeply with the content."""
                user_prompt = f"Create discussion points for this content:\n\n{node.content}\n\nCustom instructions: {custom_prompt}"
            else:
                # Custom prompt
                system_prompt = "You are a helpful assistant that creates educational content based on provided text."
                user_prompt = f"Content: {node.content}\n\nTask: {custom_prompt}"
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            generated_content = response.choices[0].message.content.strip()
            
            # Create the widget
            widget_data = {
                'node': node.id,
                'widget_type': widget_type,
                'user': request.user.id
            }
            
            # Set content based on widget type
            if 'quiz' in widget_type:
                widget_data['quiz_question'] = generated_content
            else:
                widget_data['content'] = generated_content
            
            # Add title if it's a remark widget
            if 'remark' in widget_type:
                widget_data['title'] = f"AI-Generated {llm_preset.title()}"
            
            serializer = WidgetSerializer(data=widget_data)
            serializer.is_valid(raise_exception=True)
            widget = serializer.save(user=request.user)
            
            return Response(WidgetSerializer(widget).data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to generate widget: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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


class GroupViewSet(viewsets.ModelViewSet):
    """ViewSet for Group CRUD operations and member management"""
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return groups based on user permissions"""
        if self.action == 'list':
            # Show public groups and groups user is member of
            return Group.objects.filter(
                models.Q(is_public=True) |
                models.Q(memberships__user=self.request.user)
            ).distinct().order_by('-created_at')
        return Group.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return GroupDetailSerializer
        return GroupSerializer
    
    def perform_create(self, serializer):
        """Create group and make creator the founder and admin"""
        group = serializer.save(founder=self.request.user)
        # Add founder as admin member
        group.add_member(self.request.user, role='admin')
    
    @action(detail=True, methods=['get'])
    def members(self, request, pk=None):
        """Get group members"""
        group = self.get_object()
        memberships = group.memberships.all().order_by('joined_at')
        serializer = GroupMembershipSerializer(memberships, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def join(self, request, pk=None):
        """Join a public group"""
        group = self.get_object()
        
        if not group.is_public:
            return Response(
                {'error': 'This group requires an invitation to join'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if group.is_member(request.user):
            return Response(
                {'error': 'You are already a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        group.add_member(request.user)
        return Response({'message': f'Successfully joined {group.name}'})
    
    @action(detail=True, methods=['post'])
    def leave(self, request, pk=None):
        """Leave a group"""
        group = self.get_object()
        
        if not group.is_member(request.user):
            return Response(
                {'error': 'You are not a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if group.founder == request.user:
            return Response(
                {'error': 'Group founder cannot leave. Transfer ownership or delete the group.'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        group.remove_member(request.user)
        return Response({'message': f'Successfully left {group.name}'})
    
    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        """Invite a user to the group"""
        group = self.get_object()
        
        if not group.is_admin(request.user):
            return Response(
                {'error': 'Only group admins can send invitations'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        username = request.data.get('username')
        message = request.data.get('message', '')
        
        if not username:
            return Response(
                {'error': 'Username is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            invitee = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if group.is_member(invitee):
            return Response(
                {'error': 'User is already a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if invitation already exists
        existing_invitation = GroupInvitation.objects.filter(
            group=group, 
            invitee=invitee, 
            status='pending'
        ).first()
        
        if existing_invitation:
            return Response(
                {'error': 'Invitation already sent to this user'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invitation = GroupInvitation.objects.create(
            group=group,
            inviter=request.user,
            invitee=invitee,
            message=message
        )
        
        serializer = GroupInvitationSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['patch'])
    def update_member_role(self, request, pk=None):
        """Update a member's role (admin only)"""
        group = self.get_object()
        
        if not group.is_admin(request.user):
            return Response(
                {'error': 'Only group admins can update member roles'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.data.get('user_id')
        new_role = request.data.get('role')
        
        if not user_id or not new_role:
            return Response(
                {'error': 'user_id and role are required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_role not in ['member', 'admin']:
            return Response(
                {'error': 'Invalid role. Must be "member" or "admin"'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            membership = group.memberships.get(user_id=user_id)
            membership.role = new_role
            membership.save()
            
            serializer = GroupMembershipSerializer(membership)
            return Response(serializer.data)
        except GroupMembership.DoesNotExist:
            return Response(
                {'error': 'User is not a member of this group'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        """Remove a member from the group (admin only)"""
        group = self.get_object()
        
        if not group.is_admin(request.user):
            return Response(
                {'error': 'Only group admins can remove members'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_to_remove = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        if group.founder == user_to_remove:
            return Response(
                {'error': 'Cannot remove group founder'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not group.is_member(user_to_remove):
            return Response(
                {'error': 'User is not a member of this group'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        group.remove_member(user_to_remove)
        return Response({'message': f'Successfully removed {user_to_remove.username} from {group.name}'})
    
    @action(detail=True, methods=['get'])
    def cognitions(self, request, pk=None):
        """Get group cognitions"""
        group = self.get_object()
        
        # Only members can view group cognitions
        if not group.is_member(request.user):
            return Response(
                {'error': 'Only group members can view group cognitions'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        cognitions = group.cognitions.order_by('-created_at')
        page = self.paginate_queryset(cognitions)
        if page is not None:
            serializer = CognitionSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = CognitionSerializer(cognitions, many=True, context={'request': request})
        return Response(serializer.data)


class GroupInvitationViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for managing group invitations"""
    serializer_class = GroupInvitationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return invitations for current user"""
        return GroupInvitation.objects.filter(invitee=self.request.user).order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Accept a group invitation"""
        invitation = self.get_object()
        
        if invitation.status != 'pending':
            return Response(
                {'error': 'This invitation has already been responded to'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add user to group
        invitation.group.add_member(request.user)
        
        # Update invitation status
        invitation.status = 'accepted'
        invitation.responded_at = timezone.now()
        invitation.save()
        
        return Response({'message': f'Successfully joined {invitation.group.name}'})
    
    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        """Decline a group invitation"""
        invitation = self.get_object()
        
        if invitation.status != 'pending':
            return Response(
                {'error': 'This invitation has already been responded to'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update invitation status
        invitation.status = 'declined'
        invitation.responded_at = timezone.now()
        invitation.save()
        
        return Response({'message': f'Declined invitation to {invitation.group.name}'})
