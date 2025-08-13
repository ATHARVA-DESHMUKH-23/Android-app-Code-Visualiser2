interface MethodCall {
  type: 'method_call';
  name: string;
  lineNumber: number;
}

interface IfStatement {
  type: 'if_statement';
  condition: string;
  lineNumber: number;
  trueBranch: Statement[];
  falseBranch: Statement[];
}

interface LoopStatement {
  type: 'loop_statement';
  loopType: 'for' | 'while' | 'do_while';
  condition: string;
  lineNumber: number;
  body: Statement[];
}

type Statement = MethodCall | IfStatement | LoopStatement;

interface ParsedMethod {
  name: string;
  className: string;
  fullName: string;
  visibility: string;
  parameters: Array<{ name: string; type: string }>;
  returnType: string;
  statements: Statement[];
  lineNumber: number;
}

interface ParsedClass {
  name: string;
  extends: string | null;
  implements: string[];
  methods: ParsedMethod[];
}

export interface FuncMap {
  [key: string]: Statement[];
}

export class ASTParser {
  constructor() {
    // Using enhanced regex-based parsing with better relationship detection
  }

  public parseJavaFile(content: string, filename: string): ParsedClass[] {
    return this.parseFile(content, filename, 'java');
  }

  public parseKotlinFile(content: string, filename: string): ParsedClass[] {
    return this.parseFile(content, filename, 'kotlin');
  }

  private parseFile(content: string, filename: string, language: 'java' | 'kotlin'): ParsedClass[] {
    const classes: ParsedClass[] = [];
    const lines = content.split('\n');
    
    // Enhanced regex patterns
    const classPattern = language === 'java' 
      ? /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/
      : /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:open\s+|final\s+|abstract\s+)?class\s+(\w+)(?:\s*:\s*([\w\s,]+))?/;
    
