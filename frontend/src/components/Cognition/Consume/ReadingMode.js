import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { FaStar, FaRegStar, FaEdit, FaSpinner } from "react-icons/fa";
import Navigation from '../../Navigation';
import Timeline from '../Timeline';
import axiosInstance from '../../../axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import "./ReadingMode.css";

const PRESET_RESPONSES = [
  { id: 'summarize', label: 'Summarize', prompt: 'Summarize this text concisely' },
  { id: 'bullet_points', label: 'Bullet Points', prompt: 'Convert this text into bullet points' },
  { id: 'challenge', label: 'Challenge', prompt: 'Challenge the assumptions in this text' },
  { id: 'question', label: 'Question', prompt: 'Generate thoughtful questions about this text' },
  { id: 'critique', label: 'Critique', prompt: 'Provide a critical analysis of this text' },
  { id: 'expand', label: 'Expand', prompt: 'Expand on the ideas in this text' }
];

function ReadingMode() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [cognition, setCognition] = useState(null);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Synthesis state
  const [activeTab, setActiveTab] = useState('author');
  const [authorSynthesis, setAuthorSynthesis] = useState('');
  const [aiSynthesis, setAiSynthesis] = useState('');
  const [userSynthesis, setUserSynthesis] = useState('');
  const [isSavingSynthesis, setIsSavingSynthesis] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [lastSaveStatus, setLastSaveStatus] = useState('');
  
  // Swipe handling
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const containerRef = useRef(null);
  
  // Debounce synthesis saving
  const saveTimeoutRef = useRef(null);
  
  // Determine if current user is the author
  const isAuthor = currentUser && cognition && (
    currentUser.id === cognition.user_id || 
    currentUser.username === cognition.username
  );
  
  // Get available tabs based on user role
  const availableTabs = isAuthor 
    ? [{ id: 'author', label: 'Author' }, { id: 'ai', label: 'AI' }]
    : [{ id: 'author', label: 'Author' }, { id: 'ai', label: 'AI' }, { id: 'user', label: 'My Notes' }];

  useEffect(() => {
    console.log('ReadingMode mounted with ID:', id);
    if (id) {
      fetchCognition();
    }
  }, [id]);

  useEffect(() => {
    if (cognition && cognition.nodes && cognition.nodes.length > 0) {
      console.log('Loading synthesis for node index:', currentNodeIndex);
      loadSynthesisForNode(currentNodeIndex);
    }
  }, [currentNodeIndex, cognition]);

  // Set initial active tab based on user role
  useEffect(() => {
    if (isAuthor) {
      setActiveTab('author');
    } else {
      setActiveTab('author');
    }
  }, [isAuthor]);

  const fetchCognition = async () => {
    setIsLoading(true);
    setError('');
    try {
      console.log('Fetching cognition with ID:', id);
      const response = await axiosInstance.get(`/cognitions/${id}/`);
      console.log('Fetched cognition:', response.data);
      setCognition(response.data);
      
      // Debug: Log node structure
      if (response.data.nodes) {
        console.log('Nodes found:', response.data.nodes.length);
        response.data.nodes.forEach((node, index) => {
          console.log(`Node ${index}:`, {
            id: node.id,
            content: node.content?.substring(0, 50) + '...',
            syntheses: node.syntheses
          });
        });
      }
    } catch (err) {
      console.error('Error fetching cognition:', err);
      setError('Failed to load cognition');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSynthesisForNode = (nodeIndex) => {
    if (!cognition || !cognition.nodes || !cognition.nodes[nodeIndex]) {
      console.log('No cognition or node available for index:', nodeIndex);
      return;
    }
    
    const node = cognition.nodes[nodeIndex];
    const syntheses = node.syntheses || [];
    
    console.log('Loading synthesis for node:', {
      nodeId: node.id,
      syntheses: syntheses,
      currentUserId: currentUser?.id,
      isAuthor: isAuthor
    });
    
    // Clear previous synthesis
    setAuthorSynthesis('');
    setAiSynthesis('');
    setUserSynthesis('');
    
    syntheses.forEach(synthesis => {
      console.log('Processing synthesis:', {
        synthId: synthesis.id,
        isAuthor: synthesis.is_author,
        source: synthesis.source,
        userId: synthesis.user_id,
        content: synthesis.content?.substring(0, 50) + '...'
      });
      
      if (synthesis.is_author) {
        setAuthorSynthesis(synthesis.content || '');
      } else if (synthesis.source === 'ai') {
        setAiSynthesis(synthesis.full_content || synthesis.content || '');
      } else if (synthesis.user_id === currentUser?.id) {
        setUserSynthesis(synthesis.content || '');
      }
    });
  };

  const debouncedSaveSynthesis = useCallback((content, source = 'user') => {
    if (!cognition || !cognition.nodes || !cognition.nodes[currentNodeIndex]) {
      console.log('Cannot save synthesis - missing cognition or node');
      return;
    }
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const nodeId = cognition.nodes[currentNodeIndex].id;
      setIsSavingSynthesis(true);
      setLastSaveStatus('Saving...');
      
      try {
        console.log('Saving synthesis:', { 
          nodeId, 
          content: content?.substring(0, 100) + '...', 
          source,
          endpoint: '/syntheses/add_or_update/'
        });
        
        const response = await axiosInstance.post('/syntheses/add_or_update/', {
          node_id: nodeId,
          content: content || ''
        });
        
        console.log('Synthesis saved successfully:', response.data);
        setLastSaveStatus('Saved');
        
        // Clear status after 2 seconds
        setTimeout(() => setLastSaveStatus(''), 2000);
        
      } catch (err) {
        console.error('Error saving synthesis:', {
          error: err,
          response: err.response?.data,
          status: err.response?.status
        });
        setLastSaveStatus('Save failed');
        
        // Show user-friendly error
        const errorMessage = err.response?.data?.error || 'Failed to save synthesis. Please try again.';
        alert(errorMessage);
        
        setTimeout(() => setLastSaveStatus(''), 3000);
      } finally {
        setIsSavingSynthesis(false);
      }
    }, 1000); // 1 second debounce
  }, [cognition, currentNodeIndex]);

  const handlePresetClick = async (preset) => {
    if (!cognition || !cognition.nodes || !cognition.nodes[currentNodeIndex]) {
      console.log('Cannot generate AI - missing cognition or node');
      return;
    }
    
    const nodeId = cognition.nodes[currentNodeIndex].id;
    setIsGeneratingAI(true);
    
    try {
      console.log('Generating AI response:', {
        preset: preset.label,
        nodeId: nodeId,
        endpoint: `/nodes/${nodeId}/summarize/`
      });
      
      const response = await axiosInstance.post(`/nodes/${nodeId}/summarize/`);
      console.log('AI response received:', response.data);
      
      const aiResponse = response.data.summary;
      
      if (!aiResponse) {
        throw new Error('No summary returned from AI service');
      }
      
      // Format the response with header
      const formattedResponse = `**${preset.label}:** ${aiResponse}`;
      
      // Append to existing AI synthesis
      const newAiSynthesis = aiSynthesis 
        ? `${aiSynthesis}\n\n${formattedResponse}`
        : formattedResponse;
      
      console.log('Setting new AI synthesis:', newAiSynthesis.substring(0, 100) + '...');
      setAiSynthesis(newAiSynthesis);
      
      // Save the updated AI synthesis immediately (no debounce for AI responses)
      try {
        const saveResponse = await axiosInstance.post('/syntheses/add_or_update/', {
          node_id: nodeId,
          content: newAiSynthesis
        });
        console.log('AI synthesis saved successfully:', saveResponse.data);
      } catch (saveErr) {
        console.error('Failed to save AI synthesis:', saveErr);
        alert('AI response generated but failed to save. Please try again.');
      }
      
    } catch (err) {
      console.error('Error generating AI response:', {
        error: err,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = 'Failed to generate AI response.';
      
      if (err.response?.status === 500) {
        if (err.response.data?.error?.includes('OpenAI API key')) {
          errorMessage = 'AI service not configured on server. Please contact administrator.';
        } else if (err.response.data?.error?.includes('OpenAI API error')) {
          errorMessage = 'AI service temporarily unavailable. Please try again later.';
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      alert(errorMessage);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleTimelineClick = (nodeIndex) => {
    console.log('Timeline clicked, switching to node:', nodeIndex);
    setCurrentNodeIndex(nodeIndex);
  };

  const handleStarCognition = async () => {
    if (!cognition) return;
    
    try {
      console.log('Toggling star for cognition:', cognition.id);
      const response = await axiosInstance.post(`/cognitions/${cognition.id}/star/`);
      console.log('Star response:', response.data);
      setCognition(prev => ({
        ...prev,
        is_starred: response.data.starred
      }));
    } catch (err) {
      console.error('Error starring cognition:', err);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!cognition || !cognition.nodes) return;
    
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    
    if (Math.abs(swipeDistance) > minSwipeDistance) {
      if (swipeDistance > 0 && currentNodeIndex < cognition.nodes.length - 1) {
        // Swipe left - next node
        console.log('Swiped to next node');
        setCurrentNodeIndex(prev => prev + 1);
      } else if (swipeDistance < 0 && currentNodeIndex > 0) {
        // Swipe right - previous node
        console.log('Swiped to previous node');
        setCurrentNodeIndex(prev => prev - 1);
      }
    }
  };

  const handleSynthesisChange = (value, type) => {
    console.log('Synthesis changed:', { type, length: value?.length });
    
    switch (type) {
      case 'author':
        setAuthorSynthesis(value);
        if (isAuthor) {
          debouncedSaveSynthesis(value, 'author');
        }
        break;
      case 'ai':
        setAiSynthesis(value);
        debouncedSaveSynthesis(value, 'ai');
        break;
      case 'user':
        setUserSynthesis(value);
        debouncedSaveSynthesis(value, 'user');
        break;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="reading-mode-container">
        <div className="loading-state">
          <FaSpinner className="spinning" />
          <span>Loading cognition...</span>
        </div>
        <Navigation />
      </div>
    );
  }

  if (error || !cognition) {
    return (
      <div className="reading-mode-container">
        <div className="error-state">
          <span>{error || 'Cognition not found'}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
        <Navigation />
      </div>
    );
  }

  const currentNode = cognition.nodes && cognition.nodes[currentNodeIndex];

  return (
    <div className="reading-mode-container" ref={containerRef}>
      {/* Timeline - Fixed at top */}
      <div className="timeline-section">
        <Timeline 
          nodes={cognition.nodes || []}
          currentIndex={currentNodeIndex}
          onClick={handleTimelineClick}
        />
      </div>

      {/* Main content area with touch handlers */}
      <div 
        className="main-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Node content - Top half */}
        <div className="node-section">
          <div className="node-header">
            <div className="node-info">
              <span className="node-counter">
                {currentNodeIndex + 1} of {cognition.nodes?.length || 0}
              </span>
              <h2 className="cognition-title">{cognition.title}</h2>
            </div>
            <div className="node-actions">
              <button 
                className="star-btn"
                onClick={handleStarCognition}
                title={cognition.is_starred ? 'Unstar' : 'Star'}
              >
                {cognition.is_starred ? <FaStar /> : <FaRegStar />}
              </button>
              <button className="edit-btn" title="Edit">
                <FaEdit />
              </button>
            </div>
          </div>
          
          <div className="node-content">
            {currentNode ? currentNode.content : 'No content available'}
          </div>
        </div>

        {/* Synthesis section - Bottom half */}
        <div className="synthesis-section">
          {/* Preset buttons - Only shown when AI tab is active */}
          {activeTab === 'ai' && (
            <div className="preset-buttons">
              {PRESET_RESPONSES.map(preset => (
                <button
                  key={preset.id}
                  className="preset-btn"
                  onClick={() => handlePresetClick(preset)}
                  disabled={isGeneratingAI}
                  title={`Generate ${preset.label.toLowerCase()} using AI`}
                >
                  {isGeneratingAI ? <FaSpinner className="spinning" /> : preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Synthesis tabs */}
          <div className="synthesis-tabs">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            {(isSavingSynthesis || lastSaveStatus) && (
              <div className="saving-indicator">
                {isSavingSynthesis && <FaSpinner className="spinning" />}
                <span>{lastSaveStatus}</span>
              </div>
            )}
          </div>

          {/* Synthesis content */}
          <div className="synthesis-content">
            {activeTab === 'author' && (
              <textarea
                className="synthesis-textarea"
                value={authorSynthesis}
                onChange={(e) => handleSynthesisChange(e.target.value, 'author')}
                placeholder={isAuthor ? "Add your author synthesis..." : "Author's synthesis will appear here"}
                readOnly={!isAuthor}
              />
            )}
            
            {activeTab === 'ai' && (
              <textarea
                className="synthesis-textarea"
                value={aiSynthesis}
                onChange={(e) => handleSynthesisChange(e.target.value, 'ai')}
                placeholder="AI responses will appear here. Use the preset buttons above to generate content."
              />
            )}
            
            {activeTab === 'user' && !isAuthor && (
              <textarea
                className="synthesis-textarea"
                value={userSynthesis}
                onChange={(e) => handleSynthesisChange(e.target.value, 'user')}
                placeholder="Add your personal notes and thoughts about this node..."
              />
            )}
          </div>
        </div>
      </div>

      <Navigation />
    </div>
  );
}

export default ReadingMode;