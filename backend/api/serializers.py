# api/serializers.py
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Cognition, Node, PresetResponse, Arc, UserProfile, Widget, WidgetInteraction,
    DocumentAnalysisResult, SemanticSegment, Group, GroupMembership, GroupInvitation
)
# Synthesis and SynthesisPresetLink removed - functionality consolidated into widgets

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

class UserProfileDetailSerializer(UserProfileSerializer):
    join_date = serializers.DateTimeField(source='user.date_joined', read_only=True)
    public_cognitions_count = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()
    recent_cognitions = serializers.SerializerMethodField()
    is_own_profile = serializers.SerializerMethodField()
    
    class Meta:
        model = UserProfile
        fields = ['id', 'username', 'bio', 'follower_count', 'following_count', 
                  'is_following', 'join_date', 'public_cognitions_count', 
                  'recent_activity', 'recent_cognitions', 'is_own_profile']
    
    def get_public_cognitions_count(self, obj):
        return obj.user.cognitions.filter(is_public=True).count()
    
    def get_recent_activity(self, obj):
        # Get the most recent public cognition date
        recent_cognition = obj.user.cognitions.filter(is_public=True).order_by('-updated_at').first()
        return recent_cognition.updated_at if recent_cognition else obj.user.date_joined
    
    def get_recent_cognitions(self, obj):
        # Get 3 most recent public cognitions
        recent = obj.user.cognitions.filter(is_public=True).order_by('-updated_at')[:3]
        return [{'id': c.id, 'title': c.title, 'created_at': c.created_at} for c in recent]
    
    def get_is_own_profile(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.user == request.user
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
    
    def validate(self, data):
        """Custom validation using the model's clean method"""
        # Create a temporary widget instance for validation
        widget = Widget(**data)
        widget.clean()  # This will raise ValidationError if invalid
        return data

# Synthesis serializers removed - functionality consolidated into widget system
# class SynthesisPresetLinkSerializer and SynthesisSerializer were here

class NodeSerializer(serializers.ModelSerializer):
    # syntheses field removed - consolidated into widgets
    widgets = serializers.SerializerMethodField()

    class Meta:
        model = Node
        fields = ['id', 'cognition', 'content', 'position', 'character_count',
                  'is_illuminated', 'node_type', 'created_at', 'widgets']
        read_only_fields = ['widgets', 'id', 'created_at']
    
    # Note: Synthesis functionality has been consolidated into the widget system
    
    def get_widgets(self, obj):
        """Return widgets for this node - author widgets visible to all, reader widgets only to their creators"""
        request = self.context.get('request')
        if not request:
            return []
        
        user = request.user
        
        # Get author widgets (visible to all)
        author_widgets = obj.widgets.filter(
            user=obj.cognition.user
        ).order_by('position', 'created_at')
        
        # Get reader widgets (only current user's)
        reader_widgets = []
        if user.is_authenticated:
            reader_widgets = obj.widgets.filter(
                user=user,
                widget_type__startswith='reader_'
            ).order_by('position', 'created_at')
        
        # Combine and serialize
        all_widgets = list(author_widgets) + list(reader_widgets)
        return WidgetSerializer(all_widgets, many=True, context=self.context).data

class SemanticSegmentSerializer(serializers.ModelSerializer):
    content = serializers.SerializerMethodField()
    length = serializers.ReadOnlyField()
    
    class Meta:
        model = SemanticSegment
        fields = [
            'id', 'start_position', 'end_position', 'title', 'summary',
            'topic_keywords', 'importance_level', 'estimated_reading_time',
            'semantic_coherence_score', 'sequence_order', 'content', 'length',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'content', 'length']
    
    def get_content(self, obj):
        """Return the actual text content for this segment"""
        return obj.get_content()

class DocumentAnalysisResultSerializer(serializers.ModelSerializer):
    segments = SemanticSegmentSerializer(many=True, read_only=True)
    processing_time_seconds = serializers.SerializerMethodField()
    
    class Meta:
        model = DocumentAnalysisResult
        fields = [
            'id', 'document_type', 'overall_summary', 'main_themes',
            'target_audience', 'complexity_level', 'estimated_total_read_time',
            'overall_coherence_score', 'segmentation_confidence',
            'table_of_contents', 'reading_flow', 'segments',
            'created_at', 'processing_time_ms', 'processing_time_seconds',
            'openai_model_used'
        ]
        read_only_fields = [
            'id', 'created_at', 'processing_time_ms', 'processing_time_seconds',
            'segments'
        ]
    
    def get_processing_time_seconds(self, obj):
        """Convert processing time to seconds for easier frontend use"""
        if obj.processing_time_ms:
            return round(obj.processing_time_ms / 1000, 2)
        return None

class CognitionSerializer(serializers.ModelSerializer):
    nodes_count = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.ReadOnlyField(source='user.id')
    group_name = serializers.CharField(source='group.name', read_only=True)
    group_id = serializers.ReadOnlyField(source='group.id')
    is_group_cognition = serializers.ReadOnlyField()
    owner_display = serializers.ReadOnlyField(source='get_owner_display')
    can_edit = serializers.SerializerMethodField()
    
    class Meta:
        model = Cognition
        fields = ['id', 'title', 'raw_content', 'is_starred', 'created_at',
                  'updated_at', 'nodes_count', 'table_of_contents', 'is_public',
                  'username', 'user_id', 'group_name', 'group_id', 'group',
                  'is_group_cognition', 'owner_display', 'can_edit']
    
    def get_can_edit(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.can_edit(request.user)
        return False
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()

class CognitionDetailSerializer(CognitionSerializer):
    user_id = serializers.ReadOnlyField(source='user.id')
    username = serializers.ReadOnlyField(source='user.username')
    nodes = NodeSerializer(many=True, read_only=True)
    analysis = DocumentAnalysisResultSerializer(read_only=True)
    has_semantic_analysis = serializers.SerializerMethodField()
    
    class Meta(CognitionSerializer.Meta):
        fields = CognitionSerializer.Meta.fields + [
            'user_id', 'username', 'nodes', 'analysis', 'has_semantic_analysis', 'table_of_contents'
        ]
    
    def get_has_semantic_analysis(self, obj):
        """Check if this cognition has been semantically analyzed"""
        return hasattr(obj, 'analysis') and obj.analysis is not None

class ArcSerializer(serializers.ModelSerializer):
    class Meta:
        model = Arc
        fields = ['id', 'source_node', 'target_node', 'arc_type', 
                 'description', 'strength', 'created_at']


class GroupMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    
    class Meta:
        model = GroupMembership
        fields = ['id', 'user_id', 'username', 'role', 'joined_at']


class GroupSerializer(serializers.ModelSerializer):
    founder_username = serializers.CharField(source='founder.username', read_only=True)
    member_count = serializers.ReadOnlyField()
    cognition_count = serializers.ReadOnlyField()
    is_member = serializers.SerializerMethodField()
    is_admin = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    
    class Meta:
        model = Group
        fields = [
            'id', 'name', 'description', 'founder', 'founder_username',
            'created_at', 'updated_at', 'is_public', 'member_count', 
            'cognition_count', 'is_member', 'is_admin', 'user_role'
        ]
        read_only_fields = ['founder', 'created_at', 'updated_at']
    
    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_member(request.user)
        return False
    
    def get_is_admin(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.is_admin(request.user)
        return False
    
    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user).first()
            return membership.role if membership else None
        return None


class GroupDetailSerializer(GroupSerializer):
    members = GroupMembershipSerializer(source='memberships', many=True, read_only=True)
    recent_cognitions = serializers.SerializerMethodField()
    
    class Meta(GroupSerializer.Meta):
        fields = GroupSerializer.Meta.fields + ['members', 'recent_cognitions']
    
    def get_recent_cognitions(self, obj):
        # Get 5 most recent group cognitions
        recent = obj.cognitions.order_by('-created_at')[:5]
        return CognitionSerializer(recent, many=True, context=self.context).data


class GroupInvitationSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    inviter_username = serializers.CharField(source='inviter.username', read_only=True)
    invitee_username = serializers.CharField(source='invitee.username', read_only=True)
    
    class Meta:
        model = GroupInvitation
        fields = [
            'id', 'group', 'group_name', 'inviter', 'inviter_username',
            'invitee', 'invitee_username', 'message', 'status',
            'created_at', 'responded_at'
        ]
        read_only_fields = ['inviter', 'created_at', 'responded_at']