import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaHome, FaExpandArrowsAlt, FaCheck, FaCopy, 
         FaChevronLeft, FaChevronRight, FaStar, FaRegStar } from "react-icons/fa";
import axiosInstance from "../axiosConfig";
import "./ReadingMode.css";
import Timeline from "./Timeline";

function ReadingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cognition, setCognition] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [synthesis, setSynthesis] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandMode, setExpandMode] = useState(false);
  const [newText, setNewText] = useState('');
  const [appendingText, setAppendingText] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  const [synthesisSaved, setSynthesisSaved] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currentNode = nodes[currentNodeIndex] || null;
  const [nodeText, setNodeText] = useState("");
  const textareaRef = useRef(null);
  const synthesisRef = useRef(null);

  // Auth context and owner check
  const { currentUser } = useAuth();
  const isOwner = cognition && currentUser && (
    cognition.username === currentUser.username ||
    cognition.user_id === currentUser.user_id ||
    cognition.user === currentUser.user_id // covers various possible field names
  );

  // Toast message helper
  const displayToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  // Sync nodeText with current node
  useEffect(() => {
    if (currentNode?.content) {
      setNodeText(currentNode.content);
    }
  }, [currentNode]);

  // Debounced autosave for node content
  const debouncedSaveNode = useCallback(
    debounce(async (text) => {
      if (!currentNode) return;
      try {
        await axiosInstance.post("/nodes/add_or_update/", {
          node_id: currentNode.id,
          content: text
        });
        setNodes((nodes) =>
          nodes.map((n, idx) =>
            idx === currentNodeIndex ? { ...n, content: text } : n
          )
        );
        displayToast("Node saved");
      } catch (err) {
        setError("Failed to save node");
      }
    }, 1000),
    [currentNode, currentNodeIndex]
  );

  // Debounced autosave for synthesis
  const debouncedSaveSynthesis = useCallback(
    debounce(async (text) => {
      if (!currentNode) return;
      try {
        await axiosInstance.post("/syntheses/add_or_update/", {
          node_id: currentNode.id,
          content: text
        });
        
        // Update nodes state with new synthesis
        setNodes(nodes => {
          const updatedNodes = [...nodes];
          updatedNodes[currentNodeIndex] = {
            ...currentNode,
            synthesis: {
              ...(currentNode.synthesis || {}),
              content: text
            }
          };
          return updatedNodes;
        });
        
        setSynthesisSaved(true);
        displayToast("Synthesis saved");
      } catch (err) {
        setError("Failed to save synthesis");
      }
    }, 1000),
    [currentNode, currentNodeIndex]
  );

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSaveNode.cancel();
      debouncedSaveSynthesis.cancel();
    };
  }, [debouncedSaveNode, debouncedSaveSynthesis]);

  // Handle node text changes with debounced save
  const handleNodeChange = (e) => {
    const text = e.target.value;
    setNodeText(text);
    debouncedSaveNode(text);
  };

  // Handle synthesis changes with debounced save
  const handleSynthesisChange = (e) => {
    const text = e.target.value;
    setSynthesis(text);
    setSynthesisSaved(false);
    debouncedSaveSynthesis(text);
  };

  // Delete cognition handler
  const handleDeleteCognition = async () => {
    if (!window.confirm("Are you sure you want to delete this cognition?")) return;
    try {
      await axiosInstance.delete(`/cognitions/${id}/`);
      navigate("/");
    } catch (err) {
      setError("Failed to delete cognition");
    }
  };

  // Fetch cognition and nodes
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get(`/cognitions/${id}/?include_syntheses=true`);
      setCognition(response.data);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to load cognition data");
      setIsLoading(false);
    }
  }, [id]);

  // Toggle cognition star status
  const toggleStar = async () => {
    try {
      const response = await axiosInstance.post(`/cognitions/${id}/star/`);
      setCognition(prev => ({...prev, is_starred: response.data.starred }));
      displayToast(response.data.starred ? "Added to starred" : "Removed from starred");
    } catch (err) {
      setError("Failed to update star status");
    }
  };

  // Initial load
  useEffect(() => {
    fetchCognition();
  }, [fetchCognition, id]);

  // Update synthesis textarea when node changes
  useEffect(() => {
    if (nodes.length && currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      setSynthesis(nodes[currentNodeIndex]?.synthesis?.content || "");
      setSynthesisSaved(true);
    } else {
      setSynthesis("");
    }
  }, [nodes, currentNodeIndex]);

  // Navigation
  const goToNextNode = () => {
    if (currentNodeIndex < nodes.length - 1) {
      setCurrentNodeIndex(prev => prev + 1);
    }
  };

  const goToPreviousNode = () => {
    if (currentNodeIndex > 0) {
      setCurrentNodeIndex(prev => prev - 1);
    }
  };

  // Timeline click handler
  const handleTimelineClick = (index, event) => {
    // Save current synthesis before moving
    if (!synthesisSaved && synthesis) {
      debouncedSaveSynthesis.flush();
    }
    
    if (event && event.shiftKey) {
      // Handle multi-selection with shift key
      const newSelection = new Set(selectedIndices);
      const rangeStart = Math.min(currentNodeIndex, index);
      const rangeEnd = Math.max(currentNodeIndex, index);
      for (let i = rangeStart; i <= rangeEnd; i++) {
        newSelection.add(i);
      }
      setSelectedIndices(newSelection);
    } else if (event && (event.ctrlKey || event.metaKey)) {
      // Handle multi-selection with ctrl/cmd key
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      setSelectedIndices(newSelection);
    } else {
      // Regular click - select just this node
      setSelectedIndices(new Set([index]));
    }

    setCurrentNodeIndex(index);
  };

  // Toggle node illumination
  const handleToggleIllumination = async () => {
    if (!currentNode) return;
    
    try {
      const response = await axiosInstance.post(`/nodes/${currentNode.id}/toggle_illumination/`);
      
      // Update nodes state with new illumination status
      setNodes(prev => {
        const updated = [...prev];
        updated[currentNodeIndex] = {
          ...currentNode,
          is_illuminated: response.data.is_illuminated
        };
        return updated;
      });
      
      displayToast(response.data.is_illuminated ? 
        "Node illuminated" : 
        "Node illumination removed");
    } catch (err) {
      setError("Failed to toggle illumination");
    }
  };

  // Copy handlers
  const handleCopyNode = () => {
    if (currentNode) {
      navigator.clipboard.writeText(currentNode.content);
      displayToast("Node content copied to clipboard");
    }
  };

  const handleCopySynthesis = () => {
    if (synthesis) {
      navigator.clipboard.writeText(synthesis);
      displayToast("Synthesis copied to clipboard");
    }
  };

  const handleCopyBoth = () => {
    if (currentNode) {
      const text = `${currentNode.content || ""}\n\n${synthesis || ""}`;
      navigator.clipboard.writeText(text);
      displayToast("Node and synthesis copied to clipboard");
    }
  };

  // Add/append text modal
  const handleOpenExpandMode = () => {
    setExpandMode(true);
    setNewText('');
  };

  const handleCloseExpandMode = () => {
    setExpandMode(false);
  };

  const handleAppendText = async () => {
    if (!newText.trim()) {
      setError("Please enter some text to append");
      return;
    }
    
    try {
      setAppendingText(true);
      setError(null);
      
      await axiosInstance.post(`/cognitions/${id}/append_text/`, {
        text: newText
      });
      
      // Refresh the cognition data to get the new nodes
      await fetchCognition();
      
      // Reset the expand mode and text
      setNewText('');
      setExpandMode(false);
      setAppendingText(false);
      
      // Navigate to the first of the newly added nodes
      setCurrentNodeIndex(nodes.length);
      displayToast("Text appended successfully");
      
    } catch (err) {
      setError('Failed to append text to cognition');
      setAppendingText(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle keyboard shortcuts if not in a text area
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
        case 'e':
          setEditMode(prev => !prev);
          break;
        case 'h':
          navigate('/');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentNodeIndex, nodes.length, navigate]);

  // Focus on edit textarea when entering edit mode
  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editMode]);


  // Loading states
  if (isLoading) {
    return <div className="reading-mode-loading">Loading cognition...</div>;
  }

  if (error) {
    return <div className="reading-mode-error">{error}</div>;
  }

  if (!cognition) {
    return <div className="reading-mode-error">Could not load cognition</div>;
  }

  return (
    <div className="reading-mode-container">
      {/* Header section */}
      <header className="reading-header">
        <div className="header-left">
          <button 
            className="icon-button home-btn" 
            onClick={() => navigate('/')}
            title="Return to home"
          >
            <FaHome />
          </button>
          <h1 className="cognition-title">{cognition.title}</h1>
          {isOwner && (
            <button 
              className="icon-button star-btn" 
              onClick={toggleStar}
              title={cognition.is_starred ? "Unstar" : "Star"}
            >
              {cognition.is_starred ? <FaStar /> : <FaRegStar />}
            </button>
          )}
        </div>
        <div className="header-right">
          {isOwner && (
            <>
              <button 
                className="icon-button expand-btn" 
                onClick={handleOpenExpandMode}
                title="Add text"
              >
                <FaExpandArrowsAlt />
              </button>
              <button 
                className="icon-button delete-btn" 
                onClick={handleDeleteCognition}
                title="Delete"
              >
                <FaTrashAlt />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Timeline section */}
      <div className="timeline-wrapper">
        <Timeline
          nodes={nodes}
          currentIndex={currentNodeIndex}
          onClick={handleTimelineClick}
          selectedIndices={selectedIndices}
        />
      </div>

      {/* Main content area */}
      <main className="reading-content">


        {/* Node content */}
        <div 
          className="node-content-wrapper"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
        >
          <div className="node-content-actions" style={{ flexShrink: 0 }}>
            <button 
              className={`icon-button ${currentNode?.is_illuminated ? 'illuminated' : ''}`} 
              onClick={handleToggleIllumination}
              title={currentNode?.is_illuminated ? "Remove illumination" : "Illuminate node"}
            >
              <FaStar className="illumination-indicator" />
            </button>
            {isOwner && (
              <button 
                className="icon-button edit-btn" 
                onClick={() => setEditMode(!editMode)}
                title={editMode ? "View mode" : "Edit mode"}
              >
                {editMode ? "View" : "Edit"}
              </button>
            )}
            <button 
              className="icon-button copy-btn" 
              onClick={handleCopyNode}
              title="Copy node content"
            >
              <FaCopy />
            </button>
          </div>
          
          {editMode ? (
            <textarea
              ref={textareaRef}
              className="node-content-editable"
              style={{ flex: 1, minHeight: 0 }}
              value={nodeText}
              onChange={handleNodeChange}
              placeholder="Enter node content..."
            />
          ) : (
            <div className="node-content-box" style={{ flex: 1, minHeight: 0 }}>{currentNode?.content}</div>
          )}
        </div>

        {/* Synthesis section - always visible */}
        <div 
          className="synthesis-section"
          style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}
        >
          <div className="synthesis-header" style={{ flexShrink: 0 }}>
            <div className="synthesis-label">Synthesis</div>
            <div className="synthesis-actions">
              <button 
                className="icon-button copy-btn" 
                onClick={handleCopySynthesis}
                title="Copy synthesis"
              >
                <FaCopy />
              </button>
              <button 
                className="icon-button copy-both-btn" 
                onClick={handleCopyBoth}
                title="Copy node and synthesis"
              >
                <FaCopy /> Both
              </button>
            </div>
          </div>
          
          <textarea
            ref={synthesisRef}
            className="synthesis-textarea"
            style={{ flex: 1, minHeight: 0 }}
            value={synthesis}
            onChange={isOwner ? handleSynthesisChange : undefined}
            placeholder="Write your synthesis here..."
            readOnly={!isOwner}
          />
        </div>
      </main>

      {/* Mobile navigation overlay */}
      <div className="mobile-navigation">
        <div className="node-touch-zone left" onClick={goToPreviousNode} />
        <div className="node-touch-zone right" onClick={goToNextNode} />
      </div>

      {/* Expand modal */}
      {expandMode && (
        <div className="modal-overlay" onClick={handleCloseExpandMode}>
          <div className="expand-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Text to "{cognition.title}"</h3>
              <button className="close-btn" onClick={handleCloseExpandMode}>×</button>
            </div>
            <div className="modal-body">
              <textarea
                className="expand-textarea"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter text to append..."
              />
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseExpandMode}>Cancel</button>
              <button 
                className="append-btn" 
                onClick={handleAppendText}
                disabled={appendingText || !newText.trim()}
              >
                {appendingText ? "Adding..." : "Append Text"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showToast && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default ReadingMode;