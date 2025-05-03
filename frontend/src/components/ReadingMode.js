import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Timeline from './Timeline';

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
  
  const synthesisRef = useRef(null);
  const speechSynthesis = window.speechSynthesis;
  const speechUtterance = useRef(null);
  
  // Memoize the fetch function
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`/api/cognitions/${id}/`);
      setCognition(response.data);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cognition:', error);
      setIsLoading(false);
    }
  }, [id]);
  
  const fetchPresetResponses = useCallback(async () => {
    try {
      const response = await axios.get('/api/preset-responses/by_category/');
      setPresetCategories(response.data);
    } catch (error) {
      console.error('Error fetching preset responses:', error);
    }
  }, []);
  
  // Memoize the save function
  const saveSynthesis = useCallback(async (nodeIndex) => {
    if (nodeIndex < 0 || nodeIndex >= nodes.length) return;
    
    const node = nodes[nodeIndex];
    
    try {
      await axios.post('/api/syntheses/add_or_update/', {
        node_id: node.id,
        content: synthesis
      });
    } catch (error) {
      console.error('Error saving synthesis:', error);
    }
  }, [nodes, synthesis]);
  
  // Load cognition data
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
  
  const toggleIllumination = async () => {
    if (nodes.length === 0 || currentNodeIndex >= nodes.length) return;
    
    try {
      const node = nodes[currentNodeIndex];
      const response = await axios.post(`/api/nodes/${node.id}/toggle_illumination/`);
      
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
  
  const readCurrentNode = () => {
    if (isSpeaking) return;
    
    const node = nodes[currentNodeIndex];
    if (!node) return;
    
    const cleanText = cleanTextForSpeech(node.content);
    
    // Create a new utterance
    speechUtterance.current = new SpeechSynthesisUtterance(cleanText);
    speechUtterance.current.rate = 1.1; // Slightly faster than normal
    
    // Set up event handlers
    speechUtterance.current.onstart = () => setIsSpeaking(true);
    speechUtterance.current.onend = () => {
      setIsSpeaking(false);
      
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
  
  const addPresetResponse = async (presetId) => {
    if (!nodes[currentNodeIndex]?.synthesis?.id) {
      // Create a synthesis first
      await saveSynthesis(currentNodeIndex);
      await fetchCognition(); // Refresh to get the synthesis ID
    }
    
    const synthId = nodes[currentNodeIndex]?.synthesis?.id;
    if (!synthId) return;
    
    try {
      await axios.post(`/api/syntheses/${synthId}/add_preset/`, {
        preset_id: presetId
      });
      // Refresh to show updated synthesis
      fetchCognition();
    } catch (error) {
      console.error('Error adding preset response:', error);
    }
  };
  
  if (isLoading) {
    return <div className="loading">Loading cognition...</div>;
  }
  
  if (!cognition) {
    return <div className="error">Could not load cognition.</div>;
  }
  
  const currentNode = nodes[currentNodeIndex] || null;
  
  return (
    <div className="reading-mode">
      <h1>{cognition.title}</h1>
      
      <div className="node-container">
        <h2>Node {currentNodeIndex + 1} of {nodes.length}</h2>
        <div className="node-content">
          {currentNode ? currentNode.content : 'No content available'}
        </div>
      </div>
      
      <Timeline 
        nodes={nodes} 
        currentIndex={currentNodeIndex}
        onClick={handleTimelineClick} 
      />
      
      <div className="synthesis-container">
        <h2>Your Synthesis</h2>
        <textarea
          ref={synthesisRef}
          className="synthesis-textarea"
          value={synthesis}
          onChange={(e) => setSynthesis(e.target.value)}
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
      
      <div className="controls">
        <button 
          onClick={goToPreviousNode}
          disabled={currentNodeIndex <= 0}
        >
          &larr; Back
        </button>
        <button onClick={readCurrentNode} disabled={isSpeaking}>
          🔊 Read
        </button>
        <button 
          onClick={goToNextNode}
          disabled={currentNodeIndex >= nodes.length - 1}
        >
          Next &rarr;
        </button>
        <button onClick={toggleAutoplay}>
          {autoplayActive ? '⏹ Stop' : '▶ Play'}
        </button>
        <button onClick={toggleIllumination}>
          {currentNode?.is_illuminated ? '★ Unilluminate' : '☆ Illuminate'}
        </button>
        <button onClick={handleReturnHome}>Home</button>
      </div>
      
      <div className="shortcuts">
        <p>Shortcuts: ←Back | ↑Read | →Next</p>
      </div>
    </div>
  );
}

export default ReadingMode;