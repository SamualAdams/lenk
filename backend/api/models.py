# api/models.py
from django.db import models
from django.contrib.auth.models import User
import json

class Cognition(models.Model):
    title = models.CharField(max_length=200)
    raw_content = models.TextField(help_text="The original, unprocessed text")
    is_starred = models.BooleanField(default=False, help_text="Indicates if this cognition is starred for quick access")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cognitions')
    is_public = models.BooleanField(default=False, help_text="Whether this cognition is shared publicly")
    share_date = models.DateTimeField(null=True, blank=True, help_text="When this cognition was shared")
    
    def __str__(self):
        return self.title
    
    def total_characters(self):
        return sum(node.character_count for node in self.nodes.all())

class Node(models.Model):
    cognition = models.ForeignKey(Cognition, related_name='nodes', on_delete=models.CASCADE)
    content = models.TextField()
    position = models.PositiveIntegerField()
    character_count = models.PositiveIntegerField()
    is_illuminated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['position']
        unique_together = ['cognition', 'position']
    
    def __str__(self):
        return f"{self.cognition.title} - Node {self.position}"
    
    # author_synthesis property removed - synthesis functionality replaced by widget system

class PresetResponse(models.Model):
    """Reusable preset responses that can be applied to any node."""
    title = models.CharField(max_length=100)
    content = models.TextField()
    category = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)  # For future authentication
    
    def __str__(self):
        return self.title

# Synthesis and SynthesisPresetLink models removed - functionality consolidated into widget system
# These models were used for user notes/responses on nodes, now handled by reader_remark widgets

class Arc(models.Model):
    TYPE_CHOICES = [
        ('similarity', 'Similarity'),
        ('contrast', 'Contrast'),
        ('cause_effect', 'Cause and Effect'),
        ('example', 'Example'),
        ('elaboration', 'Elaboration'),
        ('sequence', 'Sequence'),
        ('custom', 'Custom'),
    ]
    
    source_node = models.ForeignKey(Node, related_name='outgoing_arcs', on_delete=models.CASCADE)
    target_node = models.ForeignKey(Node, related_name='incoming_arcs', on_delete=models.CASCADE)
    arc_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField(blank=True)
    strength = models.IntegerField(default=5, help_text="Strength of connection (1-10)")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['source_node', 'target_node', 'arc_type']
    
    def __str__(self):
        return f"Arc: {self.source_node} -> {self.target_node} ({self.arc_type})"
