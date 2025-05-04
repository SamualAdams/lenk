import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InputMode from './components/InputMode';
import ReadingMode from './components/ReadingMode';
import Navigation from './components/Navigation';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        {/* <Navigation /> */}
        <Routes>
          <Route path="/" element={<InputMode />} />
          <Route path="/cognition/:id" element={<ReadingMode />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;