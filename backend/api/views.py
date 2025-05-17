# api/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc
from .models import UserProfile
from .serializers import (
    CognitionSerializer, CognitionDetailSerializer, 
    NodeSerializer, SynthesisSerializer, PresetResponseSerializer,
    ArcSerializer
)
from .serializers import UserProfileSerializer, CognitionCollectiveSerializer
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
from django.db import models

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

        merged = []
        skip_next = False
        for i in range(len(paragraphs)):
            if skip_next:
                skip_next = False
                continue
            current = paragraphs[i].strip()
            next_para = paragraphs[i + 1].strip() if i + 1 < len(paragraphs) else None
            if (
                len(current) < 60
                and not re.search(r'[.!?;:]$', current)
                and next_para
            ):
                merged.append(f"{current} {next_para}")
                skip_next = True
            else:
                merged.append(current)
        paragraphs = merged

        # Delete existing nodes
        cognition.nodes.all().delete()

        # Create new nodes
        for i, paragraph in enumerate(paragraphs):
            cleaned = re.sub(r'[^a-zA-Z0-9]', '', paragraph)
            if not cleaned.strip():
                continue
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
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnlyIfPublic]
    def get_queryset(self):
        user = self.request.user
        if self.action == 'list':
            return Cognition.objects.filter(user=user).order_by('-created_at')
        return Cognition.objects.filter(
            models.Q(user=user) | models.Q(is_public=True)
        ).order_by('-created_at')

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user != request.user and not instance.is_public:
            return Response(
                {'error': 'You do not have permission to view this cognition'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

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

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
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
        
        merged = []
        skip_next = False
        for i in range(len(paragraphs)):
            if skip_next:
                skip_next = False
                continue
            current = paragraphs[i].strip()
            next_para = paragraphs[i + 1].strip() if i + 1 < len(paragraphs) else None
            if (
                len(current) < 60
                and not re.search(r'[.!?;:]$', current)
                and next_para
            ):
                merged.append(f"{current} {next_para}")
                skip_next = True
            else:
                merged.append(current)
        paragraphs = merged
        
        # Delete existing nodes
        cognition.nodes.all().delete()
        
        # Create new nodes
        for i, paragraph in enumerate(paragraphs):
            cleaned = re.sub(r'[^a-zA-Z0-9]', '', paragraph)
            if not cleaned.strip():
                continue
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
        
        merged = []
        skip_next = False
        for i in range(len(paragraphs)):
            if skip_next:
                skip_next = False
                continue
            current = paragraphs[i].strip()
            next_para = paragraphs[i + 1].strip() if i + 1 < len(paragraphs) else None
            if (
                len(current) < 60
                and not re.search(r'[.!?;:]$', current)
                and next_para
            ):
                merged.append(f"{current} {next_para}")
                skip_next = True
            else:
                merged.append(current)
        paragraphs = merged
        
        # Create new nodes starting after the last position
        new_nodes = []
        for i, paragraph in enumerate(paragraphs):
            cleaned = re.sub(r'[^a-zA-Z0-9]', '', paragraph)
            if not cleaned.strip():
                continue
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
        instance.delete()
        return Response({'status': 'deleted'}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def toggle_illumination(self, request, pk=None):
        node = self.get_object()
        node.is_illuminated = not node.is_illuminated
        node.save()
        return Response({'status': 'success', 'is_illuminated': node.is_illuminated})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def summarize(self, request, pk=None):
        node = self.get_object()
        if node.cognition.user != request.user and not node.cognition.is_public:
            return Response({'error': 'You do not have permission to summarize this node'}, status=status.HTTP_403_FORBIDDEN)

        openai_api_key = os.getenv('OPENAI_API_KEY')
        if not openai_api_key:
            return Response({'error': 'OpenAI API key not set on server'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        openai.api_key = openai_api_key

        prompt = f"Summarize the following text in plain English:\n\n{node.content}"
        try:
            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=120,
                temperature=0.4,
            )
            summary = response.choices[0].message.content.strip()
        except Exception as e:
            return Response({'error': f'OpenAI API error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'summary': summary})

class SynthesisViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Synthesis objects.
    Only returns syntheses for nodes that the user can access (their own or public),
    and only if the synthesis is by the user or by the cognition author.
    """
    serializer_class = SynthesisSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return syntheses for nodes the user can access (public or their own).
        Only include syntheses by user or the cognition author.
        """
        user = self.request.user
        return Synthesis.objects.filter(
            models.Q(node__cognition__user=user) | models.Q(node__cognition__is_public=True),
        ).filter(
            models.Q(user=user) | models.Q(user=models.F('node__cognition__user'))
        )

    @action(detail=False, methods=['post'])
    def add_or_update(self, request):
        """
        Add or update the current user's synthesis for a given node.
        Only one synthesis per (user, node) is allowed.
        Returns the updated synthesis if successful.
        """
        node_id = request.data.get('node_id')
        content = request.data.get('content')
        if not node_id:
            return Response({'error': 'node_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            node = Node.objects.get(id=node_id)
            # Permission: Only allow access if user is the cognition owner or the cognition is public
            if node.cognition.user != request.user and not node.cognition.is_public:
                return Response({'error': 'You do not have permission to access this node'}, status=status.HTTP_403_FORBIDDEN)
            # Enforce one synthesis per user/node
            synthesis, created = Synthesis.objects.update_or_create(
                node=node,
                user=request.user,
                defaults={'content': content or ''}
            )
            serializer = SynthesisSerializer(synthesis, context={'request': request})
            return Response(serializer.data)
        except Node.DoesNotExist:
            return Response({'error': 'Node not found'}, status=status.HTTP_404_NOT_FOUND)

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