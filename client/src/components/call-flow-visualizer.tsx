import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause } from 'lucide-react';

interface FlowNode {
  id: string;
  type: 'method' | 'decision' | 'loop' | 'start' | 'end';
  name: string;
  className?: string;
  condition?: string;
  loopType?: 'for' | 'while' | 'do_while';
  lineNumber?: number;
}

interface FlowLink {
  source: string;
  target: string;
  type: 'calls' | 'if_true' | 'if_false' | 'loop_entry' | 'loop_exit' | 'sequence';
  branchType?: string;
}

interface CallFlowGraph {
  nodes: FlowNode[];
  links: FlowLink[];
  entryMethod: string;
}

interface CallFlowVisualizerProps {
  projectId: string;
  entryMethods: string[];
  onEntryMethodChange: (method: string) => void;
}

export function CallFlowVisualizer({ projectId, entryMethods, onEntryMethodChange }: CallFlowVisualizerProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [callFlowGraph, setCallFlowGraph] = useState<CallFlowGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [animationStep, setAnimationStep] = useState(-1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const generateCallFlow = async (entryMethod: string) => {
    if (!entryMethod) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/call-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entryMethod }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate call flow');
      }

      const data = await response.json();
      setCallFlowGraph(data.callFlowGraph);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    onEntryMethodChange(method);
    generateCallFlow(method);
    setAnimationStep(-1);
    setIsAnimating(false);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setAnimationStep(-1);
    setIsAnimating(false);
  };

  const handlePlayAnimation = () => {
    if (!callFlowGraph) return;
    
    setIsAnimating(true);
    setAnimationStep(0);
    
    const animationInterval = setInterval(() => {
      setAnimationStep(prev => {
        if (prev >= callFlowGraph.nodes.length - 1) {
          setIsAnimating(false);
          clearInterval(animationInterval);
          return -1;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const getNodeColor = (node: FlowNode, isActive: boolean = false) => {
    if (isActive) return '#ff6b6b';
    
    switch (node.type) {
      case 'start': return '#4ade80';
      case 'end': return '#ef4444';
      case 'method': return '#3b82f6';
      case 'decision': return '#f59e0b';
      case 'loop': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getLinkColor = (link: FlowLink) => {
    switch (link.type) {
      case 'calls': return '#3b82f6';
      case 'if_true': return '#10b981';
      case 'if_false': return '#ef4444';
      case 'loop_entry': return '#8b5cf6';
      case 'loop_exit': return '#8b5cf6';
      case 'sequence': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getNodeShape = (node: FlowNode) => {
    switch (node.type) {
      case 'decision':
        return 'polygon';
      case 'loop':
        return 'polygon';
      default:
        return 'rect';
    }
  };

  const renderNode = (node: FlowNode, x: number, y: number, index: number) => {
    const isActive = animationStep >= 0 && index <= animationStep;
    const isSelected = selectedNode?.id === node.id;
    
    const baseProps = {
      key: node.id,
      onClick: () => setSelectedNode(node),
      style: { cursor: 'pointer' },
      className: `transition-all duration-300 ${isSelected ? 'stroke-2' : 'stroke-1'}`,
    };

    if (node.type === 'decision') {
      // Diamond shape for decisions
      return (
        <g {...baseProps}>
          <polygon
            points={`${x-40},${y} ${x},${y-20} ${x+40},${y} ${x},${y+20}`}
            fill={getNodeColor(node, isActive)}
            stroke={isSelected ? '#000' : '#e5e7eb'}
            data-testid={`node-decision-${node.id}`}
          />
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dy="0.35em"
            fontSize="10"
            fill="white"
            fontWeight="bold"
          >
            {node.condition?.substring(0, 8) || 'Decision'}
          </text>
        </g>
      );
    }

    if (node.type === 'loop') {
      // Hexagon shape for loops
      return (
        <g {...baseProps}>
          <polygon
            points={`${x-35},${y-10} ${x-15},${y-20} ${x+15},${y-20} ${x+35},${y-10} ${x+35},${y+10} ${x+15},${y+20} ${x-15},${y+20} ${x-35},${y+10}`}
            fill={getNodeColor(node, isActive)}
            stroke={isSelected ? '#000' : '#e5e7eb'}
            data-testid={`node-loop-${node.id}`}
          />
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dy="0.35em"
            fontSize="9"
            fill="white"
            fontWeight="bold"
          >
            {node.loopType?.toUpperCase() || 'LOOP'}
          </text>
        </g>
      );
    }

    // Rectangle for methods, start, end
    return (
      <g {...baseProps}>
        <rect
          x={x - 50}
          y={y - 15}
          width={100}
          height={30}
          rx={node.type === 'start' || node.type === 'end' ? 15 : 5}
          fill={getNodeColor(node, isActive)}
          stroke={isSelected ? '#000' : '#e5e7eb'}
          data-testid={`node-${node.type}-${node.id}`}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dy="0.35em"
          fontSize="10"
          fill="white"
          fontWeight="bold"
        >
          {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
        </text>
      </g>
    );
  };

  const renderLink = (link: FlowLink, nodes: FlowNode[]) => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (!sourceNode || !targetNode) return null;

    const sourceIndex = nodes.indexOf(sourceNode);
    const targetIndex = nodes.indexOf(targetNode);
    
    const sourceX = 100 + (sourceIndex % 4) * 180;
    const sourceY = 100 + Math.floor(sourceIndex / 4) * 100;
    const targetX = 100 + (targetIndex % 4) * 180;
    const targetY = 100 + Math.floor(targetIndex / 4) * 100;

    const color = getLinkColor(link);
    const isDashed = link.type === 'if_false' || link.type === 'loop_exit';

    return (
      <g key={`${link.source}-${link.target}`}>
        <line
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
          stroke={color}
          strokeWidth="2"
          strokeDasharray={isDashed ? "5,5" : "none"}
          markerEnd="url(#arrowhead)"
          data-testid={`link-${link.type}-${link.source}-${link.target}`}
        />
        {link.branchType && (
          <text
            x={(sourceX + targetX) / 2}
            y={(sourceY + targetY) / 2 - 10}
            textAnchor="middle"
            fontSize="8"
            fill={color}
            fontWeight="bold"
          >
            {link.branchType}
          </text>
        )}
      </g>
    );
  };

  const canvasWidth = callFlowGraph ? Math.max(800, callFlowGraph.nodes.length * 50) : 800;
  const canvasHeight = callFlowGraph ? Math.max(600, Math.ceil(callFlowGraph.nodes.length / 4) * 100 + 200) : 600;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Call Flow Tracer</CardTitle>
          <CardDescription>
            Select an entry method to visualize the execution flow with branching logic
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedMethod} onValueChange={handleMethodSelect} data-testid="select-entry-method">
                <SelectTrigger>
                  <SelectValue placeholder="Select entry method..." />
                </SelectTrigger>
                <SelectContent>
                  {entryMethods.map((method) => (
                    <SelectItem key={method} value={method} data-testid={`option-method-${method}`}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleZoomIn} data-testid="button-zoom-in">
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut} data-testid="button-zoom-out">
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset">
                <RotateCcw className="w-4 h-4" />
              </Button>
              {callFlowGraph && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePlayAnimation}
                  disabled={isAnimating}
                  data-testid="button-play-animation"
                >
                  {isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
          
          {callFlowGraph && (
            <div className="mt-4 text-sm text-gray-600">
              <p>Entry Method: <strong>{callFlowGraph.entryMethod}</strong></p>
              <p>Nodes: {callFlowGraph.nodes.length} | Links: {callFlowGraph.links.length}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visualization Canvas */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">Generating call flow...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {callFlowGraph && !loading && (
        <Card>
          <CardContent className="p-0">
            <div 
              ref={containerRef}
              className="relative w-full h-96 overflow-auto border"
              data-testid="canvas-container"
            >
              <svg
                ref={svgRef}
                width={canvasWidth * zoom}
                height={canvasHeight * zoom}
                className="block"
                data-testid="visualization-canvas"
              >
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                  </marker>
                </defs>
                
                <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>
                  {/* Render links first (behind nodes) */}
                  {callFlowGraph.links.map((link) => renderLink(link, callFlowGraph.nodes))}
                  
                  {/* Render nodes */}
                  {callFlowGraph.nodes.map((node, index) => {
                    const x = 100 + (index % 4) * 180;
                    const y = 100 + Math.floor(index / 4) * 100;
                    return renderNode(node, x, y, index);
                  })}
                </g>
              </svg>
            </div>
            
            {/* Node Details Panel */}
            {selectedNode && (
              <div className="p-4 border-t bg-gray-50">
                <h3 className="font-semibold text-sm mb-2">Node Details</h3>
                <div className="space-y-1 text-xs">
                  <p><strong>Type:</strong> {selectedNode.type}</p>
                  <p><strong>Name:</strong> {selectedNode.name}</p>
                  {selectedNode.className && <p><strong>Class:</strong> {selectedNode.className}</p>}
                  {selectedNode.condition && <p><strong>Condition:</strong> {selectedNode.condition}</p>}
                  {selectedNode.lineNumber && <p><strong>Line:</strong> {selectedNode.lineNumber}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      {callFlowGraph && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Legend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>Method</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-500 rounded-sm transform rotate-45"></div>
                <span>Decision</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-purple-500" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}></div>
                <span>Loop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-green-500"></div>
                <span>True Branch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-red-500 border-dashed border-t-2 border-red-500"></div>
                <span>False Branch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-blue-500"></div>
                <span>Method Call</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-gray-500"></div>
                <span>Sequence</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}