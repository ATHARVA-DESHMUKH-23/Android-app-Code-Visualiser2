import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Download, Move } from "lucide-react";
import { createVisualization } from "@/lib/visualization";
import { type Project, type CodeComponent } from "@shared/schema";

interface FlowchartCanvasProps {
  project: Project;
  components: CodeComponent[];
  selectedComponent: CodeComponent | null;
  onComponentSelect: (component: CodeComponent) => void;
  isLoading: boolean;
}

export default function FlowchartCanvas({ 
  project, 
  components, 
  selectedComponent, 
  onComponentSelect,
  isLoading 
}: FlowchartCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (canvasRef.current && components.length > 0) {
      createVisualization(canvasRef.current, components, onComponentSelect, selectedComponent);
    }
  }, [components, selectedComponent, onComponentSelect]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleExport = () => {
    // Implementation for exporting the diagram
    const canvas = canvasRef.current;
    if (canvas) {
      // This would typically use html2canvas or similar library
      console.log("Exporting diagram...");
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -10 : 10;
    setZoomLevel(prev => Math.max(50, Math.min(200, prev + delta)));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0366D6] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-[#24292E]" data-testid="text-current-file">
              {selectedComponent ? `${selectedComponent.name}` : project.name}
            </h2>
            <div className="flex items-center space-x-2">
              {selectedComponent && (
                <>
                  <span className={`px-2 py-1 text-white text-xs rounded-full ${
                    selectedComponent.type === 'class' ? 'bg-[#FF6B6B]' :
                    selectedComponent.type === 'method' ? 'bg-[#4ECDC4]' : 'bg-[#FFD33D]'
                  }`}>
                    {selectedComponent.type}
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedComponent.visibility} • Line {selectedComponent.startLine}
                  </span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-gray-100 rounded-md">
              <button 
                onClick={handleZoomOut}
                className="px-3 py-2 text-sm hover:bg-gray-200 rounded-l-md"
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="px-3 py-2 text-sm bg-white border-x border-gray-200" data-testid="text-zoom-level">
                {zoomLevel}%
              </span>
              <button 
                onClick={handleZoomIn}
                className="px-3 py-2 text-sm hover:bg-gray-200 rounded-r-md"
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            
            <button 
              onClick={handleExport}
              className="px-3 py-2 bg-[#0366D6] text-white rounded-md text-sm hover:bg-blue-700 flex items-center space-x-1"
              data-testid="button-export"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div 
        className="flex-1 relative overflow-hidden bg-gray-50 cursor-grab active:cursor-grabbing"
        style={{ 
          transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: 'center center'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        data-testid="canvas-container"
      >
        <div 
          ref={canvasRef}
          className="absolute inset-0 p-8"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          data-testid="visualization-canvas"
        />

        {/* Relationship Legend */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-4 text-xs pointer-events-none shadow-lg">
          <h4 className="font-semibold text-gray-800 mb-2">Relationships</h4>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="w-6 h-0.5 bg-blue-600 mr-2"></div>
              <span className="text-gray-700">Method Calls</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-0.5 bg-green-600 mr-2"></div>
              <span className="text-gray-700">Inheritance</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-0.5 bg-orange-500 border-dashed border-b mr-2"></div>
              <span className="text-gray-700">Implements</span>
            </div>
            <div className="flex items-center">
              <div className="w-6 h-0.5 bg-gray-500 border-dashed border-b mr-2"></div>
              <span className="text-gray-700">Dependencies</span>
            </div>
          </div>
        </div>

        {/* Pan/Zoom Instructions */}
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-600 pointer-events-none shadow-lg">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <Move className="h-3 w-3 mr-1" />
              Click nodes for details
            </span>
            <span className="flex items-center">
              <i className="fas fa-hand-paper text-xs mr-1"></i>
              Drag to pan
            </span>
            <span className="flex items-center">
              <i className="fas fa-search-plus text-xs mr-1"></i>
              Scroll to zoom
            </span>
          </div>
        </div>

        {/* Loading overlay for empty state */}
        {components.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl text-gray-400 mb-4">
                <i className="fas fa-project-diagram"></i>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">
                No components found
              </h3>
              <p className="text-gray-600">
                Upload some Java or Kotlin files to see the code visualization
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
