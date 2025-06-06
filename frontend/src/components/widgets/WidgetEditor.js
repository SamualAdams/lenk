import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave } from 'react-icons/fa';
import MarkdownRenderer from '../MarkdownRenderer';

const WidgetEditor = ({ widget, onSave, onCancel, isVisible }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    quiz_question: '',
    quiz_choices: ['', '', '', ''],
    quiz_correct_answer: '',
    quiz_explanation: '',
    is_required: false
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (widget && isVisible) {
      setFormData({
        title: widget.title || '',
        content: widget.content || '',
        quiz_question: widget.quiz_question || '',
        quiz_choices: widget.quiz_choices?.length ? widget.quiz_choices : ['', '', '', ''],
        quiz_correct_answer: widget.quiz_correct_answer || '',
        quiz_explanation: widget.quiz_explanation || '',
        is_required: widget.is_required || false
      });
      setErrors({});
    }
  }, [widget, isVisible]);

  const validateForm = () => {
    const newErrors = {};

    if (widget?.widget_type === 'author_quiz') {
      if (!formData.quiz_question?.trim()) {
        newErrors.quiz_question = 'Quiz question is required';
      }
      if (!formData.quiz_correct_answer) {
        newErrors.quiz_correct_answer = 'Correct answer is required';
      }
      // Check if all choices are filled
      const filledChoices = formData.quiz_choices.filter(choice => choice.trim());
      if (filledChoices.length < 2) {
        newErrors.quiz_choices = 'At least 2 answer choices are required';
      }
    } else if (widget?.widget_type === 'author_remark' || widget?.widget_type === 'reader_remark') {
      if (!formData.content?.trim() && !formData.title?.trim()) {
        newErrors.content = 'Content or title is required';
      }
    } else if (widget?.widget_type === 'author_dialog') {
      if (!formData.content?.trim()) {
        newErrors.content = 'Content is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    // Prepare the data to send
    const updateData = {
      title: formData.title,
      content: formData.content,
      is_required: formData.is_required
    };

    // Add quiz-specific fields if it's a quiz widget
    if (widget?.widget_type === 'author_quiz') {
      updateData.quiz_question = formData.quiz_question;
      updateData.quiz_choices = formData.quiz_choices.filter(choice => choice.trim());
      updateData.quiz_correct_answer = formData.quiz_correct_answer;
      updateData.quiz_explanation = formData.quiz_explanation;
    }

    onSave(widget.id, updateData);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleChoiceChange = (index, value) => {
    const newChoices = [...formData.quiz_choices];
    newChoices[index] = value;
    setFormData(prev => ({
      ...prev,
      quiz_choices: newChoices
    }));
    if (errors.quiz_choices) {
      setErrors(prev => ({
        ...prev,
        quiz_choices: undefined
      }));
    }
  };

  if (!isVisible || !widget) return null;

  const getWidgetTypeLabel = () => {
    switch (widget.widget_type) {
      case 'author_remark': return 'Author Remark';
      case 'author_quiz': return 'Author Quiz';
      case 'author_dialog': return 'Author Dialog';
      case 'author_llm': return 'Author AI Response';
      case 'reader_llm': return 'Reader AI Response';
      case 'reader_remark': return 'Reader Remark';
      default: return 'Widget';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-90vh overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit {getWidgetTypeLabel()}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title field for all widget types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Widget title..."
            />
          </div>

          {/* Quiz-specific fields */}
          {widget.widget_type === 'author_quiz' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quiz Question *
                </label>
                <textarea
                  value={formData.quiz_question}
                  onChange={(e) => handleInputChange('quiz_question', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.quiz_question ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows="3"
                  placeholder="Enter your quiz question..."
                />
                {errors.quiz_question && (
                  <p className="text-red-500 text-sm mt-1">{errors.quiz_question}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Answer Choices *
                </label>
                {formData.quiz_choices.map((choice, index) => (
                  <div key={index} className="flex items-center mb-2">
                    <span className="text-sm font-medium mr-2 w-6">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => handleChoiceChange(index, e.target.value)}
                      className={`flex-1 px-3 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.quiz_choices ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={`Choice ${String.fromCharCode(65 + index)}`}
                    />
                  </div>
                ))}
                {errors.quiz_choices && (
                  <p className="text-red-500 text-sm mt-1">{errors.quiz_choices}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correct Answer *
                </label>
                <select
                  value={formData.quiz_correct_answer}
                  onChange={(e) => handleInputChange('quiz_correct_answer', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.quiz_correct_answer ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select correct answer...</option>
                  {formData.quiz_choices.map((choice, index) => (
                    choice.trim() && (
                      <option key={index} value={String.fromCharCode(65 + index)}>
                        {String.fromCharCode(65 + index)}. {choice}
                      </option>
                    )
                  ))}
                </select>
                {errors.quiz_correct_answer && (
                  <p className="text-red-500 text-sm mt-1">{errors.quiz_correct_answer}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Explanation (optional)
                </label>
                <textarea
                  value={formData.quiz_explanation}
                  onChange={(e) => handleInputChange('quiz_explanation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                  placeholder="Explain why this is the correct answer..."
                />
              </div>
            </>
          )}

          {/* Content field for non-quiz, non-LLM widgets */}
          {widget.widget_type !== 'author_quiz' && widget.widget_type !== 'reader_llm' && widget.widget_type !== 'author_llm' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content {widget.widget_type === 'author_dialog' ? '*' : ''}
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.content ? 'border-red-500' : 'border-gray-300'
                }`}
                rows="4"
                placeholder="Enter your content..."
              />
              {errors.content && (
                <p className="text-red-500 text-sm mt-1">{errors.content}</p>
              )}
            </div>
          )}

          {/* Author LLM widgets show read-only content */}
          {widget.widget_type === 'author_llm' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generated Content (read-only)
              </label>
              <div className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800">
                <MarkdownRenderer content={widget.content} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Author AI-generated content cannot be edited. Delete and recreate to generate new content.
              </p>
            </div>
          )}

          {/* Reader LLM widgets show read-only content */}
          {widget.widget_type === 'reader_llm' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generated Content (read-only)
              </label>
              <div className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800">
                <MarkdownRenderer content={widget.content} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Reader AI-generated content cannot be edited. Delete and recreate to generate new content.
              </p>
            </div>
          )}

          {/* Required checkbox for author widgets */}
          {widget.widget_type?.startsWith('author_') && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_required"
                checked={formData.is_required}
                onChange={(e) => handleInputChange('is_required', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="is_required" className="text-sm font-medium text-gray-700">
                Required (readers must complete before continuing)
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={widget.widget_type === 'reader_llm' || widget.widget_type === 'author_llm'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FaSave />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetEditor;