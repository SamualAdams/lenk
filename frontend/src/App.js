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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto py-10 px-4">
        {/* Header Section */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-3">
            Django + React App
          </h1>
          <p className="text-xl text-gray-300 max-w-xl mx-auto">
            {message || "Connect your Django backend with React frontend"}
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden border border-gray-700">
            <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-blue-400">Add New Item</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label htmlFor="name" className="block mb-2 font-medium text-gray-300">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={newItem.name}
                    onChange={handleChange}
                    placeholder="Enter item name"
                    className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
                    required
                  />
                </div>
                
                <div className="mb-5">
                  <label htmlFor="description" className="block mb-2 font-medium text-gray-300">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={newItem.description}
                    onChange={handleChange}
                    placeholder="Enter item description"
                    className="w-full p-3 rounded-lg bg-gray-700/50 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 min-h-[120px] resize-y"
                    required
                  />
                </div>
                
                <button 
                  type="submit" 
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-medium rounded-lg shadow-lg transform hover:scale-[1.02] transition-all duration-200"
                >
                  Add Item
                </button>
              </form>
            </div>
          </div>
          
          {/* Items List Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-xl overflow-hidden border border-gray-700">
            <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-emerald-400">Items List</h2>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center h-60">
                  <div className="relative w-16 h-16">
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 opacity-20 rounded-full"></div>
                    <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent animate-spin rounded-full"></div>
                  </div>
                </div>
              ) : items.length > 0 ? (
                <ul className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {items.map(item => (
                    <li key={item.id} className="group bg-gray-700/30 hover:bg-gray-700/50 rounded-lg overflow-hidden transition-all duration-200 border border-gray-700 hover:border-gray-600">
                      <div className="p-5">
                        <h3 className="text-lg font-medium text-blue-400 group-hover:text-blue-300 mb-2">{item.name}</h3>
                        <p className="text-gray-300 mb-3">{item.description}</p>
                        <div className="flex justify-end">
                          <span className="text-xs text-gray-400">
                            Created: {new Date(item.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-400 text-lg">No items yet</p>
                  <p className="text-gray-500 mt-2">Add your first item using the form</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;