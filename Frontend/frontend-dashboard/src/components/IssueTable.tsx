import { useState, useMemo } from 'react';
import { Search, Filter, ChevronUp, ChevronDown, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { Issue } from '@/services/api';

interface IssueTableProps {
  issues: Issue[];
  loading?: boolean;
  onStatusChange?: (id: string, status: Issue['status']) => void;
  onView?: (issue: Issue) => void;
  onDelete?: (id: string) => void; 
}

type SortField = 'teacherName' | 'cluster' | 'category' | 'status' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const statusIcons: Record<string, typeof AlertCircle> = {
  pending: AlertCircle,
  reviewed: Clock,
  resolved: CheckCircle,
  training_assigned: CheckCircle,
};

const statusColors: Record<string, string> = {
  pending: 'badge-destructive',
  reviewed: 'badge-warning',
  resolved: 'badge-success',
  training_assigned: 'badge-primary',
};

const categoryColors: Record<string, string> = {
  academic: 'badge-primary',
  infrastructure: 'badge-warning',
  administrative: 'badge-success',
  safety: 'badge-destructive',
  technology: 'badge-primary',
  other: 'badge-warning',
};

export function IssueTable({ issues, loading, onStatusChange, onView, onDelete }: IssueTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredIssues = useMemo(() => {
    let result = [...issues];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(i => 
        (i.teacherName?.toLowerCase() || '').includes(query) ||
        i.cluster.toLowerCase().includes(query) ||
        i.description.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter);
    }

    result.sort((a, b) => {
      let aVal: string | Date = sortField === 'teacherName' ? (a.teacherName || '') : a[sortField];
      let bVal: string | Date = sortField === 'teacherName' ? (b.teacherName || '') : b[sortField];
      
      if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt);
        bVal = new Date(b.createdAt);
      }
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [issues, searchQuery, sortField, sortOrder, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage);
  const paginatedIssues = filteredIssues.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton w-8 h-8 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card overflow-hidden">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
            aria-label="Search issues"
          />
        </div>
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-muted-foreground shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
            <option value="training_assigned">Training Assigned</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field w-auto"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            <option value="academic">Academic</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="administrative">Administrative</option>
            <option value="safety">Safety</option>
            <option value="technology">Technology</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-6">
        <table className="data-table">
          <thead>
            <tr>
              <th className="rounded-tl-lg">
                <button 
                  onClick={() => handleSort('teacherName')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Teacher <SortIcon field="teacherName" />
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('cluster')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Cluster <SortIcon field="cluster" />
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('category')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Category <SortIcon field="category" />
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th>
                <button 
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Date <SortIcon field="createdAt" />
                </button>
              </th>
              <th className="rounded-tr-lg">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedIssues.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No issues found
                </td>
              </tr>
            ) : (
              paginatedIssues.map((issue) => {
                const StatusIcon = statusIcons[issue.status] || AlertCircle;
                return (
                  <tr key={issue.id} className="group">
                    <td>
                      <p className="font-medium text-foreground">{issue.teacherName || 'Unknown'}</p>
                      {issue.teacherEmail && (
                        <p className="text-xs text-muted-foreground">{issue.teacherEmail}</p>
                      )}
                    </td>
                    <td>
                      <p className="text-muted-foreground">{issue.cluster}</p>
                    </td>
                    <td>
                      <span className={`badge ${categoryColors[issue.category] || 'badge-primary'} capitalize`}>
                        {issue.category}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusColors[issue.status] || 'badge-primary'} capitalize flex items-center gap-1 w-fit`}>
                        <StatusIcon size={12} />
                        {issue.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      {formatDate(issue.createdAt)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {onView && (
                          <button 
                            onClick={() => onView(issue)}
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </button>
                        )}
                        
                        {/* ✅ Show delete button for resolved items */}
                        {issue.status === 'resolved' && onDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this resolved feedback?')) {
                                onDelete(issue.id);
                              }
                            }}
                            className="text-sm text-destructive hover:underline flex items-center gap-1"
                            title="Delete resolved feedback"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                        
                        {/* Show status dropdown for non-resolved items */}
                        {issue.status !== 'resolved' && onStatusChange && (
                          <select
                            value={issue.status}
                            onChange={(e) => onStatusChange(issue.id, e.target.value as Issue['status'])}
                            className="text-sm border border-input rounded px-2 py-1 bg-background"
                            aria-label="Change status"
                          >
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                            <option value="training_assigned">Training Assigned</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredIssues.length)} of {filteredIssues.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-secondary py-1.5 px-3 disabled:opacity-50"
            >
              Previous
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                  ${currentPage === i + 1 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent text-muted-foreground'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-secondary py-1.5 px-3 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IssueTable;
