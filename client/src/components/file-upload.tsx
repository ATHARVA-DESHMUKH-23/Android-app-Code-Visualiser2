import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Upload, FileCode, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Project } from "@shared/schema";

interface FileUploadProps {
  onClose: () => void;
  onSuccess: (project: Project) => void;
}

export default function FileUpload({ onClose, onSuccess }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [includeTests, setIncludeTests] = useState(false);
  const [generateDocs, setGenerateDocs] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('name', projectName || 'Untitled Project');
      formData.append('description', projectDescription);
      
      const response = await apiRequest('POST', '/api/projects', formData);
      return response.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project uploaded successfully",
        description: `${project.name} has been analyzed and is ready for visualization.`,
      });
      onSuccess(project);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload project",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }
    uploadMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#24292E]">Upload Android Project</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              data-testid="button-close-upload"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Project Details */}
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0366D6] focus:border-transparent"
                data-testid="input-project-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Enter project description"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0366D6] focus:border-transparent"
                rows={3}
                data-testid="textarea-project-description"
              />
            </div>
          </div>

          {/* Upload Area */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0366D6] transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
            data-testid="upload-area"
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-[#24292E] mb-2">Drop your Android project here</p>
            <p className="text-sm text-gray-600 mb-4">or click to browse files</p>
            <div className="text-xs text-gray-500">
              Supported formats: .zip, .jar, or individual .java/.kt files
            </div>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".zip,.jar,.java,.kt"
              multiple
              onChange={handleFileSelect}
              data-testid="input-file"
            />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Files ({files.length})</h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <FileCode className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button 
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                      data-testid={`button-remove-file-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Options */}
          <div className="mt-6 space-y-4">
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox" 
                id="includeTests" 
                checked={includeTests}
                onChange={(e) => setIncludeTests(e.target.checked)}
                className="rounded border-gray-300 text-[#0366D6] focus:ring-[#0366D6]"
                data-testid="checkbox-include-tests"
              />
              <label htmlFor="includeTests" className="text-sm text-[#24292E]">
                Include test files in analysis
              </label>
            </div>
            <div className="flex items-center space-x-3">
              <input 
                type="checkbox" 
                id="generateDocs" 
                checked={generateDocs}
                onChange={(e) => setGenerateDocs(e.target.checked)}
                className="rounded border-gray-300 text-[#0366D6] focus:ring-[#0366D6]"
                data-testid="checkbox-generate-docs"
              />
              <label htmlFor="generateDocs" className="text-sm text-[#24292E]">
                Auto-generate documentation
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              disabled={uploadMutation.isPending}
              data-testid="button-cancel-upload"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={uploadMutation.isPending || files.length === 0}
              className="px-4 py-2 bg-[#0366D6] text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              data-testid="button-start-analysis"
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Start Analysis</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
