import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaHome, FaStar, FaRegStar, FaEdit, FaPlus, FaCommentDots, FaLightbulb } from "react-icons/fa";
import axiosInstance from "../axiosConfig";
import { summarizeNode } from "../axiosConfig";
import "./ReadingMode.css";

function ReadingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cognition, setCognition] = useState(null);
  const [titleInput, setTitleInput] = useState("");
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [userSynthesis, setUserSynthesis] = useState("");
  const [hasUserSynthesis, setHasUserSynthesis] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [synthesisExpanded, setSynthesisExpanded] = useState(false);
  const [actionButtonsExpanded, setActionButtonsExpanded] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isProcessingPaste, setIsProcessingPaste] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const currentNode = nodes[currentNodeIndex] || null;
  const [nodeText, setNodeText] = useState("");
  const textareaRef = useRef(null);
  const synthesisRef = useRef(null);
  const scrollContainerRef = useRef(null);

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
  
  // Handle node deletion
  const handleDeleteNode = async () => {
    if (!currentNode || !isOwner) return;
    
    if (!window.confirm("Are you sure you want to delete this node?")) return;
    
    try {
      await axiosInstance.delete(`/nodes/${currentNode.id}/`);
      
      // Move to previous node if possible, otherwise next
      const newIndex = currentNodeIndex > 0 ? currentNodeIndex - 1 : 0;
      
      await fetchCognition();
      
      // Set new index, accounting for the deleted node
      if (nodes.length > 1) {
        setCurrentNodeIndex(Math.min(newIndex, nodes.length - 2));
      } else {
        setCurrentNodeIndex(0);
      }
      
      displayToast("Node deleted");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to delete node";
      setError(errorMsg);
    }
  };
  
  // Handle node merging with next node
  const handleMergeWithNext = async () => {
    if (!currentNode || currentNodeIndex === nodes.length - 1) {
      displayToast("No next node to merge with");
      return;
    }
    
    if (!window.confirm("Merge this node with the next node?")) return;
    
    try {
      await axiosInstance.post(`/nodes/${currentNode.id}/merge_with_next/`, {
        separator: ' '
      });
      
      await fetchCognition();
      displayToast("Nodes merged successfully");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to merge nodes";
      setError(errorMsg);
    }
  };

  // Sync nodeText with current node
  useEffect(() => {
    if (currentNode?.content) {
      setNodeText(currentNode.content);
    }
  }, [currentNode]);

  // Debounced save for user synthesis
  const debouncedSaveUserSynthesis = useCallback(
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

  // Debounced save for node content
  const debouncedSaveNodeContent = useCallback(
    debounce(async (nodeId, content) => {
      try {
        await axiosInstance.patch(`/nodes/${nodeId}/`, { content });
        displayToast("Node updated");
      } catch (err) {
        setError("Failed to update node");
      }
    }, 1000),
    []
  );

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSaveUserSynthesis.cancel();
      debouncedSaveNodeContent.cancel();
    };
  }, [debouncedSaveUserSynthesis, debouncedSaveNodeContent]);

  // Handle node content changes in edit mode
  const handleNodeContentChange = (e) => {
    const newContent = e.target.value;
    setNodeText(newContent);
    setCursorPosition(e.target.selectionStart);
    
    // Update nodes state immediately for UI
    setNodes(prev => prev.map((node, idx) => 
      idx === currentNodeIndex ? { ...node, content: newContent } : node
    ));
    
    // Debounced save to backend
    if (currentNode) {
      debouncedSaveNodeContent(currentNode.id, newContent);
    }
  };

  // Split node at cursor position
  const handleSplitNode = async () => {
    if (!currentNode || !isEditMode) return;
    
    const content = nodeText;
    const splitPoint = cursorPosition;
    const beforeContent = content.substring(0, splitPoint).trim();
    const afterContent = content.substring(splitPoint).trim();
    
    if (!beforeContent || !afterContent) {
      displayToast("Cannot split - need content on both sides of cursor");
      return;
    }
    
    try {
      // Use the backend's split_node endpoint instead of manual splitting
      await axiosInstance.post(`/nodes/${currentNode.id}/split_node/`, {
        split_position: splitPoint
      });
      
      // Refresh cognition data
      await fetchCognition();
      displayToast("Node split successfully");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to split node";
      setError(errorMsg);
    }
  };

  // Move node up
  const handleMoveUp = async () => {
    if (currentNodeIndex === 0 || !currentNode) return;
    
    try {
      await axiosInstance.post(`/nodes/${currentNode.id}/reorder_position/`, {
        new_position: currentNode.position - 1
      });
      
      // Refresh and move to new position
      await fetchCognition();
      setCurrentNodeIndex(currentNodeIndex - 1);
      displayToast("Node moved up");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to move node";
      setError(errorMsg);
    }
  };

  // Move node down
  const handleMoveDown = async () => {
    if (currentNodeIndex === nodes.length - 1 || !currentNode) return;
    
    try {
      await axiosInstance.post(`/nodes/${currentNode.id}/reorder_position/`, {
        new_position: currentNode.position + 1
      });
      
      // Refresh and move to new position
      await fetchCognition();
      setCurrentNodeIndex(currentNodeIndex + 1);
      displayToast("Node moved down");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to move node";
      setError(errorMsg);
    }
  };

  // Move to first position
  const handleMoveToFirst = async () => {
    if (currentNodeIndex === 0 || !currentNode) return;
    
    try {
      await axiosInstance.post(`/nodes/${currentNode.id}/reorder_position/`, {
        new_position: 0
      });
      
      await fetchCognition();
      setCurrentNodeIndex(0);
      displayToast("Node moved to first position");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to move node";
      setError(errorMsg);
    }
  };

  // Move to last position
  const handleMoveToLast = async () => {
    if (currentNodeIndex === nodes.length - 1 || !currentNode) return;
    
    try {
      const lastPosition = nodes.length - 1;
      
      await axiosInstance.post(`/nodes/${currentNode.id}/reorder_position/`, {
        new_position: lastPosition
      });
      
      await fetchCognition();
      setCurrentNodeIndex(lastPosition);
      displayToast("Node moved to last position");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to move node";
      setError(errorMsg);
    }
  };


  // Handle bulk paste
  const handleBulkPaste = () => {
    setShowPasteModal(true);
    setPasteText('');
  };

  // Process pasted text
  const handleProcessPaste = async () => {
    if (!pasteText.trim()) return;
    
    setIsProcessingPaste(true);
    try {
      // Split by paragraphs (double newlines) or single newlines
      const paragraphs = pasteText
        .split(/\n\s*\n|\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      if (paragraphs.length === 0) {
        displayToast("No content to process");
        return;
      }
      
      // Use the new bulk create endpoint
      await axiosInstance.post(`/cognitions/${cognition.id}/bulk_create_nodes/`, {
        paragraphs
      });
      
      await fetchCognition();
      
      setShowPasteModal(false);
      setPasteText('');
      displayToast(`Added ${paragraphs.length} new nodes`);
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to process pasted text";
      setError(errorMsg);
    } finally {
      setIsProcessingPaste(false);
    }
  };
  const scrollToNode = useCallback((index) => {
    if (!scrollContainerRef.current || isTransitioning || index < 0 || index >= nodes.length) return;
    
    setIsTransitioning(true);
    setCurrentNodeIndex(index);
    
    const container = scrollContainerRef.current;
    const headerHeight = 80;
    const availableHeight = window.innerHeight - headerHeight;
    const targetScroll = index * availableHeight;
    
    // Smooth scroll to target position
    container.scrollTo({
      top: targetScroll,
      behavior: 'smooth'
    });
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, nodes.length]);

  // Handle scroll events for snap detection
  const handleScroll = useCallback(() => {
    if (isTransitioning || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const headerHeight = 80;
    const availableHeight = window.innerHeight - headerHeight;
    const scrollTop = container.scrollTop;
    
    // Calculate which node should be active based on scroll position
    const newIndex = Math.round(scrollTop / availableHeight);
    const clampedIndex = Math.max(0, Math.min(nodes.length - 1, newIndex));
    
    if (clampedIndex !== currentNodeIndex) {
      setCurrentNodeIndex(clampedIndex);
    }
  }, [currentNodeIndex, isTransitioning, nodes.length]);

  // Debounced scroll handler
  const debouncedHandleScroll = useCallback(
    debounce(handleScroll, 16), // Roughly 60fps
    [handleScroll]
  );

  const goToNextNode = () => {
    if (currentNodeIndex < nodes.length - 1) {
      scrollToNode(currentNodeIndex + 1);
    }
  };

  const goToPreviousNode = () => {
    if (currentNodeIndex > 0) {
      scrollToNode(currentNodeIndex - 1);
    }
  };

  const handleTimelineClick = (index) => {
    scrollToNode(index);
  };

  const handleSynthesisExpand = () => {
    setSynthesisExpanded(true);
  };

  const handleSynthesisCollapse = () => {
    setSynthesisExpanded(false);
    setActionButtonsExpanded(false);
  };

  const toggleActionButtons = () => {
    setActionButtonsExpanded(!actionButtonsExpanded);
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

  // Initial load
  useEffect(() => {
    fetchCognition();
  }, [fetchCognition, id]);

  // Update user synthesis when node changes
  useEffect(() => {
    if (nodes.length && currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      const syntheses = nodes[currentNodeIndex]?.syntheses || [];
      const userSyn = syntheses.find(s => !s.is_author);
      setUserSynthesis(userSyn?.content || "");
      setHasUserSynthesis(!!userSyn);
    } else {
      setUserSynthesis("");
      setHasUserSynthesis(false);
    }
  }, [nodes, currentNodeIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || isTransitioning) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goToPreviousNode();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNextNode();
          break;
        case 'ArrowLeft':
          goToPreviousNode();
          break;
        case 'ArrowRight':
          goToNextNode();
          break;
        case 'e':
          if (!isTransitioning) setIsEditMode(prev => !prev);
          break;
        case 'h':
          navigate('/');
          break;
        case 'Escape':
          if (synthesisExpanded) {
            handleSynthesisCollapse();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentNodeIndex, nodes.length, navigate, synthesisExpanded, isTransitioning]);

  // Loading states
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        color: 'var(--secondary-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        Loading cognition...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        color: 'var(--danger-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        {error}
      </div>
    );
  }

  if (!cognition) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        color: 'var(--danger-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        Could not load cognition
      </div>
    );
  }

  // Calculate heights for layout
  const headerHeight = 80;
  const availableHeight = window.innerHeight - headerHeight; // No synthesis bar in layout

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--background-color)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        height: `${headerHeight}px`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        backgroundColor: 'var(--card-background)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: 'var(--primary-color)'
            }}
          >
            <FaHome />
          </button>
          <h1 style={{
            margin: 0,
            fontSize: '1.2rem',
            fontWeight: '600',
            color: 'var(--primary-color)'
          }}>
            {cognition.title}
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isOwner && (
            <>
              {/* Edit Mode Toggle Button */}
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                style={{
                  background: isEditMode ? 'var(--accent-color)' : 'transparent',
                  border: isEditMode ? 'none' : '1px solid var(--border-color)',
                  fontSize: '1rem',
                  color: isEditMode ? 'white' : 'var(--primary-color)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
                title={isEditMode ? "Exit Edit Mode (E)" : "Enter Edit Mode (E)"}
              >
                <FaEdit />
                {isEditMode ? 'Exit' : 'Edit'}
              </button>
              
              {/* Star Button */}
              <button 
                onClick={toggleStar}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.1rem',
                  color: cognition.is_starred ? 'var(--illuminated-color)' : 'var(--secondary-color)',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                title={cognition.is_starred ? "Remove from starred" : "Add to starred"}
              >
                {cognition.is_starred ? <FaStar /> : <FaRegStar />}
              </button>
              
              {/* Delete Button */}
              <button 
                onClick={handleDeleteCognition}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.1rem',
                  color: 'var(--danger-color)',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                title="Delete cognition"
              >
                <FaTrashAlt />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        height: `${availableHeight}px`
      }}>
        {/* Scrollable Node Cards */}
        <div 
          ref={scrollContainerRef}
          onScroll={debouncedHandleScroll}
          className="hide-scrollbar"
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollSnapType: 'y mandatory',
            scrollBehavior: 'smooth',
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none'  /* IE and Edge */
          }}
        >
          {nodes.map((node, index) => (
            <div
              key={node.id}
              style={{
                height: `${availableHeight}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '2rem',
                opacity: index === currentNodeIndex ? 1 : 0.4,
                transform: index === currentNodeIndex ? 'scale(1)' : 'scale(0.95)',
                scrollSnapAlign: 'start'
              }}
            >
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                width: '100%'
              }}>
                {/* Node content - editable in edit mode */}
                {isEditMode ? (
                  <textarea
                    ref={textareaRef}
                    value={nodeText}
                    onChange={handleNodeContentChange}
                    onSelect={(e) => setCursorPosition(e.target.selectionStart)}
                    style={{
                      width: '100%',
                      minHeight: '200px',
                      fontSize: '1.4rem',
                      lineHeight: '1.6',
                      color: 'var(--primary-color)',
                      backgroundColor: 'var(--input-background)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    placeholder="Edit node content..."
                  />
                ) : (
                  <div style={{
                    fontSize: '1.4rem',
                    lineHeight: '1.6',
                    color: 'var(--primary-color)',
                    textAlign: 'left',
                    marginBottom: '1.5rem'
                  }}>
                    {node.content}
                  </div>
                )}
                
                {/* Node label under the text */}
                <div style={{
                  fontSize: '0.9rem',
                  color: 'var(--secondary-color)',
                  fontWeight: '500',
                  textAlign: 'left'
                }}>
                  NODE {index + 1} OF {nodes.length}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Vertical Timeline with horizontal lines */}
        <div style={{
          width: '12px',
          backgroundColor: 'var(--border-color)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0
        }}>
          {nodes.map((node, index) => {
            // Calculate proportional height based on character count
            const totalChars = nodes.reduce((sum, n) => sum + (n.content?.length || 0), 0);
            const nodeChars = node.content?.length || 0;
            const heightPercent = totalChars > 0 ? (nodeChars / totalChars) * 100 : (100 / nodes.length);
            
            return (
              <div
                key={node.id}
                onClick={() => handleTimelineClick(index)}
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: index === currentNodeIndex ? 'var(--accent-color)' : 'transparent',
                  borderBottom: '1px solid var(--hover-color)',
                  transition: 'all 0.2s',
                  minHeight: '15px',
                  opacity: isTransitioning ? 0.7 : 1,
                  cursor: isTransitioning ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '2px'
                }}
              >
                {/* Horizontal line indicators for node length */}
                <div style={{
                  width: '90%',
                  height: '2px',
                  backgroundColor: index === currentNodeIndex ? 'white' : 'var(--secondary-color)',
                  opacity: 0.9,
                  borderRadius: '1px'
                }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Synthesis/Edit Bar */}
      {!isEditMode ? (
        <>
          {/* Synthesis Bar - Simple bottom bar */}
          {!synthesisExpanded && (
            <div style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'var(--card-background)',
              borderTop: '1px solid var(--border-color)',
              padding: '1rem',
              zIndex: 20
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <input
                  type="text"
                  placeholder="Add synthesis..."
                  value={userSynthesis}
                  onChange={(e) => setUserSynthesis(e.target.value)}
                  onClick={handleSynthesisExpand}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '1rem',
                    backgroundColor: 'var(--input-background)',
                    color: 'var(--primary-color)'
                  }}
                />
              </div>
            </div>
          )}

          {/* Expanded Synthesis Area */}
          {synthesisExpanded && (
            <div style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50vh',
              backgroundColor: 'var(--card-background)',
              borderTop: '1px solid var(--border-color)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.1rem',
                    color: 'var(--primary-color)'
                  }}>
                    Your Synthesis
                  </h3>
                  
                  {/* Action buttons in horizontal row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <button 
                      onClick={() => displayToast("Synthesize - coming soon!")}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-color)',
                        border: 'none',
                        color: 'white',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Synthesize"
                    >
                      <FaLightbulb />
                    </button>
                    <button 
                      onClick={() => displayToast("Ask questions - coming soon!")}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--success-color)',
                        border: 'none',
                        color: 'white',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Ask questions"
                    >
                      <FaCommentDots />
                    </button>
                    <button
                      onClick={handleSynthesisCollapse}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        color: 'var(--secondary-color)'
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <textarea
                  ref={synthesisRef}
                  value={userSynthesis}
                  onChange={handleUserSynthesisChange}
                  placeholder="Write your synthesis here..."
                  style={{
                    flex: 1,
                    padding: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    outline: 'none',
                    fontSize: '1rem',
                    resize: 'none',
                    backgroundColor: 'var(--input-background)',
                    color: 'var(--primary-color)'
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}
        </>
      ) : (
        /* Edit Mode Bar */
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100px',
          backgroundColor: 'var(--hover-color)',
          borderTop: '1px solid var(--border-color)',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: '0.5rem',
          alignItems: 'center',
          zIndex: 20,
          overflowX: 'auto'
        }}>
          <button 
            onClick={handleSplitNode}
            disabled={!currentNode || !nodeText.trim()}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: (!currentNode || !nodeText.trim()) ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            Split
          </button>
          <button 
            onClick={handleMergeWithNext}
            disabled={currentNodeIndex === nodes.length - 1}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--success-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            Merge
          </button>
          <button 
            onClick={handleDeleteNode}
            disabled={!currentNode}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--danger-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: !currentNode ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            Delete
          </button>
          <button 
            onClick={handleMoveUp}
            disabled={currentNodeIndex === 0}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--secondary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: currentNodeIndex === 0 ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            ↑
          </button>
          <button 
            onClick={handleMoveDown}
            disabled={currentNodeIndex === nodes.length - 1}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--secondary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            ↓
          </button>
          <button 
            onClick={handleMoveToFirst}
            disabled={currentNodeIndex === 0}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--secondary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: currentNodeIndex === 0 ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            First
          </button>
          <button 
            onClick={handleMoveToLast}
            disabled={currentNodeIndex === nodes.length - 1}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--secondary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
              minHeight: '40px'
            }}
          >
            Last
          </button>
          <button 
            onClick={handleBulkPaste}
            style={{
              padding: '0.5rem',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              minHeight: '40px'
            }}
          >
            Paste
          </button>
        </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            width: '90%',
            maxWidth: '600px',
            backgroundColor: 'var(--card-background)',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.1rem',
                color: 'var(--primary-color)'
              }}>
                Bulk Paste Text
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--secondary-color)'
                }}
              >
                ×
              </button>
            </div>
            <div style={{
              padding: '1rem'
            }}>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste your text here. Each paragraph will become a separate node."
                style={{
                  width: '100%',
                  height: '300px',
                  padding: '1rem',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--primary-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
                autoFocus
              />
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              padding: '1rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              <button
                onClick={() => setShowPasteModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-color)',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPaste}
                disabled={!pasteText.trim() || isProcessingPaste}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--accent-color)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  opacity: (!pasteText.trim() || isProcessingPaste) ? 0.5 : 1
                }}
              >
                {isProcessingPaste ? 'Processing...' : 'Process & Add Nodes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showToast && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '8px',
          zIndex: 1000,
          fontSize: '1rem'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default ReadingMode;
