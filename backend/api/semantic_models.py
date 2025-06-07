# api/semantic_models.py
"""
Pydantic models for OpenAI structured outputs in semantic text analysis
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Union
from enum import Enum

class DocumentType(str, Enum):
    ACADEMIC_PAPER = "academic_paper"
    TUTORIAL = "tutorial"
    ARTICLE = "article"
    STORY = "story"
    REFERENCE = "reference"
    ESSAY = "essay"
    MANUAL = "manual"
    BLOG_POST = "blog_post"
    NEWS = "news"
    OTHER = "other"

class ImportanceLevel(str, Enum):
    PRIMARY = "primary"
    SECONDARY = "secondary"
    SUPPORTING = "supporting"

class DocumentSegment(BaseModel):
    """Represents a semantic segment of the document"""
    start_position: int = Field(description="Character position where segment starts")
    end_position: int = Field(description="Character position where segment ends")
    title: str = Field(description="Descriptive title for this segment")
    summary: str = Field(max_length=200, description="Brief summary of segment content")
    topic_keywords: List[str] = Field(description="Key concepts/topics in this segment")
    importance_level: ImportanceLevel = Field(description="Relative importance of this segment")
    estimated_reading_time: int = Field(description="Estimated reading time in seconds")
    semantic_coherence_score: float = Field(ge=0.0, le=1.0, description="How well this segment holds together conceptually")

class TableOfContentsSection(BaseModel):
    """Hierarchical section for table of contents"""
    title: str = Field(description="Section title")
    summary: str = Field(max_length=150, description="Brief description of section content")
    segment_indices: List[int] = Field(description="Which segment indices belong to this section")
    subsections: Optional[List['TableOfContentsSection']] = Field(default=None, description="Nested subsections")
    estimated_read_time: int = Field(description="Total estimated reading time for section in seconds")
    page_number: Optional[int] = Field(default=None, description="Equivalent page number for reference")

# Enable forward references for recursive model
TableOfContentsSection.model_rebuild()

class ReadingFlow(BaseModel):
    """Suggested reading order and flow"""
    segment_order: List[int] = Field(description="Optimal order to read segments")
    prerequisite_map: dict = Field(description="Map of segment_id -> [prerequisite_segment_ids]")
    difficulty_progression: List[str] = Field(description="How difficulty progresses through document")
    suggested_breaks: List[int] = Field(description="Segment indices where natural breaks occur")

class DocumentAnalysis(BaseModel):
    """Complete semantic analysis of document"""
    document_type: DocumentType = Field(description="Classified type of document")
    overall_summary: str = Field(max_length=300, description="High-level summary of entire document")
    main_themes: List[str] = Field(description="Primary themes/topics covered")
    target_audience: str = Field(description="Intended audience level and type")
    estimated_total_read_time: int = Field(description="Total estimated reading time in seconds")
    complexity_level: str = Field(
        description="Overall complexity/difficulty level (beginner, intermediate, advanced, expert)"
    )
    
    # Core segmentation
    segments: List[DocumentSegment] = Field(description="Semantic segments of the document")
    
    # Navigation aids
    table_of_contents: List[TableOfContentsSection] = Field(description="Hierarchical table of contents")
    reading_flow: ReadingFlow = Field(description="Suggested reading order and flow")
    
    # Quality metrics
    overall_coherence_score: float = Field(ge=0.0, le=1.0, description="How well the document holds together")
    segmentation_confidence: float = Field(ge=0.0, le=1.0, description="Confidence in segmentation quality")

class SegmentationPreferences(BaseModel):
    """User preferences for how to segment the document"""
    target_segment_length: str = Field(default="medium", description="Target segment length: short, medium, or long")
    preserve_paragraphs: bool = Field(default=True, description="Try to keep paragraphs intact")
    create_table_of_contents: bool = Field(default=True)
    analyze_reading_flow: bool = Field(default=True)
    max_segments: Optional[int] = Field(default=None, description="Maximum number of segments to create")
    focus_on_concepts: bool = Field(default=True, description="Prioritize conceptual boundaries over length")

class QuickSegmentationResult(BaseModel):
    """Simplified result for quick processing"""
    segments: List[DocumentSegment] = Field(description="Basic semantic segments")
    document_type: DocumentType = Field(description="Document type classification")
    overall_summary: str = Field(max_length=200, description="Brief document summary")
    estimated_total_read_time: int = Field(description="Total reading time in seconds")
