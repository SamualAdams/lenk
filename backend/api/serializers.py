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
    preset_links = SynthesisPresetLinkSerializer(many=True, read_only=True)
    full_content = serializers.ReadOnlyField()
    
    class Meta:
        model = Synthesis
        fields = ['id', 'content', 'full_content', 'preset_links', 'created_at', 'updated_at']

class NodeSerializer(serializers.ModelSerializer):
    synthesis = SynthesisSerializer(read_only=True)

    class Meta:
        model = Node
        fields = ['id', 'cognition', 'content', 'position', 'character_count',
                  'is_illuminated', 'created_at', 'synthesis']
        read_only_fields = ['synthesis', 'id', 'created_at']

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