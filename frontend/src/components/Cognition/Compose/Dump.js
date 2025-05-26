import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../../axiosConfig';
import './Dump.css';
import { FaPlus, FaSpinner } from 'react-icons/fa';

function Dump() {
  const [newCognitionText, setNewCognitionText] = useState('');
  const [creatingCognition, setCreatingCognition] = useState(false);
  const navigate = useNavigate();

  const handleCreateCognition = async () => {
    if (!newCognitionText.trim()) return;
    setCreatingCognition(true);
    try {
      const response = await axiosInstance.post('/cognitions/', {
        title: 'Untitled Cognition',
        raw_content: newCognitionText,
        is_starred: false,
      });
      await axiosInstance.post(`/cognitions/${response.data.id}/process_text/`);
      setNewCognitionText('');
      navigate(`/cognition/${response.data.id}`);
    } catch (err) {
      alert('Failed to create cognition');
    } finally {
      setCreatingCognition(false);
    }
  };

  return (
  <div
    className="
      flex flex-col
      p-4
      mb-300
      gap-2
      relative
      bg-red-500
      min-h-screen
    "
  >
    <textarea
      className="
        flex-1
        p-3
        rounded
        bg-gray-800
        text-gray-100
        resize-y
        placeholder-gray-500
        outline-none
        focus:ring-2
        focus:ring-red-400
      "
      placeholder="Paste or type cognition content here…"
      value={newCognitionText}
    />
  </div>
  );
}

export default Dump;