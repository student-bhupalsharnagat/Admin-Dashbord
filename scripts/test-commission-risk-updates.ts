import assert from 'assert';
import { PostgresTradingDataProvider } from '../server/providers/PostgresTradingDataProvider.ts';
import { query } from '../server/db/connection.ts';

async function verifyUpdates() {
  console.log('[Test] Verifying commission and risk update persistence...');
  const provider = new PostgresTradingDataProvider();

  // 1. Commission Plan Create & Update
  const planId = `CP_TEST_${Date.now()}`;
  const createdPlan = await provider.createCommissionPlan({
    id: planId,
    name: 'Initial Plan',
    tenant_id: 'TNT-001',
    description: 'Initial description',
    type: 'FIXED_PER_ORDER'
  });
  assert(createdPlan, 'Plan creation failed');

  const updatedPlan = await provider.updateCommissionPlan(planId, {
    name: 'Updated Plan Name',
    description: 'Updated description'
  });
  assert.strictEqual(updatedPlan.name, 'Updated Plan Name', 'Commission plan name was not updated');

  // 2. Commission Rule Create & Update
  const ruleId = `RUL_TEST_${Date.now()}`;
  const createdRule = await provider.createCommissionRule({
    id: ruleId,
    tenant_id: 'TNT-001',
    plan_id: planId,
    rate_value: 15.0,
    rate_type: 'FIXED',
    instruments: 'EQUITY'
  });
  assert(createdRule, 'Rule creation failed');

  const updatedRule = await provider.updateCommissionRule(ruleId, {
    rate: '25.50'
  });
  assert.strictEqual(Number(updatedRule.rate_value), 25.5, 'Commission rule rate_value was not updated');

  // 3. Risk Profile Create & Update
  const profileId = `RP_TEST_${Date.now()}`;
  const createdProfile = await provider.createRiskProfile({
    id: profileId,
    tenant_id: 'TNT-001',
    name: 'Initial Risk Profile',
    maxExposure: 500000,
    dailyLossLimit: 10000,
    maxLeverage: 10
  });
  assert(createdProfile, 'Profile creation failed');

  const updatedProfile = await provider.updateRiskProfile(profileId, {
    name: 'Updated Risk Profile',
    maxExposure: 750000,
    maxLeverage: 15
  });
  assert.strictEqual(updatedProfile.name, 'Updated Risk Profile', 'Risk profile name was not updated');
  assert.strictEqual(Number(updatedProfile.max_leverage), 15, 'Risk profile max_leverage was not updated');

  // Clean up test rows
  await query('DELETE FROM risk_profiles WHERE id = $1', [profileId]).catch(() => {});
  await query('DELETE FROM commission_rules WHERE id = $1', [ruleId]).catch(() => {});
  await query('DELETE FROM commission_plans WHERE id = $1', [planId]).catch(() => {});

  console.log('✅ [PASS] Commission and Risk updates verified successfully!');
}

verifyUpdates().catch(err => {
  console.error('❌ [FAIL]', err);
  process.exit(1);
});

