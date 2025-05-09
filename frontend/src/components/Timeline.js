import React, { useEffect, useRef, useCallback } from 'react';
import './Timeline.css';

function Timeline({ nodes, currentIndex, onClick }) {
  const canvasRef = useRef(null);
  
  // Dark mode color palette
  const colors = {
    normal: "#555555",
    current: "#5f9eff",
    illuminated: "#f1c232",
    current_illuminated: "#e69138",
    border: "#333333",
    bg: "#161616",
    synthesis_tab: "#5f7fbf",
    text: "#e0e0e0",
    textLight: "#ffffff"
  };
  
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes || nodes.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Update canvas size to match container
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    
    // Calculate total character count (or use fixed width if no character count)
    const totalChars = nodes.reduce((sum, node) => sum + (node.character_count || 1), 0) || nodes.length;
    
    const padding = 4;
    const minWidth = 10;
    const blockHeight = height - 10; // Leave space for synthesis tab
    const blockY = 8; // Position blocks lower to make room for synthesis tab
    const tabHeight = 5;
    const tabYOffset = 3;
    const cornerRadius = 4; // Rounded corners for blocks
    
    let x = padding;
    
    // Draw node blocks
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const blockWidth = Math.max(
        minWidth,
        (node.character_count || 1) / totalChars * (width - (nodes.length + 1) * padding)
      );
      
      const hasSynthesis = node.synthesis && node.synthesis.content;
      const isIlluminated = node.is_illuminated;
      
      // Determine block color based on state
      let color;
      if (i === currentIndex) {
        color = isIlluminated ? colors.current_illuminated : colors.current;
      } else {
        color = isIlluminated ? colors.illuminated : colors.normal;
      }
      
      // Draw main block as a simple rectangle (no rounded corners)
      ctx.fillStyle = color;
      ctx.fillRect(x, blockY, blockWidth, blockHeight);
      
      // Draw subtle border
      if (i === currentIndex) {
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      
      // Draw synthesis tab if node has synthesis
      if (hasSynthesis) {
        const tabX = x;
        const tabY = blockY - tabHeight - tabYOffset;
        ctx.fillStyle = colors.synthesis_tab;
        ctx.fillRect(tabX, tabY, blockWidth, tabHeight);
      }
      
      // Add node number for larger blocks
      if (blockWidth > 20) {
        ctx.fillStyle = colors.text;
        ctx.font = "8px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
      }
      
      x += blockWidth + padding;
    }
  }, [nodes, currentIndex, colors]);
  
  useEffect(() => {
    drawTimeline();
    
    // Add resize listener for responsive canvas
    window.addEventListener('resize', drawTimeline);
    return () => window.removeEventListener('resize', drawTimeline);
  }, [nodes, currentIndex, drawTimeline]);
  
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes || nodes.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = canvas.clientWidth;
    
    const totalChars = nodes.reduce((sum, node) => sum + (node.character_count || 1), 0) || nodes.length;
    const padding = 4;
    const minWidth = 10;
    
    let x = padding;
    
    for (let i = 0; i < nodes.length; i++) {
      const blockWidth = Math.max(
        minWidth,
        (nodes[i].character_count || 1) / totalChars * (width - (nodes.length + 1) * padding)
      );
      
      if (x <= clickX && clickX < x + blockWidth) {
        onClick(i);
        return;
      }
      
      x += blockWidth + padding;
    }
    
    // If click is beyond all blocks, select last node
    onClick(nodes.length - 1);
  };
  
  return (
    <div className="timeline-container">
      <canvas 
        ref={canvasRef} 
        className="timeline-canvas"
        onClick={handleClick}
        title="Click to navigate between nodes"
      />
    </div>
  );
}

export default Timeline;