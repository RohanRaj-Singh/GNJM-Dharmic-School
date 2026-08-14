<?php

namespace Tests\Feature\StudentReport;

use App\Models\Fee;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentSection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Security and auth flow tests for the Student Report Center.
 *
 * The system uses standard Laravel session auth. CSRF is enforced
 * automatically by the VerifyCsrfToken middleware for POST/PUT/PATCH/DELETE.
 * GET requests (page, PDF download) do not require a CSRF token.
 */
class SecurityTest extends TestCase
{
    use RefreshDatabase;

    private function makeAdmin(): User
    {
        $user = User::create([
            'name' => 'Test Admin',
            'username' => 'admin_test',
            'email' => 'admin@test.local',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);
        return $user;
    }

    private function makeStudent(): Student
    {
        $class = SchoolClass::create(['name' => 'Gurmukhi', 'type' => 'gurmukhi', 'default_monthly_fee' => 600]);
        $section = Section::create(['class_id' => $class->id, 'name' => 'A', 'monthly_fee' => 600]);
        $student = Student::create(['name' => 'Test Student', 'status' => 'active']);
        StudentSection::create([
            'student_id' => $student->id,
            'class_id' => $class->id,
            'section_id' => $section->id,
            'student_type' => 'paid',
        ]);
        return $student;
    }

    public function test_guest_cannot_access_student_report_center(): void
    {
        $this->get('/admin/student-report-center')
            ->assertRedirect('/login');
    }

    public function test_guest_cannot_call_build_endpoint(): void
    {
        $this->postJson('/admin/student-report-center/build', [
            'student_id' => 1,
            'range_mode' => 'calendar_year',
            'single_year' => 2026,
            'division' => 'all',
        ])->assertStatus(401);
    }

    public function test_non_admin_cannot_access_student_report_center(): void
    {
        $teacher = User::create([
            'name' => 'Test Teacher',
            'username' => 'teacher_test',
            'password' => bcrypt('password'),
            'role' => 'teacher',
            'is_active' => true,
        ]);
        $this->actingAs($teacher)
            ->get('/admin/student-report-center')
            ->assertRedirect(route('teacher.dashboard'));
    }

    public function test_session_is_required_for_protected_routes(): void
    {
        // Hits the /login route as a guest — proves the auth middleware
        // chain redirects. This is the baseline we rely on for all
        // /admin/* routes.
        $this->get('/admin/dashboard')
            ->assertRedirect('/login');

        $this->get('/admin/students')
            ->assertRedirect('/login');

        $this->get('/admin/student-report-center')
            ->assertRedirect('/login');
    }

    public function test_post_build_with_csrf_succeeds(): void
    {
        $admin = $this->makeAdmin();
        $student = $this->makeStudent();

        $response = $this->actingAs($admin)
            ->from('/admin/student-report-center')
            ->post('/admin/student-report-center/build', [
                '_token' => csrf_token(),
                'student_id' => $student->id,
                'range_mode' => 'calendar_year',
                'single_year' => 2026,
                'division' => 'all',
            ], ['Accept' => 'application/json']);

        $response->assertStatus(200);
        $body = $response->json();
        $this->assertSame($student->id, $body['identity']['id']);
        // Data-driven divisions (Stage A4): 'all' surfaces ONLY the divisions
        // the student is actually enrolled in. This fixture student is in a
        // single gurmukhi class, so gurmukhi is present and kirtan is absent —
        // no empty enrolled:false stub for a division the student has no data in.
        $this->assertArrayHasKey('gurmukhi', $body['divisions']);
        $this->assertArrayNotHasKey('kirtan', $body['divisions']);
    }

    public function test_post_build_validates_filter_shape(): void
    {
        $admin = $this->makeAdmin();
        $student = $this->makeStudent();

        $response = $this->actingAs($admin)
            ->from('/admin/student-report-center')
            ->post('/admin/student-report-center/build', [
                '_token' => csrf_token(),
                'student_id' => $student->id,
                'range_mode' => 'range',
                'range_start' => '2026-06',  // start > end
                'range_end' => '2025-01',
                'division' => 'all',
            ], ['Accept' => 'application/json']);

        $response->assertStatus(422);
        $body = $response->json();
        $this->assertArrayHasKey('errors', $body);
    }

    public function test_get_export_pdf_does_not_require_csrf(): void
    {
        $admin = $this->makeAdmin();
        $student = $this->makeStudent();

        $response = $this->actingAs($admin)
            ->get('/admin/student-report-center/export/pdf?' . http_build_query([
                'student_id' => $student->id,
                'range_mode' => 'calendar_year',
                'single_year' => 2026,
                'division' => 'all',
            ]));

        $response->assertStatus(200);
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_get_export_pdf_redirects_guest_to_login(): void
    {
        $this->get('/admin/student-report-center/export/pdf?student_id=1&range_mode=calendar_year&single_year=2026&division=all')
            ->assertRedirect('/login');
    }

    public function test_logout_route_invalidates_session(): void
    {
        $admin = $this->makeAdmin();
        $this->actingAs($admin);
        $this->assertTrue(auth()->check());

        $this->post('/logout', ['_token' => csrf_token()])
            ->assertRedirect('/');

        // After logout, the session is invalidated. A subsequent request
        // to a protected route must redirect to login.
        $this->get('/admin/student-report-center')
            ->assertRedirect('/login');
    }
}
