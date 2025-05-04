import './ReadingMode.css';


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../axiosConfig';

// Timeline component embedded directly for simplicity
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
    const totalChars = nodes.reduce((sum, node) => sum + node.character_count, 0) || nodes.length;
    
    const padding = 2;
    const minWidth = 10;
    const normalTop = 10;
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
        const tabWidth = Math.min(blockWidth - 2, 12);
        ctx.fillRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
        ctx.strokeRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
      }
      
      // Add node number if block is wide enough
      if (blockWidth > 20) {
        ctx.fillStyle = "#000000";
        ctx.font = "12px Inter, sans-serif";
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
    
    const totalChars = nodes.reduce((sum, node) => sum + node.character_count, 0) || nodes.length;
    const padding = 2;
    const minWidth = 10;
    
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

function ReadingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [cognition, setCognition] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [synthesis, setSynthesis] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoplayActive, setAutoplayActive] = useState(false);
  const [presetCategories, setPresetCategories] = useState({});
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  
  const synthesisRef = useRef(null);
  const containerRef = useRef(null);
  const speechSynthesis = window.speechSynthesis;
  const speechUtterance = useRef(null);
  
  // Fetch cognition and nodes
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get(`/cognitions/${id}/`);
      console.log('Cognition data:', response.data);
      setCognition(response.data);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cognition:', error);
      setError('Failed to load cognition data. Please try again.');
      setIsLoading(false);
    }
  }, [id]);
  
  // Fetch preset responses
  const fetchPresetResponses = useCallback(async () => {
    try {
      setError(null);
      const response = await axiosInstance.get('/preset-responses/by_category/');
      console.log('Preset responses:', response.data);
      setPresetCategories(response.data);
    } catch (error) {
      console.error('Error fetching preset responses:', error);
      setError('Failed to load preset responses.');
    }
  }, []);
  
  // Save synthesis for a node
  const saveSynthesis = useCallback(async (nodeIndex) => {
    if (nodeIndex < 0 || nodeIndex >= nodes.length) return;
    
    const node = nodes[nodeIndex];
    
    try {
      console.log('Saving synthesis for node:', node.id, 'Content:', synthesis);
      setStatus('Saving synthesis...');
      await axiosInstance.post('/syntheses/add_or_update/', {
        node_id: node.id,
        content: synthesis
      });
      setStatus('Synthesis saved');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      console.error('Error saving synthesis:', error);
      setError('Failed to save your synthesis. Please try again.');
    }
  }, [nodes, synthesis]);
  
  // Initial data loading
  useEffect(() => {
    fetchCognition();
    fetchPresetResponses();
  }, [fetchCognition, fetchPresetResponses]);
  
  // Save synthesis when navigating away from a node
  const lastNodeIndexRef = useRef(-1);
  useEffect(() => {
    // Save synthesis of last node
    if (lastNodeIndexRef.current >= 0 && lastNodeIndexRef.current < nodes.length) {
      saveSynthesis(lastNodeIndexRef.current);
    }
    
    // Update lastNodeIndexRef with current node
    lastNodeIndexRef.current = currentNodeIndex;
    
    // Load synthesis for current node
    if (nodes[currentNodeIndex]?.synthesis) {
      setSynthesis(nodes[currentNodeIndex].synthesis.content || '');
    } else {
      setSynthesis('');
    }
  }, [currentNodeIndex, nodes, saveSynthesis]);
  
  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in a text field
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          goToPreviousNode();
          break;
        case 'ArrowRight':
          goToNextNode();
          break;
        case 'ArrowUp':
          readCurrentNode();
          break;
        case 'ArrowDown':
          stopSpeech();
          setAutoplayActive(false);
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentNodeIndex, nodes.length, isSpeaking, autoplayActive]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Toggle node illumination
  const toggleIllumination = async () => {
    if (nodes.length === 0 || currentNodeIndex >= nodes.length) return;
    
    try {
      const node = nodes[currentNodeIndex];
      const response = await axiosInstance.post(`/nodes/${node.id}/toggle_illumination/`);
      
      // Update nodes array with the updated node
      const updatedNodes = [...nodes];
      updatedNodes[currentNodeIndex] = {
        ...node,
        is_illuminated: response.data.is_illuminated
      };
      setNodes(updatedNodes);
    } catch (error) {
      console.error('Error toggling illumination:', error);
      setError('Failed to toggle illumination. Please try again.');
    }
  };
  
  // Navigation functions
  const goToNextNode = () => {
    stopSpeech();
    
    if (currentNodeIndex < nodes.length - 1) {
      setCurrentNodeIndex(prevIndex => prevIndex + 1);
      
      // Auto-read if not in autoplay (autoplay handles reading)
      if (!autoplayActive) {
        setTimeout(() => readCurrentNode(), 100);
      }
    }
  };
  
  const goToPreviousNode = () => {
    stopSpeech();
    setAutoplayActive(false);
    
    if (currentNodeIndex > 0) {
      setCurrentNodeIndex(prevIndex => prevIndex - 1);
      setTimeout(() => readCurrentNode(), 100);
    }
  };
  
  // Speech functions
  const readCurrentNode = () => {
    if (isSpeaking) return;
    
    const node = nodes[currentNodeIndex];
    if (!node) return;
    
    const cleanText = cleanTextForSpeech(node.content);
    
    // Create a new utterance
    speechUtterance.current = new SpeechSynthesisUtterance(cleanText);
    speechUtterance.current.rate = 1.1; // Slightly faster than normal
    
    // Set up event handlers
    speechUtterance.current.onstart = () => {
      setIsSpeaking(true);
      setStatus('Reading...');
    };
    
    speechUtterance.current.onend = () => {
      setIsSpeaking(false);
      setStatus('');
      
      // If autoplay is active, move to next node
      if (autoplayActive) {
        setTimeout(() => {
          if (currentNodeIndex < nodes.length - 1) {
            goToNextNode();
          } else {
            setAutoplayActive(false);
          }
        }, 500);
      }
    };
    
    // Start speaking
    speechSynthesis.speak(speechUtterance.current);
  };
  
  const stopSpeech = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setStatus('');
  };
  
  const cleanTextForSpeech = (text) => {
    // Remove markdown and special characters - fixed escape
    let cleaned = text.replace(/[#*_`~+=[\]{}()<>|\\/@%^&$]/g, ' ');
    // Normalize whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };
  
  const toggleAutoplay = () => {
    if (autoplayActive) {
      setAutoplayActive(false);
      stopSpeech();
    } else {
      setAutoplayActive(true);
      readCurrentNode();
    }
  };
  
  const handleReturnHome = () => {
    // Save current synthesis before leaving
    saveSynthesis(currentNodeIndex);
    stopSpeech();
    navigate('/');
  };
  
  const handleTimelineClick = (index) => {
    // Save current synthesis before navigating
    saveSynthesis(currentNodeIndex);
    stopSpeech();
    setCurrentNodeIndex(index);
  };
  
  const handleSynthesisChange = (e) => {
    setSynthesis(e.target.value);
  };
  
  // Preset response handling
  const addPresetResponse = async (presetId) => {
    if (!presetId || presetId === '') return;
    
    try {
      setError(null);
      setStatus('Adding preset response...');
      console.log('Adding preset response:', presetId);
      
      // Create a synthesis first if it doesn't exist
      if (!nodes[currentNodeIndex]?.synthesis?.id) {
        console.log('Creating synthesis first for node:', nodes[currentNodeIndex].id);
        const synthResponse = await axiosInstance.post('/syntheses/add_or_update/', {
          node_id: nodes[currentNodeIndex].id,
          content: synthesis
        });
        console.log('Synthesis created:', synthResponse.data);
      }
      
      // Now get fresh data to ensure we have the synthesis ID
      await fetchCognition();
      
      // Get the synthesis ID from the updated data
      const synthId = nodes[currentNodeIndex]?.synthesis?.id;
      if (!synthId) {
        console.error('No synthesis ID available after creation');
        setError('Failed to add preset response. Please try again.');
        return;
      }
      
      // Add the preset to the synthesis
      console.log('Adding preset to synthesis:', synthId, presetId);
      const response = await axiosInstance.post(`/syntheses/${synthId}/add_preset/`, {
        preset_id: presetId
      });
      console.log('Preset added response:', response.data);
      
      // Refresh to show updated synthesis
      await fetchCognition();
      setStatus('Preset response added');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      console.error('Error adding preset response:', error);
      setError('Failed to add preset response. Please try again.');
      setStatus('');
    }
  };
  
  if (isLoading) {
    return <div className="reading-mode-loading">Loading cognition...</div>;
  }
  
  if (!cognition) {
    return <div className="reading-mode-error">Could not load cognition.</div>;
  }
  
  const currentNode = nodes[currentNodeIndex] || null;
  
  return (
    <div className="reading-mode-container" ref={containerRef}>
      <header className="reading-mode-header">
        <h1>{cognition.title}</h1>
      </header>
      
      <div className="reading-mode-split-layout">
        {/* Left Side - Controls and Synthesis */}
        <div className="reading-mode-controls-panel">
          <div className="node-navigation">
            <h2>Navigation</h2>
            <div className="node-position">
              Node {currentNodeIndex + 1} of {nodes.length}
            </div>
            
            <div className="navigation-controls">
              <button 
                onClick={goToPreviousNode}
                disabled={currentNodeIndex <= 0 || isLoading}
                className="nav-btn"
                title="Previous Node (Left Arrow)"
              >
                &larr; Previous
              </button>
              <button 
                onClick={goToNextNode}
                disabled={currentNodeIndex >= nodes.length - 1 || isLoading}
                className="nav-btn"
                title="Next Node (Right Arrow)"
              >
                Next &rarr;
              </button>
            </div>
            
            <div className="timeline-wrapper">
              <h3>Document Timeline</h3>
              <Timeline 
                nodes={nodes} 
                currentIndex={currentNodeIndex}
                onClick={handleTimelineClick} 
              />
            </div>
            
            <div className="playback-controls">
              <button 
                onClick={readCurrentNode} 
                disabled={isSpeaking || isLoading}
                className="control-btn"
                title="Read Aloud (Up Arrow)"
              >
                🔊 Read
              </button>
              <button 
                onClick={stopSpeech}
                disabled={!isSpeaking}
                className="control-btn"
                title="Stop Reading (Down Arrow)"
              >
                🔇 Stop
              </button>
              <button 
                onClick={toggleAutoplay}
                disabled={isLoading}
                className={`control-btn ${autoplayActive ? 'active' : ''}`}
                title="Toggle Autoplay"
              >
                {autoplayActive ? '⏹ Stop Autoplay' : '▶ Start Autoplay'}
              </button>
            </div>
            
            <div className="node-actions">
              <button 
                onClick={toggleIllumination}
                disabled={isLoading}
                className={`control-btn ${currentNode?.is_illuminated ? 'active' : ''}`}
                title="Toggle Illumination"
              >
                {currentNode?.is_illuminated ? '★ Marked' : '☆ Mark as Important'}
              </button>
              <button 
                onClick={handleReturnHome}
                className="control-btn home-btn"
                title="Return to Home"
              >
                Home
              </button>
            </div>
            
            {status && <div className="status-message">{status}</div>}
            {error && <div className="error-message">{error}</div>}
            
            <div className="keyboard-shortcuts">
              <h3>Keyboard Shortcuts</h3>
              <ul>
                <li>← Previous Node</li>
                <li>→ Next Node</li>
                <li>↑ Read Aloud</li>
                <li>↓ Stop Reading</li>
              </ul>
            </div>
          </div>
          
          <div className="synthesis-section">
            <h2>Your Synthesis</h2>
            <textarea
              ref={synthesisRef}
              className="synthesis-textarea"
              value={synthesis}
              onChange={handleSynthesisChange}
              placeholder="Enter your synthesis here..."
            />
            
            <div className="preset-responses">
              <h3>Preset Responses</h3>
              <select 
                onChange={(e) => {
                  if (e.target.value) {
                    addPresetResponse(e.target.value);
                    e.target.value = ''; // Reset select after use
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>Add a preset response...</option>
                {Object.entries(presetCategories).map(([category, presets]) => (
                  <optgroup key={category} label={category}>
                    {presets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Right Side - Content Display */}
        <div className="reading-mode-content-panel">
          <div className="node-container">
            <div className="node-content">
              {currentNode ? currentNode.content : 'No content available'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReadingMode;