import { type Project, type ProjectFile, type CodeComponent, type InsertProject, type InsertProjectFile, type InsertCodeComponent } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Project Files
  createProjectFile(file: InsertProjectFile): Promise<ProjectFile>;
  getProjectFiles(projectId: string): Promise<ProjectFile[]>;
  getProjectFile(id: string): Promise<ProjectFile | undefined>;
  deleteProjectFiles(projectId: string): Promise<boolean>;

  // Code Components
  createCodeComponent(component: InsertCodeComponent): Promise<CodeComponent>;
  getCodeComponents(projectId: string): Promise<CodeComponent[]>;
  getCodeComponentsByFile(fileId: string): Promise<CodeComponent[]>;
  getCodeComponent(id: string): Promise<CodeComponent | undefined>;
  deleteCodeComponents(projectId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private projects: Map<string, Project> = new Map();
  private projectFiles: Map<string, ProjectFile> = new Map();
  private codeComponents: Map<string, CodeComponent> = new Map();

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      uploadedAt: new Date(),
      description: insertProject.description ?? null,
    };
    this.projects.set(id, project);
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values()).sort((a, b) => 
      b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const existing = this.projects.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const deleted = this.projects.delete(id);
    if (deleted) {
      // Clean up related files and components
      await this.deleteProjectFiles(id);
      await this.deleteCodeComponents(id);
    }
    return deleted;
  }

  async createProjectFile(insertFile: InsertProjectFile): Promise<ProjectFile> {
    const id = randomUUID();
    const file: ProjectFile = {
      ...insertFile,
      id,
    };
    this.projectFiles.set(id, file);
    return file;
  }

  async getProjectFiles(projectId: string): Promise<ProjectFile[]> {
    return Array.from(this.projectFiles.values())
      .filter(file => file.projectId === projectId)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async getProjectFile(id: string): Promise<ProjectFile | undefined> {
    return this.projectFiles.get(id);
  }

  async deleteProjectFiles(projectId: string): Promise<boolean> {
    const filesToDelete = Array.from(this.projectFiles.values())
      .filter(file => file.projectId === projectId);
    
    for (const file of filesToDelete) {
      this.projectFiles.delete(file.id);
    }
    
    return true;
  }

  async createCodeComponent(insertComponent: InsertCodeComponent): Promise<CodeComponent> {
    const id = randomUUID();
    const component: CodeComponent = {
      ...insertComponent,
      id,
      description: insertComponent.description ?? null,
      signature: insertComponent.signature ?? null,
      visibility: insertComponent.visibility ?? null,
      startLine: insertComponent.startLine ?? null,
      endLine: insertComponent.endLine ?? null,
      returnType: insertComponent.returnType ?? null,
      parameters: insertComponent.parameters ?? null,
      dependencies: insertComponent.dependencies ?? null,
      calledBy: insertComponent.calledBy ?? null,
    };
    this.codeComponents.set(id, component);
    return component;
  }

  async getCodeComponents(projectId: string): Promise<CodeComponent[]> {
    return Array.from(this.codeComponents.values())
      .filter(component => component.projectId === projectId);
  }

  async getCodeComponentsByFile(fileId: string): Promise<CodeComponent[]> {
    return Array.from(this.codeComponents.values())
      .filter(component => component.fileId === fileId);
  }

  async getCodeComponent(id: string): Promise<CodeComponent | undefined> {
    return this.codeComponents.get(id);
  }

  async deleteCodeComponents(projectId: string): Promise<boolean> {
    const componentsToDelete = Array.from(this.codeComponents.values())
      .filter(component => component.projectId === projectId);
    
    for (const component of componentsToDelete) {
      this.codeComponents.delete(component.id);
    }
    
    return true;
  }
}

export const storage = new MemStorage();
