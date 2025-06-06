import React, { useState } from 'react';
import { FaEdit, FaTrash, FaCheck, FaTimes, FaLightbulb, FaCommentDots, FaStickyNote } from 'react-icons/fa';
import MarkdownRenderer from '../MarkdownRenderer';

const WidgetCard = ({ widget, onInteract, onEdit, onDelete, isOwner }) => {
  const [userAnswer, setUserAnswer] = useState('');
  const [completed, setCompleted] = useState(widget.user_interaction?.completed || false);

  const handleQuizSubmit = () => {
    onInteract(widget.id, {
      completed: true,
      quiz_answer: userAnswer,
      interaction_data: { submitted_at: Date.now() }
    });
    setCompleted(true);
  };

  const handleMarkComplete = () => {
    onInteract(widget.id, {
      completed: true,
      interaction_data: { completed_at: Date.now() }
    });
    setCompleted(true);
  };

  const getWidgetIcon = () => {
    switch (widget.widget_type) {
      case 'author_remark':
        return <FaStickyNote className="text-blue-400" />;
      case 'author_quiz':
        return <FaCommentDots className="text-green-400" />;
      case 'author_dialog':
        return <FaCommentDots className="text-purple-400" />;
      case 'author_llm':
        return <FaLightbulb className="text-indigo-400" />;
      case 'reader_llm':
        return <FaLightbulb className="text-orange-400" />;
      case 'reader_remark':
        return <FaStickyNote className="text-yellow-400" />;
      default:
        return <FaStickyNote />;
    }
  };

  const renderWidgetContent = () => {
    switch (widget.widget_type) {
      case 'author_remark':
        return (
          <div className="bg-gray-800 border-l-4 border-blue-400 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-1">
              {getWidgetIcon()}
              <span>Author:</span>
            </div>
            <MarkdownRenderer content={widget.content} className="text-gray-200" />
          </div>
        );

      case 'author_quiz':
        return (
          <div className="bg-gray-800 border border-green-500 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-green-400 font-medium mb-2">
              {getWidgetIcon()}
              <span>Author: Quiz</span>
            </div>
            <div className="font-medium mb-2 text-gray-200">{widget.quiz_question}</div>
            {!completed ? (
              <div>
                {widget.quiz_choices.map((choice, index) => (
                  <label key={index} className="block mb-1 cursor-pointer text-gray-300">
                    <input
                      type="radio"
                      name={`quiz_${widget.id}`}
                      value={String.fromCharCode(65 + index)}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      className="mr-2"
                    />
                    <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {choice}
                  </label>
                ))}
                <button
                  onClick={handleQuizSubmit}
                  disabled={!userAnswer}
                  className="mt-2 px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50 hover:bg-green-700 disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              </div>
            ) : (
              <div className="text-green-400">
                <div className="flex items-center gap-1 mb-1">
                  <FaCheck className="text-green-500" />
                  <span className="font-medium">Completed</span>
                </div>
                {widget.quiz_explanation && (
                  <div className="mt-1 text-sm bg-gray-700 p-2 rounded text-gray-200">
                    <strong>Explanation:</strong> {widget.quiz_explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 'author_dialog':
        return (
          <div className="bg-gray-800 border border-purple-500 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-purple-400 font-medium mb-1">
              {getWidgetIcon()}
              <span>Author: Discussion</span>
            </div>
            <MarkdownRenderer content={widget.content} className="text-gray-200 mb-2" />
            {!completed && (
              <button
                onClick={handleMarkComplete}
                className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
              >
                Mark as Read
              </button>
            )}
            {completed && (
              <div className="flex items-center gap-1 text-purple-400">
                <FaCheck className="text-purple-500" />
                <span className="text-sm font-medium">Read</span>
              </div>
            )}
          </div>
        );

      case 'author_llm':
        return (
          <div className="bg-gray-800 border border-indigo-500 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium mb-1">
              {getWidgetIcon()}
              <span>Author: {widget.llm_preset ? widget.llm_preset.charAt(0).toUpperCase() + widget.llm_preset.slice(1).replace('_', ' ') : 'AI Assistant'}</span>
            </div>
            <MarkdownRenderer content={widget.content} className="text-gray-200" />
          </div>
        );

      case 'reader_llm':
        return (
          <div className="bg-gray-800 border border-orange-500 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-orange-400 font-medium mb-1">
              {getWidgetIcon()}
              <span>Reader: {widget.llm_preset ? widget.llm_preset.charAt(0).toUpperCase() + widget.llm_preset.slice(1) : 'Custom'}</span>
            </div>
            <MarkdownRenderer content={widget.content} className="text-gray-200" />
          </div>
        );

      case 'reader_remark':
        return (
          <div className="bg-gray-800 border border-yellow-500 p-3 rounded">
            <div className="flex items-center gap-2 text-xs text-yellow-400 font-medium mb-1">
              {getWidgetIcon()}
              <span>Reader: Note</span>
            </div>
            <MarkdownRenderer content={widget.content} className="text-gray-200" />
          </div>
        );

      default:
        return (
          <div className="bg-gray-800 border border-gray-600 p-3 rounded">
            <MarkdownRenderer content={widget.content} className="text-gray-200" />
          </div>
        );
    }
  };

  return (
    <div className="mb-2 relative group">
      {renderWidgetContent()}
      
      {isOwner && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(widget)}
            className="p-1 text-xs text-gray-500 hover:text-blue-600 bg-white rounded shadow-sm"
            title="Edit widget"
          >
            <FaEdit />
          </button>
          <button
            onClick={() => onDelete(widget.id)}
            className="p-1 text-xs text-gray-500 hover:text-red-600 bg-white rounded shadow-sm"
            title="Delete widget"
          >
            <FaTrash />
          </button>
        </div>
      )}
      
      {widget.is_required && !completed && (
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full" title="Required to continue" />
      )}
    </div>
  );
};

export default WidgetCard;