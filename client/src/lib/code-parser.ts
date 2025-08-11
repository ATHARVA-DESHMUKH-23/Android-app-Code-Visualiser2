export interface ParsedComponent {
  name: string;
  type: 'class' | 'method' | 'function' | 'interface';
  signature: string;
  description: string;
  startLine: number;
  endLine: number;
  visibility: string;
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  returnType?: string;
  dependencies: string[];
  calledBy: string[];
}

export function parseJavaFile(content: string, filename: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const lines = content.split('\n');
  
  // Basic regex patterns for Java parsing
  const classPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)/;
  const interfacePattern = /(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/;
  const methodPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+|\w+<.*?>)\s+(\w+)\s*\([^)]*\)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || !line) {
      continue;
    }

    // Parse classes
    const classMatch = line.match(classPattern);
    if (classMatch) {
      components.push({
        name: classMatch[1],
        type: 'class',
        signature: line,
        description: `Class ${classMatch[1]} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: [],
        dependencies: extractImports(content),
        calledBy: []
      });
      continue;
    }

    // Parse interfaces
    const interfaceMatch = line.match(interfacePattern);
    if (interfaceMatch) {
      components.push({
        name: interfaceMatch[1],
        type: 'interface',
        signature: line,
        description: `Interface ${interfaceMatch[1]} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: [],
        dependencies: extractImports(content),
        calledBy: []
      });
      continue;
    }

    // Parse methods
    const methodMatch = line.match(methodPattern);
    if (methodMatch && !line.includes('class ') && !line.includes('interface ')) {
      const returnType = methodMatch[1];
      const methodName = methodMatch[2];
      
      components.push({
        name: methodName,
        type: 'method',
        signature: line,
        description: `Method ${methodName} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: extractParameters(line),
        returnType: returnType !== 'void' ? returnType : undefined,
        dependencies: [],
        calledBy: []
      });
    }
  }

  return components;
}

export function parseKotlinFile(content: string, filename: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const lines = content.split('\n');
  
  // Basic regex patterns for Kotlin parsing
  const classPattern = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:open\s+|final\s+|abstract\s+)?class\s+(\w+)/;
  const interfacePattern = /(?:public\s+|private\s+|protected\s+|internal\s+)?interface\s+(\w+)/;
  const functionPattern = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:suspend\s+)?fun\s+(\w+)\s*\([^)]*\)(?:\s*:\s*(\w+))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || !line) {
      continue;
    }

    // Parse classes
    const classMatch = line.match(classPattern);
    if (classMatch) {
      components.push({
        name: classMatch[1],
        type: 'class',
        signature: line,
        description: `Class ${classMatch[1]} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: [],
        dependencies: extractImports(content),
        calledBy: []
      });
      continue;
    }

    // Parse interfaces
    const interfaceMatch = line.match(interfacePattern);
    if (interfaceMatch) {
      components.push({
        name: interfaceMatch[1],
        type: 'interface',
        signature: line,
        description: `Interface ${interfaceMatch[1]} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: [],
        dependencies: extractImports(content),
        calledBy: []
      });
      continue;
    }

    // Parse functions
    const functionMatch = line.match(functionPattern);
    if (functionMatch) {
      const functionName = functionMatch[1];
      const returnType = functionMatch[2];
      
      components.push({
        name: functionName,
        type: 'function',
        signature: line,
        description: `Function ${functionName} from ${filename}`,
        startLine: i + 1,
        endLine: findBlockEnd(lines, i),
        visibility: extractVisibility(line),
        parameters: extractParameters(line),
        returnType,
        dependencies: [],
        calledBy: []
      });
    }
  }

  return components;
}

function extractVisibility(line: string): string {
  if (line.includes('private ')) return 'private';
  if (line.includes('protected ')) return 'protected';
  if (line.includes('public ')) return 'public';
  if (line.includes('internal ')) return 'internal';
  return 'package';
}

function extractParameters(line: string): Array<{ name: string; type: string; description?: string }> {
  const parameters = [];
  const paramMatch = line.match(/\(([^)]*)\)/);
  
  if (paramMatch && paramMatch[1].trim()) {
    const paramList = paramMatch[1].split(',');
    for (const param of paramList) {
      const paramParts = param.trim().split(/\s+/);
      if (paramParts.length >= 2) {
        // Java style: Type name
        if (paramParts.length === 2) {
          parameters.push({
            name: paramParts[1],
            type: paramParts[0],
            description: `Parameter ${paramParts[1]}`
          });
        }
        // Kotlin style: name: Type
        else if (param.includes(':')) {
          const [name, type] = param.split(':').map(s => s.trim());
          parameters.push({
            name: name,
            type: type,
            description: `Parameter ${name}`
          });
        }
      }
    }
  }
  
  return parameters;
}

function extractImports(content: string): string[] {
  const imports = [];
  const importPattern = /import\s+([^;]+)/g;
  let match;
  
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1].trim());
  }
  
  return imports;
}

function findBlockEnd(lines: string[], startIndex: number): number {
  let braceCount = 0;
  let foundFirstBrace = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }
  
  return startIndex + 1;
}
