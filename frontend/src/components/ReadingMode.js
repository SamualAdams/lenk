import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaHome, FaStar, FaRegStar, FaEdit, FaPlus, FaCut, FaLink, FaArrowUp, FaArrowDown, FaStepBackward, FaStepForward, FaClipboard, FaExclamationTriangle } from "react-icons/fa";
// Removed FaCommentDots, FaLightbulb - synthesis functionality consolidated into widgets
import WidgetCard from './widgets/WidgetCard';
import WidgetCreator from './widgets/WidgetCreator';
import WidgetEditor from './widgets/WidgetEditor';
import MarkdownRenderer from './MarkdownRenderer';
import axiosInstance from "../axiosConfig";
import { summarizeNode } from "../axiosConfig";
import "./ReadingMode.css";

function ReadingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cognition, setCognition] = useState(null);
  const [titleInput, setTitleInput] = useState("");
  const [nodes, setNodes] = useState([]);
  // Store current node index in state to preserve it across updates
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [preserveNodeIndex, setPreserveNodeIndex] = useState(false);
  // Synthesis state removed - functionality consolidated into widgets
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  // Synthesis UI state removed - functionality consolidated into widgets
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
  const [editingWidget, setEditingWidget] = useState(null);
  const [showWidgetEditor, setShowWidgetEditor] = useState(false);

  const currentNode = nodes[currentNodeIndex] || null;
  const [nodeText, setNodeText] = useState("");
  const textareaRef = useRef(null);
  // synthesisRef removed - functionality consolidated into widgets
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
      
      // Preserve current node position after deletion
      const newNodeCount = nodes.length - 1;
      let newIndex = currentIndex;
      if (newNodeCount === 0) {
        newIndex = 0;
      } else if (currentIndex >= newNodeCount) {
        newIndex = newNodeCount - 1;
      }
      
      setCurrentNodeIndex(newIndex);
      
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

  // Synthesis debounced save function removed - functionality consolidated into widgets
  
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
      // debouncedSaveUserSynthesis.cancel(); // Removed - functionality consolidated into widgets
      debouncedSaveNodeContent.cancel();
    };
  }, [debouncedSaveNodeContent]); // Removed debouncedSaveUserSynthesis dependency

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
    if (!currentNode) return;
    
    // If not in edit mode, use the current node content as-is
    let content = currentNode.content;
    let splitPoint = Math.floor(content.length / 2); // Default to middle
    
    // If in edit mode, use the textarea content and cursor position
    if (isEditMode) {
      content = nodeText || currentNode.content;
      if (textareaRef.current) {
        splitPoint = textareaRef.current.selectionStart;
      } else {
        splitPoint = cursorPosition;
      }
    }
    
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
      displayToast(`Cannot split - need content on both sides of split point (${splitPoint})`);
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
        // Handle both author and reader LLM widgets
        console.log('Using LLM endpoint');
        response = await axiosInstance.post('/widgets/create_llm_widget/', {
          node_id: widgetData.node,
          llm_preset: widgetData.llm_preset,
          custom_prompt: widgetData.llm_custom_prompt || '',
          widget_type: widgetData.widget_type  // NEW parameter
        });
      } else {
        // Standard widget creation with improved validation
        console.log('Using standard endpoint');
        
        // Validate content based on widget type
        const { widget_type, content, quiz_question, title } = widgetData;
        
        if (widget_type === 'author_quiz' || widget_type === 'reader_quiz') {
          // For quiz widgets, require quiz_question instead of content
          if (!quiz_question || !quiz_question.trim()) {
            throw new Error('Quiz question is required for quiz widgets');
          }
        } else if (widget_type === 'author_remark' || widget_type === 'reader_remark') {
          // For remark widgets, require either content or title
          if ((!content || !content.trim()) && (!title || !title.trim())) {
            throw new Error('Content or title is required for remark widgets');
          }
        } else if (widget_type === 'author_dialog') {
          // For dialog widgets, require content
          if (!content || !content.trim()) {
            throw new Error('Content is required for dialog widgets');
          }
        }
        // LLM widgets are handled above, no additional validation needed
        
        response = await axiosInstance.post('/widgets/', widgetData);
      }
      
      // Optimistic update: Add widget to current node only
      const newWidget = response.data;
      setNodes(prevNodes => 
        prevNodes.map(node => 
          node.id === widgetData.node 
            ? { ...node, widgets: [...(node.widgets || []), newWidget] }
            : node
        )
      );
      
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
      
      // Optimistic update: Remove widget from nodes
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          widgets: node.widgets ? node.widgets.filter(w => w.id !== widgetId) : []
        }))
      );
      
      displayToast('Widget deleted');
    } catch (err) {
      console.error('Error deleting widget:', err);
      setError('Failed to delete widget');
      // Revert on error by refetching
      fetchCognition();
    }
  };

  const interactWithWidget = async (widgetId, interactionData) => {
    try {
      const response = await axiosInstance.post(`/widgets/${widgetId}/interact/`, interactionData);
      
      // Optimistic update: Update widget interaction in nodes
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          widgets: node.widgets ? node.widgets.map(widget => 
            widget.id === widgetId 
              ? { ...widget, user_interaction: response.data }
              : widget
          ) : []
        }))
      );
    } catch (err) {
      console.error('Error recording widget interaction:', err);
      setError('Failed to record interaction');
    }
  };

  const editWidget = (widget) => {
    setEditingWidget(widget);
    setShowWidgetEditor(true);
  };

  const saveWidgetEdit = async (widgetId, updateData) => {
    try {
      const response = await axiosInstance.patch(`/widgets/${widgetId}/`, updateData);
      
      // Optimistic update: Update widget in nodes
      setNodes(prevNodes => 
        prevNodes.map(node => ({
          ...node,
          widgets: node.widgets ? node.widgets.map(widget => 
            widget.id === widgetId 
              ? { ...widget, ...response.data }
              : widget
          ) : []
        }))
      );
      
      setShowWidgetEditor(false);
      setEditingWidget(null);
      displayToast('Widget updated successfully');
    } catch (err) {
      console.error('Error updating widget:', err);
      const errorMsg = err.response?.data?.error || err.response?.data?.content?.[0] || 'Failed to update widget';
      setError(errorMsg);
    }
  };

  const cancelWidgetEdit = () => {
    setShowWidgetEditor(false);
    setEditingWidget(null);
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
    const editBarHeight = isOwner ? 80 : 0;
    const availableHeight = window.innerHeight - headerHeight - editBarHeight;
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
  }, [isTransitioning, nodes.length, isOwner]);

  // Handle scroll events for snap detection
  const handleScroll = useCallback(() => {
    if (isTransitioning || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const headerHeight = 80;
    const editBarHeight = isOwner ? 80 : 0;
    const availableHeight = window.innerHeight - headerHeight - editBarHeight;
    const scrollTop = container.scrollTop;
    
    // Calculate which node should be active based on scroll position
    const newIndex = Math.round(scrollTop / availableHeight);
    const clampedIndex = Math.max(0, Math.min(nodes.length - 1, newIndex));
    
    if (clampedIndex !== currentNodeIndex) {
      setCurrentNodeIndex(clampedIndex);
    }
  }, [currentNodeIndex, isTransitioning, nodes.length, isOwner]);

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

  // Synthesis handlers removed - functionality consolidated into widgets

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

  // Fetch cognition and nodes (only used for initial load and major operations)
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get(`/cognitions/${id}/`); // Removed syntheses parameter
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

  // Synthesis update effect removed - functionality consolidated into widgets

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
        // Escape key handler for synthesis removed - functionality consolidated into widgets
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentNodeIndex, nodes.length, navigate, isTransitioning]); // Removed synthesisExpanded

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
  const editBarHeight = isOwner ? 80 : 0; // Always account for edit bar if owner
  const availableHeight = window.innerHeight - headerHeight - editBarHeight;

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
              {/* Edit Content Toggle Button */}
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
                title={isEditMode ? "Exit Content Edit (E)" : "Edit Content (E)"}
              >
                <FaEdit />
                {isEditMode ? 'Exit Edit' : 'Edit Content'}
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
            className="hide-scrollbar main-scroll-container"
            style={{
              flex: 1,
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollSnapType: 'y mandatory',
              scrollBehavior: 'smooth',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05)'
            }}
          >
            {nodes.map((node, index) => (
              <div
                key={node.id}
                style={{
                  minHeight: `${availableHeight}px`,
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  padding: '2rem 1.5rem',
                  opacity: index === currentNodeIndex ? 1 : 0.4,
                  transform: index === currentNodeIndex ? 'scale(1)' : 'scale(0.95)',
                  scrollSnapAlign: 'start',
                  overflow: 'visible',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{
                  maxWidth: '600px',
                  margin: '0 auto',
                  width: '100%',
                  minHeight: `${availableHeight * 0.7}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
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
                    <MarkdownRenderer 
                      content={node.content}
                      className="markdown-content"
                      style={{
                        fontSize: '1.4rem',
                        lineHeight: '1.6',
                        textAlign: 'left',
                        marginBottom: '1.5rem',
                        color: 'var(--primary-color)' // Ensure proper text color
                      }}
                    />
                  )}
                  
                  {/* Widgets display for current node */}
                  {index === currentNodeIndex && node.widgets && node.widgets.length > 0 && (
                    <div 
                      className="widget-container"
                      style={{
                        marginBottom: '1.5rem',
                        maxHeight: '30vh',
                        overflowY: 'auto',
                        paddingRight: '4px'
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
                  {index === currentNodeIndex && isOwner && (
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

      {/* Synthesis bar removed - functionality consolidated into widget system */}
      
      {/* Author Control Bar - Always visible for owners */}
      {isOwner && (
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
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem'
          }}>
            {/* Content Operations */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--secondary-color)',
                marginRight: '0.5rem'
              }}>Content:</span>
            <button 
              onClick={handleSplitNode}
              disabled={!currentNode || !currentNode.content.trim()}
              style={{
                width: '40px',
                height: '40px',
                backgroundColor: 'var(--accent-color)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                cursor: 'pointer',
                opacity: (!currentNode || !currentNode.content.trim()) ? 0.5 : 1,
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
              title={isEditMode ? "Split node at cursor" : "Split node at middle"}
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
            </div>
            
            {/* Node Movement */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--secondary-color)',
                marginRight: '0.5rem'
              }}>Move:</span>
            
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
            </div>
            
            {/* Utilities */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center'
            }}>
              <span style={{
                fontSize: '0.8rem',
                color: 'var(--secondary-color)',
                marginRight: '0.5rem'
              }}>Tools:</span>
            
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

      {/* Widget Editor Modal */}
      {showWidgetEditor && editingWidget && (
        <WidgetEditor
          widget={editingWidget}
          onSave={saveWidgetEdit}
          onCancel={cancelWidgetEdit}
          isVisible={showWidgetEditor}
        />
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
