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
  const [titleInput, setTitleInput] = useState("");
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [authorSynthesis, setAuthorSynthesis] = useState("");
  const [userSynthesis, setUserSynthesis] = useState("");
  const [hasUserSynthesis, setHasUserSynthesis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandMode, setExpandMode] = useState(false);
  const [newText, setNewText] = useState('');
  const [appendingText, setAppendingText] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [editMode, setEditMode] = useState(false);
  // synthesisSaved and related state are removed, since user synthesis is debounced and auto-saved
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currentNode = nodes[currentNodeIndex] || null;
  const [nodeText, setNodeText] = useState("");
  const textareaRef = useRef(null);
  // const synthesisRef = useRef(null);

  // Auth context and owner check
  const { currentUser } = useAuth();
  const isOwner = cognition && currentUser && (
    cognition.username === currentUser.username ||
    cognition.user_id === currentUser.user_id ||
    cognition.user === currentUser.user_id ||
    (cognition.user && typeof cognition.user === "object" && cognition.user.id === currentUser.user_id)
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

  // Debounced save for user synthesis (not author synthesis)
  const debouncedSaveUserSynthesis = useCallback(
    debounce(async (text) => {
      if (!currentNode) return;
      try {
        await axiosInstance.post("/syntheses/add_or_update/", {
          node_id: currentNode.id,
          content: text
        });
        // Update nodes state with new user synthesis
        setNodes(nodes => {
          const updatedNodes = [...nodes];
          const syntheses = [...(updatedNodes[currentNodeIndex].syntheses || [])];
          const idx = syntheses.findIndex(s => !s.is_author);
          if (idx >= 0) {
            syntheses[idx] = { ...syntheses[idx], content: text };
          } else {
            syntheses.push({ content: text, is_author: false });
          }
          updatedNodes[currentNodeIndex] = {
            ...updatedNodes[currentNodeIndex],
            syntheses: syntheses
          };
          return updatedNodes;
        });
        setHasUserSynthesis(true);
        displayToast("Your synthesis saved");
      } catch (err) {
        setError("Failed to save your synthesis");
      }
    }, 1000),
    [currentNode, currentNodeIndex]
  );

  // Debounced save for author synthesis (for author only)
  const debouncedSaveAuthorSynthesis = useCallback(
    debounce(async (text) => {
      if (!currentNode) return;
      try {
        await axiosInstance.post("/syntheses/add_or_update/", {
          node_id: currentNode.id,
          content: text
        });
        setNodes(nodes => {
          const updatedNodes = [...nodes];
          const syntheses = [...(updatedNodes[currentNodeIndex].syntheses || [])];
          const idx = syntheses.findIndex(s => s.is_author);
          if (idx >= 0) {
            syntheses[idx] = { ...syntheses[idx], content: text };
          }
          updatedNodes[currentNodeIndex] = {
            ...updatedNodes[currentNodeIndex],
            syntheses: syntheses
          };
          return updatedNodes;
        });
        displayToast("Author's synthesis saved");
      } catch (err) {
        setError("Failed to save author's synthesis");
      }
    }, 1000),
    [currentNode, currentNodeIndex]
  );

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSaveNode.cancel();
      debouncedSaveUserSynthesis.cancel();
    };
  }, [debouncedSaveNode, debouncedSaveUserSynthesis]);

  // Handle node text changes with debounced save
  const handleNodeChange = (e) => {
    const text = e.target.value;
    setNodeText(text);
    debouncedSaveNode(text);
  };

  // Handle user synthesis changes with debounced save
  const handleUserSynthesisChange = (e) => {
    const text = e.target.value;
    setUserSynthesis(text);
    debouncedSaveUserSynthesis(text);
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
      setTitleInput(response.data.title);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to load cognition data");
      setIsLoading(false);
    }
  }, [id]);
  useEffect(() => {
    if (cognition && cognition.title) setTitleInput(cognition.title);
  }, [cognition]);

  const debouncedSaveTitle = useCallback(
    debounce(async (newTitle) => {
      console.log("debouncedSaveTitle called", cognition?.id, newTitle);
      try {
        await axiosInstance.patch(`/cognitions/${id}/`, { title: newTitle });
        setCognition(cog => ({ ...cog, title: newTitle }));
        displayToast("Title updated");
      } catch (err) {
        setError("Failed to update title");
      }
    }, 1000),
    [id, cognition]
  );

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

// Update syntheses (author and user) when node changes
  useEffect(() => {
    if (nodes.length && currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      const syntheses = nodes[currentNodeIndex]?.syntheses || [];
      // Find author's synthesis
      const authorSyn = syntheses.find(s => s.is_author);
      setAuthorSynthesis(authorSyn?.content || "");
      // Find user's synthesis (assumes only one user synthesis per node, not showing a list)
      const userSyn = syntheses.find(s => !s.is_author);
      setUserSynthesis(userSyn?.content || "");
      setHasUserSynthesis(!!userSyn);
    } else {
      setAuthorSynthesis("");
      setUserSynthesis("");
      setHasUserSynthesis(false);
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
          {isOwner ? (
            <input
              className="cognition-title-input"
              value={titleInput}
              onChange={e => {
                console.log("Input changed", cognition?.id, e.target.value);
                setTitleInput(e.target.value);
                debouncedSaveTitle(e.target.value);
              }}
              style={{ fontSize: '2rem', fontWeight: 'bold', border: 0, background: 'none', outline: 'none', width: '100%' }}
            />
          ) : (
            <h1 className="cognition-title">{cognition.title}</h1>
          )}
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

        {/* Synthesis sections */}
        <div className="synthesis-sections" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          {/* Author's Synthesis */}
          <div className="synthesis-section author-synthesis" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="synthesis-header">
              <div className="synthesis-label">Author's Synthesis</div>
              <div className="synthesis-actions">
                <button 
                  className="icon-button copy-btn" 
                  onClick={() => {
                    navigator.clipboard.writeText(authorSynthesis);
                    displayToast("Author's synthesis copied");
                  }}
                  title="Copy author's synthesis"
                >
                  <FaCopy />
                </button>
              </div>
            </div>
            {isOwner ? (
              <textarea
                className="synthesis-textarea"
                style={{ flex: 1, minHeight: 0 }}
                value={authorSynthesis}
                onChange={e => {
                  setAuthorSynthesis(e.target.value);
                  debouncedSaveAuthorSynthesis(e.target.value);
                }}
                placeholder="Write your synthesis as author..."
              />
            ) : (
              <div className="synthesis-content" style={{ flex: 1, overflow: 'auto', padding: '1rem', backgroundColor: 'var(--input-background)', color: 'var(--primary-color)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                {authorSynthesis || <span className="placeholder">No author synthesis available</span>}
              </div>
            )}
          </div>

          {/* User's Synthesis */}
          {!isOwner && (
            <div className="synthesis-section user-synthesis" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: '1rem' }}>
              <div className="synthesis-header">
                <div className="synthesis-label">Your Synthesis</div>
                {hasUserSynthesis && (
                  <div className="synthesis-actions">
                    <button 
                      className="icon-button copy-btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(userSynthesis);
                        displayToast("Your synthesis copied");
                      }}
                      title="Copy your synthesis"
                    >
                      <FaCopy />
                    </button>
                  </div>
                )}
              </div>
              <textarea
                className="synthesis-textarea"
                style={{ flex: 1, minHeight: 0 }}
                value={userSynthesis}
                onChange={handleUserSynthesisChange}
                placeholder="Write your own synthesis here..."
              />
            </div>
          )}
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