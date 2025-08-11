import { type CodeComponent } from "@shared/schema";

interface Node {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  component: CodeComponent;
}

interface Link {
  source: string;
  target: string;
  type: 'dependency' | 'calls' | 'extends' | 'implements';
}

export function createVisualization(
  container: HTMLElement,
  components: CodeComponent[],
  onComponentSelect: (component: CodeComponent) => void,
  selectedComponent: CodeComponent | null
) {
  // Clear previous visualization
  container.innerHTML = '';

  if (components.length === 0) {
    container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No components to display</div>';
    return;
  }

  // Create nodes and links
  const nodes = createNodes(components);
  const links = createLinks(components, nodes);

  // Calculate required canvas dimensions
  const maxX = Math.max(...nodes.map(n => n.x)) + 300;
  const maxY = Math.max(...nodes.map(n => n.y)) + 150;
  
  // Set container dimensions to accommodate all nodes
  container.style.position = 'relative';
  container.style.width = `${Math.max(maxX, 1200)}px`;
  container.style.height = `${Math.max(maxY, 800)}px`;

  // Create SVG container with proper dimensions
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.width = `${Math.max(maxX, 1200)}px`;
  svg.style.height = `${Math.max(maxY, 800)}px`;
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.zIndex = '1';
  svg.style.pointerEvents = 'none';

  // Add arrow markers for different relationship types
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  
  const createArrowMarker = (id: string, color: string) => {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', color);

    marker.appendChild(polygon);
    return marker;
  };

  defs.appendChild(createArrowMarker('arrowhead-blue', '#0366D6'));
  defs.appendChild(createArrowMarker('arrowhead-green', '#10B981'));
  defs.appendChild(createArrowMarker('arrowhead-orange', '#F59E0B'));
  defs.appendChild(createArrowMarker('arrowhead-gray', '#6B7280'));
  svg.appendChild(defs);

  // Draw links with proper styling
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourceNode.x.toString());
      line.setAttribute('y1', sourceNode.y.toString());
      line.setAttribute('x2', targetNode.x.toString());
      line.setAttribute('y2', targetNode.y.toString());
      line.setAttribute('stroke-opacity', '0.8');
      
      // Style based on relationship type
      switch (link.type) {
        case 'dependency':
          line.setAttribute('stroke', '#6B7280');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '5,5');
          line.setAttribute('marker-end', 'url(#arrowhead-gray)');
          break;
        case 'calls':
          line.setAttribute('stroke', '#0366D6');
          line.setAttribute('stroke-width', '3');
          line.setAttribute('marker-end', 'url(#arrowhead-blue)');
          break;
        case 'extends':
          line.setAttribute('stroke', '#10B981');
          line.setAttribute('stroke-width', '3');
          line.setAttribute('marker-end', 'url(#arrowhead-green)');
          break;
        case 'implements':
          line.setAttribute('stroke', '#F59E0B');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('stroke-dasharray', '3,3');
          line.setAttribute('marker-end', 'url(#arrowhead-orange)');
          break;
        default:
          line.setAttribute('stroke', '#6B7280');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('marker-end', 'url(#arrowhead-gray)');
      }
      
      svg.appendChild(line);
    }
  });

  container.appendChild(svg);

  // Draw nodes
  nodes.forEach(node => {
    const nodeElement = createNodeElement(node, onComponentSelect, selectedComponent);
    container.appendChild(nodeElement);
  });
}

function createNodes(components: CodeComponent[]): Node[] {
  const nodes: Node[] = [];
  
  // Group components by type for better layout
  const classes = components.filter(c => c.type === 'class' || c.type === 'interface');
  const methods = components.filter(c => c.type === 'method');
  const functions = components.filter(c => c.type === 'function');

  const nodeWidth = 200;
  const horizontalSpacing = 280;
  const verticalSpacing = 120;
  const startX = 150;
  let currentY = 80;

  // Group methods by their parent class
  const methodsByClass = new Map<string, CodeComponent[]>();
  methods.forEach(method => {
    const parentClass = (method as any).parentClass || 'Unknown';
    if (!methodsByClass.has(parentClass)) {
      methodsByClass.set(parentClass, []);
    }
    methodsByClass.get(parentClass)!.push(method);
  });

  // Calculate grid dimensions
  const itemsPerRow = Math.max(3, Math.min(6, Math.ceil(Math.sqrt(classes.length + methods.length + functions.length))));

  // Position classes first
  classes.forEach((component, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: startX + (col * horizontalSpacing),
      y: currentY + (row * verticalSpacing),
      component
    });
  });

  // Update Y position for methods
  const classRows = Math.ceil(classes.length / itemsPerRow);
  currentY += classRows * verticalSpacing + 50;

  // Position methods
  methods.forEach((component, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: startX + (col * horizontalSpacing),
      y: currentY + (row * verticalSpacing),
      component
    });
  });

  // Update Y position for functions
  const methodRows = Math.ceil(methods.length / itemsPerRow);
  currentY += methodRows * verticalSpacing + 50;

  // Position functions
  functions.forEach((component, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: startX + (col * horizontalSpacing),
      y: currentY + (row * verticalSpacing),
      component
    });
  });

  return nodes;
}

