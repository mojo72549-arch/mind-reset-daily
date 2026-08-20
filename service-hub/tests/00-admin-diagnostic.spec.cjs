const { test } = require('@playwright/test');

test('diagnose V6 admin runtime', async ({ page }) => {
  await page.goto('/?role=admin');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  const diag = await page.evaluate(async () => {
    const out = {
      session: sessionStorage.getItem('shp_session'),
      hasSH: typeof window.SH,
      hasV6: typeof window.SHP_V6,
      hasV5Api: typeof window.SHP_UX_TEST_API,
      beforeTitle: document.querySelector('main h2')?.textContent || null,
      errors: []
    };
    try { window.SH.go('admin'); } catch (e) { out.errors.push('go: '+(e && e.stack || e)); }
    await new Promise(r => setTimeout(r, 30));
    out.afterTitle = document.querySelector('main h2')?.textContent || null;
    out.hasAdminTitle = !!document.querySelector('.ux-admin-title');
    out.mainSnippet = (document.querySelector('main')?.innerText || '').slice(0,600);
    try {
      if (window.SHP_V6) window.SHP_V6.renderAdminSettings();
    } catch (e) { out.errors.push('render: '+(e && e.stack || e)); }
    await new Promise(r => setTimeout(r, 30));
    out.afterDirectRenderTitle = document.querySelector('main h2')?.textContent || null;
    out.afterDirectHasAdminTitle = !!document.querySelector('.ux-admin-title');
    return out;
  });
  console.log('ADMIN_V6_DIAGNOSTIC='+JSON.stringify(diag));
});
