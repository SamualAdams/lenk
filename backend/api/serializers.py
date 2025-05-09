# api/serializers.py
from rest_framework import serializers
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc

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