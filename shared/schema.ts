import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("analyzing"), // analyzing, ready, error
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`now()`),
  fileCount: integer("file_count").default(0),
  classCount: integer("class_count").default(0),
  methodCount: integer("method_count").default(0),
  functionCount: integer("function_count").default(0),
});

export const projectFiles = pgTable("project_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(), // java, kotlin, xml
  content: text("content").notNull(),
  size: integer("size").notNull(),
});

export const codeComponents = pgTable("code_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  fileId: varchar("file_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // class, method, function, interface
  signature: text("signature"),
  description: text("description"),
  startLine: integer("start_line"),
  endLine: integer("end_line"),
  visibility: text("visibility"), // public, private, protected
  parameters: json("parameters").$type<Parameter[]>().default([]),
  returnType: text("return_type"),
  dependencies: json("dependencies").$type<string[]>().default([]),
  calledBy: json("called_by").$type<string[]>().default([]),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  uploadedAt: true,
});

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({
  id: true,
});

export const insertCodeComponentSchema = createInsertSchema(codeComponents).omit({
  id: true,
});

export const parameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type InsertCodeComponent = z.infer<typeof insertCodeComponentSchema>;
export type Parameter = z.infer<typeof parameterSchema>;

export type Project = typeof projects.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type CodeComponent = typeof codeComponents.$inferSelect;
