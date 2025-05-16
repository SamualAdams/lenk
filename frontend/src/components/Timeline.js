// Refactored for clarity: drawing logic split into helpers.
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
    color = "#888";
  }
  return color;
}

// Helper: Draw a node block
function drawNodeBlock(ctx, x, blockY, blockWidth, blockHeight, color, borderColor, isCurrent) {
  ctx.fillStyle = color;
  ctx.fillRect(x, blockY, blockWidth, blockHeight);
  if (isCurrent) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, blockY, blockWidth, blockHeight);
  }
}

// Helper: Draw synthesis tab
function drawSynthesisTab(ctx, x, tabY, blockWidth, tabHeight, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, tabY, blockWidth, tabHeight);
}

// Helper: Draw copy bars
function drawCopyBars(ctx, barX, blockY, barHeight, copyBarGap, copyBarWidth, copiedBar, colors) {
  const barLabels = ['node', 'both', 'synthesis'];
  const barColors = [
    copiedBar === 'node' ? colors.copyBarActive : colors.copyBarInactive,
    copiedBar === 'both' ? colors.copyBarActive : colors.copyBarInactive,
    copiedBar === 'synthesis' ? colors.copyBarActive : colors.copyBarInactive
  ];
  barLabels.forEach((type, idx) => {
    const yPos = blockY + idx * (barHeight + copyBarGap);
    ctx.fillStyle = barColors[idx];
    ctx.fillRect(barX, yPos, copyBarWidth, barHeight);
  });
}

function Timeline({ nodes, currentIndex, onClick, selectedIndices }) {
  const [copiedBar, setCopiedBar] = useState(null); // 'node', 'synthesis', 'both'

  const canvasRef = useRef(null);
  
  // Constants
  const PADDING = 4;
  const MIN_BLOCK = 10;
  const COPY_AREA = 50;
  const COPY_BAR_WIDTH = 35; // Slightly reduced width for better appearance
  const COPY_BAR_GAP = 4;
  
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
    textLight: "#ffffff",
    copyBarActive: "#4CAF50",  // Green for active copy bar
    copyBarInactive: "#888888" // Gray for inactive copy bar
  };
  
  // Memoize total character count calculation
  const totalChars = useMemo(() => {
    return nodes.reduce((sum, node) => sum + (node.character_count || 1), 0) || nodes.length;
  }, [nodes]);
  
  const handleCopyAction = (type) => {
    // bundle text based on selection (assumes selectedIndices and nodes exist)
    const idxs = Array.from(selectedIndices || []);
    let text = '';
    if (type === 'both') {
      text = idxs.map(i => {
        const n = nodes[i] || {};
        return `${n.content || ''}\n${n.synthesis?.content || ''}`;
      }).join('\n---\n');
    } else {
      text = idxs.map(i => {
        const n = nodes[i] || {};
        if (type === 'node') return n.content || '';
        if (type === 'synthesis') return n.synthesis?.content || '';
        return '';
      }).join('\n\n');
    }
    navigator.clipboard.writeText(text);
    setCopiedBar(type);
    setTimeout(() => setCopiedBar(null), 1000);
  };

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
    
    // Clear canvas with transparent background
    ctx.clearRect(0, 0, width, height);
    
    // Timeline configuration
    const tabHeight = 5;
    const tabYOffset = 3;
    const blockY = 8;
    const blockHeight = height - (tabHeight + tabYOffset + 6);
    
    // Available width for timeline blocks (excluding copy bar area)
    const timelineWidth = width - COPY_AREA;
    
    let x = PADDING;
    // Draw node blocks using helpers
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const blockWidth = getBlockWidth(
        node,
        totalChars,
        timelineWidth,
        nodes.length,
        PADDING,
        MIN_BLOCK
      );
      const color = getBlockColor(i, node, currentIndex, colors, selectedIndices);
      const isCurrent = i === currentIndex;
      drawNodeBlock(ctx, x, blockY, blockWidth, blockHeight, color, colors.border, isCurrent);
      // Draw synthesis tab if node has synthesis
      if (node.synthesis && node.synthesis.content) {
        const tabY = blockY + blockHeight + tabYOffset;
        drawSynthesisTab(ctx, x, tabY, blockWidth, tabHeight, colors.synthesis_tab);
      }
      x += blockWidth + PADDING;
    }
    // Draw copy bars column at right end using helper
    const barHeight = blockHeight / 4;
    const barX = timelineWidth + 10;
    drawCopyBars(ctx, barX, blockY, barHeight, COPY_BAR_GAP, COPY_BAR_WIDTH, copiedBar, colors);
  }, [nodes, currentIndex, selectedIndices, colors, copiedBar, totalChars]);
  
  useEffect(() => {
    drawTimeline();
    
    // Improved debounced resize handler for responsive canvas
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
    
    const tabHeight = 5;
    const tabYOffset = 3;
    const blockHeight = rect.height - (tabHeight + tabYOffset + 6);
    const blockY = 8;
    const barHeight = blockHeight / 4;
    
    // Check if click is in copy-bar region first
    if (clickX > width - COPY_AREA) {
      const localY = e.clientY - rect.top;
      for (let idx = 0; idx < 3; idx++) {
        const yPos = blockY + idx * (barHeight + COPY_BAR_GAP);
        if (localY >= yPos && localY < yPos + barHeight) {
          handleCopyAction(['node','both','synthesis'][idx]);
          return;
        }
      }
    }
    
    // Otherwise check if click is on a node
    let x = PADDING;
    const timelineWidth = width - COPY_AREA;
    
    for (let i = 0; i < nodes.length; i++) {
      const blockWidth = Math.max(
        MIN_BLOCK,
        (nodes[i].character_count || 1) / totalChars * (timelineWidth - (nodes.length + 1) * PADDING)
      );
      
      if (x <= clickX && clickX < x + blockWidth) {
        onClick(i, e);
        return;
      }
      
      x += blockWidth + PADDING;
    }
    
    // If click is beyond all blocks but before copy bars, select last node
    if (clickX < width - COPY_AREA) {
      onClick(nodes.length - 1, e);
    }
  };
  
  return (
    <div className="timeline-container">
      <canvas 
        ref={canvasRef} 
        className="timeline-canvas"
        onClick={handleClick}
        title="Click to navigate between nodes or use copy bars on the right"
      />
    </div>
  );
}

export default Timeline;