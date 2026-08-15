<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * B15 — Admin sidebar discoverability for `/admin/classes`.
 *
 * The audit flagged M-1 ("No discoverable menu entry for `/admin/classes`
 * in `AdminLayout` sidebar") as a UX gap. The audit was actually wrong —
 * `resources/js/Layouts/AdminLayout.jsx` already ships a
 * `<SidebarLink href="/admin/classes" label="Classes" />`.
 *
 * Inertia v2 doesn't SSR layouts into the response body, so a feature test
 * that scrapes the HTML for the link can't see the React-rendered sidebar
 * (the response only contains the `data-page` JSON shell). We pin the
 * discoverability at the source level instead: any future refactor that
 * drops or renames the Classes sidebar entry trips the test.
 *
 * The test pins two things:
 *  1. `AdminLayout.jsx` contains a `<SidebarLink>` whose `href` is the
 *     `/admin/classes` route — the exact discoverability the audit
 *     asked for.
 *  2. The admin route `/admin/classes` resolves and returns 200 — so the
 *     sidebar link target itself is alive.
 */
class AdminClassesSidebarLinkTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-08-15 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_admin_layout_exposes_sidebar_link_to_classes_route(): void
    {
        $layoutPath = base_path('resources/js/Layouts/AdminLayout.jsx');
        $this->assertFileExists($layoutPath);

        $source = file_get_contents($layoutPath);

        // The sidebar must render an entry for the classes management page.
        // We allow whitespace between attrs (one-liner or multi-line both fine).
        $this->assertMatchesRegularExpression(
            '/<SidebarLink\b[^>]*href=["\']\/admin\/classes["\'][^>]*\/>/s',
            $source,
            'AdminLayout.jsx must render a <SidebarLink href="/admin/classes" /> so admins can discover the Classes management page.'
        );

        // The label should be human-readable (not empty, not raw URL).
        // Pull the label attr value for the classes href.
        preg_match(
            '/<SidebarLink\b[^>]*href=["\']\/admin\/classes["\'][^>]*label=["\']([^"\']+)["\'][^>]*\/>/s',
            $source,
            $matches
        );
        $this->assertNotEmpty($matches, 'Sidebar entry must have a label attribute.');
        $this->assertSame('Classes', $matches[1]);
    }

    public function test_classes_route_is_reachable(): void
    {
        // The sidebar's discoverability only matters if the link target itself
        // responds. Smoke-check the admin.classes.index route exists and
        // accepts an authenticated admin (the same role the sidebar is for).
        $admin = \App\Models\User::factory()->create([
            'role' => 'admin',
            'username' => 'admin_classes_route_smoke',
        ]);

        $response = $this->actingAs($admin)->get(route('admin.classes.index'));
        $response->assertOk();
    }
}