    let currentClass: ParsedClass | null = null;
    let currentMethod: ParsedMethod | null = null;
    let braceLevel = 0;
    let inClass = false;
    let inMethod = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('//') || line.startsWith('/*') || !line) continue;

      // Count braces for scope tracking
      braceLevel += (line.match(/{/g) || []).length;
      braceLevel -= (line.match(/}/g) || []).length;

      // Parse class declaration
      const classMatch = line.match(classPattern);
      if (classMatch && !inMethod) {
        if (currentClass) classes.push(currentClass);
        
        currentClass = {
          name: classMatch[1],
          extends: this.extractExtends(classMatch, language),
          implements: this.extractImplements(classMatch, language),
          methods: []
        };
        inClass = true;
        continue;
      }

      if (!currentClass) continue;

      // Parse method declaration
      const methodMatch = this.parseMethodDeclaration(line, language);
      if (methodMatch && inClass) {
        if (currentMethod) {
          currentClass.methods.push(currentMethod);
        }

        currentMethod = {
          name: methodMatch.name,
          className: currentClass.name,
          fullName: `${currentClass.name}.${methodMatch.name}`,
          visibility: methodMatch.visibility,
          parameters: methodMatch.parameters,
          returnType: methodMatch.returnType,
          statements: [],
          lineNumber: i + 1
        };
        inMethod = true;
        continue;
      }

      // Parse statements within method
      if (currentMethod && inMethod) {
        const statements = this.parseStatements(line, i + 1);
        currentMethod.statements.push(...statements);
      }

      // Check if we're leaving method scope
      if (inMethod && braceLevel <= (inClass ? 1 : 0)) {
        if (currentMethod) {
          currentClass.methods.push(currentMethod);
          currentMethod = null;
        }
        inMethod = false;
      }

      // Check if we're leaving class scope
      if (inClass && braceLevel <= 0) {
        if (currentClass) {
          if (currentMethod) {
            currentClass.methods.push(currentMethod);
            currentMethod = null;
          }
          classes.push(currentClass);
          currentClass = null;
        }
        inClass = false;
        inMethod = false;
      }
    }

    // Handle any remaining class/method
    if (currentClass) {
      if (currentMethod) {
        currentClass.methods.push(currentMethod);
      }
      classes.push(currentClass);
    }

    return classes;
  }

  public buildFuncMap(classes: ParsedClass[]): FuncMap {
    const funcMap: FuncMap = {};
    
    classes.forEach(cls => {
      cls.methods.forEach(method => {
        funcMap[method.fullName] = method.statements;
      });
    });

    return funcMap;
  }

  private parseMethodDeclaration(line: string, language: 'java' | 'kotlin'): any {
    const methodPattern = language === 'java'
      ? /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+(?:<.*?>)?)\s+(\w+)\s*\(([^)]*)\)/
      : /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:suspend\s+)?fun\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*(\w+))?/;

    const match = line.match(methodPattern);
    if (match) {
      if (language === 'java') {
        return {
          name: match[2],
          returnType: match[1],
          visibility: this.extractVisibilityFromLine(line),
          parameters: this.parseParameters(match[3], language)
        };
      } else {
        return {
          name: match[1],
          returnType: match[3] || 'Unit',
          visibility: this.extractVisibilityFromLine(line),
          parameters: this.parseParameters(match[2], language)
        };
      }
    }
    return null;
  }

  private parseStatements(line: string, lineNumber: number): Statement[] {
    const statements: Statement[] = [];

    // Method call detection
    const methodCallPattern = /(\w+)\s*\(/;
    const methodCallMatch = line.match(methodCallPattern);
    if (methodCallMatch && !this.isAndroidFrameworkCall(methodCallMatch[1])) {
      statements.push({
        type: 'method_call',
        name: methodCallMatch[1],
        lineNumber
      });
    }

    // If statement detection
    if (line.includes('if') && line.includes('(')) {
      const condition = this.extractCondition(line);
      statements.push({
        type: 'if_statement',
        condition: condition || 'condition',
        lineNumber,
        trueBranch: [],
        falseBranch: []
      });
    }

    // Loop statement detection
    const loopPattern = /(for|while|do)\s*\(/;
    const loopMatch = line.match(loopPattern);
    if (loopMatch) {
      const condition = this.extractCondition(line);
      statements.push({
        type: 'loop_statement',
        loopType: loopMatch[1] as 'for' | 'while' | 'do_while',
        condition: condition || 'loop_condition',
        lineNumber,
        body: []
      });
    }

    return statements;
  }

  private extractExtends(classMatch: RegExpMatchArray, language: 'java' | 'kotlin'): string | null {
    if (language === 'java') {
      return classMatch[2] || null;
    } else {
      // For Kotlin, parse the inheritance list
      const inheritanceList = classMatch[2];
      if (inheritanceList) {
        const parts = inheritanceList.split(',').map(s => s.trim());
        // Assume first non-interface is the superclass
        return parts[0] || null;
      }
    }
    return null;
  }

  private extractImplements(classMatch: RegExpMatchArray, language: 'java' | 'kotlin'): string[] {
    if (language === 'java') {
      const implementsList = classMatch[3];
      return implementsList ? implementsList.split(',').map(s => s.trim()) : [];
    } else {
      // For Kotlin, all items in inheritance list could be interfaces
      const inheritanceList = classMatch[2];
      if (inheritanceList) {
        return inheritanceList.split(',').map(s => s.trim()).slice(1); // Skip first (superclass)
      }
    }
    return [];
  }

  private extractVisibilityFromLine(line: string): string {
    if (line.includes('private ')) return 'private';
    if (line.includes('protected ')) return 'protected';
    if (line.includes('public ')) return 'public';
    if (line.includes('internal ')) return 'internal';
    return 'package';
  }

  private parseParameters(paramStr: string, language: 'java' | 'kotlin'): Array<{ name: string; type: string }> {
    if (!paramStr.trim()) return [];

    const parameters: Array<{ name: string; type: string }> = [];
    const paramList = paramStr.split(',');

    for (const param of paramList) {
      const trimmed = param.trim();
      if (trimmed) {
        if (language === 'java') {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            parameters.push({
              type: parts.slice(0, -1).join(' '),
              name: parts[parts.length - 1]
            });
          }
        } else {
          // Kotlin style: name: Type
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex !== -1) {
            parameters.push({
              name: trimmed.substring(0, colonIndex).trim(),
              type: trimmed.substring(colonIndex + 1).trim()
            });
          }
        }
      }
    }

    return parameters;
  }

  private extractCondition(line: string): string | null {
    const match = line.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
  }

  private isAndroidFrameworkCall(methodName: string): boolean {
    const frameworkMethods = [
      'Log', 'Toast', 'findViewById', 'setContentView', 'getSystemService',
      'startActivity', 'finish', 'runOnUiThread', 'getString', 'getResources'
    ];
    
    return frameworkMethods.some(framework => 
      methodName.includes(framework) || methodName.startsWith(framework.toLowerCase())
    );
  }
}