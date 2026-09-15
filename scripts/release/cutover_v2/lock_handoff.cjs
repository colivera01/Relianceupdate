#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');

class RecoveryLockHandoff {
  constructor({ durableFreeze, environmentSqlLock, originalDatabaseLock, recoveryLockFactory }) {
    this.durableFreeze = durableFreeze;
    this.environmentSqlLock = environmentSqlLock;
    this.originalDatabaseLock = originalDatabaseLock;
    this.recoveryLockFactory = recoveryLockFactory;
    this.recoveryDatabaseLock = null;
    this.originalAbandoned = false;
    this.environmentSqlLost = false;
  }

  async acquireForMutation() {
    await this.durableFreeze.assertFrozen();
    await this.environmentSqlLock.acquire();
    try {
      await this.originalDatabaseLock.acquire();
    } catch (error) {
      await this.environmentSqlLock.release().catch(() => {});
      throw error;
    }
    await this.assertMutationOwnership();
    return { verdict: 'ORIGINAL_MUTATION_LOCKS_ACQUIRED' };
  }

  async assertMutationOwnership() {
    await this.durableFreeze.assertFrozen();
    await this.environmentSqlLock.assertOwned();
    await this.originalDatabaseLock.assertOwned();
    return { verdict: 'ORIGINAL_MUTATION_OWNERSHIP_VERIFIED' };
  }

  async abandonOriginalForPitr() {
    await this.durableFreeze.assertFrozen();
    await this.originalDatabaseLock.release().catch(() => {});
    this.originalAbandoned = true;
    return { verdict: 'ORIGINAL_DATABASE_ABANDONED_AND_PRESERVED' };
  }

  async recordEnvironmentSqlLoss() {
    this.environmentSqlLost = true;
    await this.environmentSqlLock.release().catch(() => {});
    const durable = await this.durableFreeze.assertFrozen();
    return { verdict: 'FAIL_CLOSED', durable, environmentSqlLock: 'LOST' };
  }

  async acquireRecovery({ databaseUrl, resourceId }) {
    assert.equal(this.originalAbandoned, true, 'Original database must be abandoned before recovery handoff');
    await this.durableFreeze.assertFrozen();
    this.recoveryDatabaseLock = this.recoveryLockFactory({ databaseUrl, resourceId });
    await this.recoveryDatabaseLock.acquire();
    await this.recoveryDatabaseLock.assertOwned();
    return { verdict: 'RECOVERY_DATABASE_LOCK_ACQUIRED' };
  }

  async assertCanSwitchConnection() {
    await this.durableFreeze.assertFrozen();
    assert(this.recoveryDatabaseLock, 'Recovery database lock is required before connection switching');
    await this.recoveryDatabaseLock.assertOwned();
    return {
      verdict: 'RECOVERY_HANDOFF_VERIFIED',
      durableEnvironment: 'FROZEN',
      recoveryDatabaseLock: 'HELD',
      environmentSqlLock: this.environmentSqlLost ? 'LOST_NON_AUTHORITATIVE' : 'HELD_SECONDARY',
      originalDatabaseLock: 'NOT_REQUIRED_AFTER_ABANDONMENT',
    };
  }

  async releaseAfterExplicitReopen() {
    const state = await this.durableFreeze.inspect();
    assert.equal(state.verdict, 'OPEN', 'Durable environment must be explicitly reopened first');
    if (this.recoveryDatabaseLock) await this.recoveryDatabaseLock.release();
    await this.environmentSqlLock.release().catch(() => {});
    return { verdict: 'SQL_LOCKS_RELEASED_AFTER_EXPLICIT_REOPEN' };
  }

  async closeLocalConnectionsForControllerExit() {
    if (this.recoveryDatabaseLock) await this.recoveryDatabaseLock.release().catch(() => {});
    await this.originalDatabaseLock.release().catch(() => {});
    await this.environmentSqlLock.release().catch(() => {});
    this.recoveryDatabaseLock = null;
    return { verdict: 'LOCAL_SQL_CONNECTIONS_CLOSED_ENVIRONMENT_REMAINS_FROZEN' };
  }
}

module.exports = { RecoveryLockHandoff };
