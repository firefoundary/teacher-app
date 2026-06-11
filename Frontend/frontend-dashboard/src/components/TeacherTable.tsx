import { useState, useMemo } from 'react';
import { Search, Filter, ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import type { Teacher } from '@/services/api';

interface TeacherTableProps {
  teachers: Teacher[];
  loading?: boolean;
  onEdit?: (teacher: Teacher) => void;
  onDelete?: (teacher: Teacher) => void;
}

type SortField = 'name' | 'cluster' | 'email' | 'employeeId';
type SortOrder = 'asc' | 'desc';

export function TeacherTable({ teachers, loading, onEdit, onDelete }: TeacherTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Get unique clusters for filter
  const clusters = useMemo(() => {
    const uniqueClusters = [...new Set(teachers.map(t => t.cluster))];
    return uniqueClusters.sort();
  }, [teachers]);

  // Filter and sort teachers
  const filteredTeachers = useMemo(() => {
    let result = [...teachers];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query) ||
        t.cluster.toLowerCase().includes(query) ||
        t.employeeId.toLowerCase().includes(query)
      );
    }

    // Apply cluster filter
    if (clusterFilter !== 'all') {
      result = result.filter(t => t.cluster === clusterFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string = a[sortField] || '';
      let bVal: string = b[sortField] || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [teachers, searchQuery, sortField, sortOrder, clusterFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const paginatedTeachers = filteredTeachers.slice(
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
              <div className="skeleton w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-1/3" />
                <div className="skeleton h-3 w-1/4" />
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
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search teachers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
            aria-label="Search teachers"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="input-field w-auto"
            aria-label="Filter by cluster"
          >
            <option value="all">All Clusters</option>
            {clusters.map(cluster => (
              <option key={cluster} value={cluster}>{cluster}</option>
            ))}
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
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Teacher <SortIcon field="name" />
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
                  onClick={() => handleSort('employeeId')}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  Employee ID <SortIcon field="employeeId" />
                </button>
              </th>
              <th>Created At</th>
              <th className="rounded-tr-lg">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTeachers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  No teachers found
                </td>
              </tr>
            ) : (
              paginatedTeachers.map((teacher) => (
                <tr key={teacher.id} className="group">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-primary">
                          {teacher.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{teacher.name}</p>
                        <p className="text-sm text-muted-foreground">{teacher.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-primary">{teacher.cluster}</span>
                  </td>
                  <td className="text-muted-foreground font-mono text-sm">{teacher.employeeId}</td>
                  <td className="text-muted-foreground">{formatDate(teacher.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(teacher)}
                          className="text-sm text-primary hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button 
                          onClick={() => onDelete(teacher)}
                          className="text-sm text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      )}
                      <button className="p-1 hover:bg-accent rounded">
                        <MoreHorizontal size={16} className="text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTeachers.length)} of {filteredTeachers.length}
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

export default TeacherTable;
