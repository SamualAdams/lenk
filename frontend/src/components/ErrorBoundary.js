

import React from 'react';
import { useNavigate } from 'react-router-dom';

class ErrorBoundaryFallback extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but there was an error in the application.</p>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
          <button 
            onClick={() => window.location.href = '/'}
            className="error-home-btn"
          >
            Return to Home
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="error-reload-btn"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component to use hooks with class component
function ErrorBoundary({ children }) {
  const navigate = useNavigate();
  
  return (
    <ErrorBoundaryFallback navigate={navigate}>
      {children}
    </ErrorBoundaryFallback>
  );
}

export default ErrorBoundary;