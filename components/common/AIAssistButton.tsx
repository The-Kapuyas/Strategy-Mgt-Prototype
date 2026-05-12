
import React from 'react';
import Loader from './Loader';

interface AIAssistButtonProps {
  onClick: () => void;
  isLoading: boolean;
  text?: string;
  small?: boolean;
}

/** Sparkles icon for AI: one large star, one small sparkle—balanced composition. */
const SparklesIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden
  >
    {/* Large 8-point star, centered */}
    <path d="M10 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />
    {/* Small sparkle top-right, offset so composition feels balanced */}
    <path d="M16 3l0.5 1.5 1.5 0.5-1.5 0.5-0.5 1.5-0.5-1.5-1.5-0.5 1.5-0.5 0.5-1.5z" />
  </svg>
);


const AIAssistButton: React.FC<AIAssistButtonProps> = ({ onClick, isLoading, text = 'AI Assist', small = false }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        inline-flex items-center justify-center font-semibold rounded-md transition-colors 
        ${small ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}
        bg-brand-light text-brand-dark hover:bg-indigo-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-wait
      `}
    >
      {isLoading ? (
        <>
            <Loader />
            <span className="ml-2">Generating...</span>
        </>
      ) : (
        <>
            <SparklesIcon />
            <span className="ml-2">{text}</span>
        </>
      )}
    </button>
  );
};

export default AIAssistButton;
