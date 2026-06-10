/**
 * Admin Management Routes
 *
 * Handles:
 * - Admin authentication and profile management
 * - Teacher CRUD operations 
 * - Admin user management 
 * - Activity logging
 *
 * Security:
 * - All routes require JWT authentication
 * - Role-based access control
 * - Bcrypt password hashing
 */
// DONE WITH FULL AUTHENTICATION
import { Router, Request, Response } from 'express';
import { supabase } from './supabaseClient.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../../..', '.env'),
});

const router = Router();

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user data to req.user
 */
function requireAuth() {
  return async (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization token'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      (req as any).user = payload;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  };
}

/**
 * Super Admin Only Middleware
 * Checks if user has SUPER_ADMIN role
 */
function requireSuperAdmin() {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    
    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Super admin access required'
      });
    }
    
    next();
  };
}

/**
 * Admin or Higher Middleware
 * Checks if user has admin or super_admin role
 */
function requireAdminOrHigher() {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).user;
    
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Authentication (PUBLIC)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Update last login and log activity
    await supabase
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    await supabase.from('admin_activity_logs').insert({
      admin_id: admin.id,
      action: 'login',
      ip_address: req.ip,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        user_id: admin.id,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const { password_hash, ...adminData } = admin;

    res.json({
      success: true,
      message: 'Login successful',
      accToken: token,
      admin: {
        id: adminData.id,
        name: adminData.name,
        email: adminData.email,
        role: adminData.role,
        permissions: adminData.permissions,
      }
    });
  } catch (error) {
    console.error('[Admin] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Profile Management (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/profile/:id', requireAuth(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, name, email, role, permissions, created_at, last_login')
      .eq('id', id)
      .single();

    if (error || !admin) {
      return res.status(404).json({
        success: false,
        error: 'Admin not found'
      });
    }

    res.json({ 
      success: true, 
      data: { admin } 
    });
  } catch (error) {
    console.error('[Admin] Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.post('/:id/change-password', requireAuth(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  const user = (req as any).user;

  // Verify user is changing their own password or is super_admin
  if (user.user_id !== id && user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Cannot change another user\'s password without super admin privileges'
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current and new passwords are required'
    });
  }

  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('password_hash')
      .eq('id', id)
      .single();

    if (error || !admin) {
      return res.status(404).json({ 
        success: false, 
        error: 'Admin not found' 
      });
    }

    const isValid = await bcrypt.compare(currentPassword, admin.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    await supabase
      .from('admins')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      data: null
    });
  } catch (error) {
    console.error('[Admin] Change password error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Super Admin: Admin User Management (SUPER_ADMIN ONLY)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', requireAuth(), requireSuperAdmin(), async (req: Request, res: Response) => {
  try {
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, name, email, role, is_active, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ 
      success: true, 
      data: { admins } 
    });
  } catch (error) {
    console.error('[Admin] Get all admins error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.post('/', requireAuth(), requireSuperAdmin(), async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required'
    });
  }

  try {
    // Check for existing email
    const { data: existingEmail } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: admin, error } = await supabase
      .from('admins')
      .insert({
        name,
        email: email.toLowerCase(),
        password_hash,
        role: role || 'admin',
      })
      .select('id, name, email, role, created_at')
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
      throw error;
    }

    console.log('[Admin] Admin created:', admin.email);
    res.status(201).json({ 
      success: true, 
      message: 'Admin created successfully',
      data: { admin } 
    });
  } catch (error) {
    console.error('[Admin] Create admin error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.put('/:id', requireAuth(), requireSuperAdmin(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, role, is_active, permissions } = req.body;

  try {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (role) updateData.role = role;
    if (typeof is_active === 'boolean') updateData.is_active = is_active;
    if (permissions) updateData.permissions = permissions;

    const { data: admin, error } = await supabase
      .from('admins')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, is_active, permissions')
      .single();

    if (error) throw error;

    res.json({ 
      success: true, 
      message: 'Admin updated successfully',
      data: { admin } 
    });
  } catch (error) {
    console.error('[Admin] Update admin error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.delete('/:id', requireAuth(), requireSuperAdmin(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('[Admin] Admin deleted:', id);
    res.json({ 
      success: true, 
      message: 'Admin deleted successfully',
      data: null 
    });
  } catch (error) {
    console.error('[Admin] Delete admin error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Teacher Management (AUTHENTICATED USERS)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/teachers', requireAuth(), async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, email, cluster, employee_id, created_at, updated_at')
      .order('name');

    if (error) throw error;

    const teachers = data.map((t: any) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      cluster: t.cluster,
      employeeId: t.employee_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    res.json({ 
      success: true, 
      data: { teachers } 
    });
  } catch (error) {
    console.error('[Admin] Get teachers error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.post('/teachers', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { name, email, cluster, employeeId, password } = req.body;

  if (!name || !email || !cluster || !employeeId || !password) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required: name, email, cluster, employeeId, password'
    });
  }

  try {
    const { data: existingEmail } = await supabase
      .from('teachers')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    const { data: existingEmployeeId } = await supabase
      .from('teachers')
      .select('id')
      .eq('employee_id', employeeId)
      .single();

    if (existingEmployeeId) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('teachers')
      .insert({
        name,
        email: email.toLowerCase(),
        cluster,
        employee_id: employeeId,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) throw error;

    const teacher = {
      id: data.id,
      name: data.name,
      email: data.email,
      cluster: data.cluster,
      employeeId: data.employee_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    console.log('[Admin] Teacher created:', teacher.name);
    res.status(201).json({ 
      success: true, 
      message: 'Teacher created successfully',
      data: { teacher } 
    });
  } catch (error) {
    console.error('[Admin] Create teacher error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.put('/teachers/:id', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, cluster, employeeId, password } = req.body;

  try {
    const updateData: any = {};
    if (name) updateData.name = name;
    if (cluster) updateData.cluster = cluster;
    if (email) updateData.email = email.toLowerCase();
    if (employeeId) updateData.employee_id = employeeId;

    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    updateData.updated_at = new Date().toISOString();

    // Check for duplicate email (excluding current teacher)
    if (email) {
      const { data: existingEmail } = await supabase
        .from('teachers')
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', id)
        .single();

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }

    // Check for duplicate employee ID (excluding current teacher)
    if (employeeId) {
      const { data: existingEmployeeId } = await supabase
        .from('teachers')
        .select('id')
        .eq('employee_id', employeeId)
        .neq('id', id)
        .single();

      if (existingEmployeeId) {
        return res.status(400).json({
          success: false,
          error: 'Employee ID already exists'
        });
      }
    }

    const { data, error } = await supabase
      .from('teachers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const teacher = {
      id: data.id,
      name: data.name,
      email: data.email,
      cluster: data.cluster,
      employeeId: data.employee_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    console.log('[Admin] Teacher updated:', teacher.name);
    res.json({ 
      success: true, 
      message: 'Teacher updated successfully',
      data: { teacher } 
    });
  } catch (error) {
    console.error('[Admin] Update teacher error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

router.delete('/teachers/:id', requireAuth(), requireAdminOrHigher(), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Check for existing issues
    const { data: issue } = await supabase
      .from('issues')
      .select('id')
      .eq('teacher_id', id)
      .limit(1);

    if (issue && issue.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete teacher with existing issues. Please resolve or delete the issues first.'
      });
    }

    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log('[Admin] Teacher deleted:', id);
    res.json({ 
      success: true, 
      message: 'Teacher deleted successfully',
      data: null 
    });
  } catch (error) {
    console.error('[Admin] Delete teacher error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity Logging (AUTHENTICATED)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/logs/:adminId', requireAuth(), async (req: Request, res: Response) => {
  const { adminId } = req.params;
  const { limit = '50', offset = '0' } = req.query;

  try {
    const { data: logs, error } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({ 
      success: true, 
      data: { logs } 
    });
  } catch (error) {
    console.error('[Admin] Get activity logs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

export default router;