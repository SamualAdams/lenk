import React, { useState } from 'react';
import { FaPlus, FaTimes, FaLightbulb, FaStickyNote, FaCommentDots } from 'react-icons/fa';

const WidgetCreator = ({ nodeId, onCreateWidget, isAuthor }) => {
  const [showCreator, setShowCreator] = useState(false);
  const [widgetType, setWidgetType] = useState('');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [quizData, setQuizData] = useState({
    question: '',
    choices: ['', '', '', ''],
    correctAnswer: 'A',
    explanation: ''
  });
  const [llmPreset, setLlmPreset] = useState('simplify');
  const [isCreating, setIsCreating] = useState(false);

  const authorWidgetTypes = [
    { value: 'author_remark', label: 'Author Remark', icon: <FaStickyNote /> },
    { value: 'author_quiz', label: 'Quiz', icon: <FaCommentDots /> },
    { value: 'author_dialog', label: 'Discussion', icon: <FaCommentDots /> }
  ];

  const readerWidgetTypes = [
    { value: 'reader_remark', label: 'Personal Note', icon: <FaStickyNote /> },
    { value: 'reader_llm', label: 'AI Assistant', icon: <FaLightbulb /> }
  ];

  const llmPresets = [
    { value: 'simplify', label: 'Simplify this node' },
    { value: 'analogy', label: 'Provide analogy' },
    { value: 'bullets', label: 'Make bulleted list' },
    { value: 'summary', label: 'Summarize' },
    { value: 'questions', label: 'Generate questions' }
  ];

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      let widgetData = {
        node: nodeId,
        widget_type: widgetType,
        content: content,
        title: title,
        is_required: isRequired
      };

      if (widgetType === 'author_quiz') {
        widgetData = {
          ...widgetData,
          quiz_question: quizData.question,
          quiz_choices: quizData.choices.filter(c => c.trim()),
          quiz_correct_answer: quizData.correctAnswer,
          quiz_explanation: quizData.explanation
        };
      }

      if (widgetType === 'reader_llm') {
        widgetData = {
          ...widgetData,
          llm_preset: llmPreset
        };
      }

      await onCreateWidget(widgetData, widgetType === 'reader_llm');
      resetForm();
    } catch (error) {
      console.error('Error creating widget:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setShowCreator(false);
    setWidgetType('');
    setContent('');
    setTitle('');
    setIsRequired(false);
    setQuizData({ question: '', choices: ['', '', '', ''], correctAnswer: 'A', explanation: '' });
    setLlmPreset('simplify');
  };

  const canCreate = () => {
    if (!widgetType) return false;
    
    if (widgetType === 'author_quiz') {
      return quizData.question.trim() && quizData.choices.filter(c => c.trim()).length >= 2;
    }
    
    if (widgetType === 'reader_llm') {
      return true; // LLM widgets don't need manual content
    }
    
    // For all other widgets, content is required
    return content.trim().length > 0;
  };

  const availableTypes = isAuthor ? authorWidgetTypes : readerWidgetTypes;

  if (!showCreator) {
    return (
      <button
        onClick={() => setShowCreator(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          color: 'var(--accent-color)',
          backgroundColor: 'var(--hover-color)',
          border: '1px solid var(--border-color)',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: 'inherit'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'var(--card-background)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'var(--hover-color)';
        }}
      >
        <FaPlus /> Add Widget
      </button>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.5rem',
      backgroundColor: 'var(--card-background)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem'
      }}>
        <h4 style={{
          margin: 0,
          fontWeight: '600',
          color: 'var(--primary-color)',
          fontSize: '1.1rem'
        }}>Create Widget</h4>
        <button 
          onClick={resetForm} 
          disabled={isCreating}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--secondary-color)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '0.25rem'
          }}
        >
          <FaTimes />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Widget Type Selection */}
        <div>
          <label style={{
            display: 'block',
            fontSize: '0.9rem',
            fontWeight: '500',
            marginBottom: '0.75rem',
            color: 'var(--primary-color)'
          }}>Widget Type</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {availableTypes.map(type => (
              <label key={type.value} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: widgetType === type.value ? 'var(--hover-color)' : 'transparent',
                transition: 'all 0.2s ease'
              }}>
                <input
                  type="radio"
                  name="widgetType"
                  value={type.value}
                  checked={widgetType === type.value}
                  onChange={(e) => setWidgetType(e.target.value)}
                  style={{
                    accentColor: 'var(--accent-color)'
                  }}
                />
                <span style={{ color: 'var(--secondary-color)' }}>{type.icon}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--primary-color)' }}>{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Title field (optional for most widgets) */}
        {widgetType && widgetType !== 'reader_llm' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: 'var(--primary-color)'
            }}>
              Title <span style={{ color: 'var(--secondary-color)' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--input-background)',
                color: 'var(--primary-color)',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              placeholder="Widget title..."
            />
          </div>
        )}

        {/* LLM Preset Selection */}
        {widgetType === 'reader_llm' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.75rem',
              color: 'var(--primary-color)'
            }}>AI Assistant Type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {llmPresets.map(preset => (
                <label key={preset.value} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: llmPreset === preset.value ? 'var(--hover-color)' : 'transparent',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="llmPreset"
                    value={preset.value}
                    checked={llmPreset === preset.value}
                    onChange={(e) => setLlmPreset(e.target.value)}
                    style={{
                      accentColor: 'var(--accent-color)'
                    }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--primary-color)' }}>{preset.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Quiz Fields */}
        {widgetType === 'author_quiz' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: 'var(--primary-color)'
              }}>Question *</label>
              <textarea
                value={quizData.question}
                onChange={(e) => setQuizData({...quizData, question: e.target.value})}
                style={{
                  width: '100%',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--primary-color)',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                placeholder="Enter your quiz question..."
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {quizData.choices.map((choice, index) => (
                <div key={index}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: 'var(--primary-color)'
                  }}>
                    Choice {String.fromCharCode(65 + index)} {index < 2 && '*'}
                  </label>
                  <input
                    type="text"
                    value={choice}
                    onChange={(e) => {
                      const newChoices = [...quizData.choices];
                      newChoices[index] = e.target.value;
                      setQuizData({...quizData, choices: newChoices});
                    }}
                    style={{
                      width: '100%',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      fontSize: '0.9rem',
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--primary-color)',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    placeholder={`Choice ${String.fromCharCode(65 + index)}...`}
                  />
                </div>
              ))}
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: 'var(--primary-color)'
              }}>Correct Answer *</label>
              <select
                value={quizData.correctAnswer}
                onChange={(e) => setQuizData({...quizData, correctAnswer: e.target.value})}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--primary-color)',
                  outline: 'none'
                }}
              >
                {['A', 'B', 'C', 'D'].slice(0, quizData.choices.filter(c => c.trim()).length).map(letter => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '0.5rem',
                color: 'var(--primary-color)'
              }}>
                Explanation <span style={{ color: 'var(--secondary-color)' }}>(optional)</span>
              </label>
              <textarea
                value={quizData.explanation}
                onChange={(e) => setQuizData({...quizData, explanation: e.target.value})}
                style={{
                  width: '100%',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  backgroundColor: 'var(--input-background)',
                  color: 'var(--primary-color)',
                  outline: 'none',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                placeholder="Explain why this is the correct answer..."
              />
            </div>
          </div>
        )}

        {/* Content Field for Non-Quiz, Non-LLM Widgets */}
        {widgetType && widgetType !== 'author_quiz' && widgetType !== 'reader_llm' && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: 'var(--primary-color)'
            }}>Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--input-background)',
                color: 'var(--primary-color)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
              placeholder="Enter widget content..."
            />
          </div>
        )}

        {/* Required checkbox for author widgets */}
        {isAuthor && widgetType && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="isRequired"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              style={{
                accentColor: 'var(--accent-color)'
              }}
            />
            <label htmlFor="isRequired" style={{
              fontSize: '0.9rem',
              color: 'var(--primary-color)',
              cursor: 'pointer'
            }}>
              Required (readers must complete before continuing)
            </label>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem' }}>
          <button
            onClick={handleCreate}
            disabled={!canCreate() || isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--accent-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              opacity: (!canCreate() || isCreating) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              if (!e.target.disabled) {
                e.target.style.backgroundColor = '#4a8cef';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.target.disabled) {
                e.target.style.backgroundColor = 'var(--accent-color)';
              }
            }}
          >
            {isCreating && widgetType === 'reader_llm' && <FaLightbulb style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />}
            {isCreating ? (widgetType === 'reader_llm' ? 'Generating...' : 'Creating...') : 'Create Widget'}
          </button>
          <button
            onClick={resetForm}
            disabled={isCreating}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              color: 'var(--primary-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              opacity: isCreating ? 0.5 : 1,
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              if (!e.target.disabled) {
                e.target.style.backgroundColor = 'var(--hover-color)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.target.disabled) {
                e.target.style.backgroundColor = 'transparent';
              }
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetCreator;