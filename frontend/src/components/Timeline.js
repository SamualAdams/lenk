import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './Timeline.css';

// Helper: Calculate block width for a node
function getBlockWidth(node, totalChars, timelineWidth, nodesLength, padding, minBlock) {
  return Math.max(
    minBlock,
    ((node.character_count || 1) / totalChars) * (timelineWidth - (nodesLength + 1) * padding)
  );
}

// Helper: Determine color for a node block
function getBlockColor(i, node, currentIndex, colors, selectedIndices) {
  const isIlluminated = node.is_illuminated;
  let color;
  
  if (i === currentIndex) {
    color = isIlluminated ? colors.current_illuminated : colors.current;
  } else {
    color = isIlluminated ? colors.illuminated : colors.normal;
  }
  
  const isSelected = selectedIndices?.has(i);
  if (isSelected) {
    color = colors.selected;
  }
  
  return color;
}

// Helper: Draw a node block
function drawNodeBlock(ctx, x, blockY, blockWidth, blockHeight, color, borderColor, isCurrent) {
  ctx.fillStyle = color;
  ctx.fillRect(x, blockY, blockWidth, blockHeight);
  
  if (isCurrent) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, blockY, blockWidth, blockHeight);
  }
}

// Helper: Draw synthesis tab
function drawSynthesisTab(ctx, x, tabY, blockWidth, tabHeight, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, tabY, blockWidth, tabHeight);
}

function Timeline({ nodes, currentIndex, onClick, selectedIndices }) {
  const canvasRef = useRef(null);
  
  // Constants
  const PADDING = 4;
  const MIN_BLOCK = 8;
  
  // Dark mode color palette
  const colors = {
    normal: "#444444",
    current: "#5f9eff",
    illuminated: "#f1c232",
    current_illuminated: "#e69138",
    selected: "#888888",
    border: "#ffffff",
    bg: "#222222",
    synthesis_tab: "#5f7fbf",
    text: "#e0e0e0"
  };
  
  // Memoize total character count calculation
  const totalChars = useMemo(() => {
    return nodes.reduce((sum, node) => sum + (node.character_count || 1), 0) || nodes.length;
  }, [nodes]);
  
  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes || nodes.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    
    // Handle high DPI displays for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size with DPI adjustment
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Scale context for high DPI
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas with backgroundstill
    // ctx.fillStyle = colors.bg;
    // ctx.fillRect(0, 0, width, height);
    
    // Timeline configuration
    const tabHeight = 4;
    const tabYOffset = 2;
    const blockY = 6;
    const blockHeight = height - (tabHeight + tabYOffset + 8);
    
    let x = PADDING;
    
    // Draw node blocks using helpers
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const blockWidth = getBlockWidth(
        node,
        totalChars,
        width,
        nodes.length,
        PADDING,
        MIN_BLOCK
      );
      
      const color = getBlockColor(i, node, currentIndex, colors, selectedIndices);
      const isCurrent = i === currentIndex;
      
      // Draw node block
      drawNodeBlock(ctx, x, blockY, blockWidth, blockHeight, color, colors.border, isCurrent);
      
      // Draw synthesis tab if node has synthesis
      if (node.synthesis && node.synthesis.content) {
        const tabY = blockY + blockHeight + tabYOffset;
        drawSynthesisTab(ctx, x, tabY, blockWidth, tabHeight, colors.synthesis_tab);
      }
      
      x += blockWidth + PADDING;
    }
  }, [nodes, currentIndex, selectedIndices, colors, totalChars]);
  
  useEffect(() => {
    drawTimeline();
    
    // Debounced resize handler for responsive canvas
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        drawTimeline();
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [nodes, currentIndex, drawTimeline]);
  
  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes || nodes.length === 0) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    let x = PADDING;
    
    for (let i = 0; i < nodes.length; i++) {
      const blockWidth = Math.max(
        MIN_BLOCK,
        (nodes[i].character_count || 1) / totalChars * (width - (nodes.length + 1) * PADDING)
      );
      
      if (x <= clickX && clickX < x + blockWidth) {
        onClick(i, e);
        return;
      }
      
      x += blockWidth + PADDING;
    }
    
    // If click is beyond all blocks, select last node
    if (clickX < width) {
      onClick(nodes.length - 1, e);
    }
  };
  
  return (
    <div className="timeline-container">
      <canvas 
        ref={canvasRef} 
        className="timeline-canvas"
        onClick={handleClick}
        title="Click to navigate. Use Shift+Click or Ctrl+Click for multiple selection."
      />
    </div>
  );
}

export default Timeline;