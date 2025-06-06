from django.contrib import admin
from .models import Cognition, Node, PresetResponse, Arc, UserProfile, Widget, WidgetInteraction
# Synthesis and SynthesisPresetLink removed - functionality replaced by widget system

class NodeInline(admin.TabularInline):
    model = Node
    extra = 0

@admin.register(Cognition)
class CognitionAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'is_public', 'share_date', 'created_at', 'updated_at', 'get_nodes_count')
    search_fields = ('title', 'raw_content')
    list_filter = ('is_public', 'created_at', 'user', 'updated_at')
    inlines = [NodeInline]
    
    def get_nodes_count(self, obj):
        return obj.nodes.count()
    get_nodes_count.short_description = 'Nodes'

class WidgetInline(admin.TabularInline):
    model = Widget
    extra = 0
    fields = ('widget_type', 'title', 'content', 'position', 'is_required')
    readonly_fields = ('created_at',)

@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('cognition', 'position', 'is_illuminated', 'character_count', 'created_at')
    list_filter = ('is_illuminated', 'created_at', 'cognition')
    search_fields = ('content',)
    inlines = [WidgetInline]  # Changed from SynthesisInline to WidgetInline

# Synthesis admin classes removed - functionality replaced by widget system

class WidgetInteractionInline(admin.TabularInline):
    model = WidgetInteraction
    extra = 0
    fields = ('user', 'completed', 'quiz_answer', 'created_at')
    readonly_fields = ('created_at',)

@admin.register(Widget)
class WidgetAdmin(admin.ModelAdmin):
    list_display = ('node', 'user', 'widget_type', 'title', 'position', 'is_required', 'created_at')
    list_filter = ('widget_type', 'is_required', 'created_at', 'user')
    search_fields = ('title', 'content')
    inlines = [WidgetInteractionInline]

@admin.register(WidgetInteraction)
class WidgetInteractionAdmin(admin.ModelAdmin):
    list_display = ('widget', 'user', 'completed', 'quiz_answer', 'created_at')
    list_filter = ('completed', 'created_at', 'widget__widget_type')
    search_fields = ('widget__title', 'user__username')

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

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_following_count', 'get_followers_count')
    search_fields = ('user__username',)

    def get_following_count(self, obj):
        return obj.following.count()
    get_following_count.short_description = 'Following'

    def get_followers_count(self, obj):
        return obj.followers.count()
    get_followers_count.short_description = 'Followers'