# CodeFlow - Android Code Visualization Tool

## Overview

CodeFlow is an interactive web application designed to visualize Android project code structure through dynamic flowcharts. The application enables developers to upload Android projects (Java/Kotlin files) and analyze class relationships, method dependencies, and code architecture through an intuitive visual interface. Users can explore code components, view detailed information about classes and methods, and understand the interconnections within their codebase through interactive diagrams.

**Recent Enhancement (August 11, 2025)**: Added GitHub repository integration allowing users to directly analyze public GitHub repositories by entering a repository URL. The system automatically downloads, parses, and visualizes the code structure with enhanced relationship detection between classes, methods, and dependencies.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure
The application follows a monorepo pattern with clear separation between client, server, and shared code:
- **Client**: React-based frontend built with Vite, located in `/client`
- **Server**: Express.js backend with TypeScript, located in `/server`
- **Shared**: Common schemas and types shared between client and server, located in `/shared`

### Frontend Architecture
**Technology Stack**: React 18 with TypeScript, styled using Tailwind CSS and shadcn/ui components.

**Key Design Decisions**:
- **Component Library**: Uses shadcn/ui with Radix UI primitives for consistent, accessible UI components
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with custom design system using CSS variables for theming
- **Code Visualization**: Custom SVG-based visualization system for rendering interactive flowcharts

**Architecture Benefits**: 
- Lightweight bundle size compared to heavier frameworks
- Excellent performance with built-in caching and optimistic updates
- Highly customizable UI components with consistent design tokens

### Backend Architecture
**Technology Stack**: Express.js with TypeScript, using ESM modules.

**Key Design Decisions**:
- **RESTful API**: Simple REST endpoints for project and file management
- **File Processing**: Multer for handling multipart file uploads with in-memory storage
- **Code Analysis**: Custom Java/Kotlin parser to extract classes, methods, and dependencies
- **Development Setup**: Vite integration for hot module replacement in development

**Storage Strategy**: Currently uses in-memory storage (`MemStorage` class) with a well-defined interface (`IStorage`) that allows easy migration to database storage later.

### Data Model
**Database Schema Design** (using Drizzle ORM):
- **Projects**: Stores project metadata, file counts, and analysis status
- **Project Files**: Individual source files with content and metadata
- **Code Components**: Parsed code elements (classes, methods, functions) with relationships

**Relationship Mapping**: The system tracks dependencies and call relationships between code components, enabling the generation of interactive flowcharts.

### Code Analysis Engine
**Parsing Strategy**: Custom regex-based parsers for Java and Kotlin files that extract:
- Class and interface definitions
- Method signatures and visibility modifiers
- Parameter types and return types
- Import dependencies and method calls

**Visualization Algorithm**: Creates node-link diagrams where code components become nodes and relationships become edges, positioned using force-directed layout principles.

## External Dependencies

### UI Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Query for state management
- **Component Library**: Radix UI primitives, shadcn/ui components, Lucide icons
- **Styling**: Tailwind CSS, class-variance-authority for component variants

### Backend Dependencies
- **Web Framework**: Express.js with TypeScript support
- **File Processing**: Multer for handling file uploads, JSZip for archive processing
- **Development Tools**: Vite for build tooling, tsx for TypeScript execution

### Database and ORM
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Database**: PostgreSQL (via Neon Database serverless)
- **Connection**: @neondatabase/serverless for edge-compatible database connections

### Development and Build Tools
- **Build System**: Vite with React plugin, esbuild for server bundling
- **TypeScript**: Full TypeScript support across client, server, and shared code
- **Development**: Hot module replacement, runtime error overlays
- **Code Quality**: ESLint integration, path aliases for clean imports

### Third-Party Services
- **Database Hosting**: Configured for Neon Database (PostgreSQL-compatible)
- **Font Services**: Google Fonts (Inter, Fira Code)
- **Icon Library**: Font Awesome for additional icons beyond Lucide

The application is designed to be deployed on Replit with built-in development tooling and can easily be extended with additional database providers or cloud services.