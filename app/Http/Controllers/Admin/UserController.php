<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /* ==============================
     | Create new user
     ============================== */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'username' => 'required|string|unique:users,username',
            'role' => 'required|in:admin,accountant,teacher',
            'sections' => 'array',
        ]);

        DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'username' => $data['username'],
                'role' => $data['role'],
                'password' => Hash::make('password'), // temp
                'is_active' => true,
            ]);

            if ($data['role'] === 'teacher') {
                $user->sections()->sync($data['sections'] ?? []);
            }
        });

        return back();
    }

    /* ==============================
     | Bulk update users
     ============================== */
   public function bulkUpdate(Request $request)
{
    $request->validate([
        'users' => 'required|array',
        'users.*.id' => 'required|exists:users,id',
        'users.*.name' => 'required|string',
        'users.*.username' => 'required|string',
        'users.*.role' => 'required|in:admin,accountant,teacher',
        'users.*.is_active' => 'required|boolean',
        'users.*.sections' => 'array',
        'users.*.password' => 'nullable|string|min:4',
    ]);

    DB::transaction(function () use ($request) {
        foreach ($request->users as $row) {
            $user = User::findOrFail($row['id']);

            $isSelf = $user->id === auth()->id();

            // Decide role & active safely
            $role = $isSelf ? $user->role : $row['role'];
            $isActive = $isSelf ? $user->is_active : $row['is_active'];

            $user->update([
                'name' => $row['name'],
                'username' => $row['username'],
                'role' => $role,
                'is_active' => $isActive,
            ]);

            // Password update (write-only)
            if (!empty($row['password'])) {
                $user->update([
                    'password' => Hash::make($row['password']),
                ]);
            }

            // Section sync (teachers only)
            if ($role === 'teacher') {
                $user->sections()->sync($row['sections'] ?? []);
            } else {
                $user->sections()->detach();
            }
        }
    });

    return back();
}


    /* ==============================
     | Delete user (safe)
     ============================== */
    public function destroy(User $user)
    {
        if ($user->id === auth()->id()) {
            abort(403);
        }

        $user->delete();

        return back();
    }
}
