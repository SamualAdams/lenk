import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSpinner } from 'react-icons/fa';
import Navigation from '../../Navigation';
import Timeline from '../Timeline';
import OutlineMode from '../Outline/OutlineMode';
import axiosInstance from '../../../axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import './Compose.css';

const AI_PRESETS = [
  { id: 'expand', label: 'Expand', prompt: 'Expand on this content with more detail and examples' },
  { id: 'clarify', label: 'Clarify', prompt: 'Make this content clearer and easier to understand' },
  { id: 'shorten', label: 'Shorten', prompt: 'Make this content more concise while keeping key points' },
  { id: 'examples', label: 'Add Examples', prompt: 'Add relevant examples to illustrate these points' },
  { id: 'structure', label: 'Structure', prompt: 'Improve the structure and organization of this content' },
  { id: 'tone', label: 'Adjust Tone', prompt: 'Adjust the tone to be more engaging and appropriate' }
];

function Compose() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Core state
  const [nodes, setNodes] = useState([{ id: 1, content: '', position: 0 }]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'outline'
  
  // AI state
  const [aiOutput, setAiOutput] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiScope, setAiScope] = useState('node'); // 'node' or 'cognition'
  
  // Auto-save state
  const [cognitionId, setCognitionId] = useState(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  
  // Refs
  const autoSaveTimeoutRef = useRef(null);
  
  // Initialize with empty cognition
  useEffect(() => {
    createNewCognition();
  }, []);

  // Auto-save on content changes
  useEffect(() => {
    if (cognitionId && nodes.length > 0) {
      debouncedAutoSave();
    }
  }, [nodes, cognitionId]);

  const createNewCognition = async () => {
    try {
      const response = await axiosInstance.post('/cognitions/', {
        title: 'Untitled Composition',
        raw_content: '',
        is_starred: false
      });
      setCognitionId(response.data.id);
      console.log('Created new cognition:', response.data.id);
    } catch (err) {
      console.error('Failed to create cognition:', err);
    }
  };

  const debouncedAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await autoSaveCognition();
    }, 2000); // 2 second debounce
  }, [cognitionId, nodes]);

  const autoSaveCognition = async () => {
    if (!cognitionId || nodes.length === 0) return;
    
    setIsAutoSaving(true);
    try {
      // Combine all node content into raw_content
      const rawContent = nodes
        .sort((a, b) => a.position - b.position)
        .map(node => node.content)
        .filter(content => content.trim())
        .join('\n\n');

      // Update cognition
      await axiosInstance.put(`/cognitions/${cognitionId}/`, {
        title: generateTitleFromContent(rawContent),
        raw_content: rawContent,
        is_starred: false
      });

      // Process into nodes
      await axiosInstance.post(`/cognitions/${cognitionId}/process_text/`);
      
      setLastSaved(new Date());
      console.log('Auto-saved cognition');
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const generateTitleFromContent = (content) => {
    if (!content.trim()) return 'Untitled Composition';
    
    // Look for markdown header
    const headerMatch = content.match(/^#\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }
    
    // Fallback to first line
    const firstLine = content.split('\n')[0].trim();
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine || 'Untitled Composition';
  };

  const handleNodeContentChange = (content) => {
    setNodes(prev => prev.map((node, index) => 
      index === currentNodeIndex 
        ? { ...node, content }
        : node
    ));
  };

  const addNewNode = () => {
    const newNode = {
      id: Math.max(...nodes.map(n => n.id)) + 1,
      content: '',
      position: nodes.length
    };
    setNodes(prev => [...prev, newNode]);
    setCurrentNodeIndex(nodes.length);
  };

  const handleTimelineClick = (nodeIndex) => {
    setCurrentNodeIndex(nodeIndex);
  };

  const handleAIPreset = async (preset) => {
    await generateAIContent(preset.prompt);
  };

  const handleCustomAI = async () => {
    if (!customPrompt.trim()) return;
    await generateAIContent(customPrompt);
    setCustomPrompt('');
  };

  const generateAIContent = async (prompt) => {
    setIsGeneratingAI(true);
    setAiOutput('');
    
    try {
      const content = aiScope === 'node' 
        ? nodes[currentNodeIndex]?.content || ''
        : nodes.map(n => n.content).join('\n\n');
      
      const fullPrompt = `${prompt}\n\nContent: ${content}`;
      
      // For now, use the existing summarize endpoint
      // In production, you'd want a dedicated content editing endpoint
      console.log('Generating AI content with prompt:', fullPrompt);
      
      // Simulate AI response for now
      const mockResponse = `[AI Enhancement for: "${prompt}"]\n\nThis is where the AI-enhanced content would appear. The AI would process the ${aiScope === 'node' ? 'current node' : 'entire cognition'} and provide suggestions based on your prompt.`;
      
      setAiOutput(mockResponse);
    } catch (err) {
      console.error('AI generation failed:', err);
      setAiOutput('Failed to generate AI content. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const applyAIContent = () => {
    if (!aiOutput.trim()) return;
    
    if (aiScope === 'node') {
      handleNodeContentChange(aiOutput);
    } else {
      // For cognition-level, replace all nodes
      const newNodes = aiOutput.split('\n\n').map((content, index) => ({
        id: index + 1,
        content: content.trim(),
        position: index
      })).filter(node => node.content);
      
      setNodes(newNodes);
      setCurrentNodeIndex(0);
    }
    
    setAiOutput('');
  };

  const discardAIContent = () => {
    setAiOutput('');
  };

  const handlePublish = async () => {
    await autoSaveCognition();
    if (cognitionId) {
      navigate(`/cognition/${cognitionId}`);
    }
  };

  const currentNode = nodes[currentNodeIndex];

  return (
    <div className="compose-container">
      {/* Header */}
      <div className="compose-header">
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'outline' ? 'active' : ''}`}
            onClick={() => setViewMode('outline')}
          >
            Outline
          </button>
        </div>
        
        <div className="compose-actions">
          {isAutoSaving && <span className="auto-save-indicator">Saving...</span>}
          {lastSaved && !isAutoSaving && (
            <span className="last-saved">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button className="publish-btn" onClick={handlePublish}>
            View Reading Mode
          </button>
        </div>
      </div>

      {/* Timeline Mode */}
      {viewMode === 'timeline' && (
        <div className="timeline-mode">
          {/* Timeline */}
          <div className="timeline-section">
            <div className="timeline-container">
              <Timeline 
                nodes={nodes.map(node => ({ ...node, character_count: node.content.length }))}
                currentIndex={currentNodeIndex}
                onClick={handleTimelineClick}
              />
              <button className="add-node-btn" onClick={addNewNode}>
                <FaPlus />
              </button>
            </div>
          </div>

          {/* Node Editor */}
          <div className="node-editor-section">
            <div className="node-editor">
              <div className="node-meta">
                <span className="node-position">
                  Node {currentNodeIndex + 1} of {nodes.length}
                </span>
                <span className="word-count">
                  {currentNode?.content.length || 0} characters
                </span>
              </div>
              <textarea
                className="node-textarea"
                value={currentNode?.content || ''}
                onChange={(e) => handleNodeContentChange(e.target.value)}
                placeholder="Start typing your node content... Use markdown like # for headers, **bold**, *italic*, - for lists"
              />
            </div>
          </div>

          {/* AI Toolkit */}
          <div className="ai-toolkit-section">
            <div className="ai-scope-toggle">
              <button 
                className={`scope-btn ${aiScope === 'node' ? 'active' : ''}`}
                onClick={() => setAiScope('node')}
              >
                Current Node
              </button>
              <button 
                className={`scope-btn ${aiScope === 'cognition' ? 'active' : ''}`}
                onClick={() => setAiScope('cognition')}
              >
                Entire Cognition
              </button>
            </div>

            <div className="ai-controls">
              <div className="ai-presets">
                {AI_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    className="preset-btn"
                    onClick={() => handleAIPreset(preset)}
                    disabled={isGeneratingAI}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <div className="custom-prompt">
                <input
                  type="text"
                  className="prompt-input"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Custom AI prompt..."
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomAI()}
                />
                <button 
                  className="prompt-btn"
                  onClick={handleCustomAI}
                  disabled={isGeneratingAI || !customPrompt.trim()}
                >
                  {isGeneratingAI ? <FaSpinner className="spinning" /> : 'Go'}
                </button>
              </div>
            </div>

            {/* AI Output */}
            {(aiOutput || isGeneratingAI) && (
              <div className="ai-output">
                <div className="ai-output-header">
                  <span>AI Suggestion ({aiScope})</span>
                  {!isGeneratingAI && (
                    <div className="ai-actions">
                      <button className="apply-btn" onClick={applyAIContent}>
                        Apply
                      </button>
                      <button className="discard-btn" onClick={discardAIContent}>
                        Discard
                      </button>
                    </div>
                  )}
                </div>
                <div className="ai-output-content">
                  {isGeneratingAI ? (
                    <div className="ai-loading">
                      <FaSpinner className="spinning" />
                      <span>Generating AI content...</span>
                    </div>
                  ) : (
                    <pre>{aiOutput}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Outline Mode - using the shared OutlineMode component */}
      {viewMode === 'outline' && cognitionId && (
        <OutlineMode 
          id={cognitionId} 
          inComposeView={true}
          onBack={() => setViewMode('timeline')}
        />
      )}

      <Navigation />
    </div>
  );
}

export default Compose;