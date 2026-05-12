import React, { useState } from 'react';
import { Objective } from '../types';
import AIAssistButton from './common/AIAssistButton';
import { suggestObjectives, getCachedResearch, clearResearchCache, type CompanyResearch, type CompanyContext, type ObjectiveSuggestion } from '../services/openaiService';
import { OKR_GUIDELINES } from '../constants';

interface ObjectivesStepProps {
  objectives: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  onNext: () => void;
  onBack: () => void;
  companyName: string;
  companyContext?: CompanyContext;
}

const ObjectivesStep: React.FC<ObjectivesStepProps> = ({ 
  objectives, 
  setObjectives, 
  onNext, 
  onBack, 
  companyName,
  companyContext
}) => {
  const [newObjective, setNewObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [suggestions, setSuggestions] = useState<ObjectiveSuggestion[]>([]);
  const [overallRationale, setOverallRationale] = useState<string>('');
  const [research, setResearch] = useState<CompanyResearch | null>(null);
  
  const addObjective = (title: string) => {
    if (title.trim() && !objectives.find(o => o.title === title.trim())) {
      const objective: Objective = { 
        id: Date.now().toString(), 
        title: title.trim(), 
        keyResults: [] 
      };
      setObjectives([...objectives, objective]);
    }
  };

  const handleAdd = () => {
    addObjective(newObjective);
    setNewObjective('');
  };
  
  const removeObjective = (id: string) => {
    setObjectives(objectives.filter(o => o.id !== id));
  };

  const handleGetSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    setOverallRationale('');
    setResearch(null);
    
    try {
      // Clear cache to get fresh research
      clearResearchCache();
      
      // Show status based on what context we have
      if (companyContext && (companyContext.description || companyContext.industry || companyContext.goals)) {
        setLoadingStatus(`Researching ${companyName} & combining with your context...`);
        console.log('Will combine web research with user context:', companyContext);
      } else {
        setLoadingStatus(`Researching ${companyName}...`);
        console.log('Starting fresh research for:', companyName);
      }
      
      // This will ALWAYS do web research AND combine with user context if available
      const result = await suggestObjectives(companyName, companyContext);
      
      // Always get the research that was done
      const completedResearch = getCachedResearch(companyName);
      console.log('Research data received:', completedResearch);
      if (completedResearch) {
        setResearch(completedResearch);
      }
      
      setLoadingStatus('');
      setSuggestions(result.objectives);
      setOverallRationale(result.overallRationale);
      
      if (result.objectives.length === 0) {
        console.warn('No suggestions returned from AI');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setLoadingStatus('');
      alert('Failed to get AI suggestions. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
  );

  const InfoIcon = () => (
    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">
        Define Your Objectives
      </h2>
      <p className="text-slate-600 mb-6 text-center">
        What inspiring goals does {companyName} want to achieve in the next 12-18 months?
      </p>

      {/* OKR Best Practices Tip */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <InfoIcon />
          <div>
            <h4 className="font-semibold text-indigo-900 text-sm mb-1">OKR Best Practice: Objectives</h4>
            <p className="text-indigo-700 text-sm">{OKR_GUIDELINES.OBJECTIVES.description}</p>
            <ul className="mt-2 text-xs text-indigo-600 space-y-1">
              {OKR_GUIDELINES.OBJECTIVES.rules.slice(0, 2).map((rule, i) => (
                <li key={i}>• {rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g., Become the market leader in our category"
            className="flex-grow px-4 py-2 border border-slate-300 rounded-md focus:ring-brand-primary focus:border-brand-primary"
          />
          <button 
            onClick={handleAdd} 
            className="px-4 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary transition-colors"
          >
            Add
          </button>
        </div>
        
        <div className="flex justify-start items-center gap-3">
          <AIAssistButton 
            onClick={handleGetSuggestions} 
            isLoading={loading} 
            text="Suggest Objectives" 
          />
          {loading && loadingStatus && (
            <span className="text-sm text-slate-500 animate-pulse">{loadingStatus}</span>
          )}
        </div>

        {/* Research Summary */}
        {research && !loading && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-semibold text-blue-800 text-sm">Company Research</h4>
                <p className="text-xs text-blue-600 mt-1">
                  {research.companyDescription || (research as any).description || 'No description available'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div>
                <span className="text-blue-500 font-medium">Industry:</span>
                <span className="text-blue-700 ml-1">{research.industry || 'N/A'}</span>
              </div>
              <div>
                <span className="text-blue-500 font-medium">Stage:</span>
                <span className="text-blue-700 ml-1">{research.stage || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-blue-500 font-medium">Target Market:</span>
                <span className="text-blue-700 ml-1">{research.targetMarket || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <h4 className="font-semibold text-slate-700">AI Suggestions (click to add)</h4>
            </div>
            
            {/* Overall Rationale */}
            {overallRationale && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Why these objectives?</p>
                    <p className="text-sm text-amber-800">{overallRationale}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Individual Suggestions with Reasoning */}
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <button 
                  key={i} 
                  onClick={() => addObjective(s.title)} 
                  className="w-full text-left p-3 bg-white rounded-lg border border-slate-200 hover:border-brand-primary hover:bg-brand-light/30 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-brand-light text-brand-primary font-bold text-xs px-2 py-1 rounded flex-shrink-0">
                      O{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 group-hover:text-brand-primary transition-colors">
                        {s.title}
                      </p>
                      {s.reasoning && (
                        <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 flex-shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span>{s.reasoning}</span>
                        </p>
                      )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-brand-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {objectives.map((o, index) => (
          <div 
            key={o.id} 
            className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center transition-all animate-in fade-in"
          >
            <div className="flex items-center">
              <span className="bg-brand-primary text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-3 text-sm">
                O{index + 1}
              </span>
              <span className="text-slate-800">{o.title}</span>
            </div>
            <button 
              onClick={() => removeObjective(o.id)} 
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-between">
        <button 
          onClick={onBack} 
          className="px-6 py-2 bg-slate-200 text-slate-700 font-semibold rounded-md hover:bg-slate-300 transition-colors"
        >
          Back
        </button>
        <button 
          onClick={onNext} 
          disabled={objectives.length === 0} 
          className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary disabled:bg-slate-300 transition-colors"
        >
          Next: Define Key Results
        </button>
      </div>
    </div>
  );
};

export default ObjectivesStep;

