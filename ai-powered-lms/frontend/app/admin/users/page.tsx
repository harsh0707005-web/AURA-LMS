"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { User } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editEnrollment, setEditEnrollment] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<User[]>("/users");
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditDepartment(user.department || "Computer Engineering");
    setEditEnrollment(user.enrollmentNo || "");
    setEditEmployeeId(user.employeeId || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaving(true);
    try {
      await apiRequest(`/users/${editingUser.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          department: editDepartment.trim(),
          enrollmentNo: editEnrollment.trim() || undefined,
          employeeId: editEmployeeId.trim() || undefined,
        }),
      });

      setEditingUser(null);
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      await apiRequest(`/users/${userId}`, { method: "DELETE" });
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.enrollmentNo && u.enrollmentNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="User Account Management" subtitle="System Authentication & Role Governance" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Controls Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name, email, roll no..."
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-surface-container-low border border-outline-variant/50 rounded-lg px-3 py-2 text-xs text-on-surface font-medium focus:outline-none focus:border-primary transition-colors"
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value="STUDENT">Students</option>
              <option value="FACULTY">Faculty</option>
              <option value="ADMIN">Administrators</option>
            </select>
          </div>

          <span className="text-xs text-on-surface-variant font-medium">
            Showing <strong className="text-on-surface font-mono">{filteredUsers.length}</strong> of <strong className="text-on-surface font-mono">{users.length}</strong> Accounts
          </span>
        </div>

        {/* Users Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">manage_accounts</span>
              <h3 className="text-sm font-bold text-on-surface">Directory Accounts</h3>
            </div>
            <span className="font-mono text-[11px] text-outline font-semibold uppercase">Authorized Users</span>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Name</th>
                    <th className="pb-2.5 font-bold">Email</th>
                    <th className="pb-2.5 font-bold">Role</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">ID / Roll No.</th>
                    <th className="pb-2.5 font-bold">Created</th>
                    <th className="pb-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{u.name}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            u.role === "ADMIN" ? "danger" : u.role === "FACULTY" ? "info" : "default"
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 text-on-surface-variant">{u.department || "Computer Engineering"}</td>
                      <td className="py-3 font-mono text-on-surface-variant text-[11px]">
                        {u.enrollmentNo || u.employeeId || "ADMIN"}
                      </td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1 text-xs text-primary hover:bg-surface-container border border-primary/30 rounded-lg font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          <span>Edit</span>
                        </button>
                        {u.role !== "ADMIN" && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-2.5 py-1 text-xs text-error hover:bg-error-container/40 border border-error/30 rounded-lg font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                            <span>Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No Users Found" description="No accounts match your search or filter." />
          )}
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">Edit User: {editingUser.name}</h3>
                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{editingUser.email}</p>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-outline hover:text-on-surface font-bold text-xl cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors font-medium"
                  />
                </div>

                {editingUser.role === "STUDENT" ? (
                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Enrollment Number
                    </label>
                    <input
                      type="text"
                      value={editEnrollment}
                      onChange={(e) => setEditEnrollment(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={editEmployeeId}
                      onChange={(e) => setEditEmployeeId(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                    />
                  </div>
                )}

                <div className="pt-3.5 border-t border-outline-variant/30 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
