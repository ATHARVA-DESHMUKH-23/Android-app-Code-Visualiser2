import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertProjectSchema, insertProjectFileSchema, insertCodeComponentSchema } from "@shared/schema";
import { z } from "zod";
import JSZip from "jszip";
import https from "https";
import { Readable } from "stream";
import { ASTParser } from "./ast-parser";
import { CallFlowTracer } from "./call-flow-tracer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Upload and create new project
  app.post("/api/projects", upload.array("files"), async (req, res) => {
    try {
      const { name, description } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      // Create project
      const projectData = insertProjectSchema.parse({
        name: name || "Untitled Project",
        description: description || "",
        status: "analyzing"
      });

      const project = await storage.createProject(projectData);

      // Process uploaded files
      let totalFiles = 0;
      let classCount = 0;
      let methodCount = 0;
      let functionCount = 0;

      for (const file of files) {
        if (file.originalname.endsWith('.zip')) {
          // Handle ZIP files
          const zip = new JSZip();
          const contents = await zip.loadAsync(file.buffer);
          
          for (const [filename, zipFile] of Object.entries(contents.files)) {
            if (!zipFile.dir && (filename.endsWith('.java') || filename.endsWith('.kt'))) {
              const content = await zipFile.async('text');
              const projectFile = await storage.createProjectFile({
                projectId: project.id,
                name: filename.split('/').pop() || filename,
                path: filename,
                type: filename.endsWith('.java') ? 'java' : 'kotlin',
                content,
                size: content.length
              });

              // Parse code components
              const components = parseCodeFile(content, filename.endsWith('.java') ? 'java' : 'kotlin');
              for (const component of components) {
                await storage.createCodeComponent({
                  ...component,
                  projectId: project.id,
                  fileId: projectFile.id
                });

                if (component.type === 'class' || component.type === 'interface') classCount++;
                else if (component.type === 'method') methodCount++;
                else if (component.type === 'function') functionCount++;
              }

              totalFiles++;
            }
          }
        } else if (file.originalname.endsWith('.java') || file.originalname.endsWith('.kt')) {
          // Handle individual files
          const content = file.buffer.toString('utf-8');
          const projectFile = await storage.createProjectFile({
            projectId: project.id,
            name: file.originalname,
            path: file.originalname,
            type: file.originalname.endsWith('.java') ? 'java' : 'kotlin',
            content,
            size: content.length
          });

          // Parse code components
          const components = parseCodeFile(content, file.originalname.endsWith('.java') ? 'java' : 'kotlin');
          for (const component of components) {
            await storage.createCodeComponent({
              ...component,
              projectId: project.id,
              fileId: projectFile.id
            });

            if (component.type === 'class' || component.type === 'interface') classCount++;
            else if (component.type === 'method') methodCount++;
            else if (component.type === 'function') functionCount++;
          }

          totalFiles++;
        }
      }

      // Update project with counts
      const updatedProject = await storage.updateProject(project.id, {
        status: "ready",
        fileCount: totalFiles,
        classCount,
        methodCount,
        functionCount
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Get project files
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const files = await storage.getProjectFiles(req.params.id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching project files:", error);
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  // Get code components for project
  app.get("/api/projects/:id/components", async (req, res) => {
    try {
      const components = await storage.getCodeComponents(req.params.id);
      res.json(components);
    } catch (error) {
      console.error("Error fetching code components:", error);
      res.status(500).json({ message: "Failed to fetch code components" });
    }
  });

  // Get single code component
  app.get("/api/components/:id", async (req, res) => {
    try {
      const component = await storage.getCodeComponent(req.params.id);
      if (!component) {
        return res.status(404).json({ message: "Component not found" });
      }
      res.json(component);
    } catch (error) {
      console.error("Error fetching component:", error);
      res.status(500).json({ message: "Failed to fetch component" });
    }
  });

  // GitHub repository upload
  app.post("/api/projects/github", async (req, res) => {
    try {
      const { githubUrl, name, description } = req.body;

      if (!githubUrl || !githubUrl.includes('github.com')) {
        return res.status(400).json({ message: "Invalid GitHub URL" });
      }

      // Extract owner and repo from GitHub URL
      const urlParts = githubUrl.replace('https://github.com/', '').split('/');
      if (urlParts.length < 2) {
        return res.status(400).json({ message: "Invalid GitHub repository URL" });
      }

      const owner = urlParts[0];
      const repo = urlParts[1];

      // Create project
      const projectData = insertProjectSchema.parse({
        name: name || `${owner}/${repo}`,
        description: description || `GitHub repository: ${githubUrl}`,
        status: "analyzing"
      });

      const project = await storage.createProject(projectData);

      // Download and process GitHub repository
      try {
        const files = await downloadGitHubRepo(owner, repo);
        let totalFiles = 0;
        let classCount = 0;
        let methodCount = 0;
        let functionCount = 0;

        for (const file of files) {
          if (file.name.endsWith('.java') || file.name.endsWith('.kt')) {
            const projectFile = await storage.createProjectFile({
              projectId: project.id,
              name: file.name.split('/').pop() || file.name,
              path: file.name,
              type: file.name.endsWith('.java') ? 'java' : 'kotlin',
              content: file.content,
              size: file.content.length
            });

            // Parse code components
            const components = parseCodeFile(file.content, file.name.endsWith('.java') ? 'java' : 'kotlin');
            for (const component of components) {
              await storage.createCodeComponent({
                ...component,
                projectId: project.id,
                fileId: projectFile.id
              });

              if (component.type === 'class' || component.type === 'interface') classCount++;
              else if (component.type === 'method') methodCount++;
              else if (component.type === 'function') functionCount++;
            }

            totalFiles++;
          }
        }

        // Update project with counts
        const updatedProject = await storage.updateProject(project.id, {
          status: "ready",
          fileCount: totalFiles,
          classCount,
          methodCount,
          functionCount
        });

        res.json(updatedProject);
      } catch (downloadError) {
        console.error("Error downloading GitHub repo:", downloadError);
        await storage.updateProject(project.id, { status: "error" });
        res.status(500).json({ message: "Failed to download GitHub repository. Make sure it's a public repository." });
      }
    } catch (error) {
      console.error("Error processing GitHub repository:", error);
      res.status(500).json({ message: "Failed to process GitHub repository" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Get call flow graph for a project starting from an entry method
  app.post("/api/projects/:id/call-flow", async (req, res) => {
    try {
      const { entryMethod } = req.body;
      const projectId = req.params.id;

      if (!entryMethod) {
        return res.status(400).json({ message: "Entry method is required" });
      }

      // Get all project files
      const files = await storage.getProjectFiles(projectId);
      if (!files || files.length === 0) {
        return res.status(404).json({ message: "No files found for project" });
      }

      // Initialize AST parser and call flow tracer
      const astParser = new ASTParser();
      const allClasses: any[] = [];

      // Parse all files to build function map
      for (const file of files) {
        const fileExtension = file.name.endsWith('.java') ? 'java' : 'kotlin';
        const classes = fileExtension === 'java' 
          ? astParser.parseJavaFile(file.content, file.name)
          : astParser.parseKotlinFile(file.content, file.name);
        
        allClasses.push(...classes);
      }

      // Build function map
      const funcMap = astParser.buildFuncMap(allClasses);

      // Initialize call flow tracer
      const tracer = new CallFlowTracer(funcMap);

      // Generate call flow graph
      const callFlowGraph = tracer.traceFromEntryMethod(entryMethod);

      // Get available entry methods for the frontend
      const availableEntryMethods = tracer.getAvailableEntryMethods();
      const allMethods = tracer.getAllMethods();

      res.json({
        callFlowGraph,
        availableEntryMethods,
        allMethods,
        totalMethods: allMethods.length,
        totalClasses: allClasses.length
      });

    } catch (error) {
      console.error("Error generating call flow:", error);
      res.status(500).json({ 
        message: "Failed to generate call flow", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Get available entry methods for a project
  app.get("/api/projects/:id/entry-methods", async (req, res) => {
    try {
      const projectId = req.params.id;

      // Get all project files
      const files = await storage.getProjectFiles(projectId);
      if (!files || files.length === 0) {
        return res.status(404).json({ message: "No files found for project" });
      }

      // Initialize AST parser
      const astParser = new ASTParser();
      const allClasses: any[] = [];

      // Parse all files to build function map
      for (const file of files) {
        const fileExtension = file.name.endsWith('.java') ? 'java' : 'kotlin';
        const classes = fileExtension === 'java' 
          ? astParser.parseJavaFile(file.content, file.name)
          : astParser.parseKotlinFile(file.content, file.name);
        
        allClasses.push(...classes);
      }

      // Build function map and get available methods
      const funcMap = astParser.buildFuncMap(allClasses);
      const tracer = new CallFlowTracer(funcMap);
      const availableEntryMethods = tracer.getAvailableEntryMethods();
      const allMethods = tracer.getAllMethods();

      res.json({
        entryMethods: availableEntryMethods,
        allMethods: allMethods,
        totalMethods: allMethods.length,
        totalClasses: allClasses.length
      });

    } catch (error) {
      console.error("Error fetching entry methods:", error);
      res.status(500).json({ 
        message: "Failed to fetch entry methods", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// GitHub repository download function
async function downloadGitHubRepo(owner: string, repo: string): Promise<Array<{ name: string; content: string }>> {
  return new Promise((resolve, reject) => {
    // Use GitHub API to get repository contents
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball`;
    
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'CodeFlow-Analyzer/1.0'
      }
    }, (response) => {
      if (response.statusCode === 302 && response.headers.location) {
        // Follow redirect to actual zip file
        https.get(response.headers.location, (zipResponse) => {
          if (zipResponse.statusCode !== 200) {
            reject(new Error(`Failed to download: ${zipResponse.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          zipResponse.on('data', chunk => chunks.push(chunk));
          zipResponse.on('end', async () => {
            try {
              const zipBuffer = Buffer.concat(chunks);
              const zip = new JSZip();
              const contents = await zip.loadAsync(zipBuffer);
              
              const files: Array<{ name: string; content: string }> = [];
              
              for (const [filename, zipFile] of Object.entries(contents.files)) {
                if (!zipFile.dir && (filename.endsWith('.java') || filename.endsWith('.kt'))) {
                  const content = await zipFile.async('text');
                  // Remove the top-level directory from the path
                  const cleanPath = filename.split('/').slice(1).join('/');
                  if (cleanPath) {
                    files.push({
                      name: cleanPath,
                      content
                    });
                  }
                }
              }
              
              resolve(files);
            } catch (error) {
              reject(error);
            }
          });
        }).on('error', reject);
      } else if (response.statusCode === 200) {
        // Direct download
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', async () => {
          try {
            const zipBuffer = Buffer.concat(chunks);
            const zip = new JSZip();
            const contents = await zip.loadAsync(zipBuffer);
            
            const files: Array<{ name: string; content: string }> = [];
            
            for (const [filename, zipFile] of Object.entries(contents.files)) {
              if (!zipFile.dir && (filename.endsWith('.java') || filename.endsWith('.kt'))) {
                const content = await zipFile.async('text');
                // Remove the top-level directory from the path
                const cleanPath = filename.split('/').slice(1).join('/');
                if (cleanPath) {
                  files.push({
                    name: cleanPath,
                    content
                  });
                }
              }
            }
            
            resolve(files);
          } catch (error) {
            reject(error);
          }
        });
      } else {
        reject(new Error(`GitHub API returned status: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

// Enhanced code parser for Java/Kotlin files with relationship detection
function parseCodeFile(content: string, type: 'java' | 'kotlin') {
  const components: any[] = [];
  const lines = content.split('\n');
  let currentClass = '';
  
  // Enhanced regex patterns for parsing
  const classPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)/;
  const methodPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+|\w+<.*?>)\s+(\w+)\s*\([^)]*\)/;
  const interfacePattern = /(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/;
  
  // Patterns to detect method calls and dependencies
  const methodCallPattern = /(\w+)\s*\(/g;
  const importPattern = /import\s+(?:static\s+)?([^;]+);/;
  const fieldPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(\w+)\s+(\w+)\s*[=;]/;

  // First pass: collect all components
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || !line) {
      continue;
    }

    // Parse classes
    const classMatch = line.match(classPattern);
    if (classMatch) {
      currentClass = classMatch[1];
      components.push({
        name: classMatch[1],
        type: 'class' as const,
        signature: line,
        description: `Class ${classMatch[1]}`,
        startLine: i + 1,
        endLine: i + 1,
        visibility: getVisibility(line),
        parameters: [],
        returnType: null,
        dependencies: extractDependenciesFromLine(line, content),
        calledBy: [],
        parentClass: currentClass
      });
      continue;
    }

    // Parse interfaces
    const interfaceMatch = line.match(interfacePattern);
    if (interfaceMatch) {
      currentClass = interfaceMatch[1];
      components.push({
        name: interfaceMatch[1],
        type: 'interface' as const,
        signature: line,
        description: `Interface ${interfaceMatch[1]}`,
        startLine: i + 1,
        endLine: i + 1,
        visibility: getVisibility(line),
        parameters: [],
        returnType: null,
        dependencies: extractDependenciesFromLine(line, content),
        calledBy: [],
        parentClass: currentClass
      });
      continue;
    }

    // Parse methods
    const methodMatch = line.match(methodPattern);
    if (methodMatch && !line.includes('class ') && !line.includes('interface ')) {
      const returnType = methodMatch[1];
      const methodName = methodMatch[2];
      
      // Extract parameters
      const paramMatch = line.match(/\(([^)]*)\)/);
      const parameters = [];
      if (paramMatch && paramMatch[1].trim()) {
        const paramList = paramMatch[1].split(',');
        for (const param of paramList) {
          const paramParts = param.trim().split(/\s+/);
          if (paramParts.length >= 2) {
            parameters.push({
              name: paramParts[paramParts.length - 1],
              type: paramParts.slice(0, -1).join(' '),
              description: `Parameter ${paramParts[paramParts.length - 1]}`
            });
          }
        }
      }

      // Analyze method body for dependencies and calls
      const methodBody = extractMethodBody(lines, i);
      const dependencies = extractMethodDependencies(methodBody, content);

      components.push({
        name: methodName,
        type: 'method' as const,
        signature: line,
        description: `Method ${methodName} in class ${currentClass}`,
        startLine: i + 1,
        endLine: i + 1,
        visibility: getVisibility(line),
        parameters,
        returnType: returnType !== 'void' ? returnType : null,
        dependencies,
        calledBy: [],
        parentClass: currentClass
      });
    }
  }

  // Second pass: establish relationships
  const componentNames = components.map(c => c.name);
  
  components.forEach(component => {
    // Find which components call this one
    component.calledBy = findCallers(component.name, content, componentNames);
    
    // Filter dependencies to only include components in this project
    component.dependencies = component.dependencies.filter((dep: string) => 
      componentNames.includes(dep)
    );
  });

  return components;
}

// Helper function to extract method body
function extractMethodBody(lines: string[], startIndex: number): string {
  let braceCount = 0;
  let inMethod = false;
  let methodBody = '';
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('{')) {
      braceCount += (line.match(/\{/g) || []).length;
      inMethod = true;
    }
    
    if (inMethod) {
      methodBody += line + '\n';
    }
    
    if (line.includes('}')) {
      braceCount -= (line.match(/\}/g) || []).length;
      if (braceCount <= 0) break;
    }
  }
  
  return methodBody;
}

// Helper function to extract dependencies from method body
function extractMethodDependencies(methodBody: string, fullContent: string): string[] {
  const dependencies = new Set<string>();
  
  // Find method calls
  const methodCallPattern = /(\w+)\s*\(/g;
  let match;
  while ((match = methodCallPattern.exec(methodBody)) !== null) {
    const methodName = match[1];
    // Skip common Java/Kotlin keywords and built-ins
    if (!['if', 'for', 'while', 'switch', 'catch', 'System', 'String', 'Math', 'Log'].includes(methodName)) {
      dependencies.add(methodName);
    }
  }
  
  // Find class instantiations
  const newPattern = /new\s+(\w+)\s*\(/g;
  while ((match = newPattern.exec(methodBody)) !== null) {
    dependencies.add(match[1]);
  }
  
  // Find static method calls
  const staticCallPattern = /(\w+)\.(\w+)\s*\(/g;
  while ((match = staticCallPattern.exec(methodBody)) !== null) {
    dependencies.add(match[1]);
    dependencies.add(match[2]);
  }
  
  return Array.from(dependencies);
}

// Helper function to extract dependencies from a line
function extractDependenciesFromLine(line: string, fullContent: string): string[] {
  const dependencies = new Set<string>();
  
  // Find extends relationships
  const extendsMatch = line.match(/extends\s+(\w+)/);
  if (extendsMatch) {
    dependencies.add(extendsMatch[1]);
  }
  
  // Find implements relationships
  const implementsMatch = line.match(/implements\s+([\w\s,]+)/);
  if (implementsMatch) {
    const interfaces = implementsMatch[1].split(',').map(i => i.trim());
    interfaces.forEach(iface => dependencies.add(iface));
  }
  
  return Array.from(dependencies);
}

// Helper function to find which components call a specific method/class
function findCallers(targetName: string, fullContent: string, allComponentNames: string[]): string[] {
  const callers = new Set<string>();
  const lines = fullContent.split('\n');
  
  lines.forEach((line, index) => {
    if (line.includes(targetName)) {
      // Find the containing method or class
      for (let i = index; i >= 0; i--) {
        const containerLine = lines[i];
        const classMatch = containerLine.match(/(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)/);
        const methodMatch = containerLine.match(/(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+|\w+<.*?>)\s+(\w+)\s*\([^)]*\)/);
        
        if (methodMatch && allComponentNames.includes(methodMatch[2])) {
          callers.add(methodMatch[2]);
          break;
        } else if (classMatch && allComponentNames.includes(classMatch[1])) {
          callers.add(classMatch[1]);
          break;
        }
      }
    }
  });
  
  return Array.from(callers);
}

function getVisibility(line: string): string {
  if (line.includes('private ')) return 'private';
  if (line.includes('protected ')) return 'protected';
  if (line.includes('public ')) return 'public';
  return 'package';
}
