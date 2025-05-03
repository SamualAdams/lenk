import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [message, setMessage] = useState('');
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch hello message
    axios.get('http://localhost:8000/api/hello/')
      .then(response => {
        setMessage(response.data.message);
      })
      .catch(error => console.error('Error fetching message:', error));
    
    // Fetch items
    axios.get('http://localhost:8000/api/items/')
      .then(response => {
        setItems(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching items:', error);
        setLoading(false);
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:8000/api/items/', newItem)
      .then(response => {
        setItems([...items, response.data]);
        setNewItem({ name: '', description: '' });
      })
      .catch(error => console.error('Error creating item:', error));
  };

  const handleChange = (e) => {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Django + React App</h1>
        <p className="welcome-message">{message}</p>
        
        <div className="content-container">
          <div className="item-form-container">
            <h2>Add New Item</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newItem.name}
                  onChange={handleChange}
                  placeholder="Enter item name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={newItem.description}
                  onChange={handleChange}
                  placeholder="Enter item description"
                  required
                />
              </div>
              
              <button type="submit" className="submit-btn">Add Item</button>
            </form>
          </div>
          
          <div className="items-container">
            <h2>Items List</h2>
            {loading ? (
              <p>Loading items...</p>
            ) : items.length > 0 ? (
              <ul className="items-list">
                {items.map(item => (
                  <li key={item.id} className="item-card">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p className="created-at">Created: {new Date(item.created_at).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-items">No items yet. Add some!</p>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;