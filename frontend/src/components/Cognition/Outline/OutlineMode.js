import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import Navigation from '../../Navigation';
import Timeline from '../Timeline';
import './OutlineMode.css';
import { FaSave, FaArrowLeft, FaPlus, FaTrash } from 'react-icons/fa';

function OutlineMode({ id: propId, inComposeView, onBack }) {
  const params = useParams();
  const navigate = useNavigate();
  const id = propId || params.id; // Use prop ID if provided, otherwise use URL param
  
  const [cognition, setCognition] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  
  // Fetch cognition data
  useEffect(() => {
    const fetchCognition = async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get(`/cognitions/${id}/`);
        setCognition(response.data);
        setNodes(response.data.nodes || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to load cognition');
        setLoading(false);
      }
    };
    
    if (id) {
      fetchCognition();
    }
  }, [id]);
  
  // Handle node selection from Timeline
  const handleNodeSelect = (index) => {
    setCurrentNodeIndex(index);
  };
  
  // Save node changes incrementally with debounce
  const saveNode = useCallback(async (nodeId, content) => {
    if (!nodeId) return;
    
    setSaveStatus('saving');
    try {
      await axiosInstance.post('/nodes/add_or_update/', {
        node_id: nodeId,
        content: content
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Error saving node:', err);
      setSaveStatus('error');
      // Reset save status after showing error briefly
      setTimeout(() => setSaveStatus('saved'), 3000);
    }
  }, []);
  
  // Node content change handler with debouncing
  const handleNodeContentChange = (e) => {
    const updatedContent = e.target.value;
    const nodeId = nodes[currentNodeIndex]?.id;
    
    // Update local state immediately for responsiveness
    const updatedNodes = [...nodes];
    updatedNodes[currentNodeIndex] = {
      ...updatedNodes[currentNodeIndex],
      content: updatedContent,
      character_count: updatedContent.length
    };
    setNodes(updatedNodes);
    
    // Set saving status
    setSaveStatus('saving');
    
    // Debounce the actual save
    const timer = setTimeout(() => {
      saveNode(nodeId, updatedContent);
    }, 1000);
    
    return () => clearTimeout(timer);
  };
  
  // Add a new node after the current one
  const handleAddNode = async () => {
    const newPosition = currentNodeIndex + 1;
    
    try {
      // Create empty node
      const response = await axiosInstance.post('/nodes/', {
        cognition: id,
        content: '',
        position: newPosition,
        character_count: 0,
        is_illuminated: false
      });
      
      // Update local nodes array
      const newNodes = [...nodes];
      // Increment positions of nodes after the new one
      const updatedNodes = newNodes.map(node => {
        if (node.position >= newPosition) {
          return { ...node, position: node.position + 1 };
        }
        return node;
      });
      
      // Insert new node
      updatedNodes.splice(newPosition, 0, response.data);
      setNodes(updatedNodes);
      setCurrentNodeIndex(newPosition);
    } catch (err) {
      alert('Failed to add new node');
    }
  };
  
  // Delete the current node
  const handleDeleteNode = async () => {
    if (nodes.length <= 1) {
      alert('Cannot delete the only node. A cognition must have at least one node.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this node?')) {
      return;
    }
    
    const nodeId = nodes[currentNodeIndex]?.id;
    
    try {
      await axiosInstance.delete(`/nodes/${nodeId}/`);
      
      // Update local state
      const updatedNodes = nodes.filter((_, index) => index !== currentNodeIndex);
      setNodes(updatedNodes);
      
      // Adjust current index if needed
      if (currentNodeIndex >= updatedNodes.length) {
        setCurrentNodeIndex(updatedNodes.length - 1);
      }
    } catch (err) {
      alert('Failed to delete node');
    }
  };
  
  // Handle back button click
  const handleBack = () => {
    if (inComposeView && onBack) {
      onBack(); // Use callback if in compose view
    } else {
      navigate('/dump'); // Otherwise go to dump view
    }
  };
  
  if (loading) {
    return <div className="outline-loading">Loading...</div>;
  }
  
  if (error) {
    return <div className="outline-error">{error}</div>;
  }
  
  const currentNode = nodes[currentNodeIndex];
  
  return (
    <div className={`outline-mode-container ${inComposeView ? 'in-compose-view' : ''}`}>
      <div className="outline-header">
        <button className="back-button" onClick={handleBack} aria-label="Back">
          <FaArrowLeft />
        </button>
        <h1 className="cognition-title">{cognition?.title || 'Untitled'}</h1>
        <div className="save-status">
          {saveStatus === 'saving' && <span className="saving">Saving...</span>}
          {saveStatus === 'saved' && <span className="saved">Saved</span>}
          {saveStatus === 'error' && <span className="error">Error saving</span>}
        </div>
      </div>
      
      {nodes.length > 0 && (
        <>
          <Timeline 
            nodes={nodes} 
            currentIndex={currentNodeIndex} 
            onClick={handleNodeSelect} 
          />
          
          <div className="outline-editor">
            <div className="node-controls">
              <button className="control-button add-node" onClick={handleAddNode} aria-label="Add node">
                <FaPlus />
              </button>
              <button className="control-button delete-node" onClick={handleDeleteNode} aria-label="Delete node">
                <FaTrash />
              </button>
            </div>
            
            <textarea
              className="node-editor"
              value={currentNode?.content || ''}
              onChange={handleNodeContentChange}
              placeholder="Start writing..."
            />
          </div>
        </>
      )}
      
      {!inComposeView && <Navigation />}
    </div>
  );
}

export default OutlineMode;