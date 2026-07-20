<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in(['admin', 'accountant', 'teacher'])],
            'sections' => 'nullable|array',
            'sections.*' => 'exists:sections,id',
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'username' => $data['username'],
                'role' => $data['role'],
                'password' => $data['password'],
                'is_active' => true,
            ]);

            if ($data['role'] === 'teacher') {
                $user->sections()->sync($data['sections'] ?? []);
            }

            return $user->fresh()->load('sections:id,name');
        });

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'role' => $user->role,
                'is_active' => $user->is_active,
                'sections' => $user->sections->pluck('id')->toArray(),
            ],
        ]);
    }

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
            'users.*.sections.*' => 'exists:sections,id',
        ]);

        DB::transaction(function () use ($request) {
            foreach ($request->users as $row) {
                $user = User::findOrFail($row['id']);
                $isSelf = $user->id === auth()->id();

                $role = $isSelf ? $user->role : $row['role'];
                $isActive = $isSelf ? $user->is_active : $row['is_active'];

                $user->update([
                    'name' => $row['name'],
                    'username' => $row['username'],
                    'role' => $role,
                    'is_active' => $isActive,
                ]);

                if ($role === 'teacher') {
                    $user->sections()->sync($row['sections'] ?? []);
                } else {
                    $user->sections()->detach();
                }
            }
        });

        return response()->json(['success' => true, 'message' => 'Users updated successfully']);
    }

    public function resetPassword(Request $request, User $user)
    {
        if ($user->id === auth()->id()) {
            abort(403, 'Cannot reset your own password from here.');
        }

        $data = $request->validate([
            'password' => 'required|string|min:6',
        ]);

        $user->update(['password' => $data['password']]);

        return response()->json(['success' => true, 'message' => 'Password reset successfully']);
    }

    public function destroy(User $user)
    {
        if ($user->id === auth()->id()) {
            abort(403, 'Cannot delete your own account.');
        }

        $user->delete();

        return response()->json(['success' => true, 'message' => 'User deleted successfully']);
    }
}
