import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
    <div className="min-h-screen bg-gray-800 text-white">
      <div className="container mx-auto py-10 px-4">
        <h1 className="text-3xl font-bold text-center text-cyan-400 mb-2">Django + React App</h1>
        <p className="text-xl text-center mb-10">{message}</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-gray-700 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-cyan-400 text-cyan-400">Add New Item</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block mb-2 font-medium">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newItem.name}
                  onChange={handleChange}
                  placeholder="Enter item name"
                  className="w-full p-2 rounded bg-gray-600 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="description" className="block mb-2 font-medium">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={newItem.description}
                  onChange={handleChange}
                  placeholder="Enter item description"
                  className="w-full p-2 rounded bg-gray-600 border border-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 min-h-[100px] resize-y"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-gray-800 font-bold py-2 px-4 rounded transition duration-300"
              >
                Add Item
              </button>
            </form>
          </div>
          
          {/* Items List Section */}
          <div className="bg-gray-700 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-cyan-400 text-cyan-400">Items List</h2>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-400"></div>
              </div>
            ) : items.length > 0 ? (
              <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {items.map(item => (
                  <li key={item.id} className="bg-gray-600 rounded-lg p-4 border-l-4 border-cyan-400">
                    <h3 className="text-lg font-medium text-cyan-300">{item.name}</h3>
                    <p className="mt-2 text-gray-300">{item.description}</p>
                    <p className="mt-2 text-xs text-gray-400 text-right">
                      Created: {new Date(item.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400 italic text-center py-10">No items yet. Add some!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;