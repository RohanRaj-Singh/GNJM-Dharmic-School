import AdminLayout from "@/Layouts/AdminLayout";
import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import MultiSelect from "@/Components/MultiSelect";
import toast from "react-hot-toast";

export default function Index() {
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPasswordFor, setShowPasswordFor] = useState(null);

    const [newUser, setNewUser] = useState({
        name: "",
        username: "",
        role: "teacher",
        sections: [],
    });

    /* ==============================
       LOAD USERS + SECTIONS
    ============================== */
    useEffect(() => {
        Promise.all([
            fetch("/admin/users/data").then((r) => r.json()),
            fetch("/admin/sections/with-classes").then((r) => r.json()),
        ]).then(([usersData, classData]) => {
            setUsers(usersData);
            setClasses(classData);
            setLoading(false);
        });
    }, []);

    /* ==============================
       CREATE USER
    ============================== */
    async function createUser() {
    if (!newUser.name || !newUser.username || !newUser.role) {
        toast.error("Name, username and role are required");
        return;
    }

    if (newUser.role === "teacher" && newUser.sections.length === 0) {
        toast.error("Teacher must have at least one section");
        return;
    }

    try {
        const res = await fetch("/admin/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": document
                    .querySelector('meta[name="csrf-token"]')
                    .getAttribute("content"),
            },
            body: JSON.stringify(newUser),
        });

        if (!res.ok) throw new Error("Request failed");

        const data = await res.json();

        if (data.success) {
            toast.success("User created successfully");

            // ✅ IMMEDIATELY SHOW IN TABLE
            setUsers(prev => [...prev, data.user]);

            // reset form
            setNewUser({
                name: "",
                username: "",
                role: "teacher",
                sections: [],
            });
        }
    } catch (e) {
        toast.error("Failed to create user");
    }
}



    /* ==============================
       UPDATE HELPERS
    ============================== */
    function updateCell(rowIndex, key, value) {
        setUsers((prev) =>
            prev.map((u, i) => (i === rowIndex ? { ...u, [key]: value } : u)),
        );
    }

    function save() {
        const validUsers = users.filter((u) => u.id);

        if (validUsers.length === 0) {
            toast.error("Nothing to save");
            return;
        }

        for (const u of validUsers) {
            if (!u.name || !u.username || !u.role) {
                toast.error("Name, username and role are required");
                return;
            }

            if (u.role === "teacher" && (!u.sections || u.sections.length === 0)) {
                toast.error(`Teacher "${u.name}" must have at least one section`);
                return;
            }
        }

        router.post(
            "/admin/users/save",
            { users: validUsers },
            {
                onSuccess: () => {
                    toast.success("Users updated successfully");
                    fetch("/admin/users/data")
                        .then((r) => r.json())
                        .then(setUsers);
                },
                onError: () => {
                    toast.error("Failed to save users");
                },
            },
        );
    }

    /* ==============================
       SECTION OPTIONS
    ============================== */
    const sectionOptions = useMemo(() => {
        return classes.flatMap((cls) =>
            cls.sections.map((sec) => ({
                value: sec.id,
                label: sec.label,
            })),
        );
    }, [classes]);

    /* ==============================
       TABLE COLUMNS
    ============================== */
    const columns = useMemo(
        () => [
            { header: "#", cell: ({ row }) => row.index + 1 },

            {
                accessorKey: "name",
                header: "Name",
                cell: ({ row, column }) => (
                    <input
                        value={row.original.name}
                        onChange={(e) =>
                            updateCell(row.index, column.id, e.target.value)
                        }
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
                        onChange={(e) =>
                            updateCell(row.index, column.id, e.target.value)
                        }
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
                        onChange={(e) =>
                            updateCell(row.index, "role", e.target.value)
                        }
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
                        onChange={(e) =>
                            updateCell(row.index, "is_active", e.target.checked)
                        }
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
                            onChange={(vals) =>
                                updateCell(row.index, "sections", vals)
                            }
                            placeholder="Select sections"
                        />
                    ) : (
                        <span className="text-gray-400 text-xs">—</span>
                    ),
            },

            {
                header: "Password",
                cell: ({ row }) => {
                    const visible =
                        row.original.id &&
                        showPasswordFor === row.original.id;

                    return (
                        <div className="flex items-center gap-1">
                            <input
                                type={visible ? "text" : "password"}
                                value={row.original.password || ""}
                                onChange={(e) =>
                                    updateCell(
                                        row.index,
                                        "password",
                                        e.target.value,
                                    )
                                }
                                className="border px-2 py-1 rounded text-xs w-36"
                                placeholder="New password"
                            />
                            {row.original.id && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPasswordFor(
                                            visible ? null : row.original.id,
                                        )
                                    }
                                    className="text-gray-500 hover:text-black text-sm"
                                >
                                    {visible ? "🙈" : "👁"}
                                </button>
                            )}
                        </div>
                    );
                },
            },

            {
                header: "Actions",
                cell: ({ row }) => (
                    <button
                        onClick={() => {
                            if (confirm("Delete this user?")) {
                                router.delete(
                                    `/admin/users/${row.original.id}`,
                                );
                            }
                        }}
                        className="text-red-600 text-sm"
                    >
                        Delete
                    </button>
                ),
            },
        ],
        [sectionOptions, showPasswordFor],
    );

    const table = useReactTable({
        data: users,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (loading) {
        return <AdminLayout title="Users">Loading…</AdminLayout>;
    }

    /* ==============================
       RENDER
    ============================== */
    return (
        <AdminLayout title="Users">
            {/* CREATE USER */}
            <div className="mb-4 flex flex-wrap gap-2 items-end">
                <input
                    placeholder="Name"
                    value={newUser.name}
                    onChange={(e) =>
                        setNewUser({ ...newUser, name: e.target.value })
                    }
                    className="border px-2 py-1 rounded"
                />
                <input
                    placeholder="Username"
                    value={newUser.username}
                    onChange={(e) =>
                        setNewUser({
                            ...newUser,
                            username: e.target.value,
                        })
                    }
                    className="border px-2 py-1 rounded"
                />
                <select
                    value={newUser.role}
                    onChange={(e) =>
                        setNewUser({ ...newUser, role: e.target.value })
                    }
                    className="border px-2 py-1 rounded"
                >
                    <option value="admin">Admin</option>
                    <option value="accountant">Accountant</option>
                    <option value="teacher">Teacher</option>
                </select>

                {newUser.role === "teacher" && (
                    <MultiSelect
                        options={sectionOptions}
                        value={newUser.sections}
                        onChange={(vals) =>
                            setNewUser({ ...newUser, sections: vals })
                        }
                        placeholder="Select sections"
                    />
                )}

                <button
                    onClick={createUser}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                    Add User
                </button>
            </div>

            <button
  onClick={save}
  className="mb-3 bg-green-600 text-white px-4 py-2 rounded"
>
  Save User Updates
</button>


            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border text-sm">
                    <thead>
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((h) => (
                                    <th
                                        key={h.id}
                                        className="px-3 py-2 border-b text-left"
                                    >
                                        {flexRender(
                                            h.column.columnDef.header,
                                            h.getContext(),
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>

                    <tbody>
                        {table.getRowModel().rows.map((row) => (
                            <tr key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="px-3 py-2 border-b align-top min-w-[150px]"
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </AdminLayout>
    );
}