# UserProfile model
class Widget(models.Model):
    WIDGET_TYPE_CHOICES = [
        ('author_remark', 'Author Remark'),
        ('author_quiz', 'Author Quiz'),
        ('author_dialog', 'Author Dialog'),
        ('author_llm', 'Author AI Response'),
        ('reader_llm', 'Reader AI Response'),
        ('reader_remark', 'Reader Remark'),
    ]
    
    LLM_PRESET_CHOICES = [
        # Reader presets
        ('simplify', 'Simplify this node'),
        ('analogy', 'Provide analogy'),
        ('bullets', 'Make bulleted list'),
        ('summary', 'Summarize'),
        ('questions', 'Generate questions'),
        
        # Author presets
        ('explain', 'Provide detailed explanation'),
        ('examples', 'Give practical examples'),
        ('context', 'Add background context'),
        ('connections', 'Show concept relationships'),
        ('deeper_dive', 'Expand with advanced details'),
        ('clarify', 'Clarify potential confusion'),
        ('applications', 'Show real-world applications'),
    ]
    
    node = models.ForeignKey(Node, related_name='widgets', on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    widget_type = models.CharField(max_length=20, choices=WIDGET_TYPE_CHOICES)
    
    # Content fields
    title = models.CharField(max_length=200, blank=True)
    content = models.TextField(blank=True)  # Allow blank for quiz widgets and others with specific fields
    
    # Quiz-specific fields
    quiz_question = models.TextField(blank=True)
    quiz_choices = models.JSONField(default=list, blank=True)  # ['A', 'B', 'C', 'D']
    quiz_correct_answer = models.CharField(max_length=1, blank=True)
    quiz_explanation = models.TextField(blank=True)
    
    # LLM-specific fields
    llm_preset = models.CharField(max_length=20, choices=LLM_PRESET_CHOICES, blank=True)
    llm_custom_prompt = models.TextField(blank=True)
    
    # Behavior fields
    is_required = models.BooleanField(default=False)  # Blocks progression if not completed
    position = models.PositiveIntegerField(default=0)  # Order within node
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['position', 'created_at']
    
    def __str__(self):
        return f"{self.get_widget_type_display()} by {self.user.username} on {self.node}"
    
    def clean(self):
        """Custom validation for different widget types"""
        from django.core.exceptions import ValidationError
        
        if self.widget_type in ['author_quiz', 'reader_quiz']:
            if not self.quiz_question or not self.quiz_question.strip():
                raise ValidationError('Quiz question is required for quiz widgets')
        elif self.widget_type in ['author_remark', 'reader_remark']:
            if (not self.content or not self.content.strip()) and (not self.title or not self.title.strip()):
                raise ValidationError('Content or title is required for remark widgets')
        elif self.widget_type == 'author_dialog':
            if not self.content or not self.content.strip():
                raise ValidationError('Content is required for dialog widgets')
        # author_llm and reader_llm widgets get their content generated, so no validation needed
    
    @property
    def is_author_widget(self):
        return self.widget_type.startswith('author_')
    
    @property
    def is_reader_widget(self):
        return self.widget_type.startswith('reader_')

class WidgetInteraction(models.Model):
    """Track user interactions with widgets (completion, answers, etc.)"""
    widget = models.ForeignKey(Widget, related_name='interactions', on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    
    # Interaction data
    completed = models.BooleanField(default=False)
    quiz_answer = models.CharField(max_length=1, blank=True)  # User's quiz answer
    interaction_data = models.JSONField(default=dict, blank=True)  # Flexible data storage
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['widget', 'user']
    
    def __str__(self):
        return f"{self.user.username} interaction with {self.widget}"

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True, null=True)
    following = models.ManyToManyField('self', symmetrical=False, related_name='followers', blank=True)
    
    def __str__(self):
        return f"{self.user.username}'s profile"
    
    def follow(self, profile):
        if profile != self:
            self.following.add(profile)
    
    def unfollow(self, profile):
        self.following.remove(profile)
    
    def is_following(self, profile):
        return self.following.filter(pk=profile.pk).exists()
    
    def get_followers(self):
        return self.followers.all()
    
    def get_following(self):
        return self.following.all()

class DocumentAnalysisResult(models.Model):
    """Stores the results of semantic document analysis"""
    
    DOCUMENT_TYPES = [
        ('academic_paper', 'Academic Paper'),
        ('tutorial', 'Tutorial'),
        ('article', 'Article'),
        ('story', 'Story'),
        ('reference', 'Reference'),
        ('essay', 'Essay'),
        ('manual', 'Manual'),
        ('blog_post', 'Blog Post'),
        ('news', 'News'),
        ('other', 'Other'),
    ]
    
    COMPLEXITY_LEVELS = [
        ('beginner', 'Beginner'),
        ('intermediate', 'Intermediate'),
        ('advanced', 'Advanced'),
        ('expert', 'Expert'),
    ]
    
    cognition = models.OneToOneField(Cognition, on_delete=models.CASCADE, related_name='analysis')
    
    # Basic classification
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    overall_summary = models.TextField()
    main_themes = models.JSONField(default=list)  # List of strings
    target_audience = models.CharField(max_length=200)
    complexity_level = models.CharField(max_length=20, choices=COMPLEXITY_LEVELS)
    
    # Time estimates
    estimated_total_read_time = models.PositiveIntegerField(help_text="Total reading time in seconds")
    
    # Quality metrics
    overall_coherence_score = models.FloatField()
    segmentation_confidence = models.FloatField()
    
    # Structured data (stored as JSON)
    table_of_contents = models.JSONField(default=list)
    reading_flow = models.JSONField(default=dict)
    
    # Processing metadata
    created_at = models.DateTimeField(auto_now_add=True)
    processing_time_ms = models.PositiveIntegerField(null=True, blank=True)
    openai_model_used = models.CharField(max_length=50, default='gpt-4o')
    
    def __str__(self):
        return f"Analysis for {self.cognition.title} ({self.document_type})"
    
    def get_table_of_contents_tree(self):
        """Return table of contents as nested structure"""
        return self.table_of_contents
    
    def get_reading_flow_order(self):
        """Return suggested reading order"""
        return self.reading_flow.get('segment_order', [])

class SemanticSegment(models.Model):
    """Individual semantic segments identified by AI analysis"""
    
    IMPORTANCE_LEVELS = [
        ('primary', 'Primary'),
        ('secondary', 'Secondary'),
        ('supporting', 'Supporting'),
    ]
    
    analysis = models.ForeignKey(DocumentAnalysisResult, on_delete=models.CASCADE, related_name='segments')
    node = models.OneToOneField(Node, on_delete=models.CASCADE, related_name='semantic_segment', null=True, blank=True)
    
    # Position in original text
    start_position = models.PositiveIntegerField()
    end_position = models.PositiveIntegerField()
    
    # AI-generated metadata
    title = models.CharField(max_length=200)
    summary = models.TextField(max_length=500)
    topic_keywords = models.JSONField(default=list)  # List of strings
    importance_level = models.CharField(max_length=20, choices=IMPORTANCE_LEVELS)
    
    # Metrics
    estimated_reading_time = models.PositiveIntegerField(help_text="Reading time in seconds")
    semantic_coherence_score = models.FloatField()
    
    # Order and relationships
    sequence_order = models.PositiveIntegerField(help_text="Order in the document")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['sequence_order']
        unique_together = ['analysis', 'sequence_order']
    
    def __str__(self):
        return f"Segment {self.sequence_order}: {self.title}"
    
    def get_content(self):
        """Extract content from original text based on positions"""
        if self.analysis.cognition.raw_content:
            return self.analysis.cognition.raw_content[self.start_position:self.end_position]
        return ""
    
    @property
    def length(self):
        return self.end_position - self.start_position