import React, { useState, useEffect, useMemo } from 'react';
import { Objective, DepartmentalProject, KeyResult } from '../types';
import { generateExecutionInsights } from '../services/openaiService';
import AIAssistButton from './common/AIAssistButton';
import { getAllProjects, calculateAverageProgress, calculateTalentAlignment } from '../utils/priorityHelpers';
import { PROJECT_STATUS, PROGRESS_VALUES, STATUS_COLORS } from '../constants';
import { getAvatarColor, getInitials } from '../utils/constants';

interface ExecutionDashboardProps {
  priorities: Objective[];
  companyName: string;
  onUpdateProject: (projectId: string, status: 'To Do' | 'Doing' | 'Done', progress: number) => void;
}

// Calculate days between two dates
const daysBetween = (start: string, end: string): number => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
};

// Calculate if a project is on track based on timeline
const getProjectTimelineStatus = (project: DepartmentalProject): 'on-track' | 'at-risk' | 'behind' | 'ahead' | 'no-timeline' => {
  if (!project.startDate || !project.endDate) return 'no-timeline';
  
  const today = new Date();
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  
  if (today < start) return 'on-track'; // Not started yet
  if (today > end) {
    return project.status === 'Done' ? 'on-track' : 'behind';
  }
  
  // Calculate expected progress based on elapsed time
  const totalDays = daysBetween(project.startDate, project.endDate);
  const elapsedDays = daysBetween(project.startDate, today.toISOString().split('T')[0]);
  const expectedProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  
  const progressDiff = project.progress - expectedProgress;
  
  if (progressDiff >= 10) return 'ahead';
  if (progressDiff >= -10) return 'on-track';
  if (progressDiff >= -25) return 'at-risk';
  return 'behind';
};

