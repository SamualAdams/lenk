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
  const [llmPreset, setLlmPreset] = useState('explain');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const authorWidgetTypes = [
    { value: 'author_remark', label: 'Author Remark', icon: <FaStickyNote /> },
    { value: 'author_quiz', label: 'Quiz', icon: <FaCommentDots /> },
    { value: 'author_dialog', label: 'Discussion', icon: <FaCommentDots /> },
    { value: 'author_llm', label: 'AI Assistant', icon: <FaLightbulb /> }
  ];

  const readerWidgetTypes = [
    { value: 'reader_remark', label: 'Personal Note', icon: <FaStickyNote /> },
    { value: 'reader_llm', label: 'AI Assistant', icon: <FaLightbulb /> }
  ];

  const authorLlmPresets = [
    { 
      value: 'explain', 
      label: 'Provide detailed explanation',
      prompt: 'As the author, provide a detailed explanation to help readers understand this concept better. Use markdown formatting (headers, bullet points, **bold**, *italic*) to structure your response clearly:'
    },
    { 
      value: 'examples', 
      label: 'Give practical examples',
      prompt: 'As the author, provide 2-3 concrete examples that illustrate this concept. Use markdown formatting with numbered lists or bullet points:'
    },
    { 
      value: 'context', 
      label: 'Add background context',
      prompt: 'As the author, provide important background context that readers need to understand this. Use markdown headers and formatting to organize the information:'
    },
    { 
      value: 'connections', 
      label: 'Show concept relationships',
      prompt: 'As the author, explain how this concept connects to related ideas or principles. Use markdown formatting to highlight key relationships:'
    },
    { 
      value: 'deeper_dive', 
      label: 'Expand with advanced details',
      prompt: 'As the author, expand on this concept with more advanced details and nuances. Use markdown formatting with headers and emphasis:'
    },
    { 
      value: 'clarify', 
      label: 'Clarify potential confusion',
      prompt: 'As the author, address potential points of confusion readers might have about this. Use markdown formatting to structure your clarifications:'
    },
    { 
      value: 'applications', 
      label: 'Show real-world applications',
      prompt: 'As the author, describe real-world applications and use cases for this concept. Use markdown formatting with bullet points or numbered lists:'
    },
  ];

  const readerLlmPresets = [
    { 
      value: 'simplify', 
      label: 'Simplify this node',
      prompt: 'Simplify this text in plain language. Use markdown formatting with bullet points or short paragraphs for clarity:'
    },
    { 
      value: 'analogy', 
      label: 'Provide analogy',
      prompt: 'Provide a helpful analogy for this concept. Use markdown formatting to structure your analogy clearly:'
    },
    { 
      value: 'bullets', 
      label: 'Make bulleted list',
      prompt: 'Convert this into a well-structured markdown bulleted list:'
    },
    { 
      value: 'summary', 
      label: 'Summarize',
      prompt: 'Summarize this text concisely using markdown formatting with headers and key points:'
    },
    { 
      value: 'questions', 
      label: 'Generate questions',
      prompt: 'Generate 2-3 study questions about this text. Format as a markdown numbered list:'
    }
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

      if (widgetType === 'reader_llm' || widgetType === 'author_llm') {
        widgetData = {
          ...widgetData,
          llm_preset: llmPreset,
          llm_custom_prompt: customPrompt // Use custom prompt instead of preset
        };
      }

      await onCreateWidget(widgetData, widgetType === 'reader_llm' || widgetType === 'author_llm');
      resetForm();
    } catch (error) {
      console.error('Error creating widget:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePresetClick = (presetPrompt) => {
    const currentText = customPrompt;
    const newText = currentText ? currentText + '\n\n' + presetPrompt : presetPrompt;
    setCustomPrompt(newText);
  };

  const resetForm = () => {
    setShowCreator(false);
    setWidgetType('');
    setContent('');
    setTitle('');
    setIsRequired(false);
    setQuizData({ question: '', choices: ['', '', '', ''], correctAnswer: 'A', explanation: '' });
    setLlmPreset('explain'); // Default to author preset
    setCustomPrompt(''); // Reset custom prompt
  };

  // Update LLM preset default when widget type changes
  React.useEffect(() => {
    if (widgetType === 'author_llm') {
      setLlmPreset('explain');
      setCustomPrompt(''); // Clear custom prompt when switching widget types
    } else if (widgetType === 'reader_llm') {
      setLlmPreset('simplify');
      setCustomPrompt(''); // Clear custom prompt when switching widget types
    }
  }, [widgetType]);

  const canCreate = () => {
    if (!widgetType) return false;
    
    if (widgetType === 'author_quiz') {
    return quizData.question.trim() && quizData.choices.filter(c => c.trim()).length >= 2;
    }
    
    if (widgetType === 'reader_llm' || widgetType === 'author_llm') {
    return customPrompt.trim().length > 0; // Require custom prompt for LLM widgets
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
        {widgetType && widgetType !== 'reader_llm' && widgetType !== 'author_llm' && (
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

        {/* AI Custom Prompt Interface */}
        {(widgetType === 'author_llm' || widgetType === 'reader_llm') && (
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.75rem',
              color: 'var(--primary-color)'
            }}>Custom AI Prompt</label>
            
            {/* Custom Prompt Text Area */}
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={{
                width: '100%',
                height: '120px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.9rem',
                backgroundColor: 'var(--input-background)',
                color: 'var(--primary-color)',
                outline: 'none',
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: '1rem'
              }}
              placeholder="Enter your custom prompt for the AI..."
            />
            
            {/* Preset Buttons */}
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--secondary-color)',
                marginBottom: '0.5rem'
              }}>Quick Add Presets:</div>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '0.5rem'
              }}>
                {(widgetType === 'author_llm' ? authorLlmPresets : readerLlmPresets).map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handlePresetClick(preset.prompt)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      backgroundColor: 'var(--hover-color)',
                      color: 'var(--primary-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
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
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--secondary-color)',
                marginTop: '0.5rem',
                fontStyle: 'italic'
              }}>Click buttons to add preset prompts to your custom prompt</div>
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
        {widgetType && widgetType !== 'author_quiz' && widgetType !== 'reader_llm' && widgetType !== 'author_llm' && (
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
            {isCreating && (widgetType === 'reader_llm' || widgetType === 'author_llm') && <FaLightbulb style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />}
            {isCreating ? ((widgetType === 'reader_llm' || widgetType === 'author_llm') ? 'Generating...' : 'Creating...') : 'Create Widget'}
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