# api/openai_service.py
import openai
import os
import json
from typing import List, Dict, Any


class OpenAITOCService:
    """OpenAI service specifically for Table of Contents generation"""
    
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    
    def generate_table_of_contents(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a table of contents from a list of node data.
        
        Args:
            nodes: List of dictionaries containing node data with keys:
                  - id: Node ID
                  - position: Node position
                  - content: Node content text
        
        Returns:
            Dictionary with TOC structure matching the specification
        """
        
        if len(nodes) < 2:
            raise ValueError("Minimum 2 nodes required for TOC generation")
        
        # Prepare content for analysis
        content_summary = self._prepare_content_for_analysis(nodes)
        
        # Generate TOC using OpenAI
        system_prompt = self._get_toc_system_prompt()
        user_prompt = self._get_toc_user_prompt(content_summary)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            toc_data = json.loads(response.choices[0].message.content)
            
            # Validate and clean the response
            return self._validate_and_clean_toc_data(toc_data, len(nodes))
            
        except Exception as e:
            print(f"OpenAI TOC generation error: {str(e)}")
            # Fallback to basic section creation
            return self._create_fallback_toc(nodes)
    
    def _prepare_content_for_analysis(self, nodes: List[Dict[str, Any]]) -> str:
        """Prepare node content for OpenAI analysis"""
        content_parts = []
        
        for node in nodes:
            # Truncate very long content to avoid token limits
            content = node['content'][:500]  # First 500 chars
            content_parts.append(f"NODE {node['position']}: {content}")
        
        return "\n\n".join(content_parts)
    
    def _get_toc_system_prompt(self) -> str:
        """System prompt for TOC generation"""
        return """You are an expert at creating structured table of contents for educational and informational documents.

Your task is to analyze a series of nodes/sections and create a logical table of contents that groups related content into meaningful sections.

Guidelines:
- Create 2-6 logical sections that group related nodes
- Each section should span 1-5 consecutive nodes
- Provide clear, descriptive section titles
- Include brief descriptions that summarize what readers will learn
- Assign importance levels: "primary" for main topics, "secondary" for supporting topics, "supporting" for background/examples
- Ensure sections cover all nodes without gaps or overlaps
- Make the TOC helpful for navigation and comprehension

Return ONLY a JSON object with this exact structure:
{
  "title": "Table of Contents",
  "sections": [
    {
      "title": "Section Name",
      "description": "Brief section summary (1-2 sentences)",
      "start_node": 1,
      "end_node": 3,
      "importance": "primary"
    }
  ]
}"""
    
    def _get_toc_user_prompt(self, content_summary: str) -> str:
        """User prompt with content for analysis"""
        return f"""Analyze the following nodes and create a table of contents:

{content_summary}

Create logical sections that group related content. Ensure all nodes are included in exactly one section."""
    
    def _validate_and_clean_toc_data(self, toc_data: Dict[str, Any], total_nodes: int) -> Dict[str, Any]:
        """Validate and clean the TOC data from OpenAI"""
        
        # Ensure basic structure
        if "sections" not in toc_data:
            raise ValueError("Invalid TOC structure: missing sections")
        
        sections = toc_data["sections"]
        
        # Validate each section
        cleaned_sections = []
        covered_nodes = set()
        
        for section in sections:
            # Validate required fields
            if not all(key in section for key in ["title", "start_node", "end_node"]):
                continue
            
            start = section["start_node"]
            end = section["end_node"]
            
            # Validate node ranges
            if start < 1 or end > total_nodes or start > end:
                continue
            
            # Check for overlaps
            section_nodes = set(range(start, end + 1))
            if section_nodes & covered_nodes:
                continue  # Skip overlapping sections
            
            covered_nodes.update(section_nodes)
            
            # Clean up the section
            cleaned_section = {
                "title": section.get("title", "Untitled Section"),
                "description": section.get("description", ""),
                "start_node": start,
                "end_node": end,
                "importance": section.get("importance", "secondary")
            }
            
            # Validate importance level
            if cleaned_section["importance"] not in ["primary", "secondary", "supporting"]:
                cleaned_section["importance"] = "secondary"
            
            cleaned_sections.append(cleaned_section)
        
        # If we missed any nodes, create additional sections
        all_nodes = set(range(1, total_nodes + 1))
        uncovered = all_nodes - covered_nodes
        
        if uncovered:
            # Group consecutive uncovered nodes
            uncovered_list = sorted(uncovered)
            i = 0
            while i < len(uncovered_list):
                start = uncovered_list[i]
                end = start
                
                # Find consecutive nodes
                while i + 1 < len(uncovered_list) and uncovered_list[i + 1] == uncovered_list[i] + 1:
                    i += 1
                    end = uncovered_list[i]
                
                # Create meaningful section for uncovered nodes by analyzing content
                section_title = self._generate_section_title_from_nodes(
                    nodes, start - 1, end - 1  # Convert to 0-based indexing
                )
                cleaned_sections.append({
                    "title": section_title,
                    "description": "Additional content",
                    "start_node": start,
                    "end_node": end,
                    "importance": "supporting"
                })
                
                i += 1
        
        # Sort sections by start_node
        cleaned_sections.sort(key=lambda x: x["start_node"])
        
        return {
            "title": toc_data.get("title", "Table of Contents"),
            "sections": cleaned_sections
        }
    
    def _create_fallback_toc(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a basic fallback TOC if OpenAI fails"""
        
        total_nodes = len(nodes)
        sections_count = min(4, max(2, total_nodes // 3))  # 2-4 sections
        nodes_per_section = total_nodes // sections_count
        
        sections = []
        
        for i in range(sections_count):
            start = i * nodes_per_section + 1
            if i == sections_count - 1:  # Last section gets remaining nodes
                end = total_nodes
            else:
                end = (i + 1) * nodes_per_section
            
            # Generate meaningful title from node content
            section_title = self._generate_section_title_from_nodes(
                nodes, start - 1, end - 1  # Convert to 0-based indexing
            )
            sections.append({
                "title": section_title,
                "description": f"Content from nodes {start} to {end}",
                "start_node": start,
                "end_node": end,
                "importance": "primary" if i < 2 else "secondary"
            })
        
        return {
            "title": "Table of Contents",
            "sections": sections
        }
    
    def _generate_section_title_from_nodes(self, nodes: List[Dict[str, Any]], start_idx: int, end_idx: int) -> str:
        """Generate a meaningful section title from node content"""
        try:
            # Extract key content from the first node in the range
            first_node = nodes[start_idx]
            content = first_node['content'][:200]  # First 200 chars
            
            # Simple heuristics to extract a title
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                # Look for markdown headers
                if line.startswith('#'):
                    return line.replace('#', '').strip()
                # Look for lines that seem like titles (short, capitalized)
                if len(line) < 60 and len(line) > 10 and line[0].isupper():
                    return line
            
            # Extract first few words as fallback
            words = content.split()[:4]
            if words:
                title = ' '.join(words)
                # Clean up common markdown/formatting
                title = title.replace('*', '').replace('_', '').replace('`', '')
                return title.strip()
            
            # Final fallback
            node_range = f"Nodes {start_idx + 1}" if start_idx == end_idx else f"Nodes {start_idx + 1}-{end_idx + 1}"
            return f"Content ({node_range})"
            
        except (IndexError, KeyError):
            # Safety fallback
            node_range = f"Nodes {start_idx + 1}" if start_idx == end_idx else f"Nodes {start_idx + 1}-{end_idx + 1}"
            return f"Section ({node_range})"


# Global instance
toc_service = OpenAITOCService()