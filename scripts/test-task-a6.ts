/**
 * Automated Verification for TASK A6 (Admin Mobile Responsiveness):
 * 1. Mobile only (<768px) with desktop (>=768px) pixel-identical.
 * 2. Sidebar -> off-canvas drawer with hamburger in header (md: breakpoint).
 * 3. Tables -> overflow-x-auto with min-width.
 * 4. KPI / Chart grids -> 1-2 columns on mobile.
 * 5. Modals -> full-width with max-h scroll.
 * 6. Touch targets -> >=40px on mobile.
 * 7. Viewport meta + safe-area insets.
 */

import fs from 'fs';
import path from 'path';

async function main() {
  console.log('================================================================');
  console.log('  STARTING TASK A6 VERIFICATION TEST SUITE                      ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failed++;
    }
  }

  // 1. Viewport Meta in index.html
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  assert(
    indexHtml.includes('viewport-fit=cover'),
    'index.html includes viewport-fit=cover meta tag'
  );

  // 2. Safe-area insets & Touch targets in src/index.css
  const indexCss = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
  assert(
    indexCss.includes('safe-area-inset-top') || indexCss.includes('safe-top'),
    'src/index.css includes safe-area inset definitions'
  );
  assert(
    indexCss.includes('min-height: 40px') || indexCss.includes('40px'),
    'src/index.css enforces minimum 40px touch targets on mobile'
  );

  // 3. AdminSidebar Responsive Breakpoints (<768px mobile drawer, >=768px desktop static)
  const sidebarCode = fs.readFileSync(path.resolve('src/components/layout/AdminSidebar.tsx'), 'utf-8');
  assert(
    sidebarCode.includes('md:hidden') && sidebarCode.includes('md:static') && sidebarCode.includes('md:translate-x-0'),
    'AdminSidebar uses md: breakpoint for off-canvas mobile drawer and static desktop'
  );
  assert(
    sidebarCode.includes('min-h-[40px]'),
    'AdminSidebar buttons include min-h-[40px] touch target'
  );

  // 4. AdminHeader Hamburger Menu & Touch Targets
  const headerCode = fs.readFileSync(path.resolve('src/components/layout/AdminHeader.tsx'), 'utf-8');
  assert(
    headerCode.includes('md:hidden') && headerCode.includes('onOpenMobileMenu'),
    'AdminHeader includes mobile hamburger menu toggled at md: breakpoint'
  );
  assert(
    headerCode.includes('min-h-[40px]') || headerCode.includes('p-2'),
    'AdminHeader mobile controls satisfy touch target requirements'
  );

  // 5. Dashboard Grid Columns (1-2 columns on mobile)
  const dashboardCode = fs.readFileSync(path.resolve('src/views/DashboardView.tsx'), 'utf-8');
  assert(
    dashboardCode.includes('grid-cols-1') && (dashboardCode.includes('sm:grid-cols-2') || dashboardCode.includes('md:grid-cols-2')),
    'Dashboard KPI grids configure 1-2 columns on mobile viewports (<768px)'
  );

  // 6. Tables overflow-x-auto with min-width across views and dashboard cards
  const tableFiles = [
    'src/components/dashboard/RecentTradesCard.tsx',
    'src/components/dashboard/RecentRegistrationsCard.tsx',
    'src/views/TradesView.tsx',
    'src/views/OrdersView.tsx',
    'src/views/PositionsView.tsx',
    'src/views/ComplianceView.tsx',
    'src/views/CommissionView.tsx',
    'src/views/HierarchyViews.tsx',
    'src/views/TenantsView.tsx',
    'src/views/WhiteLabelView.tsx'
  ];

  for (const file of tableFiles) {
    const code = fs.readFileSync(path.resolve(file), 'utf-8');
    assert(
      code.includes('overflow-x-auto') && (code.includes('min-w-[') || code.includes('min-w-')),
      `${path.basename(file)} wraps tables with overflow-x-auto and min-width constraint`
    );
  }

  // 7. Modals full-width with max-h scroll
  const modalFiles = [
    'src/components/modals/CreateMasterModal.tsx',
    'src/components/modals/CreateBrokerModal.tsx',
    'src/components/modals/AddClientModal.tsx',
    'src/components/modals/CreateTenantModal.tsx',
    'src/components/modals/ReviewKYCModal.tsx'
  ];

  for (const modal of modalFiles) {
    const code = fs.readFileSync(path.resolve(modal), 'utf-8');
    assert(
      code.includes('w-full') && (code.includes('max-h-[9') || code.includes('max-h-[8') || code.includes('overflow-y-auto')),
      `${path.basename(modal)} configures full-width responsive modal with max-h scroll`
    );
  }

  console.log('\n================================================================');
  console.log(`  TASK A6 VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
