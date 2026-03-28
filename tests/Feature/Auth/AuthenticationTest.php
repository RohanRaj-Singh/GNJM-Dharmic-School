<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'username' => fake()->unique()->userName(),
            'role' => 'teacher',
            'is_active' => true,
        ], $overrides));
    }

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = $this->makeUser([
            'role' => 'admin',
        ]);

        $response = $this->post('/login', [
            'login' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect('/admin/dashboard');
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = $this->makeUser();

        $this->post('/login', [
            'login' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_logout(): void
    {
        $user = $this->makeUser();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
    }

    public function test_authenticated_admin_is_redirected_away_from_login_screen(): void
    {
        $user = $this->makeUser([
            'role' => 'admin',
        ]);

        $response = $this->actingAs($user)->get('/login');

        $response->assertRedirect('/admin/dashboard');
    }

    public function test_authenticated_accountant_is_redirected_away_from_login_screen(): void
    {
        $user = $this->makeUser([
            'role' => 'accountant',
        ]);

        $response = $this->actingAs($user)->get('/login');

        $response->assertRedirect('/accountant');
    }

    public function test_authenticated_teacher_is_redirected_away_from_login_screen(): void
    {
        $user = $this->makeUser([
            'role' => 'teacher',
        ]);

        $response = $this->actingAs($user)->get('/login');

        $response->assertRedirect('/teacher');
    }
}
