import React, { useState, useEffect, useRef, useCallback } from "react";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { FaTrashAlt, FaHome, FaExpandArrowsAlt, FaCheck, FaCopy } from "react-icons/fa";
import axiosInstance from "../axiosConfig";
import "./ReadingMode.css";
import Timeline from "./Timeline"; // Import the standalone Timeline component

function ReadingMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cognition, setCognition] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [synthesis, setSynthesis] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [presetCategories, setPresetCategories] = useState({});
  const [error, setError] = useState(null);
  const [expandMode, setExpandMode] = useState(false);
  const [newText, setNewText] = useState('');
  const [appendingText, setAppendingText] = useState(false);

  const [copiedNode, setCopiedNode] = useState(false);
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);

  // --- Multi-selection state for timeline blocks ---
  const [selectedIndices, setSelectedIndices] = useState(new Set());

  const currentNode = nodes[currentNodeIndex] || null;

  // --- State for editing node content ---
  const [nodeText, setNodeText] = useState("");
  // --- Sync nodeText with current node, but avoid overwriting unsaved edits ---
  useEffect(() => {
    const newContent = currentNode?.content || "";
    if (newContent !== nodeText) {
      setNodeText(newContent);
    }
  }, [currentNode]);

  // --- Debounced autosave for node content ---
  const debouncedSave = useCallback(
    debounce(async (text) => {
      if (!currentNode) return;
      try {
        console.log("Saving node via POST:", currentNode.id, text);
        const response = await axiosInstance.post("/nodes/add_or_update/", {
          node_id: currentNode.id,
          content: text
        });
        setNodes((nodes) =>
          nodes.map((n, idx) =>
            idx === currentNodeIndex ? { ...n, content: text } : n
          )
        );
      } catch (err) {
        console.error("Debounced save node error (POST):", err);
      }
    }, 1000),
    [currentNode, currentNodeIndex]
  );

  // cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  // handle textarea changes with debounced save
  const handleNodeChange = (e) => {
    const text = e.target.value;
    setNodeText(text);
    debouncedSave(text);
  };

  // --- Delete cognition handler ---
  const handleDeleteCognition = async () => {
    if (!window.confirm("Are you sure you want to delete this cognition?")) return;
    try {
      await axiosInstance.delete(`/cognitions/${id}/`);
      navigate("/");
    } catch (err) {
      setError("Failed to delete cognition");
    }
  };
  const synthesisRef = useRef(null);

  // --- Fetch cognition and nodes ---
  const fetchCognition = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axiosInstance.get(`/cognitions/${id}/?include_syntheses=true`);
      console.log("API response:", response.data);
      setCognition(response.data);
      setNodes(response.data.nodes || []);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to load cognition data");
      setIsLoading(false);
    }
  }, [id]);

  // --- Fetch preset responses ---
  const fetchPresetResponses = useCallback(async () => {
    try {
      setError(null);
      const response = await axiosInstance.get("/preset-responses/by_category/");
      setPresetCategories(response.data);
    } catch (err) {
      // ignore
    }
  }, []);

  // --- Save synthesis for a node ---
  const saveSynthesis = useCallback(
    async (nodeIndex) => {
      if (nodeIndex < 0 || nodeIndex >= nodes.length) return;
      const node = nodes[nodeIndex];
      try {
        const response = await axiosInstance.post("/syntheses/add_or_update/", {
          node_id: node.id,
          content: synthesis,
        });
        const updatedNodes = [...nodes];
        updatedNodes[nodeIndex] = {
          ...node,
          synthesis: {
            id: response.data.id,
            content: synthesis
          }
        };
        setNodes(updatedNodes);
      } catch (err) {
        // ignore
      }
    },
    [nodes, synthesis]
  );


  // --- Initial load ---
  useEffect(() => {
    fetchCognition();
    fetchPresetResponses();
    // eslint-disable-next-line
  }, [id]);

  // --- Update synthesis textarea when node changes ---
  useEffect(() => {
    if (nodes.length && currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      console.log("Current node:", nodes[currentNodeIndex]);
      console.log("Synthesis data:", nodes[currentNodeIndex]?.synthesis);
      setSynthesis(nodes[currentNodeIndex]?.synthesis?.content || "");
    } else {
      setSynthesis("");
    }
  }, [nodes, currentNodeIndex]);

  useEffect(() => {
    console.log("Updated nodes:", nodes);
  }, [nodes]);
  useEffect(() => {
    console.log("Current synthesis state:", synthesis);
  }, [synthesis]);



  // --- Navigation ---
  const goToNextNode = async () => {
    if (currentNodeIndex < nodes.length - 1) {
      await fetchCognition();
      setCurrentNodeIndex((i) => i + 1);
    }
  };
  const goToPreviousNode = async () => {
    if (currentNodeIndex > 0) {
      await fetchCognition();
      setCurrentNodeIndex((i) => i - 1);
    }
  };
  const handleTimelineClick = async (index, event) => {
    await fetchCognition();
    await saveSynthesis(currentNodeIndex);
    if (event && event.shiftKey) {
      const newSelection = new Set(selectedIndices);
      const rangeStart = Math.min(currentNodeIndex, index);
      const rangeEnd = Math.max(currentNodeIndex, index);
      for (let i = rangeStart; i <= rangeEnd; i++) {
        newSelection.add(i);
      }
      setSelectedIndices(newSelection);
    } else if (event && (event.ctrlKey || event.metaKey)) {
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      setSelectedIndices(newSelection);
    } else {
      setSelectedIndices(new Set([index]));
    }

    setCurrentNodeIndex(index);
  };
  const handleReturnHome = () => {
    navigate("/");
  };
  const handleSynthesisChange = (e) => setSynthesis(e.target.value);
  const handleToggleIllumination = async () => {
    if (nodes.length === 0 || currentNodeIndex >= nodes.length) return;
    try {
      const node = nodes[currentNodeIndex];
      const response = await axiosInstance.post(
        `/nodes/${node.id}/toggle_illumination/`
      );
      const updatedNodes = [...nodes];
      updatedNodes[currentNodeIndex] = {
        ...node,
        is_illuminated: response.data.is_illuminated,
      };
      setNodes(updatedNodes);
    } catch (err) {
      // ignore
    }
  };

  // --- Copy to clipboard handlers ---
  const handleCopyNode = () => {
    if (currentNode) {
      navigator.clipboard.writeText(currentNode.content);
      setCopiedNode(true);
      setTimeout(() => setCopiedNode(false), 1500);
    }
  };
  const handleCopySynthesis = () => {
    if (synthesis) {
      navigator.clipboard.writeText(synthesis);
      setCopiedSynthesis(true);
      setTimeout(() => setCopiedSynthesis(false), 1500);
    }
  };
  const handleCopyBoth = () => {
    const text = `${currentNode?.content || ""}\n\n${synthesis}`;
    navigator.clipboard.writeText(text);
    setCopiedBoth(true);
    setTimeout(() => setCopiedBoth(false), 1500);
  };
  // --- Preset response handling ---
  const togglePresetResponse = async (presetId) => {
    const node = nodes[currentNodeIndex];
    if (!node?.synthesis?.id) return;
    const synthId = node.synthesis.id;
    const isSelected = node.synthesis.presets?.some(p => p.id === presetId);
    try {
      if (isSelected) {
        await axiosInstance.post(`/syntheses/${synthId}/remove_preset/`, { preset_id: presetId });
      } else {
        await axiosInstance.post(`/syntheses/${synthId}/add_preset/`, { preset_id: presetId });
      }
      await fetchCognition();
    } catch (err) {
      console.error("Preset toggle error:", err);
    }
  };


  const handleAppendText = async () => {
    if (!newText.trim()) {
      setError("Please enter some text to append");
      return;
    }
    
    try {
      setAppendingText(true);
      setError(null);
      
      const response = await axiosInstance.post(`/cognitions/${id}/append_text/`, {
        text: newText
      });
      
      console.log('Text appended successfully:', response.data);
      
      // Refresh the cognition data to get the new nodes
      await fetchCognition();
      
      // Reset the expand mode and text
      setNewText('');
      setExpandMode(false);
      setAppendingText(false);
      
      // Navigate to the first of the newly added nodes
      const newNodeIndex = nodes.length; // This will be the index of the first new node
      setCurrentNodeIndex(newNodeIndex);
      
    } catch (err) {
      console.error('Error appending text:', err);
      setError('Failed to append text to cognition. Please try again.');
      setAppendingText(false);
    }
  };

  if (!cognition) {
    return <div className="reading-mode-error">Could not load cognition</div>;
  }

  return (
    <div className="reading-mode-container">
      <div className="reading-mode-timeline-wrapper">
        <Timeline
          nodes={nodes}
          currentIndex={currentNodeIndex}
          onClick={handleTimelineClick}
          selectedIndices={selectedIndices}
        />
      </div>

      <div className="reading-mode-mobile-layout">
        <div
          className="node-center-display"
          onClick={(e) => {
            const { left, width } = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - left;
            if (x < width / 2) {
              goToPreviousNode();
            } else {
              goToNextNode();
            }
          }}
          style={{ width: "100%", cursor: "pointer" }}
        >
          <div className="node-content-box">
            {currentNode?.content}
          </div>
        </div>
      </div>

      <div className="synthesis-bottom-bar">
        <textarea
          ref={synthesisRef}
          className="synthesis-textarea"
          value={synthesis}
          onChange={handleSynthesisChange}
          placeholder="Write your synthesis here..."
        />
      </div>
    </div>
  );
}

export default ReadingMode;

/* Minimal CSS for selector-group for inline-flex and margin */
// (If you don't use CSS-in-JS, add this to ReadingMode.css)
// .selector-group {
//   display: inline-flex;
//   align-items: center;
//   margin-right: 12px;
//   gap: 4px;
// }