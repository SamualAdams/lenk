# api/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc, UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    follower_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'bio', 'follower_count', 'following_count', 'is_following']
    
    def get_follower_count(self, obj):
        return obj.followers.count()
    
    def get_following_count(self, obj):
        return obj.following.count()
    
    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return request.user.profile.following.filter(pk=obj.pk).exists()
        return False

class CognitionCollectiveSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    nodes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Cognition
        fields = ['id', 'title', 'username', 'is_public', 'share_date', 
                  'created_at', 'updated_at', 'nodes_count']
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()

class PresetResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = PresetResponse
        fields = ['id', 'title', 'content', 'category', 'created_at']

class SynthesisPresetLinkSerializer(serializers.ModelSerializer):
    preset_response = PresetResponseSerializer(read_only=True)
    
    class Meta:
        model = SynthesisPresetLink
        fields = ['id', 'preset_response', 'position']

class SynthesisSerializer(serializers.ModelSerializer):
    user_id = serializers.ReadOnlyField(source='user.id')
    username = serializers.ReadOnlyField(source='user.username')
    is_author = serializers.SerializerMethodField()
    preset_links = SynthesisPresetLinkSerializer(many=True, read_only=True)
    full_content = serializers.ReadOnlyField()
    
    class Meta:
        model = Synthesis
        fields = ['id', 'content', 'full_content', 'user_id', 'username', 
                  'is_author', 'preset_links', 'created_at', 'updated_at']
        read_only_fields = ['user_id', 'username', 'is_author']
    
    # Indicates if the synthesis is by the cognition author
    def get_is_author(self, obj):
        # Defensive check in case obj.user is None or anonymous user
        if obj.user is None or not hasattr(obj.user, 'is_authenticated'):
            return False
        return obj.user == obj.node.cognition.user

class NodeSerializer(serializers.ModelSerializer):
    syntheses = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = ['id', 'cognition', 'content', 'position', 'character_count',
                  'is_illuminated', 'created_at', 'syntheses']
        read_only_fields = ['syntheses', 'id', 'created_at']
    
    # Supports multiple syntheses per node: 
    # Returns author's synthesis and the current user's synthesis (if user is not author).
    # Used for displaying both syntheses in the UI.
    def get_syntheses(self, obj):
        """
        Return a list with:
        - The author's synthesis (always, if exists)
        - The current user's synthesis (if exists, and different from author)
        """
        user = None
        if 'request' in self.context:
            user = self.context['request'].user

        # Always show the author's synthesis (if exists)
        author_synthesis = obj.syntheses.filter(user=obj.cognition.user).first()

        # Show the current user's synthesis if it's not the author, and only if authenticated
        # Defensive: syntheses are included only if current user is authenticated
        user_synthesis = None
        if user and user.is_authenticated and user != obj.cognition.user:
            user_synthesis = obj.syntheses.filter(user=user).first()

        syntheses = []
        if author_synthesis:
            syntheses.append(SynthesisSerializer(author_synthesis, context=self.context).data)
        if user_synthesis:
            syntheses.append(SynthesisSerializer(user_synthesis, context=self.context).data)

        return syntheses

class CognitionSerializer(serializers.ModelSerializer):
    nodes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Cognition
        fields = ['id', 'title', 'raw_content', 'is_starred', 'created_at',
                  'updated_at', 'nodes_count']
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()

class CognitionDetailSerializer(CognitionSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    
    class Meta(CognitionSerializer.Meta):
        fields = CognitionSerializer.Meta.fields + ['nodes']

class ArcSerializer(serializers.ModelSerializer):
    class Meta:
        model = Arc
        fields = ['id', 'source_node', 'target_node', 'arc_type', 
                 'description', 'strength', 'created_at']