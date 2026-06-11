import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit3, Shield } from 'lucide-react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { api, type Admin } from '@/services/api';
import { toast } from '@/hooks/use-toast';

interface AdminManagementProps {
  onLogout: () => void;
}

export function AdminManagement({ onLogout }: AdminManagementProps) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'admin' 
  });

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const data = await api.getAdmins();
      setAdmins(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load admins',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const created = await api.createAdmin(newAdmin);
      setAdmins(prev => [created, ...prev]);
      setShowCreateModal(false);
      setNewAdmin({ name: '', email: '', password: '', role: 'admin' });
      toast({
        title: 'Admin Created',
        description: 'New admin account has been created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create admin',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this admin?')) return;

    try {
      await api.deleteAdmin(id);
      setAdmins(prev => prev.filter(a => a.id !== id));
      toast({
        title: 'Admin Deleted',
        description: 'Admin account has been removed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete admin',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400';
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DashboardLayout 
      title="Admin Management"
      subtitle="Manage administrator accounts and permissions"
      onLogout={onLogout}
    >
      <div className="space-y-6">
        {/* Header with Action Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Administrator Accounts</h2>
              <p className="text-sm text-muted-foreground">
                {admins.length} admin{admins.length !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Admin
          </button>
        </div>

        {/* Admins Table */}
        {loading ? (
          <div className="dashboard-card p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="mt-4 text-muted-foreground">Loading administrators...</p>
          </div>
        ) : admins.length === 0 ? (
          <div className="dashboard-card p-12 text-center">
            <Shield className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Administrators</h3>
            <p className="text-muted-foreground mb-6">Get started by adding your first admin account</p>
            <button onClick={() => setShowCreateModal(true)} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add First Admin
            </button>
          </div>
        ) : (
          <div className="dashboard-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Name</th>
                    <th className="text-left p-4 font-medium text-sm">Email</th>
                    <th className="text-left p-4 font-medium text-sm">Role</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                    <th className="text-left p-4 font-medium text-sm">Last Login</th>
                    <th className="text-right p-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {admin.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium">{admin.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{admin.email}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(admin.role)}`}>
                          {admin.role.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        {admin.isActive !== false ? (
                          <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground text-sm">
                        {admin.lastLogin 
                          ? new Date(admin.lastLogin).toLocaleDateString('en-IN', { 
                              day: 'numeric', 
                              month: 'short', 
                              year: 'numeric' 
                            })
                          : 'Never'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Admin Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg shadow-xl w-full max-w-md animate-fade-in">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-bold">Create New Admin</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a new administrator account to the system
                </p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="admin@diet.gov.in"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={newAdmin.password}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Role</label>
                  <select
                    value={newAdmin.role}
                    onChange={(e) => setNewAdmin(prev => ({ ...prev, role: e.target.value }))}
                    className="input-field"
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Super Admin has full system access
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-border flex gap-3">
                <button 
                  onClick={handleCreate} 
                  className="btn-primary flex-1"
                >
                  Create Admin
                </button>
                <button 
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAdmin({ name: '', email: '', password: '', role: 'admin' });
                  }} 
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default AdminManagement;
