import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState, useCallback } from "react";
import { router } from "@inertiajs/react";
import DataTable from "@/Components/DataTable";
import MultiSelect from "@/Components/MultiSelect";
import toast from "react-hot-toast";
import { Trash2, Key } from "lucide-react";

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? "";
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf(), Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.errors
      ? Object.values(data.errors).flat().join("; ")
      : data.message || `Server error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json", "X-CSRF-TOKEN": csrf() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Server error (${res.status})`);
  return data;
}

export default function Index() {
  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [newUser, setNewUser] = useState({ name: "", username: "", password: "", role: "teacher", sections: [] });
  const [creating, setCreating] = useState(false);

  const [passwordModal, setPasswordModal] = useState({ open: false, user: null });
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [deletingIds, setDeletingIds] = useState(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/admin/users/data").then((r) => r.json()),
      fetch("/admin/sections/with-classes").then((r) => r.json()),
    ])
      .then(([usersData, classData]) => {
        setUsers(usersData.map((u) => ({ ...u, sections: u.sections || [] })));
        setClasses(classData);
      })
      .catch((e) => {
        setLoadError(e.message || "Failed to load users");
        toast.error("Failed to load users");
      })
      .finally(() => setLoading(false));
  }, []);

  const sectionOptions = useMemo(() => {
    return classes.flatMap((cls) =>
      cls.sections.map((sec) => ({ value: sec.id, label: sec.label }))
    );
  }, [classes]);

  /* ----------------------------------------
   | Create
  ---------------------------------------- */
  const handleCreate = useCallback(async () => {
    if (!newUser.name?.trim() || !newUser.username?.trim() || !newUser.password?.trim()) {
      toast.error("Name, username, and password are required");
      return;
    }
    if (newUser.role === "teacher" && newUser.sections.length === 0) {
      toast.error("Teacher must have at least one section");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreating(true);
    try {
      const data = await apiPost("/admin/users", newUser);
      setUsers((prev) => [...prev, { ...data.user, sections: data.user.sections || [] }]);
      setNewUser({ name: "", username: "", password: "", role: "teacher", sections: [] });
      toast.success("User created");
    } catch (e) {
      toast.error(e.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }, [newUser]);

  /* ----------------------------------------
   | Table helpers
  ---------------------------------------- */
  const updateCell = useCallback((rowIndex, key, value) => {
    setUsers((prev) => prev.map((u, i) => (i === rowIndex ? { ...u, [key]: value } : u)));
  }, []);

  const handleSave = useCallback(() => {
    const validUsers = users.filter((u) => u.id);
    if (validUsers.length === 0) {
      toast.error("Nothing to save");
      return;
    }

    for (const u of validUsers) {
      if (!u.name?.trim() || !u.username?.trim()) {
        toast.error("Name and username are required for all users");
        return;
      }
      if (u.role === "teacher" && (!u.sections || u.sections.length === 0)) {
        toast.error(`Teacher "${u.name}" must have at least one section`);
        return;
      }
    }

    router.post("/admin/users/save", { users: validUsers }, {
      onSuccess: () => {
        toast.success("Users updated");
        fetch("/admin/users/data")
          .then((r) => r.json())
          .then((data) => setUsers(data.map((u) => ({ ...u, sections: u.sections || [] }))))
          .catch(() => {});
      },
      onError: (errs) => {
        const msg = typeof errs === "string" ? errs : errs?.message || "Failed to save";
        toast.error(msg);
      },
    });
  }, [users]);

  /* ----------------------------------------
   | Password reset
  ---------------------------------------- */
  const openPasswordModal = useCallback((user) => {
    setPasswordModal({ open: true, user });
    setNewPassword("");
  }, []);

  const handleResetPassword = useCallback(async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    try {
      await apiPost(`/admin/users/${passwordModal.user.id}/reset-password`, { password: newPassword });
      toast.success(`Password reset for ${passwordModal.user.name}`);
      setPasswordModal({ open: false, user: null });
    } catch (e) {
      toast.error(e.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }, [newPassword, passwordModal.user]);

  /* ----------------------------------------
   | Delete
  ---------------------------------------- */
  const handleDelete = useCallback(async (user) => {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;

    setDeletingIds((prev) => new Set(prev).add(user.id));
    try {
      await apiDelete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`User "${user.name}" deleted`);
    } catch (e) {
      toast.error(e.message || "Failed to delete user");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }, []);

  /* ----------------------------------------
   | Columns
  ---------------------------------------- */
  const columns = useMemo(() => [
    { header: "#", cell: ({ row }) => row.index + 1 },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row, column }) => (
        <input
          value={row.original.name}
          onChange={(e) => updateCell(row.index, column.id, e.target.value)}
          className="border px-2 py-1 rounded text-sm w-full"
        />
      ),
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row, column }) => (
        <input
          value={row.original.username}
          onChange={(e) => updateCell(row.index, column.id, e.target.value)}
          className="border px-2 py-1 rounded text-sm w-full"
        />
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => (
        <select
          value={row.original.role}
          onChange={(e) => updateCell(row.index, "role", e.target.value)}
          className="border px-2 py-1 rounded text-sm"
        >
          <option value="admin">Admin</option>
          <option value="accountant">Accountant</option>
          <option value="teacher">Teacher</option>
        </select>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Active",
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={!!row.original.is_active}
          onChange={(e) => updateCell(row.index, "is_active", e.target.checked)}
        />
      ),
    },
    {
      header: "Sections",
      cell: ({ row }) =>
        row.original.role === "teacher" ? (
          <MultiSelect
            options={sectionOptions}
            value={row.original.sections || []}
            onChange={(vals) => updateCell(row.index, "sections", vals)}
            placeholder="Select sections"
            isMulti
          />
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      header: "Password",
      cell: ({ row }) =>
        row.original.id ? (
          <button
            onClick={() => openPasswordModal(row.original)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            title="Set new password"
          >
            <Key className="w-3 h-3" />
            Set
          </button>
        ) : null,
    },
    {
      header: "Actions",
      cell: ({ row }) =>
        row.original.id ? (
          <button
            onClick={() => handleDelete(row.original)}
            disabled={deletingIds.has(row.original.id)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            {deletingIds.has(row.original.id) ? "..." : "Delete"}
          </button>
        ) : null,
    },
  ], [sectionOptions, updateCell, handleDelete, openPasswordModal, deletingIds]);

  if (loading) {
    return (
      <AdminLayout title="Users">
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading...</div>
      </AdminLayout>
    );
  }

  if (loadError) {
    return (
      <AdminLayout title="Users">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 text-sm">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-1.5 rounded text-sm bg-red-600 text-white hover:bg-red-700">Retry</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Users">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Users & Roles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff accounts, roles, and section assignments.</p>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New User</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Name *</label>
              <input
                placeholder="Full name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="border px-2 py-1.5 rounded text-sm w-40"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Username *</label>
              <input
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="border px-2 py-1.5 rounded text-sm w-36"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Password *</label>
              <input
                type="text"
                placeholder="Min 6 chars"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="border px-2 py-1.5 rounded text-sm w-32"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="border px-2 py-1.5 rounded text-sm"
              >
                <option value="admin">Admin</option>
                <option value="accountant">Accountant</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            {newUser.role === "teacher" && (
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">Sections *</label>
                <MultiSelect
                  options={sectionOptions}
                  value={newUser.sections}
                  onChange={(vals) => setNewUser({ ...newUser, sections: vals })}
                  placeholder="Select sections"
                  isMulti
                />
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Add User"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">{users.length} user(s)</span>
          <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors">
            Save All Changes
          </button>
        </div>

        <DataTable
          data={users}
          columns={columns}
          pagination
          emptyMessage="No users found"
          containerClassName="overflow-x-auto bg-white rounded-lg border"
          tableClassName="min-w-full text-sm"
          tbodyClassName="divide-y"
          headerCellClassName="px-3 py-3 border-b text-left text-xs font-medium text-gray-500 uppercase"
          bodyRowClassName="hover:bg-gray-50/50"
          cellClassName="px-3 py-2 align-top min-w-[140px]"
        />
      </div>

      {passwordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !resetting && setPasswordModal({ open: false, user: null })}>
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Set Password</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Set a new password for <strong>{passwordModal.user?.name}</strong>.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPasswordModal({ open: false, user: null })} className="px-4 py-2 rounded-lg text-sm text-gray-700 border hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 transition-colors"
              >
                {resetting ? "Saving..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
