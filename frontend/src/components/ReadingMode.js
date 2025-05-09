import React, { useState, useEffect, useRef, useCallback } from "react";
import debounce from 'lodash.debounce';
import { useParams, useNavigate } from "react-router-dom";
import { useSpeechSynthesis } from "react-speech-kit";
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
  const [autoplayActive, setAutoplayActive] = useState(false);
  const [presetCategories, setPresetCategories] = useState({});
  const [error, setError] = useState(null);
  const [voiceList, setVoiceList] = useState([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [expandMode, setExpandMode] = useState(false);
  const [newText, setNewText] = useState('');
  const [appendingText, setAppendingText] = useState(false);

  const [copiedNode, setCopiedNode] = useState(false);
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);

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
  const autoplayTimerRef = useRef(null);
  const lastNodeIndexRef = useRef(-1);
  const { speak, cancel, supported, voices } = useSpeechSynthesis();

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

  // --- Load voices using voiceschanged event ---
  useEffect(() => {
    let mounted = true;
    function updateVoices() {
      if (!window.speechSynthesis) return;
      const allVoices = window.speechSynthesis.getVoices();
      const en = allVoices.filter(v => v.lang.toLowerCase().startsWith("en")).slice(0,2);
      const mx = allVoices.filter(v => v.lang.toLowerCase() === "es-mx").slice(0,2);
      const v = [...en, ...mx];
      if (mounted) setVoiceList(v);
    }
    updateVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", updateVoices);
    // fallback: update after a short delay
    const t = setTimeout(updateVoices, 500);
    return () => {
      mounted = false;
      window.speechSynthesis?.removeEventListener("voiceschanged", updateVoices);
      clearTimeout(t);
    };
  }, []);

  // --- Select default voice when loaded ---
  useEffect(() => {
    if (voiceList.length > 0) {
      // Prefer English voice, fallback to first
      let idx = voiceList.findIndex(
        (v) => v.lang && v.lang.toLowerCase().startsWith("en")
      );
      if (idx === -1) idx = 0;
      setSelectedVoiceIndex(idx);
    }
  }, [voiceList]);

  // --- Initial load ---
  useEffect(() => {
    fetchCognition();
    fetchPresetResponses();
    if (window.speechSynthesis) window.speechSynthesis.getVoices();
    return () => {
      if (autoplayTimerRef.current) clearTimeout(autoplayTimerRef.current);
      cancel();
    };
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

  // --- Save synthesis when leaving node ---
  useEffect(() => {
    if (
      lastNodeIndexRef.current >= 0 &&
      lastNodeIndexRef.current < nodes.length &&
      lastNodeIndexRef.current !== currentNodeIndex
    ) {
      saveSynthesis(lastNodeIndexRef.current);
    }
    lastNodeIndexRef.current = currentNodeIndex;
    cancel();
    // Auto-play when cell changes
    handleReadCurrentNode();
    // eslint-disable-next-line
  }, [currentNodeIndex]);

  // --- Handle autoplay ---
  useEffect(() => {
    if (autoplayActive && !speaking && nodes.length > 0) {
      // Clear any existing timer
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      
      // Set new timer with a small delay
      autoplayTimerRef.current = setTimeout(() => {
        handleReadCurrentNode();
      }, 100);
    } else {
      // Clear timer if autoplay is disabled or we're speaking
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    }
    // eslint-disable-next-line
  }, [autoplayActive, speaking, nodes]);

  // --- Keyboard navigation ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          if (currentNodeIndex > 0) {
            handleStopSpeech();
            setCurrentNodeIndex((i) => i - 1);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentNodeIndex < nodes.length - 1) {
            handleStopSpeech();
            setCurrentNodeIndex((i) => i + 1);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          handleReadCurrentNode();
          break;
        case "ArrowDown":
          e.preventDefault();
          handleStopSpeech();
          break;
        case " ":
          e.preventDefault();
          handleToggleAutoplay();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line
  }, [currentNodeIndex, nodes.length, autoplayActive]);

  // --- Speech Synthesis Logic ---
  const handleReadCurrentNode = useCallback(() => {
    if (!voiceList.length || !supported) return;
    if (currentNodeIndex >= 0 && currentNodeIndex < nodes.length) {
      const nodeText = nodes[currentNodeIndex]?.content || "";
      const cleanText = nodeText
        .replace(/[#*_`~+=[\]{}()<>|\\/@%^&$]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleanText) {
        try {
          window.speechSynthesis.cancel();
          setTimeout(() => {
            setSpeaking(true);
            speak({
              text: cleanText,
              voice: voiceList[selectedVoiceIndex],
              rate: speechRate,
              pitch: 1.0,
              volume: 1.0,
              onend: () => {
                setSpeaking(false);
                if (!autoplayActive) cancel();
                if (autoplayActive && currentNodeIndex < nodes.length - 1) {
                  setCurrentNodeIndex((i) => i + 1);
                } else if (autoplayActive && currentNodeIndex >= nodes.length - 1) {
                  setAutoplayActive(false);
                }
              },
              onerror: (err) => {
                setSpeaking(false);
                setError("Speech synthesis error: " + (err?.message || "Unknown error"));
                setAutoplayActive(false);
              },
            });
          }, 50);
        } catch (err) {
          setSpeaking(false);
          setError("Speech error: " + (err?.message || "Unknown error"));
          setAutoplayActive(false);
        }
      } else if (autoplayActive && currentNodeIndex < nodes.length - 1) {
        setCurrentNodeIndex((i) => i + 1);
      }
    }
    // eslint-disable-next-line
  }, [voiceList, selectedVoiceIndex, currentNodeIndex, nodes, supported, autoplayActive, speak, speechRate, cancel]);

  const handleStopSpeech = useCallback(() => {
    try {
      window.speechSynthesis.cancel();
      cancel();
      setSpeaking(false);
      if (autoplayTimerRef.current) {
        clearTimeout(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
    } catch (err) {}
  }, [cancel]);

  // --- Navigation ---
  const goToNextNode = async () => {
    if (currentNodeIndex < nodes.length - 1) {
      await fetchCognition();
      handleStopSpeech();
      setCurrentNodeIndex((i) => i + 1);
      setTimeout(() => handleReadCurrentNode(), 50);
    }
  };
  const goToPreviousNode = async () => {
    if (currentNodeIndex > 0) {
      await fetchCognition();
      handleStopSpeech();
      setCurrentNodeIndex((i) => i - 1);
      setTimeout(() => handleReadCurrentNode(), 50);
    }
  };
  const handleTimelineClick = async (index) => {
    await fetchCognition();
    await saveSynthesis(currentNodeIndex);
    handleStopSpeech();
    setCurrentNodeIndex(index);
    setTimeout(() => handleReadCurrentNode(), 50);
  };
  const handleReturnHome = () => {
    navigate("/");
  };
  const handleSynthesisChange = (e) => setSynthesis(e.target.value);
  const handleVoiceChange = (e) => setSelectedVoiceIndex(Number(e.target.value));
  const handleToggleAutoplay = () => {
    if (autoplayActive) {
      handleStopSpeech();
      setAutoplayActive(false);
    } else {
      setAutoplayActive(true);
      // Start reading immediately when autoplay is enabled
      setTimeout(() => handleReadCurrentNode(), 50);
    }
  };
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
  const handleTestSpeech = () => {
    if (!voiceList.length || !supported) return;
    try {
      setSpeaking(true);
      speak({
        text: "This is a test of the speech synthesis",
        voice: voiceList[selectedVoiceIndex],
        rate: speechRate,
        pitch: 1.0,
        volume: 1.0,
        onend: () => setSpeaking(false),
        onerror: () => setSpeaking(false),
      });
    } catch (err) {
      setSpeaking(false);
      setError("Test speech error: " + (err?.message || "Unknown error"));
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

  // --- Error for unsupported speech synthesis ---
  useEffect(() => {
    if (!supported) {
      setError(
        "Speech synthesis is not supported in this browser. Please try Chrome, Edge, or Safari."
      );
    } else {
      setError(null);
    }
  }, [supported]);

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
  const speechSynthesisReady = supported && voiceList.length > 0;

  return (
    <div className="reading-mode-container">
      {expandMode && (
        <div className="expand-modal-overlay">
          <div className="expand-modal">
            <div className="expand-modal-header">
              <h3>Append Text to "{cognition?.title || 'Cognition'}"</h3>
              <button 
                className="close-btn" 
                onClick={() => setExpandMode(false)}
              >
                ×
              </button>
            </div>
            <div className="expand-modal-body">
              <textarea
                className="expand-textarea"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Paste or type additional text to append to this cognition..."
                rows={10}
              />
            </div>
            <div className="expand-modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setExpandMode(false)}
              >
                Cancel
              </button>
              <button
                className="append-btn"
                onClick={handleAppendText}
                disabled={appendingText || !newText.trim()}
              >
                {appendingText ? "Appending..." : "Append Text"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="reading-mode-split-layout">
        {/* Left Side - Controls and Synthesis */}
        <div className="reading-mode-controls-panel">
          <div className="node-info">
            <div className="title-row">
              <div className="cognition-title">{cognition?.title}</div>
              <div className="title-buttons">
                <button
                  onClick={() => setExpandMode(true)}
                  className="expand-btn"
                  title="Expand Cognition"
                  aria-label="Expand Cognition"
                >
                  <FaExpandArrowsAlt />
                </button>
                <button
                  onClick={handleReturnHome}
                  className="home-btn"
                  title="Return to Home"
                  aria-label="Return to Home"
                >
                  <FaHome />
                </button>
                <button
                  onClick={handleDeleteCognition}
                  className="delete-btn"
                  title="Delete Cognition"
                  aria-label="Delete Cognition"
                >
                  <FaTrashAlt />
                </button>
              </div>
            </div>
            <div className="timeline-wrapper">
              <Timeline
                nodes={nodes}
                currentIndex={currentNodeIndex}
                onClick={handleTimelineClick}
              />
            </div>
            <div className="navigation-controls">
              <button
                onClick={goToPreviousNode}
                disabled={currentNodeIndex <= 0 || isLoading}
                className="nav-btn"
                title="Previous Node (Left Arrow)"
              >
                ← Prev
              </button>
              <button
                onClick={goToNextNode}
                disabled={currentNodeIndex >= nodes.length - 1 || isLoading}
                className="nav-btn"
                title="Next Node (Right Arrow)"
              >
                Next →
              </button>
            </div>
            <div className="voice-controls">
              <div className="selector-group horizontal mb-2">
                <select
                  id="voice-select"
                  onChange={handleVoiceChange}
                  disabled={!speechSynthesisReady}
                  value={selectedVoiceIndex}
                  className="voice-select"
                >
                  {voiceList.length > 0 ? (
                    voiceList.map((voice, idx) => (
                      <option key={idx} value={idx}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  ) : (
                    <option value={0}>No voices available</option>
                  )}
                </select>
                <input
                  type="range"
                  min="0.5"
                  max="4"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  className="speech-rate-slider"
                />
              </div>
            </div>
            <div className="playback-controls">
              <button
                onClick={handleReadCurrentNode}
                disabled={isLoading || !speechSynthesisReady}
                className="control-btn"
                title="Read Aloud (Up Arrow)"
              >
                Read
              </button>
              <button
                onClick={handleStopSpeech}
                disabled={!speaking}
                className="control-btn"
                title="Stop Reading (Down Arrow)"
              >
                Stop
              </button>
              <button
                onClick={handleToggleAutoplay}
                disabled={isLoading || !speechSynthesisReady}
                className={`control-btn ${autoplayActive ? "active" : ""}`}
                title="Toggle Autoplay (Spacebar)"
              >
                {autoplayActive ? "⏹ Stop" : "▶ Play"}
              </button>
              <button
                onClick={handleToggleIllumination}
                disabled={isLoading}
                className={`control-btn ${
                  currentNode?.is_illuminated ? "active" : ""
                }`}
                title="Toggle Illumination"
              >
                {currentNode?.is_illuminated ? "★" : "☆"}
              </button>
            </div>
            {error && (
              <div className="error-message">
                {error}
                <button
                  onClick={() => setError(null)}
                  className="dismiss-error-btn"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
          <div className="synthesis-section">
            <textarea
              ref={synthesisRef}
              className="synthesis-textarea"
              value={synthesis}
              onChange={handleSynthesisChange}
              placeholder="Write your synthesis here..."
            />

            {currentNode?.synthesis?.presets?.length > 0 && (
              <div className="associated-presets">
                <div className="preset-scroll-box">
                  {currentNode.synthesis.presets.map((preset, index) => (
                    <div key={index} className="preset-block">
                      <div className="preset-block-title">{preset.title}</div>
                      <div className="preset-block-content">{preset.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Right Side - Content Display */}
        <div className="reading-mode-content-panel">
          <div className="content-wrapper">
            <div className="node-container">
              <textarea
                className="node-textarea"
                value={nodeText}
                onChange={handleNodeChange}
                placeholder="Edit the node content here..."
              />
            </div>
            <div className="copy-buttons">
              <button
                onClick={handleCopyNode}
                className="copy-btn copy-node-btn"
                title="Copy Node"
                aria-label="Copy Node"
              >
                {copiedNode && <FaCheck />}
              </button>
              <button
                onClick={handleCopyBoth}
                className="copy-btn copy-both-btn"
                title="Copy Both"
                aria-label="Copy Both"
              >
                {copiedBoth && <FaCheck />}
              </button>
              <button
                onClick={handleCopySynthesis}
                className="copy-btn copy-synthesis-btn"
                title="Copy Synthesis"
                aria-label="Copy Synthesis"
              >
                {copiedSynthesis && <FaCheck />}
              </button>
            </div>
          </div>
        </div>
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