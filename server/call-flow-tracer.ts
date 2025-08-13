import { FuncMap } from './ast-parser';

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

export class CallFlowTracer {
  private funcMap: FuncMap;
  private visited: Set<string>;
  private nodes: FlowNode[];
  private links: FlowLink[];
  private nodeIdCounter: number;

  constructor(funcMap: FuncMap) {
    this.funcMap = funcMap;
    this.visited = new Set();
    this.nodes = [];
    this.links = [];
    this.nodeIdCounter = 0;
  }

  public traceFromEntryMethod(entryMethod: string): CallFlowGraph {
    this.reset();
    
    // Create start node
    const startNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'start',
      name: 'START',
      lineNumber: 1
    };
    this.nodes.push(startNode);

    // Trace the entry method
    const entryNodeId = this.traceMethod(entryMethod, startNode.id);
    
    // Create end node
    const endNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'end',
      name: 'END'
    };
    this.nodes.push(endNode);

    return {
      nodes: this.nodes,
      links: this.links,
      entryMethod
    };
  }

  private reset(): void {
    this.visited.clear();
    this.nodes = [];
    this.links = [];
    this.nodeIdCounter = 0;
  }

  private generateNodeId(): string {
    return `node_${this.nodeIdCounter++}`;
  }

  private traceMethod(methodName: string, parentNodeId: string): string {
    // Avoid infinite recursion
    if (this.visited.has(methodName)) {
      // Create a reference node instead of re-processing
      const refNode: FlowNode = {
        id: this.generateNodeId(),
        type: 'method',
        name: `${methodName} (ref)`,
        className: this.extractClassName(methodName)
      };
      this.nodes.push(refNode);
      this.links.push({
        source: parentNodeId,
        target: refNode.id,
        type: 'calls'
      });
      return refNode.id;
    }

    this.visited.add(methodName);

    // Create method node
    const methodNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'method',
      name: this.extractMethodName(methodName),
      className: this.extractClassName(methodName)
    };
    this.nodes.push(methodNode);

    // Link from parent
    this.links.push({
      source: parentNodeId,
      target: methodNode.id,
      type: 'calls'
    });

    // Get method statements
    const statements = this.funcMap[methodName] || [];
    
    let currentNodeId = methodNode.id;

    // Process each statement in the method
    for (const statement of statements) {
      currentNodeId = this.processStatement(statement, currentNodeId);
    }

    return currentNodeId;
  }

  private processStatement(statement: any, parentNodeId: string): string {
    switch (statement.type) {
      case 'method_call':
        return this.processMethodCall(statement, parentNodeId);
      
      case 'if_statement':
        return this.processIfStatement(statement, parentNodeId);
      
      case 'loop_statement':
        return this.processLoopStatement(statement, parentNodeId);
      
      default:
        return parentNodeId;
    }
  }

  private processMethodCall(statement: any, parentNodeId: string): string {
    const fullMethodName = this.resolveFullMethodName(statement.name);
    
    // If we have the method definition, trace into it
    if (this.funcMap[fullMethodName]) {
      return this.traceMethod(fullMethodName, parentNodeId);
    } else {
      // Create external method call node
      const callNode: FlowNode = {
        id: this.generateNodeId(),
        type: 'method',
        name: statement.name,
        lineNumber: statement.lineNumber
      };
      this.nodes.push(callNode);
      
      this.links.push({
        source: parentNodeId,
        target: callNode.id,
        type: 'calls'
      });
      
      return callNode.id;
    }
  }

  private processIfStatement(statement: any, parentNodeId: string): string {
    // Create decision node
    const decisionNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'decision',
      name: 'Decision',
      condition: statement.condition,
      lineNumber: statement.lineNumber
    };
    this.nodes.push(decisionNode);

    // Link from parent to decision
    this.links.push({
      source: parentNodeId,
      target: decisionNode.id,
      type: 'sequence'
    });

    // Process true branch
    let trueBranchEndId = decisionNode.id;
    for (const stmt of statement.trueBranch) {
      trueBranchEndId = this.processStatement(stmt, trueBranchEndId);
    }

    // Process false branch
    let falseBranchEndId = decisionNode.id;
    for (const stmt of statement.falseBranch) {
      falseBranchEndId = this.processStatement(stmt, falseBranchEndId);
    }

    // Create merge node if both branches exist
    if (statement.trueBranch.length > 0 || statement.falseBranch.length > 0) {
      const mergeNode: FlowNode = {
        id: this.generateNodeId(),
        type: 'method',
        name: 'Merge'
      };
      this.nodes.push(mergeNode);

      // Link branches to merge node
      if (statement.trueBranch.length > 0) {
        this.links.push({
          source: decisionNode.id,
          target: trueBranchEndId === decisionNode.id ? mergeNode.id : trueBranchEndId,
          type: 'if_true',
          branchType: 'true'
        });
        
        if (trueBranchEndId !== decisionNode.id) {
          this.links.push({
            source: trueBranchEndId,
            target: mergeNode.id,
            type: 'sequence'
          });
        }
      }

      if (statement.falseBranch.length > 0) {
        this.links.push({
          source: decisionNode.id,
          target: falseBranchEndId === decisionNode.id ? mergeNode.id : falseBranchEndId,
          type: 'if_false',
          branchType: 'false'
        });
        
        if (falseBranchEndId !== decisionNode.id) {
          this.links.push({
            source: falseBranchEndId,
            target: mergeNode.id,
            type: 'sequence'
          });
        }
      }

      return mergeNode.id;
    }

    return decisionNode.id;
  }

  private processLoopStatement(statement: any, parentNodeId: string): string {
    // Create loop node
    const loopNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'loop',
      name: `${statement.loopType.toUpperCase()} Loop`,
      condition: statement.condition,
      loopType: statement.loopType,
      lineNumber: statement.lineNumber
    };
    this.nodes.push(loopNode);

    // Link from parent to loop
    this.links.push({
      source: parentNodeId,
      target: loopNode.id,
      type: 'sequence'
    });

    // Process loop body
    let bodyEndId = loopNode.id;
    for (const stmt of statement.body) {
      bodyEndId = this.processStatement(stmt, bodyEndId);
    }

    // Create loop back link
    if (bodyEndId !== loopNode.id) {
      this.links.push({
        source: bodyEndId,
        target: loopNode.id,
        type: 'loop_exit'
      });
    }

    // Create loop exit node
    const exitNode: FlowNode = {
      id: this.generateNodeId(),
      type: 'method',
      name: 'Loop Exit'
    };
    this.nodes.push(exitNode);

    this.links.push({
      source: loopNode.id,
      target: exitNode.id,
      type: 'loop_exit'
    });

    return exitNode.id;
  }

  private extractClassName(fullMethodName: string): string {
    const parts = fullMethodName.split('.');
    return parts.length > 1 ? parts[0] : 'Unknown';
  }

  private extractMethodName(fullMethodName: string): string {
    const parts = fullMethodName.split('.');
    return parts.length > 1 ? parts[1] : fullMethodName;
  }

  private resolveFullMethodName(methodName: string): string {
    // Try to find the full method name in funcMap
    const possibleNames = Object.keys(this.funcMap).filter(key => 
      key.endsWith(`.${methodName}`) || key === methodName
    );
    
    return possibleNames[0] || methodName;
  }

  public getAvailableEntryMethods(): string[] {
    return Object.keys(this.funcMap).filter(methodName => {
      // Common Android entry methods
      const entryPatterns = [
        'onCreate', 'onStart', 'onResume', 'onPause', 'onStop', 'onDestroy',
        'onActivityResult', 'onRequestPermissionsResult', 'main'
      ];
      
      return entryPatterns.some(pattern => methodName.includes(pattern));
    });
  }

  public getAllMethods(): string[] {
    return Object.keys(this.funcMap);
  }
}