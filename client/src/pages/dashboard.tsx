import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import Header from "@/components/header";
import ProjectSidebar from "@/components/project-sidebar";
import FlowchartCanvas from "@/components/flowchart-canvas";
import DetailPanel from "@/components/detail-panel";
import FileUpload from "@/components/file-upload";
import { type Project, type CodeComponent } from "@shared/schema";

export default function Dashboard() {
  const [, params] = useRoute("/project/:id");
  const [selectedComponent, setSelectedComponent] = useState<CodeComponent | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects, isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: currentProject } = useQuery<Project>({
    queryKey: ["/api/projects", params?.id],
    enabled: !!params?.id,
  });

  const { data: components, isLoading: componentsLoading } = useQuery<CodeComponent[]>({
    queryKey: ["/api/projects", params?.id, "components"],
    enabled: !!params?.id,
  });

  const { data: files } = useQuery<ProjectFile[]>({
    queryKey: ["/api/projects", params?.id, "files"],
    enabled: !!params?.id,
  });

  const handleComponentSelect = (component: CodeComponent) => {
    setSelectedComponent(component);
  };

  const handleProjectSelect = (projectId: string) => {
    window.location.href = `/project/${projectId}`;
  };

  const filteredComponents = components?.filter((component: CodeComponent) => 
    component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    component.type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-screen flex flex-col bg-white">
      <Header 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUploadClick={() => setShowUploadModal(true)}
        data-testid="header"
      />
      
      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar 
          projects={projects || []}
          currentProject={currentProject}
          files={files || []}
          components={filteredComponents}
          onProjectSelect={handleProjectSelect}
          onComponentSelect={handleComponentSelect}
          isLoading={projectsLoading}
          data-testid="sidebar"
        />
        
        <main className="flex-1 flex overflow-hidden">
          {currentProject ? (
            <>
              <FlowchartCanvas 
                project={currentProject}
                components={filteredComponents}
                selectedComponent={selectedComponent}
                onComponentSelect={handleComponentSelect}
                isLoading={componentsLoading}
                data-testid="canvas"
              />
              
              {selectedComponent && (
                <DetailPanel 
                  component={selectedComponent}
                  onClose={() => setSelectedComponent(null)}
                  data-testid="detail-panel"
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="text-4xl text-gray-400 mb-4">
                  <i className="fas fa-project-diagram"></i>
                </div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">
                  Welcome to CodeFlow
                </h2>
                <p className="text-gray-600 mb-4">
                  Upload an Android project to start visualizing your code
                </p>
                <button 
                  onClick={() => setShowUploadModal(true)}
                  className="bg-[#0366D6] text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  data-testid="button-upload-welcome"
                >
                  Upload Project
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {showUploadModal && (
        <FileUpload 
          onClose={() => setShowUploadModal(false)}
          onSuccess={(project) => {
            setShowUploadModal(false);
            window.location.href = `/project/${project.id}`;
          }}
          data-testid="upload-modal"
        />
      )}
    </div>
  );
}
