import { X, ExternalLink } from "lucide-react";
import { type CodeComponent } from "@shared/schema";

interface DetailPanelProps {
  component: CodeComponent;
  onClose: () => void;
}

export default function DetailPanel({ component, onClose }: DetailPanelProps) {
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'class':
      case 'interface':
        return 'bg-[#FF6B6B]';
      case 'method':
        return 'bg-[#4ECDC4]';
      case 'function':
        return 'bg-[#FFD33D] text-black';
      default:
        return 'bg-gray-400';
    }
  };

  const generateCodePreview = (component: CodeComponent) => {
    if (component.type === 'method') {
      const params = component.parameters?.map(p => `${p.type} ${p.name}`).join(', ') || '';
      return `${component.visibility || 'public'} ${component.returnType || 'void'} ${component.name}(${params}) {
    // Method implementation
    ${component.type === 'method' ? '// TODO: Implement method logic' : ''}
}`;
    } else if (component.type === 'class') {
      return `${component.visibility || 'public'} class ${component.name} {
    // Class implementation
    // TODO: Add class members and methods
}`;
    } else {
      return component.signature || `// ${component.type}: ${component.name}`;
    }
  };

  return (
    <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto custom-scrollbar">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#24292E]">Component Details</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            data-testid="button-close-detail-panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Component Information */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${getNodeColor(component.type)}`}></div>
              <span className="font-medium text-[#24292E]" data-testid="text-component-name">
                {component.name}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize">
                {component.visibility || 'package'}
              </span>
            </div>
            <p className="text-sm text-gray-600" data-testid="text-component-description">
              {component.description || `${component.type} ${component.name}`}
            </p>
          </div>

          {/* Type and Location */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <div className="font-medium capitalize" data-testid="text-component-type">
                {component.type}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Line:</span>
              <div className="font-medium" data-testid="text-component-line">
                {component.startLine || 'N/A'}
              </div>
            </div>
          </div>

          {/* Method Signature */}
          {component.signature && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Signature:</div>
              <code className="text-sm font-mono text-[#24292E]" data-testid="text-component-signature">
                {component.signature}
              </code>
            </div>
          )}

          {/* Parameters */}
          {component.parameters && component.parameters.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Parameters</h4>
              <div className="space-y-2">
                {component.parameters.map((param, index) => (
                  <div key={index} className="bg-gray-50 rounded p-2 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-[#24292E]" data-testid={`text-param-name-${index}`}>
                        {param.name}
                      </span>
                      <span className="text-xs text-gray-500 font-mono" data-testid={`text-param-type-${index}`}>
                        {param.type}
                      </span>
                    </div>
                    {param.description && (
                      <p className="text-xs text-gray-600" data-testid={`text-param-description-${index}`}>
                        {param.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Value */}
          {component.returnType && component.returnType !== 'void' && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Returns</h4>
              <div className="bg-gray-50 rounded p-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[#24292E] text-sm" data-testid="text-return-type">
                    {component.returnType}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  Return value of type {component.returnType}
                </p>
              </div>
            </div>
          )}

          {/* Dependencies */}
          {component.dependencies && component.dependencies.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Dependencies</h4>
              <div className="space-y-2">
                {component.dependencies.map((dep, index) => (
                  <div 
                    key={index}
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    data-testid={`dependency-${index}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#FFD33D]"></div>
                    <span className="text-sm text-[#24292E]">{dep}</span>
                    <ExternalLink className="h-3 w-3 text-gray-400 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Called By */}
          {component.calledBy && component.calledBy.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Called By</h4>
              <div className="space-y-2">
                {component.calledBy.map((caller, index) => (
                  <div 
                    key={index}
                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    data-testid={`caller-${index}`}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#4ECDC4]"></div>
                    <span className="text-sm text-[#24292E]">{caller}</span>
                    <ExternalLink className="h-3 w-3 text-gray-400 ml-auto" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Code Preview</h4>
              <button className="text-xs text-[#0366D6] hover:underline" data-testid="button-view-full-code">
                View Full Code
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 text-xs font-mono overflow-x-auto">
              <pre className="text-gray-300">
                <code data-testid="code-preview">
                  {generateCodePreview(component)}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
