import React, { useEffect, useRef, useCallback } from 'react';
import './Timeline.css';

function Timeline({ nodes, currentIndex, onClick }) {
  const canvasRef = useRef(null);
  
  const colors = {
    normal: "#cccccc",
    current: "#4a86e8",
    illuminated: "#f1c232",
    current_illuminated: "#e69138",
    border: "#333333",
    bg: "#f5f5f5",
    synthesis_tab: "#aaaaaa"
  };
  
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    // Update canvas size to match container
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    
    // Calculate total character count
    const totalChars = nodes.reduce((sum, node) => sum + node.character_count, 0);
    if (totalChars === 0) return;
    
    const padding = 2;
    const minWidth = 5;
    const normalTop = 15;
    const tabHeight = 6;
    let x = 0;
    
    // Draw node blocks
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const blockWidth = Math.max(
        minWidth,
        (node.character_count / totalChars) * (width - nodes.length * padding)
      );
      
      const hasSynthesis = node.synthesis && node.synthesis.content;
      const isIlluminated = node.is_illuminated;
      
      // Set color based on state
      let color;
      if (i === currentIndex) {
        color = isIlluminated ? colors.current_illuminated : colors.current;
      } else {
        color = isIlluminated ? colors.illuminated : colors.normal;
      }
      
      // Set y position - blocks with synthesis start higher
      const yStart = hasSynthesis ? 2 : normalTop;
      
      // Draw block
      ctx.fillStyle = color;
      ctx.strokeStyle = colors.border;
      ctx.fillRect(x, yStart, blockWidth, height - 4);
      ctx.strokeRect(x, yStart, blockWidth, height - 4);
      
      // Draw synthesis tab if needed
      if (hasSynthesis) {
        const tabWidth = Math.min(blockWidth - 2, 15);
        ctx.fillRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
        ctx.strokeRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
      }
      
      // Add node number if block is wide enough
      if (blockWidth > 20) {
        ctx.fillStyle = "#000000";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((i + 1).toString(), x + blockWidth / 2, height / 2);
      }
      
      x += blockWidth + padding;
    }
  }, [nodes, currentIndex, colors]);
  
  useEffect(() => {
    drawTimeline();
    
    // Add resize listener
    window.addEventListener('resize', drawTimeline);
    return () => window.removeEventListener('resize', drawTimeline);
  }, [nodes, currentIndex, drawTimeline]);
  
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = canvas.clientWidth;
    
    const totalChars = nodes.reduce((sum, node) => sum + node.character_count, 0);
    const padding = 2;
    const minWidth = 5;
    
    let cumulativeX = 0;
    
    for (let i = 0; i < nodes.length; i++) {
      const blockWidth = Math.max(
        minWidth,
        (nodes[i].character_count / totalChars) * (width - nodes.length * padding)
      );
      
      if (cumulativeX <= x && x < cumulativeX + blockWidth) {
        onClick(i);
        return;
      }
      
      cumulativeX += blockWidth + padding;
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
      />
    </div>
  );
}

export default Timeline;