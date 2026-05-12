
import React from 'react';
import { STEP_LABELS } from '../constants';

interface OnboardingStepperProps {
  currentStep: number;
  totalSteps: number;
}

const OnboardingStepper: React.FC<OnboardingStepperProps> = ({ currentStep }) => {
  return (
    <div className="w-full px-4">
      <div className="flex items-center gap-2 max-w-[640px]">
        {STEP_LABELS.map((label, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <React.Fragment key={index}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200
                    ${isActive ? 'bg-brand-primary text-white scale-110 shadow-[0_0_0_3px_var(--brand-light)]' : ''}
                    ${isCompleted ? 'bg-brand-primary text-white' : ''}
                    ${!isActive && !isCompleted ? 'bg-slate-100 text-slate-400' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                    </svg>
                  ) : (
                    <span className="text-[13px] font-bold">{index + 1}</span>
                  )}
                </div>
                <span className={`text-[13px] whitespace-nowrap ${isActive ? 'font-semibold text-slate-900' : 'font-medium text-slate-500'}`}>
                  {label}
                </span>
              </div>
              {index < STEP_LABELS.length - 1 && (
                <div className={`flex-1 h-0.5 min-w-[24px] rounded-full transition-all duration-150 ${isCompleted ? 'bg-brand-primary' : 'bg-slate-200'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingStepper;
