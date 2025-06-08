# api/toc_processor.py
from django.db import transaction
from .models import Cognition, Node
from .openai_service import toc_service
from typing import Dict, Any, Optional
import json


class TOCProcessor:
    """Handles Table of Contents processing and node management"""
    
    @staticmethod
    def generate_toc_for_cognition(cognition: Cognition) -> Dict[str, Any]:
        """
        Generate a Table of Contents for a cognition.
        
        Args:
            cognition: The Cognition instance to generate TOC for
            
        Returns:
            Dictionary with toc_node_id, sections_created, and processing_time_ms
        """
        
        # Validate minimum node count (excluding any existing TOC nodes)
        content_nodes = cognition.nodes.filter(node_type='content').order_by('position')
        
        if content_nodes.count() < 2:
            raise ValueError("Minimum 2 content nodes required for TOC generation")
        
        # Use a single transaction for the entire operation
        with transaction.atomic():
            # Check if TOC already exists
            existing_toc = cognition.nodes.filter(node_type='toc').first()
            if existing_toc:
                return {
                    'toc_node_id': existing_toc.id,
                    'sections_created': len(cognition.table_of_contents.get('sections', [])),
                    'processing_time_ms': 0,
                    'message': 'TOC already exists'
                }
            
            # Prepare node data for analysis (refresh content_nodes inside transaction)
            content_nodes = cognition.nodes.filter(node_type='content').order_by('position')
            node_data = []
            for node in content_nodes:
                node_data.append({
                    'id': node.id,
                    'position': node.position,
                    'content': node.content
                })
            
            # Generate TOC using OpenAI service
            import time
            start_time = time.time()
            
            try:
                toc_data = toc_service.generate_table_of_contents(node_data)
            except Exception as e:
                raise ValueError(f"Failed to generate TOC: {str(e)}")
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            # Shift existing nodes to make room at position 0
            TOCProcessor._shift_existing_nodes(cognition)
            
            # Create the TOC node at position 0
            toc_node = TOCProcessor._create_toc_node(cognition, toc_data)
            
            # Update cognition's TOC data
            TOCProcessor._update_cognition_toc_data(cognition, toc_data)
        
        return {
            'toc_node_id': toc_node.id,
            'sections_created': len(toc_data.get('sections', [])),
            'processing_time_ms': processing_time_ms
        }
    
    @staticmethod
    def regenerate_toc_for_cognition(cognition: Cognition) -> Dict[str, Any]:
        """
        Regenerate TOC for a cognition, replacing any existing one.
        
        Args:
            cognition: The Cognition instance to regenerate TOC for
            
        Returns:
            Dictionary with toc_node_id, sections_created, and processing_time_ms
        """
        
        # Remove existing TOC
        with transaction.atomic():
            existing_toc = cognition.nodes.filter(node_type='toc').first()
            if existing_toc:
                existing_toc.delete()
                # Reorder remaining nodes to fill the gap
                TOCProcessor._reorder_nodes_after_deletion(cognition, 0)  # TOC was at position 0
        
        # Generate new TOC
        return TOCProcessor.generate_toc_for_cognition(cognition)
    
    @staticmethod
    def _create_toc_node(cognition: Cognition, toc_data: Dict[str, Any]) -> Node:
        """Create the TOC node with formatted content"""
        
        # Generate markdown content for the TOC
        toc_content = TOCProcessor._generate_toc_markdown(toc_data)
        
        # Create the TOC node at position 0
        toc_node = Node.objects.create(
            cognition=cognition,
            content=toc_content,
            position=0,
            character_count=len(toc_content),
            node_type='toc',
            is_illuminated=False
        )
        
        return toc_node
    
    @staticmethod
    def _generate_toc_markdown(toc_data: Dict[str, Any]) -> str:
        """Generate minimalist markdown content for the TOC node"""
        
        sections = toc_data.get('sections', [])
        
        if not sections:
            return "# Table of Contents\n\n*No sections available.*"
        
        markdown_parts = []
        
        for i, section in enumerate(sections, 1):
            # Section header with navigation info only
            start_node = section.get('start_node', 1)
            end_node = section.get('end_node', 1)
            importance = section.get('importance', 'secondary')
            
            # Use different markdown levels based on importance
            if importance == 'primary':
                header_level = "##"
            elif importance == 'secondary':
                header_level = "###"
            else:
                header_level = "####"
            
            section_title = section.get('title', f'Section {i}')
            node_range = f"(Nodes {start_node}-{end_node})" if start_node != end_node else f"(Node {start_node})"
            
            # Only include title and node range - no descriptions
            markdown_parts.append(f"{header_level} {section_title} {node_range}")
        
        return "\n".join(markdown_parts)
    
    @staticmethod
    def _shift_existing_nodes(cognition: Cognition):
        """Shift all existing nodes by +1 position to make room for TOC at position 0"""
        
        # Use raw SQL to avoid unique constraint conflicts during the shift
        from django.db import connection
        
        with connection.cursor() as cursor:
            # Add a large offset to all positions first to avoid conflicts
            cursor.execute("""
                UPDATE api_node 
                SET position = position + 1000 
                WHERE cognition_id = %s
            """, [cognition.id])
            
            # Then set the final positions (1000 + old_position -> 1 + old_position)
            cursor.execute("""
                UPDATE api_node 
                SET position = position - 999 
                WHERE cognition_id = %s
            """, [cognition.id])
    
    @staticmethod
    def _reorder_nodes_after_deletion(cognition: Cognition, deleted_position: int):
        """Reorder nodes after a deletion to fill gaps"""
        
        # Get all nodes after the deleted position
        nodes_to_reorder = cognition.nodes.filter(
            position__gt=deleted_position
        ).order_by('position')
        
        for node in nodes_to_reorder:
            node.position -= 1
            node.save(update_fields=['position'])
    
    @staticmethod
    def _update_cognition_toc_data(cognition: Cognition, toc_data: Dict[str, Any]):
        """Update the cognition's table_of_contents field"""
        
        cognition.table_of_contents = toc_data
        cognition.save(update_fields=['table_of_contents'])
    
    @staticmethod
    def update_toc_content(toc_node: Node, new_content: str) -> bool:
        """
        Update TOC node content and try to parse structured data.
        
        Args:
            toc_node: The TOC node to update
            new_content: New markdown content for the TOC
            
        Returns:
            Boolean indicating if the update was successful
        """
        
        try:
            with transaction.atomic():
                toc_node.content = new_content
                toc_node.character_count = len(new_content)
                toc_node.save(update_fields=['content', 'character_count'])
                
                # Try to parse any updated section information from the content
                # This is a simple implementation - could be enhanced with more sophisticated parsing
                
                return True
        except Exception as e:
            print(f"Failed to update TOC content: {str(e)}")
            return False
    
    @staticmethod
    def get_toc_node(cognition: Cognition) -> Optional[Node]:
        """Get the TOC node for a cognition, if it exists"""
        return cognition.nodes.filter(node_type='toc').first()
    
    @staticmethod
    def has_toc(cognition: Cognition) -> bool:
        """Check if a cognition has a TOC"""
        return cognition.nodes.filter(node_type='toc').exists()


# Global instance
toc_processor = TOCProcessor()