import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, FileCode, Circle } from "lucide-react";
import { type Project, type ProjectFile, type CodeComponent } from "@shared/schema";

interface ProjectSidebarProps {
  projects: Project[];
  currentProject?: Project;
  files: ProjectFile[];
  components: CodeComponent[];
  onProjectSelect: (projectId: string) => void;
  onComponentSelect: (component: CodeComponent) => void;
  isLoading: boolean;
}

export default function ProjectSidebar({ 
  projects, 
  currentProject, 
  files, 
  components, 
  onProjectSelect, 
  onComponentSelect,
  isLoading 
}: ProjectSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'java':
      case 'kotlin':
        return FileCode;
      default:
        return FileCode;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'class':
      case 'interface':
        return 'bg-[#FF6B6B]';
      case 'method':
        return 'bg-[#4ECDC4]';
      case 'function':
        return 'bg-[#FFD33D]';
      default:
        return 'bg-gray-400';
    }
  };

  const organizedFiles = files.reduce((acc, file) => {
    const pathParts = file.path.split('/');
    const folder = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'root';
    
    if (!acc[folder]) {
      acc[folder] = [];
    }
    acc[folder].push(file);
    
    return acc;
  }, {} as Record<string, ProjectFile[]>);

  if (isLoading) {
    return (
      <aside className="w-80 bg-[#F6F8FA] border-r border-gray-200 flex flex-col">
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded mb-2"></div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 bg-[#F6F8FA] border-r border-gray-200 flex flex-col custom-scrollbar">
      {/* Project Info */}
      {currentProject && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#24292E]" data-testid="text-project-name">
              {currentProject.name}
            </h2>
            <span className={`px-2 py-1 text-white text-xs rounded-full ${
              currentProject.status === 'ready' ? 'bg-[#28A745]' : 
              currentProject.status === 'analyzing' ? 'bg-yellow-500' : 'bg-red-500'
            }`}>
              {currentProject.status === 'ready' ? 'Analyzed' : 
               currentProject.status === 'analyzing' ? 'Analyzing' : 'Error'}
            </span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>Classes:</span>
              <span data-testid="text-class-count">{currentProject.classCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Methods:</span>
              <span data-testid="text-method-count">{currentProject.methodCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Functions:</span>
              <span data-testid="text-function-count">{currentProject.functionCount || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Project List */}
      {!currentProject && (
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-[#24292E] mb-3">Recent Projects</h2>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                className="p-2 hover:bg-white rounded cursor-pointer border-l-2 border-transparent hover:border-[#0366D6] transition-colors"
                data-testid={`project-item-${project.id}`}
              >
                <div className="font-medium text-sm text-[#24292E]">{project.name}</div>
                <div className="text-xs text-gray-500">
                  {project.classCount || 0} classes • {project.methodCount || 0} methods
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-4">
                No projects yet. Upload your first project to get started.
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Tree Navigation */}
      {currentProject && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Project Structure
            </h3>
            
            <div className="space-y-1">
              {Object.entries(organizedFiles).map(([folder, folderFiles]) => (
                <div key={folder} className="space-y-1">
                  {/* Folder Header */}
                  <div 
                    className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
                    onClick={() => toggleFolder(folder)}
                    data-testid={`folder-${folder}`}
                  >
                    {expandedFolders.has(folder) ? (
                      <ChevronDown className="h-3 w-3 text-gray-400 mr-2" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-gray-400 mr-2" />
                    )}
                    <Folder className="h-4 w-4 text-[#0366D6] mr-2" />
                    <span className="text-sm">{folder === 'root' ? 'Root' : folder.split('/').pop()}</span>
                  </div>
                  
                  {/* Files in folder */}
                  {expandedFolders.has(folder) && (
                    <div className="ml-6 space-y-1">
                      {folderFiles.map((file) => {
                        const FileIcon = getFileIcon(file.type);
                        const fileComponents = components.filter(c => c.fileId === file.id);
                        
                        return (
                          <div key={file.id}>
                            <div className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer">
                              <FileIcon className={`h-4 w-4 mr-2 ${
                                file.type === 'java' ? 'text-[#FF6B6B]' : 'text-[#4ECDC4]'
                              }`} />
                              <span className="text-sm flex-1">{file.name}</span>
                              <span className="ml-auto text-xs text-gray-500">
                                {fileComponents.length} items
                              </span>
                            </div>
                            
                            {/* Components in file */}
                            <div className="ml-6 space-y-1">
                              {fileComponents.map((component) => (
                                <div 
                                  key={component.id}
                                  onClick={() => onComponentSelect(component)}
                                  className="flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
                                  data-testid={`component-${component.id}`}
                                >
                                  <Circle className={`h-2 w-2 mr-2 ${getNodeColor(component.type)}`} />
                                  <span className="text-sm">{component.name}</span>
                                  <span className="ml-auto text-xs text-gray-500 capitalize">
                                    {component.type}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 p-3 bg-white rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Legend</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#FF6B6B] mr-2"></div>
                <span>Classes</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#4ECDC4] mr-2"></div>
                <span>Methods</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-[#FFD33D] mr-2"></div>
                <span>Functions</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
