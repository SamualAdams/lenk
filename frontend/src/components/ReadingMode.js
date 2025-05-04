import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import './ReadingMode.css';

// Timeline component embedded directly for simplicity
function Timeline({ nodes, currentIndex, onClick }) {
  const canvasRef = useRef(null);
  
  const colors = {
    normal: "#cccccc",
    current: "#4a86e8",
    illuminated: "#f1c232",
    current_illuminated: "#e69138",
    border: "#dddddd",
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
    const normalTop = 5;
    const tabHeight = 3;
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
      const yStart = hasSynthesis ? 1 : normalTop;
      
      // Draw block
      ctx.fillStyle = color;
      ctx.strokeStyle = colors.border;
      ctx.fillRect(x, yStart, blockWidth, height - 2);
      ctx.strokeRect(x, yStart, blockWidth, height - 2);
      
      // Draw synthesis tab if needed
      if (hasSynthesis) {
        const tabWidth = Math.min(blockWidth - 2, 8);
        ctx.fillRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
        ctx.strokeRect(x + (blockWidth - tabWidth) / 2, yStart - tabHeight, tabWidth, tabHeight);
      }
      
      // Add node number if block is wide enough
      if (blockWidth > 20) {
        ctx.fillStyle = "#000000";
        ctx.font = "8px Inter, sans-serif";
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
  
  const synthesisRef = useRef(null);
  
  // Fetch cognition and nodes
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get(`/cognitions/${id}/`);
      setCognition(response.data);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cognition:', error);
      setError('Failed to load cognition data');
      setIsLoading(false);
    }
  }, [id]);
  
  // Fetch preset responses
  const fetchPresetResponses = useCallback(async () => {
    try {
      setError(null);
      const response = await axiosInstance.get('/preset-responses/by_category/');
      setPresetCategories(response.data);
    } catch (error) {
      console.error('Error fetching preset responses:', error);
    }
  }, []);
  
  // Save synthesis for a node
  const saveSynthesis = useCallback(async (nodeIndex) => {
    if (nodeIndex < 0 || nodeIndex >= nodes.length) return;
    
    const node = nodes[nodeIndex];
    
    try {
      await axiosInstance.post('/syntheses/add_or_update/', {
        node_id: node.id,
        content: synthesis
      });
    } catch (error) {
      console.error('Error saving synthesis:', error);
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
  
  // Simple speech synthesis functions
  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setAutoplayActive(false);
    }
  };
  
  const readText = (text) => {
    if (!window.speechSynthesis) {
      console.error("Speech synthesis not supported");
      return;
    }
    
    // Cancel any ongoing speech
    stopSpeech();
    
    // Create a new utterance with the text
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set event handlers
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      
      // If autoplay is active and not at the last node, go to next node
      if (autoplayActive && currentNodeIndex < nodes.length - 1) {
        setTimeout(() => {
          setCurrentNodeIndex(prevIndex => prevIndex + 1);
        }, 500);
      } else {
        setAutoplayActive(false);
      }
    };
    
    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsSpeaking(false);
      setAutoplayActive(false);
    };
    
    // Start speaking
    window.speechSynthesis.speak(utterance);
  };
  
  // Read the current node
  const readCurrentNode = () => {
    if (currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      const nodeText = nodes[currentNodeIndex].content || '';
      
      // Clean up text before reading
      const cleanText = nodeText
        .replace(/[#*_`~+=[\]{}()<>|\\/@%^&$]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      readText(cleanText);
    }
  };
  
  // Effect to auto-read when autoplay is turned on or node changes during autoplay
  useEffect(() => {
    if (autoplayActive && !isSpeaking && nodes.length > 0) {
      readCurrentNode();
    }
  }, [autoplayActive, currentNodeIndex, nodes, isSpeaking]);
  
  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in a text field
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentNodeIndex > 0) {
            stopSpeech();
            setCurrentNodeIndex(prevIndex => prevIndex - 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentNodeIndex < nodes.length - 1) {
            stopSpeech();
            setCurrentNodeIndex(prevIndex => prevIndex + 1);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          readCurrentNode();
          break;
        case 'ArrowDown':
          e.preventDefault();
          stopSpeech();
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentNodeIndex, nodes.length]);
  
  // Navigation functions
  const goToNextNode = () => {
    if (currentNodeIndex < nodes.length - 1) {
      stopSpeech();
      setCurrentNodeIndex(prevIndex => prevIndex + 1);
    }
  };
  
  const goToPreviousNode = () => {
    if (currentNodeIndex > 0) {
      stopSpeech();
      setCurrentNodeIndex(prevIndex => prevIndex - 1);
    }
  };
  
  // Toggle autoplay
  const toggleAutoplay = () => {
    if (autoplayActive) {
      stopSpeech();
    } else {
      setAutoplayActive(true);
      readCurrentNode();
    }
  };
  
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
      
      // Create a synthesis first if it doesn't exist
      if (!nodes[currentNodeIndex]?.synthesis?.id) {
        await axiosInstance.post('/syntheses/add_or_update/', {
          node_id: nodes[currentNodeIndex].id,
          content: synthesis
        });
      }
      
      // Now get fresh data to ensure we have the synthesis ID
      await fetchCognition();
      
      // Get the synthesis ID from the updated data
      const synthId = nodes[currentNodeIndex]?.synthesis?.id;
      if (!synthId) {
        console.error('No synthesis ID available after creation');
        return;
      }
      
      // Add the preset to the synthesis
      await axiosInstance.post(`/syntheses/${synthId}/add_preset/`, {
        preset_id: presetId
      });
      
      // Refresh to show updated synthesis
      await fetchCognition();
    } catch (error) {
      console.error('Error adding preset response:', error);
    }
  };
  
  if (isLoading) {
    return <div className="reading-mode-loading">Loading...</div>;
  }
  
  if (!cognition) {
    return <div className="reading-mode-error">Could not load cognition</div>;
  }
  
  const currentNode = nodes[currentNodeIndex] || null;
  
  return (
    <div className="reading-mode-container">
      <div className="reading-mode-split-layout">
        {/* Left Side - Controls and Synthesis */}
        <div className="reading-mode-controls-panel">
          <div className="node-info">
            <div className="title-row">
              <div className="cognition-title">{cognition.title}</div>
              <button onClick={handleReturnHome} className="home-btn" title="Return to Home">Home</button>
            </div>
            
            <div className="node-position">
              Node {currentNodeIndex + 1} of {nodes.length}
              {isSpeaking && <span className="reading-indicator"> (Reading...)</span>}
            </div>
            
            <div className="timeline-wrapper">
              <Timeline 
                nodes={nodes} 
                currentIndex={currentNodeIndex}
                onClick={handleTimelineClick} 
              />
            </div>
            
            <div className="navigation-controls">
              <button 
                onClick={goToPreviousNode}
                disabled={currentNodeIndex <= 0 || isLoading}
                className="nav-btn"
                title="Previous Node (Left Arrow)"
              >
                ← Prev
              </button>
              <button 
                onClick={goToNextNode}
                disabled={currentNodeIndex >= nodes.length - 1 || isLoading}
                className="nav-btn"
                title="Next Node (Right Arrow)"
              >
                Next →
              </button>
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
                {autoplayActive ? '⏹ Stop' : '▶ Play'}
              </button>
              <button 
                onClick={toggleIllumination}
                disabled={isLoading}
                className={`control-btn ${currentNode?.is_illuminated ? 'active' : ''}`}
                title="Toggle Illumination"
              >
                {currentNode?.is_illuminated ? '★' : '☆'}
              </button>
            </div>
          </div>
          
          <div className="synthesis-section">
            <textarea
              ref={synthesisRef}
              className="synthesis-textarea"
              value={synthesis}
              onChange={handleSynthesisChange}
              placeholder="Write your synthesis here..."
            />
            
            <div className="preset-responses">
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
            
            {error && <div className="error-message">{error}</div>}
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