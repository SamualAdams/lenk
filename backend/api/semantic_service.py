# api/semantic_service.py
"""
OpenAI-powered semantic text analysis service
"""
import openai
import os
import time
import json
from typing import Tuple, Optional, Union
from django.conf import settings
from .semantic_models import (
    DocumentAnalysis, 
    QuickSegmentationResult, 
    SegmentationPreferences,
    DocumentType
)

class SemanticAnalysisError(Exception):
    """Custom exception for semantic analysis errors"""
    pass

class SemanticAnalysisService:
    """Service for performing semantic text analysis using OpenAI"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise SemanticAnalysisError("OpenAI API key not configured")
        
        openai.api_key = self.api_key
        self.model = "gpt-4o"  # Use latest model for best results
        self.max_tokens = 4000  # Reserve tokens for response
    
    def analyze_document(
        self, 
        text: str, 
        preferences: Optional[SegmentationPreferences] = None
    ) -> Tuple[DocumentAnalysis, int]:
        """
        Perform comprehensive semantic analysis of document
        
        Returns:
            Tuple of (DocumentAnalysis, processing_time_ms)
        """
        if not text.strip():
            raise SemanticAnalysisError("Text content is empty")
        
        if len(text) > 50000:  # Approximately 40k tokens
            raise SemanticAnalysisError("Text too long for analysis. Please break into smaller documents.")
        
        preferences = preferences or SegmentationPreferences()
        start_time = time.time()
        
        try:
            # Build the analysis prompt
            prompt = self._build_analysis_prompt(text, preferences)
            
            # Call OpenAI with JSON mode (fallback due to schema generation issues)
            response = openai.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt() + "\n\nPlease respond with valid JSON that matches the DocumentAnalysis structure."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=self.max_tokens,
                temperature=0.1  # Low temperature for consistency
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            # Parse the structured response
            content = response.choices[0].message.content
            if not content:
                raise SemanticAnalysisError("Empty response from AI model")
                
            analysis_data = json.loads(content)
            analysis = DocumentAnalysis(**analysis_data)
            
            return analysis, processing_time
            
        except openai.OpenAIError as e:
            raise SemanticAnalysisError(f"OpenAI API error: {str(e)}")
        except json.JSONDecodeError as e:
            raise SemanticAnalysisError(f"Failed to parse AI response: {str(e)}")
        except Exception as e:
            raise SemanticAnalysisError(f"Unexpected error during analysis: {str(e)}")
    
    def quick_segmentation(
        self, 
        text: str,
        max_segments: Optional[int] = None
    ) -> Tuple[QuickSegmentationResult, int]:
        """
        Perform faster, simpler segmentation for quick processing
        
        Returns:
            Tuple of (QuickSegmentationResult, processing_time_ms)
        """
        if not text.strip():
            raise SemanticAnalysisError("Text content is empty")
        
        start_time = time.time()
        
        try:
            prompt = self._build_quick_prompt(text, max_segments)
            
            response = openai.chat.completions.create(
                model="gpt-4o-mini",  # Use faster model for quick analysis
                messages=[
                    {
                        "role": "system",
                        "content": self._get_quick_system_prompt() + "\n\nPlease respond with valid JSON that matches the QuickSegmentationResult structure."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=2000,
                temperature=0.1
            )
            
            processing_time = int((time.time() - start_time) * 1000)
            
            content = response.choices[0].message.content
            if not content:
                raise SemanticAnalysisError("Empty response from AI model")
                
            result_data = json.loads(content)
            result = QuickSegmentationResult(**result_data)
            
            return result, processing_time
            
        except openai.OpenAIError as e:
            raise SemanticAnalysisError(f"OpenAI API error: {str(e)}")
        except json.JSONDecodeError as e:
            raise SemanticAnalysisError(f"Failed to parse AI response: {str(e)}")
        except Exception as e:
            raise SemanticAnalysisError(f"Unexpected error during quick analysis: {str(e)}")
    
    def _get_system_prompt(self) -> str:
        """System prompt for comprehensive document analysis"""
        return """
You are an expert document analyst specializing in semantic text segmentation and content structure analysis. Your task is to analyze documents and break them into meaningful, coherent segments that preserve conceptual boundaries.

Key principles:
1. Semantic coherence: Each segment should contain related ideas that belong together
2. Natural boundaries: Split at logical transition points, not arbitrary lengths
3. Preserve context: Ensure segments are self-contained but maintain document flow
4. User experience: Create segments that enhance reading comprehension
5. Hierarchy awareness: Respect document structure (headings, sections, etc.)

For position calculations:
- start_position and end_position should be exact character indices in the original text
- Ensure segments don't overlap and cover the entire document
- Preserve important formatting boundaries (paragraph breaks, section headers)

For reading time estimation:
- Use approximately 200 words per minute (3.3 words per second)
- Adjust for content complexity and formatting

For coherence scoring:
- 1.0: Perfect conceptual unity (single focused topic)
- 0.7-0.9: Strong coherence (related concepts, clear theme)
- 0.4-0.6: Moderate coherence (somewhat related ideas)
- 0.1-0.3: Weak coherence (loosely connected content)
        """
    
    def _get_quick_system_prompt(self) -> str:
        """System prompt for quick segmentation"""
        return """
You are a text segmentation specialist. Quickly analyze the given text and break it into meaningful semantic segments.

Focus on:
1. Clear topic boundaries
2. Conceptual coherence within segments
3. Reasonable segment lengths
4. Accurate position mapping

Keep analysis efficient but accurate.

Return a JSON object with this structure:
{
  "segments": [
    {
      "start_position": 0,
      "end_position": 100,
      "title": "Section Title",
      "summary": "Brief summary of this segment",
      "topic_keywords": ["keyword1", "keyword2"],
      "importance_level": "primary",
      "estimated_reading_time": 30,
      "semantic_coherence_score": 0.8
    }
  ],
  "document_type": "article",
  "overall_summary": "Brief document summary",
  "estimated_total_read_time": 120
}

importance_level must be one of: "primary", "secondary", "supporting"
document_type must be one of: "academic_paper", "tutorial", "article", "story", "reference", "essay", "manual", "blog_post", "news", "other"
        """
    
    def _build_analysis_prompt(self, text: str, preferences: SegmentationPreferences) -> str:
        """Build the analysis prompt with user preferences"""
        char_count = len(text)
        estimated_words = char_count // 5  # Rough estimate
        
        prompt = f"""
Analyze this document for semantic segmentation and create a comprehensive analysis.

Document length: {char_count} characters (~{estimated_words} words)

User preferences:
- Target segment length: {preferences.target_segment_length}
- Preserve paragraphs: {preferences.preserve_paragraphs}
- Create table of contents: {preferences.create_table_of_contents}
- Analyze reading flow: {preferences.analyze_reading_flow}
- Focus on concepts: {preferences.focus_on_concepts}
"""
        
        if preferences.max_segments:
            prompt += f"- Maximum segments: {preferences.max_segments}\n"
        
        prompt += f"""

Document text:
{text}

Provide a complete semantic analysis following the DocumentAnalysis schema.
        """
        
        return prompt
    
    def _build_quick_prompt(self, text: str, max_segments: Optional[int] = None) -> str:
        """Build prompt for quick segmentation"""
        char_count = len(text)
        
        prompt = f"""
Quickly segment this text into meaningful semantic chunks.

Document length: {char_count} characters
"""
        
        if max_segments:
            prompt += f"Maximum segments: {max_segments}\n"
        
        prompt += f"""

Document text:
{text}

Provide segmentation following the QuickSegmentationResult schema.
        """
        
        return prompt
    
    def estimate_processing_cost(self, text: str, analysis_type: str = "full") -> dict:
        """
        Estimate the cost and time for processing this text
        
        Args:
            text: The text to analyze
            analysis_type: "full" or "quick"
        
        Returns:
            Dict with estimated tokens, cost, and time
        """
        # Rough token estimation (1 token ≈ 4 characters for English)
        input_tokens = len(text) // 4
        
        if analysis_type == "full":
            output_tokens = 2000  # Estimated for comprehensive analysis
            model = "gpt-4o"
        else:
            output_tokens = 500   # Estimated for quick analysis
            model = "gpt-4o-mini"
        
        # OpenAI pricing (approximate, as of 2024)
        pricing = {
            "gpt-4o": {"input": 0.005, "output": 0.015},  # per 1K tokens
            "gpt-4o-mini": {"input": 0.0001, "output": 0.0004}
        }
        
        if model in pricing:
            input_cost = (input_tokens / 1000) * pricing[model]["input"]
            output_cost = (output_tokens / 1000) * pricing[model]["output"]
            total_cost = input_cost + output_cost
        else:
            total_cost = 0.0
        
        estimated_time_seconds = 10 if analysis_type == "full" else 3
        
        return {
            "input_tokens": input_tokens,
            "estimated_output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "estimated_cost_usd": round(total_cost, 4),
            "estimated_time_seconds": estimated_time_seconds,
            "model": model
        }

# Service instance
semantic_service = SemanticAnalysisService()
