# api/models.py
from django.db import models

class Cognition(models.Model):
    title = models.CharField(max_length=200)
    raw_content = models.TextField(help_text="The original, unprocessed text")
    is_starred = models.BooleanField(default=False, help_text="Indicates if this cognition is starred for quick access")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # user = models.ForeignKey(User, on_delete=models.CASCADE)  # For future auth implementation
    
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

class PresetResponse(models.Model):
    """Reusable preset responses that can be applied to any node."""
    title = models.CharField(max_length=100)
    content = models.TextField()
    category = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)  # For future auth
    
    def __str__(self):
        return self.title

class Synthesis(models.Model):
    node = models.OneToOneField(Node, related_name='synthesis', on_delete=models.CASCADE)
    content = models.TextField(blank=True)
    preset_responses = models.ManyToManyField(PresetResponse, through='SynthesisPresetLink', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Synthesis for {self.node}"
    
    @property
    def full_content(self):
        """Returns combined content of custom text and preset responses."""
        full_text = self.content
        
        # Add content from all preset responses
        links = self.preset_links.all().order_by('position')
        if links:
            if full_text:
                full_text += "\n\n"
            preset_texts = [link.preset_response.content for link in links]
            full_text += "\n\n".join(preset_texts)
            
        return full_text

class SynthesisPresetLink(models.Model):
    """Junction table to track which preset responses are used in a synthesis with ordering."""
    synthesis = models.ForeignKey(Synthesis, related_name='preset_links', on_delete=models.CASCADE)
    preset_response = models.ForeignKey(PresetResponse, on_delete=models.CASCADE)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['position']
        unique_together = ['synthesis', 'preset_response']
    
    def __str__(self):
        return f"{self.synthesis} - {self.preset_response}"

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