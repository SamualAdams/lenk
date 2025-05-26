import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navigation from '../../Navigation';
import "./ReadingMode.css";

function ReadingMode() {
  const { id } = useParams();
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    const fetchCognition = async () => {
      try {
        const response = await fetch(`/api/cognitions/${id}/`);
        const data = await response.json();
        setNodes(data.nodes || []);
      } catch (error) {
        console.error("Failed to load cognition:", error);
      }
    };

    fetchCognition();
  }, [id]);

  return (
    <div className="reading-mode-container">
      <Navigation />
      <div className="snapchat-style-view">
        {nodes.map((node, index) => (
          <div key={index} className="snap-panel">
            <p>{node.content}hi</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReadingMode;