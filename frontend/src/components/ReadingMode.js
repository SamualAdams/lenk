import React from "react";
import { FaTrashAlt, FaHome, FaPlus, FaCheck, FaCopy, 
         FaChevronLeft, FaChevronRight, FaStar, FaRegStar } from "react-icons/fa";
import { FaRegEdit } from "react-icons/fa";
import "./ReadingMode.css";

function ReadingMode() {
  return (
    <div className="reading-mode-container">
      {/* Header section */}
      <header className="reading-header">
        <div className="header-left">
          <h1 className="cognition-title">Cognition Title</h1>
        </div>
        <div className="header-actions">
          <button className="icon-button edit-btn" title="Edit mode">
            <FaRegEdit />
          </button>
          <button className="icon-button delete-btn" title="Delete">
            <FaTrashAlt />
          </button>
          <button className="icon-button home-btn" title="Return to home">
            <FaHome />
          </button>
          <button className="icon-button star-btn" title="Star">
            <FaRegStar />
          </button>
        </div>
      </header>

      {/* Timeline section */}
      <div className="timeline-wrapper">
        <div className="timeline-preview">
          <div className="timeline-node"></div>
          <div className="timeline-node"></div>
          <div className="timeline-node current"></div>
          <div className="timeline-node"></div>
          <div className="timeline-node illuminated"></div>
          <div className="timeline-node"></div>
          <div className="timeline-node synthesis"></div>
        </div>
      </div>

      {/* Main content area */}
      <main className="reading-content">
        {/* Node content */}
        <div className="node-content-wrapper">
          <div className="node-content-actions">
            <button className="icon-button" title="Illuminate node">
              <FaStar className="illumination-indicator" />
            </button>
            <button className="icon-button copy-btn" title="Copy node content">
              <FaCopy />
            </button>
          </div>
          
          <div className="node-content-box">
            This is the current node content. This text would typically contain the main content of the selected node that the user is viewing.
          </div>

          {/* Node action ribbon */}
          <div className="node-action-ribbon">
            <button className="action-tag summarize-tag">Summarize</button>
            <button className="action-tag challenge-tag">Challenge</button>
            <button className="action-tag">Bullet Points</button>
            <button className="action-tag">Question</button>
          </div>
        </div>

        {/* AI Synthesis - Enhanced */}
        <div className="synthesis-section ai-synthesis">
          <div className="synthesis-header">
            <div className="synthesis-label">
              <span className="ai-icon">✦</span> AI Synthesis
            </div>
            <div className="synthesis-actions">
              <button className="icon-button copy-btn" title="Copy AI synthesis">
                <FaCopy />
              </button>
            </div>
          </div>
          <div className="synthesis-content">
            This is an AI-generated synthesis of the node content, providing an automated analysis and summary.
          </div>
        </div>


        {/* Synthesis sections */}
        <div className="synthesis-sections">
          {/* Author's Synthesis */}
          <div className="synthesis-section author-synthesis">
            <div className="synthesis-header">
              <div className="synthesis-label">Author's Synthesis</div>
              <div className="synthesis-actions">
                <button className="icon-button copy-btn" title="Copy author's synthesis">
                  <FaCopy />
                </button>
              </div>
            </div>
            <div className="synthesis-content">
              This is the author's synthesis of the node. It represents the author's thoughts and analysis of the content.
            </div>
          </div>

          {/* User's Synthesis */}
          <div className="synthesis-section user-synthesis">
            <div className="synthesis-header">
              <div className="synthesis-label">Your Synthesis</div>
              <div className="synthesis-actions">
                <button className="icon-button copy-btn" title="Copy your synthesis">
                  <FaCopy />
                </button>
              </div>
            </div>
            <textarea
              className="synthesis-textarea"
              placeholder="Write your own synthesis here..."
            >this is my reaction to the node.</textarea>
          </div>

        </div>
      </main>
    </div>
  );
}

export default ReadingMode;