from django.contrib import admin
from .models import Cognition, Node, Synthesis, PresetResponse, SynthesisPresetLink, Arc

class NodeInline(admin.TabularInline):
    model = Node
    extra = 0

@admin.register(Cognition)
class CognitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_at', 'updated_at', 'get_nodes_count')
    search_fields = ('title', 'raw_content')
    list_filter = ('created_at', 'updated_at')
    inlines = [NodeInline]
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()
    get_nodes_count.short_description = 'Nodes'

class SynthesisInline(admin.StackedInline):
    model = Synthesis
    extra = 0

@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('cognition', 'position', 'is_illuminated', 'character_count', 'created_at')
    list_filter = ('is_illuminated', 'created_at', 'cognition')
    search_fields = ('content',)
    inlines = [SynthesisInline]

class SynthesisPresetLinkInline(admin.TabularInline):
    model = SynthesisPresetLink
    extra = 0

@admin.register(Synthesis)
class SynthesisAdmin(admin.ModelAdmin):
    list_display = ('node', 'created_at', 'updated_at')
    search_fields = ('content',)
    inlines = [SynthesisPresetLinkInline]

@admin.register(PresetResponse)
class PresetResponseAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'created_at')
    list_filter = ('category', 'created_at')
    search_fields = ('title', 'content')

@admin.register(Arc)
class ArcAdmin(admin.ModelAdmin):
    list_display = ('source_node', 'target_node', 'arc_type', 'strength', 'created_at')
    list_filter = ('arc_type', 'strength', 'created_at')
    search_fields = ('description',)