const ExecutionDashboard: React.FC<ExecutionDashboardProps> = ({ 
  priorities: objectives, 
  companyName, 
  onUpdateProject
}) => {
  const [insights, setInsights] = useState<{
    risks: (string | { risk: string; reasoning?: string })[];
    focusAreas: (string | { area: string; reasoning?: string })[];
    summary: string;
  } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'timeline' | 'departments'>('overview');

  // Calculate metrics
  const allProjects = useMemo(() => getAllProjects(objectives), [objectives]);
  const totalProgress = useMemo(() => calculateAverageProgress(allProjects), [allProjects]);
  const talentAlignmentScore = useMemo(() => calculateTalentAlignment(allProjects), [allProjects]);
  
  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const breakdown = { 'To Do': 0, 'Doing': 0, 'Done': 0 };
    allProjects.forEach(p => breakdown[p.status]++);
    return breakdown;
  }, [allProjects]);
  
  // Timeline status breakdown
  const timelineBreakdown = useMemo(() => {
    const breakdown = { 'on-track': 0, 'at-risk': 0, 'behind': 0, 'ahead': 0, 'no-timeline': 0 };
    allProjects.forEach(p => {
      const status = getProjectTimelineStatus(p);
      breakdown[status]++;
    });
    return breakdown;
  }, [allProjects]);
  
  // Department breakdown
  const departmentBreakdown = useMemo(() => {
    const breakdown: Record<string, { total: number; done: number; progress: number; projects: DepartmentalProject[] }> = {};
    allProjects.forEach(p => {
      if (!breakdown[p.department]) {
        breakdown[p.department] = { total: 0, done: 0, progress: 0, projects: [] };
      }
      breakdown[p.department].total++;
      breakdown[p.department].projects.push(p);
      if (p.status === 'Done') breakdown[p.department].done++;
      breakdown[p.department].progress += p.progress;
    });
    // Calculate averages
    Object.keys(breakdown).forEach(dept => {
      breakdown[dept].progress = Math.round(breakdown[dept].progress / breakdown[dept].total);
    });
    return breakdown;
  }, [allProjects]);
  
  // At-risk and behind projects
  const problemProjects = useMemo(() => {
    return allProjects.filter(p => {
      const status = getProjectTimelineStatus(p);
      return status === 'at-risk' || status === 'behind';
    }).sort((a, b) => {
      const aStatus = getProjectTimelineStatus(a);
      const bStatus = getProjectTimelineStatus(b);
      if (aStatus === 'behind' && bStatus !== 'behind') return -1;
      if (bStatus === 'behind' && aStatus !== 'behind') return 1;
      return a.progress - b.progress;
    });
  }, [allProjects]);
  
  // Key Results progress
  const keyResultsProgress = useMemo(() => {
    const krs: { kr: KeyResult; objective: Objective; progress: number; projectCount: number }[] = [];
    objectives.forEach(obj => {
      obj.keyResults.forEach(kr => {
        const projects = kr.departmentalProjects || [];
        const avgProgress = projects.length > 0 
          ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
          : 0;
        krs.push({ kr, objective: obj, progress: avgProgress, projectCount: projects.length });
      });
    });
    return krs.sort((a, b) => a.progress - b.progress);
  }, [objectives]);

  const handleFetchInsights = async () => {
    setLoadingInsights(true);
    const executionData = JSON.stringify({
      company: companyName,
      objectives: objectives.map(o => ({
        title: o.title,
        keyResults: o.keyResults.map(kr => {
          const projects = kr.departmentalProjects || [];
          return {
            title: kr.title,
            projectCount: projects.length,
            avgProgress: projects.length > 0 
              ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) 
              : 0,
            projects: projects.map(p => ({
              title: p.title,
              department: p.department,
              status: p.status,
              progress: p.progress,
              timelineStatus: getProjectTimelineStatus(p),
              timeframe: p.startDate && p.endDate ? `${p.startDate} to ${p.endDate}` : 'Not set',
              headcount: p.headcount?.length || 0
            }))
          };
        })
      })),
      metrics: {
        totalProjects: allProjects.length,
        overallProgress: totalProgress,
        statusBreakdown,
        timelineBreakdown,
        atRiskCount: problemProjects.length
      }
    });
    const res = await generateExecutionInsights(companyName, executionData);
    setInsights(res);
    setLoadingInsights(false);
  };

  useEffect(() => {
    if (allProjects.length > 0) {
      handleFetchInsights();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS[PROJECT_STATUS.TODO];
  };

  const handleToggleStatus = (project: DepartmentalProject) => {
    let nextStatus: 'To Do' | 'Doing' | 'Done' = PROJECT_STATUS.TODO;
    let nextProgress = PROGRESS_VALUES.TODO;
    
    if (project.status === PROJECT_STATUS.TODO) {
      nextStatus = PROJECT_STATUS.DOING;
      nextProgress = PROGRESS_VALUES.DOING;
    } else if (project.status === PROJECT_STATUS.DOING) {
      nextStatus = PROJECT_STATUS.DONE;
      nextProgress = PROGRESS_VALUES.DONE;
    }
    
    onUpdateProject(project.id, nextStatus, nextProgress);
  };

  const getTimelineStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'text-emerald-600 bg-emerald-50';
      case 'ahead': return 'text-blue-600 bg-blue-50';
      case 'at-risk': return 'text-amber-600 bg-amber-50';
      case 'behind': return 'text-red-600 bg-red-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  return (
    <div className="w-full pb-20 animate-in fade-in zoom-in duration-500">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Monitoring Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Monitor execution progress against your strategy blueprint
        </p>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Progress</span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-black ${totalProgress >= 70 ? 'text-emerald-600' : totalProgress >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
              {totalProgress}%
            </span>
            <span className="text-xs text-slate-400 mb-1">of plan complete</span>
          </div>
          <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${totalProgress >= 70 ? 'bg-emerald-500' : totalProgress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">On Track</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-emerald-600">{timelineBreakdown['on-track'] + timelineBreakdown['ahead']}</span>
            <span className="text-xs text-slate-400 mb-1">of {allProjects.length} projects</span>
          </div>
          <div className="mt-2 flex gap-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">{timelineBreakdown['on-track']} on track</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">{timelineBreakdown['ahead']} ahead</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Needs Attention</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-black text-red-600">{timelineBreakdown['at-risk'] + timelineBreakdown['behind']}</span>
            <span className="text-xs text-slate-400 mb-1">projects at risk</span>
          </div>
          <div className="mt-2 flex gap-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">{timelineBreakdown['at-risk']} at risk</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded">{timelineBreakdown['behind']} behind</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacity Health</span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-3xl font-black ${talentAlignmentScore >= 80 ? 'text-emerald-600' : talentAlignmentScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
              {talentAlignmentScore}%
            </span>
            <span className="text-xs text-slate-400 mb-1">team alignment</span>
          </div>
          <div className="mt-2 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${talentAlignmentScore >= 80 ? 'bg-purple-500' : talentAlignmentScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${talentAlignmentScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <div className="inline-flex bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setSelectedView('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedView === 'overview' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedView('timeline')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedView === 'timeline' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            Project Timeline
          </button>
          <button
            onClick={() => setSelectedView('departments')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedView === 'departments' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            By Department
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {selectedView === 'overview' && (
            <>
              {/* Status Distribution */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Execution Status Distribution</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-slate-400 transition-all" 
                      style={{ width: `${(statusBreakdown['To Do'] / allProjects.length) * 100}%` }}
                      title={`To Do: ${statusBreakdown['To Do']}`}
                    />
                    <div 
                      className="h-full bg-amber-500 transition-all" 
                      style={{ width: `${(statusBreakdown['Doing'] / allProjects.length) * 100}%` }}
                      title={`In Progress: ${statusBreakdown['Doing']}`}
                    />
                    <div 
                      className="h-full bg-emerald-500 transition-all" 
                      style={{ width: `${(statusBreakdown['Done'] / allProjects.length) * 100}%` }}
                      title={`Done: ${statusBreakdown['Done']}`}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-slate-400"></div>
                    <span className="text-slate-600">To Do ({statusBreakdown['To Do']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-amber-500"></div>
                    <span className="text-slate-600">In Progress ({statusBreakdown['Doing']})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-emerald-500"></div>
                    <span className="text-slate-600">Done ({statusBreakdown['Done']})</span>
                  </div>
                </div>
              </div>

              {/* Key Results Progress */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Key Results Progress</h3>
                <div className="space-y-4">
                  {keyResultsProgress.map(({ kr, objective, progress, projectCount }) => (
                    <div key={kr.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-500 truncate">{objective.title}</p>
                          <p className="text-sm font-medium text-slate-800 truncate">{kr.title}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-[10px] text-slate-400">{projectCount} projects</span>
                          <span className={`text-sm font-bold ${progress >= 70 ? 'text-emerald-600' : progress >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                            {progress}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${progress >= 70 ? 'bg-emerald-500' : progress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-Risk Projects */}
              {problemProjects.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-sm font-bold text-red-800">Projects Needing Attention ({problemProjects.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {problemProjects.slice(0, 5).map(project => {
                      const status = getProjectTimelineStatus(project);
                      return (
                        <div 
                          key={project.id} 
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 cursor-pointer transition-all"
                          onClick={() => handleToggleStatus(project)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-brand-dark bg-brand-light px-1.5 py-0.5 rounded uppercase">
                              {project.department}
                            </span>
                            <span className="text-sm font-medium text-slate-800 truncate">{project.title}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getTimelineStatusColor(status)}`}>
                              {status === 'at-risk' ? 'At Risk' : 'Behind'}
                            </span>
                            <span className="text-xs font-bold text-slate-600">{project.progress}%</span>
                          </div>
                        </div>
                      );
                    })}
                    {problemProjects.length > 5 && (
                      <p className="text-xs text-slate-500 text-center pt-2">
                        + {problemProjects.length - 5} more projects need attention
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedView === 'timeline' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Project Timeline Status</h3>
              <div className="space-y-3">
                {allProjects.map(project => {
                  const timelineStatus = getProjectTimelineStatus(project);
                  return (
                    <div 
                      key={project.id}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all cursor-pointer"
                      onClick={() => handleToggleStatus(project)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-bold text-brand-dark bg-brand-light px-1.5 py-0.5 rounded uppercase">
                              {project.department}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${getTimelineStatusColor(timelineStatus)}`}>
                              {timelineStatus === 'no-timeline' ? 'No Timeline' : 
                               timelineStatus === 'on-track' ? 'On Track' :
                               timelineStatus === 'ahead' ? 'Ahead' :
                               timelineStatus === 'at-risk' ? 'At Risk' : 'Behind'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800">{project.title}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${getStatusColor(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-500">Progress</span>
                            <span className="text-xs font-bold text-slate-700">{project.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${getStatusColor(project.status)}`}
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                        </div>
                        
                        {project.startDate && project.endDate && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-500">Timeline</p>
                            <p className="text-xs font-medium text-slate-700">
                              {project.startDate} → {project.endDate}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {project.headcount && project.headcount.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2">
                          <div className="flex -space-x-1">
                            {project.headcount.slice(0, 4).map((hc) => (
                              <div 
                                key={hc.id}
                                className={`w-6 h-6 rounded-full bg-gradient-to-br ${getAvatarColor(hc.name)} flex items-center justify-center text-white text-[8px] font-bold border-2 border-white`}
                                title={`${hc.name} - ${hc.role}`}
                              >
                                {getInitials(hc.name)}
                              </div>
                            ))}
                            {project.headcount.length > 4 && (
                              <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-white text-[8px] font-bold border-2 border-white">
                                +{project.headcount.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">{project.headcount.length} team members</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedView === 'departments' && (
            <div className="space-y-4">
              {Object.entries(departmentBreakdown).sort((a, b) => b[1].progress - a[1].progress).map(([dept, data]) => (
                <div key={dept} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-brand-dark bg-brand-light px-3 py-1 rounded-lg uppercase">
                        {dept}
                      </span>
                      <span className="text-xs text-slate-500">{data.total} projects</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${data.progress >= 70 ? 'text-emerald-600' : data.progress >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {data.progress}%
                      </span>
                      <span className="text-xs text-slate-500">avg progress</span>
                    </div>
                  </div>
                  
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div 
                      className={`h-full transition-all ${data.progress >= 70 ? 'bg-emerald-500' : data.progress >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${data.progress}%` }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {data.projects.map(project => {
                      const timelineStatus = getProjectTimelineStatus(project);
                      return (
                        <div 
                          key={project.id}
                          className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                          onClick={() => handleToggleStatus(project)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              project.status === 'Done' ? 'bg-emerald-500' :
                              project.status === 'Doing' ? 'bg-amber-500' : 'bg-slate-300'
                            }`} />
                            <span className="text-sm text-slate-700 truncate">{project.title}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {timelineStatus !== 'no-timeline' && timelineStatus !== 'on-track' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getTimelineStatusColor(timelineStatus)}`}>
                                {timelineStatus === 'ahead' ? 'Ahead' : timelineStatus === 'at-risk' ? 'At Risk' : 'Behind'}
                              </span>
                            )}
                            <span className="text-xs font-medium text-slate-600 w-10 text-right">{project.progress}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - AI Analysis */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl sticky top-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold">Execution Analysis</h2>
                <p className="text-xs text-slate-400">AI-powered insights</p>
              </div>
              <AIAssistButton onClick={handleFetchInsights} isLoading={loadingInsights} text="Analyze" small />
            </div>
            
            {insights ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Summary</p>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {insights.summary}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Execution Risks
                  </p>
                  <ul className="space-y-2">
                    {insights.risks.map((riskItem, i) => {
                      const risk = typeof riskItem === 'string' ? riskItem : riskItem.risk;
                      return (
                        <li key={i} className="text-xs text-slate-300 flex items-start">
                          <span className="text-red-400 mr-2 mt-0.5">•</span>
                          <span>{risk}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Recommended Actions
                  </p>
                  <ul className="space-y-2">
                    {insights.focusAreas.map((focusItem, i) => {
                      const focus = typeof focusItem === 'string' ? focusItem : focusItem.area;
                      return (
                        <li key={i} className="text-xs text-slate-300 flex items-start">
                          <span className="text-emerald-400 mr-2 mt-0.5">→</span>
                          <span>{focus}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs text-slate-500">Analyzing execution...</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-600">Total Objectives</span>
                <span className="text-sm font-bold text-slate-800">{objectives.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-600">Total Key Results</span>
                <span className="text-sm font-bold text-slate-800">
                  {objectives.reduce((sum, o) => sum + o.keyResults.length, 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-600">Total Projects</span>
                <span className="text-sm font-bold text-slate-800">{allProjects.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-xs text-slate-600">Completed Projects</span>
                <span className="text-sm font-bold text-emerald-600">{statusBreakdown['Done']}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-slate-600">Team Members Assigned</span>
                <span className="text-sm font-bold text-purple-600">
                  {allProjects.reduce((sum, p) => sum + (p.headcount?.length || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionDashboard;