function createLinks(components: CodeComponent[], nodes: Node[]): Link[] {
  const links: Link[] = [];
  const nodeMap = new Map(nodes.map(n => [n.name, n]));

  components.forEach(component => {
    const sourceNode = nodeMap.get(component.name);
    if (!sourceNode) return;

    // Create dependency links (what this component uses)
    component.dependencies?.forEach(dep => {
      const targetNode = nodeMap.get(dep);
      if (targetNode && targetNode.id !== sourceNode.id) {
        // Avoid duplicate links
        const existingLink = links.find(l => 
          l.source === sourceNode.id && l.target === targetNode.id
        );
        if (!existingLink) {
          links.push({
            source: sourceNode.id,
            target: targetNode.id,
            type: 'dependency'
          });
        }
      }
    });

    // Create "called by" links (what calls this component)
    component.calledBy?.forEach(caller => {
      const callerNode = nodeMap.get(caller);
      if (callerNode && callerNode.id !== sourceNode.id) {
        // Avoid duplicate links
        const existingLink = links.find(l => 
          l.source === callerNode.id && l.target === sourceNode.id
        );
        if (!existingLink) {
          links.push({
            source: callerNode.id,
            target: sourceNode.id,
            type: 'calls'
          });
        }
      }
    });

    // Create inheritance links (extends/implements)
    if (component.type === 'class' || component.type === 'interface') {
      // Look for extends/implements in signature
      const signature = component.signature || '';
      const extendsMatch = signature.match(/extends\s+(\w+)/);
      const implementsMatch = signature.match(/implements\s+([\w\s,]+)/);
      
      if (extendsMatch) {
        const parentNode = nodeMap.get(extendsMatch[1]);
        if (parentNode) {
          links.push({
            source: sourceNode.id,
            target: parentNode.id,
            type: 'extends'
          });
        }
      }
      
      if (implementsMatch) {
        const interfaces = implementsMatch[1].split(',').map(i => i.trim());
        interfaces.forEach(iface => {
          const ifaceNode = nodeMap.get(iface);
          if (ifaceNode) {
            links.push({
              source: sourceNode.id,
              target: ifaceNode.id,
              type: 'implements'
            });
          }
        });
      }
    }
  });

  return links;
}

function createNodeElement(
  node: Node,
  onComponentSelect: (component: CodeComponent) => void,
  selectedComponent: CodeComponent | null
): HTMLElement {
  const nodeDiv = document.createElement('div');
  nodeDiv.className = `absolute cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
    selectedComponent?.id === node.id ? 'ring-2 ring-blue-500' : ''
  }`;
  nodeDiv.style.left = `${node.x}px`;
  nodeDiv.style.top = `${node.y}px`;
  nodeDiv.style.transform = 'translate(-50%, -50%)';
  nodeDiv.style.zIndex = '10';

  const getNodeStyle = (type: string) => {
    switch (type) {
      case 'class':
      case 'interface':
        return 'bg-[#FF6B6B] text-white border-2 border-red-400';
      case 'method':
        return 'bg-[#4ECDC4] text-white border-2 border-teal-400';
      case 'function':
        return 'bg-[#FFD33D] text-black border-2 border-yellow-600';
      default:
        return 'bg-gray-400 text-white border-2 border-gray-500';
    }
  };

  nodeDiv.innerHTML = `
    <div class="${getNodeStyle(node.type)} px-4 py-3 rounded-lg shadow-lg">
      <div class="flex items-center space-x-2">
        <i class="fas fa-${node.type === 'class' ? 'cube' : node.type === 'method' ? 'cog' : 'function'}"></i>
        <div>
          <div class="font-medium text-sm">${node.name}</div>
          <div class="text-xs opacity-90">${node.type} • ${node.component.visibility || 'package'}</div>
        </div>
      </div>
    </div>
  `;

  nodeDiv.addEventListener('click', () => {
    onComponentSelect(node.component);
  });

  // Add hover tooltip
  nodeDiv.title = `${node.component.description || node.name}\nClick for details`;

  return nodeDiv;
}
