import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../axiosConfig';
import './InputMode.css';
import { FaStar, FaRegStar, FaTrashAlt, FaCopy } from 'react-icons/fa';

function InputMode() {
  const [cognitions, setCognitions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCognitions();
  }, []);

  const fetchCognitions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await axiosInstance.get('/cognitions/');
      setCognitions(response.data);
    } catch (err) {
      setError('Failed to load cognitions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this cognition?')) return;
    try {
      await axiosInstance.delete(`/cognitions/${id}/`);
      setCognitions(prev => prev.filter(c => c.id !== id));
    } catch {
      alert('Failed to delete cognition.');
    }
  };

  const handleDuplicateCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const original = cognitions.find(c => c.id === id);
      if (!original) return;
      const duplicateData = { ...original };
      delete duplicateData.id;
      duplicateData.title = original.title + ' (Copy)';
      const response = await axiosInstance.post('/cognitions/', duplicateData);
      setCognitions(prev => [...prev, response.data]);
    } catch {
      alert('Failed to duplicate cognition.');
    }
  };

  const handleStarCognition = async (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const cognition = cognitions.find(c => c.id === id);
      if (!cognition) return;
      const updated = { ...cognition, is_starred: !cognition.is_starred };
      await axiosInstance.put(`/cognitions/${id}/`, updated);
      setCognitions(prev => prev.map(c => (c.id === id ? updated : c)));
    } catch {
      alert('Failed to update star status.');
    }
  };

  const handleNewCognition = async () => {
    try {
      const response = await axiosInstance.post('/cognitions/', { title: 'Untitled Cognition', content: '', is_starred: false });
      setCognitions(prev => [...prev, response.data]);
      navigate(`/cognition/${response.data.id}`);
    } catch {
      alert('Failed to create new cognition.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axiosInstance.post('/cognitions/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCognitions(prev => [...prev, response.data]);
    } catch {
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const starredCognitions = cognitions.filter(c => c.is_starred);
  const unstarredCognitions = cognitions.filter(c => !c.is_starred);

  return (
    <div className="input-mode vertical-layout">
      <main className="mobile-network">
        <div className="cognition-list">
          {isLoading && !cognitions.length ? (
            <div className="loading">Loading cognitions...</div>
          ) : error && !cognitions.length ? (
            <p className="error-message">{error}</p>
          ) : cognitions.length === 0 ? (
            <p className="empty-message">No saved cognitions found.</p>
          ) : (
            <>
              <div className="starred-pane">
                <h2>Starred</h2>
                <ul className="cognition-group">
                  {starredCognitions.map(cognition => (
                    <li key={cognition.id} className="cognition-item">
                      <div className="cognition-row">
                        <Link to={`/cognition/${cognition.id}`} className="cognition-title">{cognition.title}</Link>
                        <div className="button-group">
                          <button className="delete-btn" onClick={(e) => handleDeleteCognition(cognition.id, e)} aria-label={`Delete ${cognition.title}`}><FaTrashAlt /></button>
                          <button className="duplicate-btn" onClick={(e) => handleDuplicateCognition(cognition.id, e)} aria-label={`Duplicate ${cognition.title}`}><FaCopy /></button>
                          <button className="template-btn" data-starred={cognition.is_starred} onClick={(e) => handleStarCognition(cognition.id, e)} aria-label={`Toggle star for ${cognition.title}`}>{cognition.is_starred ? <FaStar /> : <FaRegStar />}</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="unstarred-pane">
                <h2>All Cognitions</h2>
                <ul className="cognition-group">
                  {unstarredCognitions.map(cognition => (
                    <li key={cognition.id} className="cognition-item">
                      <div className="cognition-row">
                        <Link to={`/cognition/${cognition.id}`} className="cognition-title">{cognition.title}</Link>
                        <div className="button-group">
                          <button className="delete-btn" onClick={(e) => handleDeleteCognition(cognition.id, e)} aria-label={`Delete ${cognition.title}`}><FaTrashAlt /></button>
                          <button className="duplicate-btn" onClick={(e) => handleDuplicateCognition(cognition.id, e)} aria-label={`Duplicate ${cognition.title}`}><FaCopy /></button>
                          <button className="template-btn" data-starred={cognition.is_starred} onClick={(e) => handleStarCognition(cognition.id, e)} aria-label={`Toggle star for ${cognition.title}`}>{cognition.is_starred ? <FaStar /> : <FaRegStar />}</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="mobile-footer">
        <button className="collective-btn">Collective</button>
        <div className="bottom-button-row">
          <button className="arcs-btn">Arcs</button>
          <button className="new-btn" onClick={handleNewCognition}>New</button>
        </div>
      </footer>
    </div>
  );
}

export default InputMode;