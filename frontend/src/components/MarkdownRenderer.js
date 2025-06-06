import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for better formatting
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false, // Don't add IDs to headers
  mangle: false // Don't mangle autolinks
});

const MarkdownRenderer = ({ content, className = '' }) => {
  if (!content) return null;

  // Convert markdown to HTML
  const rawMarkup = marked(content);
  
  // Sanitize the HTML to prevent XSS attacks
  const cleanMarkup = DOMPurify.sanitize(rawMarkup, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
  });

  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanMarkup }}
      style={{
        lineHeight: '1.6',
        // Markdown-specific styling
        '--markdown-spacing': '0.5rem'
      }}
    />
  );
};

export default MarkdownRenderer;
