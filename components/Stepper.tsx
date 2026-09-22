import React from 'react';

interface Step {
    title: string;
    subtitle: string;
}

interface StepperProps {
    current: number;
    steps: Step[];
    onStepClick: (index: number) => void;
}

export const Stepper: React.FC<StepperProps> = ({ current, steps, onStepClick }) => (
    <nav aria-label="Progress" className="w-full">
        <ol role="list" className="flex items-center justify-between">
            {steps.map((step, index) => {
                const isCompleted = index < current;
                const isCurrent = index === current;
                const canClick = current !== 4 && index !== 4 && ((index === 0 && current > 0) || (index < current));

                return (
                    <li key={step.title} className={`relative ${index !== steps.length - 1 ? 'flex-1' : ''}`}>
                        <div 
                            className={`flex items-center text-sm font-medium ${canClick ? 'cursor-pointer group' : ''}`}
                            onClick={() => canClick && onStepClick(index)}
                        >
                            <span 
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                                    isCompleted 
                                        ? 'bg-green-600 text-white' 
                                        : isCurrent 
                                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 font-bold' 
                                            : 'bg-gray-200 text-gray-600'
                                } ${canClick ? 'group-hover:opacity-80' : ''}`}
                            >
                                {isCompleted ? (
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </span>
                            <div className="ml-3 hidden lg:block">
                                <span className={`block text-sm font-semibold leading-tight ${
                                    isCompleted ? 'text-green-700' : isCurrent ? 'text-blue-700 font-bold' : 'text-gray-500'
                                }`}>
                                    {step.title}
                                </span>
                                <span className="block text-xs text-gray-400">
                                    {step.subtitle}
                                </span>
                            </div>
                        </div>
                        {index !== steps.length - 1 && (
                            <div 
                                className={`absolute top-5 left-10 -ml-px mt-px h-0.5 w-full hidden sm:block ${
                                    isCompleted ? 'bg-green-600' : 'bg-gray-200'
                                }`} 
                                aria-hidden="true" 
                            />
                        )}
                    </li>
                );
            })}
        </ol>
    </nav>
);
