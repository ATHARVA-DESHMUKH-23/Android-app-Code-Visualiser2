import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertProjectSchema, insertProjectFileSchema, insertCodeComponentSchema } from "@shared/schema";
import { z } from "zod";
import JSZip from "jszip";

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

  const httpServer = createServer(app);
  return httpServer;
}

// Simple code parser for Java/Kotlin files
function parseCodeFile(content: string, type: 'java' | 'kotlin') {
  const components = [];
  const lines = content.split('\n');
  
  // Basic regex patterns for parsing
  const classPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:abstract\s+)?class\s+(\w+)/;
  const methodPattern = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+|\w+<.*?>)\s+(\w+)\s*\([^)]*\)/;
  const interfacePattern = /(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/;

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
        type: 'class' as const,
        signature: line,
        description: `Class ${classMatch[1]}`,
        startLine: i + 1,
        endLine: i + 1,
        visibility: getVisibility(line),
        parameters: [],
        returnType: null,
        dependencies: [],
        calledBy: []
      });
      continue;
    }

    // Parse interfaces
    const interfaceMatch = line.match(interfacePattern);
    if (interfaceMatch) {
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
        dependencies: [],
        calledBy: []
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

      components.push({
        name: methodName,
        type: 'method' as const,
        signature: line,
        description: `Method ${methodName}`,
        startLine: i + 1,
        endLine: i + 1,
        visibility: getVisibility(line),
        parameters,
        returnType: returnType !== 'void' ? returnType : null,
        dependencies: [],
        calledBy: []
      });
    }
  }

  return components;
}

function getVisibility(line: string): string {
  if (line.includes('private ')) return 'private';
  if (line.includes('protected ')) return 'protected';
  if (line.includes('public ')) return 'public';
  return 'package';
}
