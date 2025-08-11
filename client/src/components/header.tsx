import { Search, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onUploadClick: () => void;
}

export default function Header({ searchQuery, onSearchChange, onUploadClick }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-full px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <i className="fas fa-project-diagram text-[#0366D6] text-xl"></i>
              <h1 className="text-xl font-semibold text-[#24292E]">CodeFlow</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6 ml-8">
              <a href="#" className="text-[#24292E] hover:text-[#0366D6] font-medium" data-testid="nav-dashboard">
                Dashboard
              </a>
              <a href="#" className="text-gray-600 hover:text-[#0366D6]" data-testid="nav-projects">
                Projects
              </a>
              <a href="#" className="text-gray-600 hover:text-[#0366D6]" data-testid="nav-docs">
                Documentation
              </a>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search classes, methods..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 w-80 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0366D6] focus:border-transparent"
                data-testid="input-search"
              />
            </div>
            
            <button 
              onClick={onUploadClick}
              className="bg-[#0366D6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              data-testid="button-upload"
            >
              <Upload className="h-4 w-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
