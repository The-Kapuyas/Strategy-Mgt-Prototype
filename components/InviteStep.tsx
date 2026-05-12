import React, { useState } from 'react';
import AIAssistButton from './common/AIAssistButton';
import { suggestInviteMessage, suggestDepartmentalProjects, suggestProjectResources, type ProjectSuggestion, type HeadcountSuggestion, type TimeframeSuggestion, type ProjectResourceSuggestionsResult } from '../services/openaiService';
import { Objective, DepartmentalProject, ProjectAssignment, Personnel } from '../types';
import { getAvatarColor, getInitials } from '../utils/constants';

interface CompanyContext {
  description: string;
  industry: string;
  stage: string;
  goals: string;
  challenges: string;
}

interface InviteStepProps {
  onNext: () => void;
  onBack: () => void;
  companyName: string;
  companyContext?: CompanyContext;
  priorities: Objective[]; // Using legacy prop name for backward compatibility
  setPriorities: (objectives: Objective[]) => void;
  personnel: Personnel[];
}

const ProjectItem: React.FC<{
  objectiveId: string;
  keyResultId: string;
  project: DepartmentalProject;
  companyName: string;
  personnel: Personnel[];
  onUpdate: (oId: string, krId: string, project: DepartmentalProject) => void;
  onRemove: (oId: string, krId: string, projectId: string) => void;
}> = ({ objectiveId, keyResultId, project, companyName, personnel, onUpdate, onRemove }) => {
  const [isExpandingResources, setIsExpandingResources] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [showPersonnelPicker, setShowPersonnelPicker] = useState(false);
  const [resourceSuggestions, setResourceSuggestions] = useState<ProjectResourceSuggestionsResult | null>(null);
  const [resourceSummary, setResourceSummary] = useState<string>('');

  const handleSuggestResources = async () => {
    setLoadingResources(true);
    setResourceSuggestions(null);
    setResourceSummary('');
    const result = await suggestProjectResources(project.title, project.department, companyName, personnel);
    if (result) {
      setResourceSuggestions(result);
      setResourceSummary(result.summary || '');
    }
    setLoadingResources(false);
  };
  
  const acceptTimeframeSuggestion = () => {
    if (!resourceSuggestions?.timeframe) return;
    onUpdate(objectiveId, keyResultId, { 
      ...project, 
      startDate: resourceSuggestions.timeframe.startDate,
      endDate: resourceSuggestions.timeframe.endDate,
    });
  };
  
  const acceptHeadcountSuggestion = (suggestion: HeadcountSuggestion) => {
    const newAssignment: ProjectAssignment = {
      id: Math.random().toString(36).substr(2, 9),
      name: suggestion.name,
      role: suggestion.role,
      allocation: suggestion.allocation,
      personnelId: suggestion.personnelId,
    };
    onUpdate(objectiveId, keyResultId, { 
      ...project, 
      headcount: [...(project.headcount || []), newAssignment] 
    });
    // Remove from suggestions
    if (resourceSuggestions) {
      setResourceSuggestions({
        ...resourceSuggestions,
        headcount: resourceSuggestions.headcount.filter(h => h !== suggestion)
      });
    }
  };
  
  const acceptAllHeadcount = () => {
    if (!resourceSuggestions?.headcount) return;
    const newAssignments: ProjectAssignment[] = resourceSuggestions.headcount.map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      name: s.name,
      role: s.role,
      allocation: s.allocation,
      personnelId: s.personnelId,
    }));
    onUpdate(objectiveId, keyResultId, { 
      ...project, 
      headcount: [...(project.headcount || []), ...newAssignments],
      startDate: resourceSuggestions.timeframe?.startDate || project.startDate,
      endDate: resourceSuggestions.timeframe?.endDate || project.endDate,
    });
    setResourceSuggestions(null);
  };

  const addPersonnelToProject = (person: Personnel) => {
    const newAssignment: ProjectAssignment = {
      id: `personnel-${person.id}-${Date.now()}`,
      personnelId: person.id,
      name: person.name,
      role: person.role,
      allocation: person.availability || 'Full-time',
    };
    onUpdate(objectiveId, keyResultId, { 
      ...project, 
      headcount: [...(project.headcount || []), newAssignment] 
    });
    setShowPersonnelPicker(false);
  };

  // Filter personnel by department for suggestions
  const relevantPersonnel = personnel.filter(p => 
    p.department.toLowerCase() === project.department.toLowerCase() ||
    p.department.toLowerCase() === 'general'
  );
  const otherPersonnel = personnel.filter(p => 
    p.department.toLowerCase() !== project.department.toLowerCase() &&
    p.department.toLowerCase() !== 'general'
  );

  const updateTimeframe = (startDate: string, endDate: string) => {
    onUpdate(objectiveId, keyResultId, { ...project, startDate, endDate });
  };

  const removeHeadcount = (hcId: string) => {
    const headcount = (project.headcount || []).filter(h => h.id !== hcId);
    onUpdate(objectiveId, keyResultId, { ...project, headcount });
  };
  
  const headcountCount = project.headcount?.length || 0;

  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all group">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-brand-dark bg-brand-light px-1.5 py-0.5 rounded uppercase tracking-tighter">
                {project.department}
            </span>
            <span className="text-xs font-bold text-slate-800">{project.title}</span>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsExpandingResources(!isExpandingResources)} 
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${isExpandingResources ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
                {isExpandingResources ? 'Hide Resources' : 'Time & Talent'}
                {headcountCount > 0 && <span className="ml-1 opacity-80">({headcountCount})</span>}
            </button>
            <button onClick={() => onRemove(objectiveId, keyResultId, project.id)} className="text-slate-300 hover:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
      </div>

      {isExpandingResources && (
          <div className="mt-3 pt-3 border-t border-slate-100 animate-in slide-in-from-top-2">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resource Plan</span>
                  <AIAssistButton onClick={handleSuggestResources} isLoading={loadingResources} text={personnel.length > 0 ? "AI Suggest (uses roster)" : "Plan Resources"} small />
              </div>
              
              {/* AI Resource Suggestions with Reasoning */}
              {resourceSuggestions && (resourceSuggestions.headcount.length > 0 || resourceSuggestions.timeframe) && (
                <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                      </svg>
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">AI Suggestions</span>
                    </div>
                    <button 
                      onClick={acceptAllHeadcount}
                      className="text-[9px] px-2 py-1 bg-amber-600 text-white rounded font-bold hover:bg-amber-700"
                    >
                      Accept All
                    </button>
                  </div>
                  {resourceSummary && (
                    <p className="text-[10px] text-amber-700 italic mb-2">{resourceSummary}</p>
                  )}
                  <div className="space-y-3">
                    {/* Timeframe Suggestion */}
                    {resourceSuggestions.timeframe && (
                      <div 
                        className="p-2 bg-blue-50 rounded border border-blue-100 hover:border-blue-300 cursor-pointer group"
                        onClick={acceptTimeframeSuggestion}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            <span className="text-[10px] font-bold text-blue-700">Timeframe:</span>
                            <span className="text-[10px] text-blue-600">{resourceSuggestions.timeframe.startDate} → {resourceSuggestions.timeframe.endDate}</span>
                            <span className="text-[9px] text-blue-500">({resourceSuggestions.timeframe.durationMonths} months)</span>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 group-hover:text-blue-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        {resourceSuggestions.timeframe.reasoning && (
                          <p className="text-[9px] text-blue-500 mt-1 italic">↳ {resourceSuggestions.timeframe.reasoning}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Headcount Suggestions */}
                    {resourceSuggestions.headcount.map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-2 p-2 bg-white rounded border border-amber-100 hover:border-amber-300 cursor-pointer group"
                        onClick={() => acceptHeadcountSuggestion(suggestion)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${getAvatarColor(suggestion.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                              {getInitials(suggestion.name)}
                            </div>
                            <span className="text-[10px] font-bold text-slate-800">{suggestion.name}</span>
                            <span className="text-[10px] text-slate-500">• {suggestion.role}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{suggestion.allocation}</span>
                          </div>
                          {suggestion.reasoning && (
                            <p className="text-[9px] text-slate-500 mt-1 italic">↳ {suggestion.reasoning}</p>
                          )}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400 group-hover:text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Current Timeframe */}
              <div className="mb-3">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider mb-1 block">Timeframe</span>
                <div className="flex items-center gap-2 p-2 bg-blue-50/50 rounded border border-blue-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <input 
                    type="date"
                    className="text-[10px] bg-transparent border-b border-transparent focus:border-blue-300 outline-none"
                    value={project.startDate || ''}
                    onChange={(e) => updateTimeframe(e.target.value, project.endDate || '')}
                    placeholder="Start date"
                  />
                  <span className="text-[10px] text-slate-400">to</span>
                  <input 
                    type="date"
                    className="text-[10px] bg-transparent border-b border-transparent focus:border-blue-300 outline-none"
                    value={project.endDate || ''}
                    onChange={(e) => updateTimeframe(project.startDate || '', e.target.value)}
                    placeholder="End date"
                  />
                </div>
              </div>

              {/* Current Headcount */}
              <div className="space-y-2">
                  <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider">Team ({headcountCount})</span>
                  {project.headcount?.map(hc => (
                      <div key={hc.id} className="flex gap-2 items-center bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                            {getInitials(hc.name)}
                          </div>
                          <span className="text-[10px] font-medium text-slate-800 flex-grow">{hc.name}</span>
                          <span className="text-[10px] text-slate-500">{hc.role}</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">{hc.allocation}</span>
                          <button onClick={() => removeHeadcount(hc.id)} className="text-slate-300 hover:text-red-400">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                          </button>
                      </div>
                  ))}
                  
                  {personnel.length > 0 && (
                    <button 
                      onClick={() => setShowPersonnelPicker(!showPersonnelPicker)} 
                      className={`text-[10px] font-bold flex items-center gap-1 mt-2 ${showPersonnelPicker ? 'text-emerald-600' : 'text-emerald-500 hover:text-emerald-700'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      + Add from Roster
                    </button>
                  )}

                  {/* Personnel Picker */}
                  {showPersonnelPicker && personnel.length > 0 && (
                    <div className="mt-3 bg-white border border-emerald-200 rounded-lg overflow-hidden shadow-sm">
                      {relevantPersonnel.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-100">
                            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">{project.department} Team</span>
                          </div>
                          {relevantPersonnel.map(person => (
                            <button
                              key={person.id}
                              onClick={() => addPersonnelToProject(person)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 transition-colors text-left border-b border-slate-50 last:border-0"
                            >
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                                {getInitials(person.name)}
                              </div>
                              <div className="flex-grow">
                                <p className="text-[10px] font-medium text-slate-800">{person.name}</p>
                                <p className="text-[9px] text-slate-500">{person.role}{person.skills?.length ? ` • ${person.skills.slice(0, 2).join(', ')}` : ''}</p>
                              </div>
                              {person.availability && (
                                <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{person.availability}</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {otherPersonnel.length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Other Departments</span>
                          </div>
                          {otherPersonnel.slice(0, 5).map(person => (
                            <button
                              key={person.id}
                              onClick={() => addPersonnelToProject(person)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                            >
                              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                                {getInitials(person.name)}
                              </div>
                              <div className="flex-grow">
                                <p className="text-[10px] font-medium text-slate-800">{person.name}</p>
                                <p className="text-[9px] text-slate-500">{person.role} • {person.department}</p>
                              </div>
                            </button>
                          ))}
                          {otherPersonnel.length > 5 && (
                            <div className="px-3 py-1.5 text-center text-[9px] text-slate-400">
                              + {otherPersonnel.length - 5} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

const InviteStep: React.FC<InviteStepProps> = ({ onNext, onBack, companyName, priorities: objectives, setPriorities: setObjectives, personnel }) => {
  const [invites, setInvites] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState<Record<string, boolean>>({});
  const [newProjectInputs, setNewProjectInputs] = useState<Record<string, { dept: string, title: string }>>({});
  const [projectSuggestions, setProjectSuggestions] = useState<Record<string, ProjectSuggestion[]>>({});

  const addInvite = () => {
    if (currentEmail && !invites.includes(currentEmail) && /^\S+@\S+\.\S+$/.test(currentEmail)) {
      setInvites([...invites, currentEmail]);
      setCurrentEmail('');
    }
  };

  const handleSuggestMessage = async () => {
    setLoadingMessage(true);
    const suggested = await suggestInviteMessage(companyName);
    if (suggested) setMessage(suggested);
    setLoadingMessage(false);
  };

  const updateProject = (oId: string, krId: string, updatedProject: DepartmentalProject) => {
    setObjectives(objectives.map(o => {
        if (o.id !== oId) return o;
        return {
          ...o,
          keyResults: o.keyResults.map(kr => {
            if (kr.id !== krId) return kr;
            return {
              ...kr,
              departmentalProjects: kr.departmentalProjects?.map(dp => 
                dp.id === updatedProject.id ? updatedProject : dp
              )
            };
          })
        };
    }));
  };

  const removeProject = (oId: string, krId: string, projectId: string) => {
    setObjectives(objectives.map(o => {
        if (o.id !== oId) return o;
        return {
          ...o,
          keyResults: o.keyResults.map(kr => {
            if (kr.id !== krId) return kr;
            return {
              ...kr,
              departmentalProjects: kr.departmentalProjects?.filter(dp => dp.id !== projectId)
            };
          })
        };
    }));
  };

  const handleSuggestProjects = async (objectiveId: string, keyResultId: string, title: string) => {
    setLoadingProjects(prev => ({ ...prev, [keyResultId]: true }));
    setProjectSuggestions(prev => ({ ...prev, [keyResultId]: [] }));
    const suggestions = await suggestDepartmentalProjects(title, companyName);
    if (suggestions) {
      setProjectSuggestions(prev => ({ ...prev, [keyResultId]: suggestions }));
    }
    setLoadingProjects(prev => ({ ...prev, [keyResultId]: false }));
  };
  
  const acceptProjectSuggestion = (objectiveId: string, keyResultId: string, suggestion: ProjectSuggestion) => {
    const newProj: DepartmentalProject = {
      id: Math.random().toString(36).substr(2, 9),
      department: suggestion.department,
      title: suggestion.title,
      status: 'To Do',
      progress: 0,
      resources: []
    };
    setObjectives(objectives.map(o => {
      if (o.id !== objectiveId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => {
          if (kr.id !== keyResultId) return kr;
          return { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), newProj] };
        })
      };
    }));
    // Remove from suggestions
    setProjectSuggestions(prev => ({
      ...prev,
      [keyResultId]: (prev[keyResultId] || []).filter(s => s !== suggestion)
    }));
  };
  
  const acceptAllProjectSuggestions = (objectiveId: string, keyResultId: string) => {
    const suggestions = projectSuggestions[keyResultId] || [];
    if (suggestions.length === 0) return;
    
    const newProjs: DepartmentalProject[] = suggestions.map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      department: s.department,
      title: s.title,
      status: 'To Do',
      progress: 0,
      resources: []
    }));
    
    setObjectives(objectives.map(o => {
      if (o.id !== objectiveId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => {
          if (kr.id !== keyResultId) return kr;
          return { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), ...newProjs] };
        })
      };
    }));
    setProjectSuggestions(prev => ({ ...prev, [keyResultId]: [] }));
  };

  const addProject = (oId: string, krId: string) => {
    const input = newProjectInputs[krId];
    if (!input?.dept || !input?.title) return;
    setObjectives(objectives.map(o => {
      if (o.id !== oId) return o;
      return {
        ...o,
        keyResults: o.keyResults.map(kr => {
          if (kr.id !== krId) return kr;
          const project: DepartmentalProject = {
            id: Date.now().toString(),
            department: input.dept,
            title: input.title,
            status: 'To Do',
            progress: 0,
            resources: []
          };
          return { ...kr, departmentalProjects: [...(kr.departmentalProjects || []), project] };
        })
      };
    }));
    setNewProjectInputs(prev => ({ ...prev, [krId]: { dept: '', title: '' } }));
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <h2 className="text-3xl font-bold text-slate-900 mb-2 text-center">Plan Execution: Time & Talent</h2>
      <p className="text-slate-600 mb-8 text-center">Draft projects for each Key Result and assign specific headcount and time requirements.</p>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-8">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
            </svg>
            Project Drafts & Resource Plan
        </h3>
        <div className="space-y-8">
          {objectives.map((o, oIndex) => o.keyResults.map((kr, krIndex) => (
            <div key={kr.id} className="bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded">KR{krIndex + 1}</span>
                      <h4 className="text-sm font-bold text-slate-800">{kr.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-brand-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">O{oIndex + 1}</span>
                      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{o.title}</span>
                    </div>
                </div>
                <AIAssistButton onClick={() => handleSuggestProjects(o.id, kr.id, kr.title)} isLoading={loadingProjects[kr.id]} text="Seed Dept Projects" small />
              </div>
              
              {/* AI Project Suggestions with Reasoning */}
              {projectSuggestions[kr.id] && projectSuggestions[kr.id].length > 0 && (
                <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                      </svg>
                      <span className="text-sm font-bold text-amber-800">AI Suggested Projects</span>
                    </div>
                    <button 
                      onClick={() => acceptAllProjectSuggestions(o.id, kr.id)}
                      className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-colors"
                    >
                      Add All Projects
                    </button>
                  </div>
                  <div className="space-y-2">
                    {projectSuggestions[kr.id].map((suggestion, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-3 p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 cursor-pointer group transition-all"
                        onClick={() => acceptProjectSuggestion(o.id, kr.id, suggestion)}
                      >
                        <span className="text-[9px] font-black text-brand-dark bg-brand-light px-1.5 py-0.5 rounded uppercase tracking-tighter flex-shrink-0 mt-0.5">
                          {suggestion.department}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 group-hover:text-amber-700">{suggestion.title}</p>
                          {suggestion.reasoning && (
                            <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <span className="italic">{suggestion.reasoning}</span>
                            </p>
                          )}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400 group-hover:text-amber-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                {kr.departmentalProjects?.map(dp => (
                  <ProjectItem 
                    key={dp.id} 
                    objectiveId={o.id} 
                    keyResultId={kr.id} 
                    project={dp} 
                    companyName={companyName}
                    personnel={personnel}
                    onUpdate={updateProject}
                    onRemove={removeProject}
                  />
                ))}
              </div>

              <div className="flex gap-2 bg-white p-3 rounded-xl border border-dashed border-slate-200">
                <input 
                  className="w-1/4 px-3 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" 
                  placeholder="Dept (e.g. Sales)" 
                  value={newProjectInputs[kr.id]?.dept || ''} 
                  onChange={e => setNewProjectInputs({...newProjectInputs, [kr.id]: {...(newProjectInputs[kr.id]||{title:''}), dept: e.target.value}})}
                />
                <input 
                  className="flex-grow px-3 py-1.5 text-sm border rounded-lg focus:ring-1 focus:ring-brand-primary outline-none" 
                  placeholder="Draft project title..." 
                  value={newProjectInputs[kr.id]?.title || ''} 
                  onChange={e => setNewProjectInputs({...newProjectInputs, [kr.id]: {...(newProjectInputs[kr.id]||{dept:''}), title: e.target.value}})}
                />
                <button onClick={() => addProject(o.id, kr.id)} className="bg-slate-800 text-white px-4 py-1.5 text-sm rounded-lg font-bold hover:bg-slate-900 transition-colors">Add Project</button>
              </div>
            </div>
          )))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-8">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Invite Department Leads</h3>
        <p className="text-xs text-slate-500 mb-4">Share this OKR plan with your team to begin execution alignment.</p>
        <div className="flex gap-2 mb-4">
          <input className="flex-grow px-4 py-2 border rounded-xl" placeholder="email@company.com" value={currentEmail} onChange={e => setCurrentEmail(e.target.value)} />
          <button onClick={addInvite} className="bg-brand-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-brand-secondary transition-all">Add Lead</button>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {invites.map(e => <span key={e} className="px-3 py-1 bg-brand-light text-brand-dark rounded-full text-xs font-bold">{e}</span>)}
        </div>
        <textarea className="w-full p-4 border rounded-xl text-sm h-32" placeholder="Invitation message..." value={message} onChange={e => setMessage(e.target.value)} />
        <div className="mt-2"><AIAssistButton onClick={handleSuggestMessage} isLoading={loadingMessage} text="Auto-Draft Invitation" small /></div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-8 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl">Back</button>
        <button onClick={onNext} className="px-8 py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">Finish & View Roadmap</button>
      </div>
    </div>
  );
};

export default InviteStep;
