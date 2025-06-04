import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaHome, FaStar, FaRegStar, FaEdit, FaPlus, FaCommentDots, FaLightbulb, FaCut, FaLink, FaArrowUp, FaArrowDown, FaStepBackward, FaStepForward, FaClipboard, FaExclamationTriangle } from "react-icons/fa";
import WidgetCard from './widgets/WidgetCard';
import WidgetCreator from './widgets/WidgetCreator';
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
  const [showWidgetCreator, setShowWidgetCreator] = useState(false);
  const [blockedByRequired, setBlockedByRequired] = useState(false);

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
      const currentIndex = currentNodeIndex;
      const totalNodes = nodes.length;
      
      await axiosInstance.delete(`/nodes/${currentNode.id}/`);
      
      await fetchCognition();
      
      // Smart positioning after deletion
      let newIndex = currentIndex;
      if (totalNodes === 1) {
        // If it was the only node, stay at 0
        newIndex = 0;
      } else if (currentIndex === totalNodes - 1) {
        // If we deleted the last node, go to the new last node
        newIndex = currentIndex - 1;
      } else {
        // Otherwise, stay at the same index (which now shows the next node)
        newIndex = currentIndex;
      }
      
      // Force scroll to the correct position after refresh
      setTimeout(() => {
        scrollToNode(newIndex);
      }, 100);
      
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
      const currentIndex = currentNodeIndex;
      
      await axiosInstance.post(`/nodes/${currentNode.id}/merge_with_next/`, {
        separator: ' '
      });
      
      await fetchCognition();
      
      // Force scroll to the correct position after refresh
      setTimeout(() => {
        scrollToNode(currentIndex);
      }, 100);
      
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
    
    // Get the current cursor position from the textarea
    let splitPoint = 0;
    if (textareaRef.current) {
      splitPoint = textareaRef.current.selectionStart;
    } else {
      splitPoint = cursorPosition;
    }
    
    // Use the current nodeText which is the edited version
    const content = nodeText || currentNode.content;
    const beforeContent = content.substring(0, splitPoint).trim();
    const afterContent = content.substring(splitPoint).trim();
    
    console.log('Split debug:', {
      splitPoint,
      contentLength: content.length,
      beforeContent: beforeContent.substring(0, 20) + '...',
      afterContent: afterContent.substring(0, 20) + '...',
      beforeLength: beforeContent.length,
      afterLength: afterContent.length
    });
    
    if (!beforeContent || !afterContent) {
      displayToast(`Cannot split - need content on both sides of cursor (split at ${splitPoint})`);
      return;
    }
    
    try {
      const currentIndex = currentNodeIndex;
      
      // Use the backend's split_node endpoint
      await axiosInstance.post(`/nodes/${currentNode.id}/split_node/`, {
        split_position: splitPoint
      });
      
      // Refresh cognition data
      await fetchCognition();
      
      // Force scroll to the correct position after refresh
      setTimeout(() => {
        scrollToNode(currentIndex);
      }, 100);
      
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


  // Widget functions
  const createWidget = async (widgetData, isLLM = false) => {
    try {
      let response;
      
      console.log('Creating widget:', { widgetData, isLLM }); // Debug log
      
      if (isLLM) {
        // Use the special LLM endpoint
        console.log('Using LLM endpoint');
        response = await axiosInstance.post('/widgets/create_llm_widget/', {
          node_id: widgetData.node,
          llm_preset: widgetData.llm_preset,
          custom_prompt: widgetData.llm_custom_prompt || ''
        });
      } else {
        // Standard widget creation - ensure content is provided
        console.log('Using standard endpoint');
        
        // For non-LLM widgets, ensure content is not empty
        if (!widgetData.content || !widgetData.content.trim()) {
          throw new Error('Content is required for this widget type');
        }
        
        response = await axiosInstance.post('/widgets/', widgetData);
      }
      
      await fetchCognition(); // Refresh to get updated widgets
      setShowWidgetCreator(false);
      displayToast('Widget created successfully');
    } catch (err) {
      console.error('Error creating widget:', err);
      console.error('Request data:', widgetData);
      const errorMsg = err.response?.data?.error || err.response?.data?.content?.[0] || err.message || 'Failed to create widget';
      setError(errorMsg);
    }
  };

  const deleteWidget = async (widgetId) => {
    if (!window.confirm('Are you sure you want to delete this widget?')) return;
    
    try {
      await axiosInstance.delete(`/widgets/${widgetId}/`);
      await fetchCognition();
      displayToast('Widget deleted');
    } catch (err) {
      console.error('Error deleting widget:', err);
      setError('Failed to delete widget');
    }
  };

  const interactWithWidget = async (widgetId, interactionData) => {
    try {
      await axiosInstance.post(`/widgets/${widgetId}/interact/`, interactionData);
      await fetchCognition(); // Refresh to update interaction state
    } catch (err) {
      console.error('Error recording widget interaction:', err);
      setError('Failed to record interaction');
    }
  };

  const editWidget = (widget) => {
    // For now, just show a toast - we can implement edit functionality later
    displayToast('Widget editing coming soon!');
  };

  // Check if current node has required widgets that aren't completed
  const checkRequiredWidgets = useCallback(() => {
    if (!currentNode || !currentNode.widgets) {
      setBlockedByRequired(false);
      return;
    }

    const requiredWidgets = currentNode.widgets.filter(w => w.is_required && w.is_author_widget);
    const hasIncomplete = requiredWidgets.some(w => !w.user_interaction?.completed);
    setBlockedByRequired(hasIncomplete);
  }, [currentNode]);

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
    if (blockedByRequired && !isOwner) {
      displayToast('Please complete all required widgets before continuing');
      return;
    }
    
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

  // Check required widgets when node changes
  useEffect(() => {
    checkRequiredWidgets();
  }, [checkRequiredWidgets]);

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
        {/* Vertical Timeline */}
        <div style={{
          width: '12px',
          backgroundColor: 'var(--border-color)',
          position: 'relative',
          cursor: 'pointer',
          flexShrink: 0,
          zIndex: 40,
          height: '100%'
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
                  transition: 'all 0.2s',
                  minHeight: '3px',
                  opacity: isTransitioning ? 0.7 : 1,
                  cursor: isTransitioning ? 'not-allowed' : 'pointer',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxSizing: 'border-box'
                }}
              >
                {/* Blue background for current node */}
                {index === currentNodeIndex && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'var(--accent-color)',
                    zIndex: 1
                  }} />
                )}
                
                {/* Horizontal line indicators for node length */}
                <div style={{
                  width: '90%',
                  height: '2px',
                  backgroundColor: index === currentNodeIndex ? 'white' : 'var(--secondary-color)',
                  opacity: 0.9,
                  borderRadius: '1px',
                  position: 'relative',
                  zIndex: 2
                }} />
              </div>
            );
          })}
        </div>

        {/* Content Wrapper for Node and Synthesis */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
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
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
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
                  width: '100%',
                  maxHeight: '100%',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1
                }}>
                  {/* Node content - editable in edit mode */}
                  {isEditMode && index === currentNodeIndex ? (
                    <textarea
                      ref={textareaRef}
                      value={nodeText}
                      onChange={handleNodeContentChange}
                      onSelect={(e) => setCursorPosition(e.target.selectionStart)}
                      onFocus={(e) => setCursorPosition(e.target.selectionStart)}
                      onClick={(e) => setCursorPosition(e.target.selectionStart)}
                      onKeyUp={(e) => setCursorPosition(e.target.selectionStart)}
                      style={{
                        width: '100%',
                        minHeight: '200px',
                        maxHeight: '60vh',
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
                        fontFamily: 'inherit',
                        overflowY: 'auto',
                        boxSizing: 'border-box'
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
                  
                  {/* Widgets display for current node */}
                  {index === currentNodeIndex && node.widgets && node.widgets.length > 0 && (
                    <div style={{
                      marginBottom: '1.5rem',
                      maxHeight: '40vh',
                      overflowY: 'auto'
                    }}>
                      <div style={{
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: 'var(--secondary-color)',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        Interactive Elements
                        {blockedByRequired && !isOwner && (
                          <FaExclamationTriangle 
                            style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }} 
                            title="Complete required widgets to continue"
                          />
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {node.widgets.map(widget => (
                          <WidgetCard
                            key={widget.id}
                            widget={widget}
                            onInteract={interactWithWidget}
                            onEdit={editWidget}
                            onDelete={deleteWidget}
                            isOwner={widget.username === currentUser?.username}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Widget Creator for current node */}
                  {index === currentNodeIndex && (isEditMode || !synthesisExpanded) && (
                    <div style={{ marginBottom: '1rem' }}>
                      <WidgetCreator
                        nodeId={node.id}
                        onCreateWidget={createWidget}
                        isAuthor={isOwner}
                      />
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
              left: '12px',  // Start after timeline
              right: 0,
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
              left: '12px',  // Start after timeline
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
          left: '12px',  // Start after timeline
          right: 0,
          backgroundColor: 'var(--hover-color)',
          borderTop: '1px solid var(--border-color)',
          padding: '1rem',
          zIndex: 20
        }}>
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(50px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <button 
              onClick={handleSplitNode}
              disabled={!currentNode || !nodeText.trim()}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: (!currentNode || !nodeText.trim()) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#4a8cef';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--accent-color)';
                }
              }}
              title="Split node at cursor"
            >
              <FaCut />
            </button>
            
            <button 
              onClick={handleMergeWithNext}
              disabled={currentNodeIndex === nodes.length - 1}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--success-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#45a049';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--success-color)';
                }
              }}
              title="Merge with next node"
            >
              <FaLink />
            </button>
            
            <button 
              onClick={handleDeleteNode}
              disabled={!currentNode}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--danger-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: !currentNode ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#ff3333';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--danger-color)';
                }
              }}
              title="Delete current node"
            >
              <FaTrashAlt />
            </button>
            
            <button 
              onClick={handleMoveUp}
              disabled={currentNodeIndex === 0}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--secondary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: currentNodeIndex === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#777';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--secondary-color)';
                }
              }}
              title="Move node up"
            >
              <FaArrowUp />
            </button>
            
            <button 
              onClick={handleMoveDown}
              disabled={currentNodeIndex === nodes.length - 1}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--secondary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#777';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--secondary-color)';
                }
              }}
              title="Move node down"
            >
              <FaArrowDown />
            </button>
            
            <button 
              onClick={handleMoveToFirst}
              disabled={currentNodeIndex === 0}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--secondary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: currentNodeIndex === 0 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#777';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--secondary-color)';
                }
              }}
              title="Move to first position"
            >
              <FaStepBackward />
            </button>
            
            <button 
              onClick={handleMoveToLast}
              disabled={currentNodeIndex === nodes.length - 1}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--secondary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: currentNodeIndex === nodes.length - 1 ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = '#777';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.backgroundColor = 'var(--secondary-color)';
                }
              }}
              title="Move to last position"
            >
              <FaStepForward />
            </button>
            
            <button 
              onClick={handleBulkPaste}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#4a8cef';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'var(--accent-color)';
              }}
              title="Bulk paste text"
            >
              <FaClipboard />
            </button>
          </div>
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
