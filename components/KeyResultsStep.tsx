import React, { useState } from 'react';
import { Objective, KeyResult } from '../types';
import AIAssistButton from './common/AIAssistButton';
import { suggestKeyResults, type KeyResultSuggestion, type CompanyContext } from '../services/openaiService';
import { OKR_GUIDELINES } from '../constants';

interface KeyResultsStepProps {
  objectives: Objective[];
  setObjectives: (objectives: Objective[]) => void;
  onNext: () => void;
  onBack: () => void;
  companyName: string;
  companyContext?: CompanyContext;
}

const KeyResultItem: React.FC<{
  objectiveId: string;
  keyResult: KeyResult;
  onRemove: (oId: string, krId: string) => void;
}> = ({ objectiveId, keyResult, onRemove }) => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden transition-all">
      <div className="p-3 flex justify-between items-center bg-white">
        <div className="flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded">KR</span>
          <span className="font-medium text-slate-800 text-sm">{keyResult.title}</span>
        </div>
        <button 
          onClick={() => onRemove(objectiveId, keyResult.id)} 
          className="text-slate-400 hover:text-red-500 p-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const KeyResultInput: React.FC<{
  objective: Objective;
  onAddKeyResult: (objectiveId: string, title: string) => void;
  companyName: string;
  companyContext?: CompanyContext;
}> = ({ objective, onAddKeyResult, companyName, companyContext }) => {
  const [newKeyResult, setNewKeyResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<KeyResultSuggestion[]>([]);
  
  const handleAdd = () => {
    if (newKeyResult.trim()) {
      onAddKeyResult(objective.id, newKeyResult.trim());
      setNewKeyResult('');
    }
  };

  const handleGetSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    const result = await suggestKeyResults(objective.title, companyName, companyContext);
    setSuggestions(result || []);
    setLoading(false);
  };
  
  return (
    <div className="mt-4 pl-6 border-l-2 border-emerald-200">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={newKeyResult}
          onChange={(e) => setNewKeyResult(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="e.g., Increase NPS from 40 to 60"
          className="flex-grow px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-brand-primary focus:border-brand-primary outline-none"
        />
        <button 
          onClick={handleAdd} 
          className="px-3 py-1.5 bg-slate-600 text-white font-semibold rounded-md text-sm hover:bg-slate-700 transition-colors"
        >
          Add
        </button>
      </div>
      <AIAssistButton 
        onClick={handleGetSuggestions} 
        isLoading={loading} 
        text="Suggest Key Results" 
        small 
      />

      {suggestions.length > 0 && (
        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <h5 className="font-semibold text-slate-700 text-xs uppercase tracking-wide">
              AI Suggestions (click to add)
            </h5>
          </div>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <button 
                key={i} 
                onClick={() => onAddKeyResult(objective.id, s.title)} 
                className="w-full text-left p-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-emerald-50 hover:border-emerald-300 transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800 group-hover:text-emerald-700">{s.title}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">Metric: {s.metric}</span>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">Target: {s.target}</span>
                    </div>
                    {s.reasoning && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                        </svg>
                        <span className="italic">{s.reasoning}</span>
                      </div>
                    )}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


const KeyResultsStep: React.FC<KeyResultsStepProps> = ({ 
  objectives, 
  setObjectives, 
  onNext, 
  onBack, 
  companyName,
  companyContext
}) => {
  
  const addKeyResult = (objectiveId: string, title: string) => {
    const newObjectives = objectives.map(o => {
      if (o.id === objectiveId) {
        if (o.keyResults.find(kr => kr.title === title)) return o;
        const keyResult: KeyResult = { id: Date.now().toString(), title };
        return { ...o, keyResults: [...o.keyResults, keyResult] };
      }
      return o;
    });
    setObjectives(newObjectives);
  };

  const removeKeyResult = (objectiveId: string, keyResultId: string) => {
    const newObjectives = objectives.map(o => {
      if (o.id === objectiveId) {
        return { ...o, keyResults: o.keyResults.filter(kr => kr.id !== keyResultId) };
      }
      return o;
    });
    setObjectives(newObjectives);
  };

  const hasAtLeastOneKeyResult = objectives.some(o => o.keyResults.length > 0);

  const InfoIcon = () => (
    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 text-center">
        Define Your Key Results
      </h2>
      <p className="text-slate-600 mb-6 text-center">
        How will you measure progress toward each Objective? Add measurable Key Results.
      </p>
      
      {/* OKR Best Practices Tip */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <InfoIcon />
          <div>
            <h4 className="font-semibold text-emerald-900 text-sm mb-1">OKR Best Practice: Key Results</h4>
            <p className="text-emerald-700 text-sm">{OKR_GUIDELINES.KEY_RESULTS.description}</p>
            <ul className="mt-2 text-xs text-emerald-600 space-y-1">
              {OKR_GUIDELINES.KEY_RESULTS.rules.slice(0, 2).map((rule, i) => (
                <li key={i}>• {rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {objectives.map((o, index) => (
          <div key={o.id} className="bg-white p-6 rounded-lg shadow-md border-t-4 border-brand-primary">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-brand-primary text-white font-bold rounded-full w-6 h-6 flex items-center justify-center text-xs">
                {o.id}
              </span>
              <h3 className="font-bold text-lg text-brand-dark">{o.title}</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-widest font-bold">Key Results</p>
            
            <div className="space-y-3 mb-6">
              {o.keyResults.map((kr, krIndex) => (
                <div key={kr.id} className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-semibold">{kr.id}</span>
                  <KeyResultItem 
                    objectiveId={o.id} 
                    keyResult={kr} 
                    onRemove={removeKeyResult} 
                  />
                </div>
              ))}
              {o.keyResults.length === 0 && (
                <p className="text-sm text-slate-400 italic">No Key Results yet. Add measurable outcomes below.</p>
              )}
            </div>
            
            <KeyResultInput 
              objective={o} 
              onAddKeyResult={addKeyResult} 
              companyName={companyName}
              companyContext={companyContext}
            />
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
          disabled={!hasAtLeastOneKeyResult} 
          className="px-6 py-2 bg-brand-primary text-white font-semibold rounded-md hover:bg-brand-secondary disabled:bg-slate-300 transition-colors"
        >
          Next: Invite Team
        </button>
      </div>
    </div>
  );
};

export default KeyResultsStep;

