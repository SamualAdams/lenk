# api/models.py
from django.db import models
from django.contrib.auth.models import User

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
    
    @property
    def author_synthesis(self):
        """
        Returns the synthesis for this node created by the author of the parent cognition.
        This property fetches the synthesis instance where the user matches the cognition's user.
        """
        return self.syntheses.filter(user=self.cognition.user).first()

class PresetResponse(models.Model):
    """Reusable preset responses that can be applied to any node."""
    title = models.CharField(max_length=100)
    content = models.TextField()
    category = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)  # For future authentication
    
    def __str__(self):
        return self.title

class Synthesis(models.Model):
    """
    Each node can have multiple syntheses—one per user.
    This model represents a synthesis written by a user for a specific node.
    """
    node = models.ForeignKey(Node, related_name='syntheses', on_delete=models.CASCADE)
    user = models.ForeignKey(User, related_name='syntheses', on_delete=models.CASCADE)
    content = models.TextField(blank=True)
    preset_responses = models.ManyToManyField(PresetResponse, through='SynthesisPresetLink', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['node', 'user']

    def __str__(self):
        return f"Synthesis by {self.user.username} for {self.node}"

    @property
    def full_content(self):
        """Returns combined content of custom text and preset responses."""
        full_text = self.content
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
# UserProfile model
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