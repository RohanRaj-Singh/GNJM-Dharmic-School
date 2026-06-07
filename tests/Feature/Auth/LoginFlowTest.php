<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login(): void
    {
        $admin = User::create([
            'name' => 'Test Admin',
            'username' => 'admin_test',
            'email' => 'admin@test.local',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'login' => 'admin_test',
            'password' => 'password',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/admin/dashboard');
        $this->assertAuthenticatedAs($admin);
    }

    public function test_teacher_can_login(): void
    {
        $teacher = User::create([
            'name' => 'Test Teacher',
            'username' => 'teacher_test',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'login' => 'teacher_test',
            'password' => 'password',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/teacher');
        $this->assertAuthenticatedAs($teacher);
    }

    public function test_accountant_can_login(): void
    {
        $accountant = User::create([
            'name' => 'Test Accountant',
            'username' => 'accountant_test',
            'password' => bcrypt('password'),
            'role' => 'accountant',
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'login' => 'accountant_test',
            'password' => 'password',
        ]);

        $response->assertStatus(302);
        $response->assertRedirect('/accountant');
        $this->assertAuthenticatedAs($accountant);
    }

    public function test_invalid_password_is_rejected(): void
    {
        User::create([
            'name' => 'Test User',
            'username' => 'test_user',
            'password' => bcrypt('correct'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $response = $this->post('/login', [
            'login' => 'test_user',
            'password' => 'wrong',
        ]);

        $response->assertSessionHasErrors('login');
        $this->assertGuest();
    }

    public function test_inactive_user_is_rejected(): void
    {
        User::create([
            'name' => 'Inactive User',
            'username' => 'inactive',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => false,
        ]);

        $response = $this->post('/login', [
            'login' => 'inactive',
            'password' => 'password',
        ]);

        $response->assertSessionHasErrors('login');
        $this->assertGuest();
    }

    public function test_logged_in_admin_visits_root_gets_dashboard(): void
    {
        $admin = User::create([
            'name' => 'Test Admin',
            'username' => 'admin_test',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->actingAs($admin);

        $response = $this->get('/');
        $response->assertStatus(302);
        $response->assertRedirect(route('admin.dashboard'));
    }

    public function test_logout_works(): void
    {
        $admin = User::create([
            'name' => 'Test Admin',
            'username' => 'admin_test',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $this->actingAs($admin);
        $this->assertAuthenticatedAs($admin);

        $response = $this->post('/logout');
        $response->assertRedirect('/');
        $this->assertGuest();
    }

    public function test_guest_cannot_access_protected_route(): void
    {
        $response = $this->get('/admin/dashboard');
        $response->assertRedirect(route('login'));
    }

    public function test_teacher_cannot_access_admin_route(): void
    {
        $teacher = User::create([
            'name' => 'Test Teacher',
            'username' => 'teacher_test',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $response = $this->actingAs($teacher)->get('/admin/dashboard');
        $response->assertRedirect(route('teacher.dashboard'));
    }
}
