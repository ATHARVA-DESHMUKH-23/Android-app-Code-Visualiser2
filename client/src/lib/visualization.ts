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
  type: 'dependency' | 'calls' | 'inheritance';
}

export function createVisualization(
  container: HTMLElement,
  components: CodeComponent[],
  onComponentSelect: (component: CodeComponent) => void,
  selectedComponent: CodeComponent | null
) {
  // Clear previous visualization
  container.innerHTML = '';

  if (components.length === 0) return;

  // Create nodes and links
  const nodes = createNodes(components);
  const links = createLinks(components, nodes);

  // Create SVG container
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.zIndex = '1';

  // Add arrow markers
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
  polygon.setAttribute('fill', '#0366D6');

  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Draw links
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sourceNode.x.toString());
      line.setAttribute('y1', sourceNode.y.toString());
      line.setAttribute('x2', targetNode.x.toString());
      line.setAttribute('y2', targetNode.y.toString());
      line.setAttribute('stroke', link.type === 'dependency' ? '#28A745' : '#0366D6');
      line.setAttribute('stroke-width', '2');
      
      if (link.type === 'dependency') {
        line.setAttribute('stroke-dasharray', '5,5');
      } else {
        line.setAttribute('marker-end', 'url(#arrowhead)');
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

  let xOffset = 200;
  let yOffset = 100;

  // Position classes at the top
  classes.forEach((component, index) => {
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: xOffset + (index * 200),
      y: yOffset,
      component
    });
  });

  // Position methods in the middle
  yOffset += 150;
  methods.forEach((component, index) => {
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: xOffset + (index * 180),
      y: yOffset,
      component
    });
  });

  // Position functions at the bottom
  yOffset += 150;
  functions.forEach((component, index) => {
    nodes.push({
      id: component.id,
      name: component.name,
      type: component.type,
      x: xOffset + (index * 180),
      y: yOffset,
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
