"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { User, UserRole } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { TableSkeleton } from "@/components/ui/SkeletonLoader";

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

  const loadUsers = async () => {
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
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
    } catch (err: any) {
      alert(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await apiRequest(`/users/${userId}`, { method: "DELETE" });
      loadUsers();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
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
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="User Account Management" subtitle="System Authentication & Role Governance" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, roll no..."
              className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 w-72 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors shadow-2xs"
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600 shadow-2xs transition-colors"
            >
              <option value="ALL">All Roles ({users.length})</option>
              <option value="STUDENT">Students</option>
              <option value="FACULTY">Faculty</option>
              <option value="ADMIN">Administrators</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900 font-mono">{filteredUsers.length}</strong> of <strong className="text-slate-900 font-mono">{users.length}</strong> Accounts
          </span>
        </div>

        {/* Users Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">Name</th>
                    <th className="pb-2.5 font-bold">Email</th>
                    <th className="pb-2.5 font-bold">Role</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">ID / Roll No.</th>
                    <th className="pb-2.5 font-bold">Created</th>
                    <th className="pb-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            u.role === "ADMIN" ? "danger" : u.role === "FACULTY" ? "info" : "default"
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-600">{u.department || "Computer Engineering"}</td>
                      <td className="py-3 font-mono text-slate-600 text-[11px]">
                        {u.enrollmentNo || u.employeeId || "ADMIN"}
                      </td>
                      <td className="py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-3 py-1 text-xs text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md font-semibold cursor-pointer transition-all btn-press"
                        >
                          Edit
                        </button>
                        {u.role !== "ADMIN" && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md font-semibold cursor-pointer transition-all btn-press"
                          >
                            Delete
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
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit User: {editingUser.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">{editingUser.email}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700 font-bold text-xl cursor-pointer p-1">
                  ×
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                  />
                </div>

                {editingUser.role === "STUDENT" ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Enrollment Number</label>
                    <input
                      type="text"
                      value={editEnrollment}
                      onChange={(e) => setEditEnrollment(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Employee ID</label>
                    <input
                      type="text"
                      value={editEmployeeId}
                      onChange={(e) => setEditEmployeeId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>
                )}

                <div className="pt-3.5 border-t border-slate-100 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold rounded-lg shadow-xs cursor-pointer transition-all btn-press"
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
