# api/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc, UserProfile, Widget, WidgetInteraction

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

class WidgetInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WidgetInteraction
        fields = ['id', 'completed', 'quiz_answer', 'interaction_data', 'created_at']

class WidgetSerializer(serializers.ModelSerializer):
    user_interaction = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    is_author_widget = serializers.ReadOnlyField()
    is_reader_widget = serializers.ReadOnlyField()
    
    class Meta:
        model = Widget
        fields = [
            'id', 'node', 'widget_type', 'title', 'content', 'quiz_question', 
            'quiz_choices', 'quiz_correct_answer', 'quiz_explanation',
            'llm_preset', 'llm_custom_prompt', 'is_required', 'position',
            'username', 'is_author_widget', 'is_reader_widget', 
            'user_interaction', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'username', 'created_at', 'updated_at']
    
    def get_user_interaction(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        interaction = obj.interactions.filter(user=request.user).first()
        if interaction:
            return WidgetInteractionSerializer(interaction).data
        return None

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
    widgets = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = ['id', 'cognition', 'content', 'position', 'character_count',
                  'is_illuminated', 'created_at', 'syntheses', 'widgets']
        read_only_fields = ['syntheses', 'widgets', 'id', 'created_at']
    
    # Supports multiple syntheses per node: 
    # Returns author's synthesis and the current user's synthesis (if user is not author).
    # Used for displaying both syntheses in the UI.
    def get_syntheses(self, obj):
        """
        Return a list with:
        - The author's synthesis (always, if exists)
        - The current user's synthesis (if exists)
        - If current user is the author, include their synthesis in both roles
        """
        user = None
        if 'request' in self.context:
            user = self.context['request'].user

        # Always show the author's synthesis (if exists)
        author_synthesis = obj.syntheses.filter(user=obj.cognition.user).first()

        # Get the user's synthesis (whether they're the author or not)
        user_synthesis = None
        if user and user.is_authenticated:
            user_synthesis = obj.syntheses.filter(user=user).first()

        syntheses = []
        if author_synthesis:
            syntheses.append(SynthesisSerializer(author_synthesis, context=self.context).data)
        
        # Add user's synthesis if it exists and is different from author's synthesis
        if user_synthesis and (not author_synthesis or user_synthesis.id != author_synthesis.id):
            syntheses.append(SynthesisSerializer(user_synthesis, context=self.context).data)
        

        return syntheses
    
    def get_widgets(self, obj):
        """Temporarily return empty list during migration setup"""
        return []
        
        # TODO: Re-enable after successful migration
        # request = self.context.get('request')
        # if not request:
        #     return []
        # 
        # user = request.user
        # 
        # # Get author widgets (visible to all)
        # author_widgets = obj.widgets.filter(
        #     user=obj.cognition.user
        # ).order_by('position', 'created_at')
        # 
        # # Get reader widgets (only current user's)
        # reader_widgets = []
        # if user.is_authenticated:
        #     reader_widgets = obj.widgets.filter(
        #         user=user,
        #         widget_type__startswith='reader_'
        #     ).order_by('position', 'created_at')
        # 
        # # Combine and serialize
        # all_widgets = list(author_widgets) + list(reader_widgets)
        # return WidgetSerializer(all_widgets, many=True, context=self.context).data

class CognitionSerializer(serializers.ModelSerializer):
    nodes_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Cognition
        fields = ['id', 'title', 'raw_content', 'is_starred', 'created_at',
                  'updated_at', 'nodes_count']
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()

class CognitionDetailSerializer(CognitionSerializer):
    user_id = serializers.ReadOnlyField(source='user.id')
    username = serializers.ReadOnlyField(source='user.username')
    nodes = NodeSerializer(many=True, read_only=True)
    
    class Meta(CognitionSerializer.Meta):
        fields = CognitionSerializer.Meta.fields + ['user_id', 'username', 'nodes']

class ArcSerializer(serializers.ModelSerializer):
    class Meta:
        model = Arc
        fields = ['id', 'source_node', 'target_node', 'arc_type', 
                 'description', 'strength', 'created_at']