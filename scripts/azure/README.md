# Azure temporary-resource guard

Every Reliance task that creates billable rehearsal, recovery, cutover, or test
infrastructure must create a manifest before the resource. Start from
`temporary-resource-manifest.example.json` and give each live resource these
additional tags:

- `Project=Reliance`
- `Environment=Test` or `Environment=Rehearsal`
- `Owner=ProductOwner`
- `Purpose=<plain language>`
- `Retention=Temporary`
- `ExpiresOn=<real YYYY-MM-DD date>`
- `MonthlyCostClass=Temporary`
- `RelianceRunId=<manifest runId>`

Validate the declaration before creating resources:

```powershell
python scripts/azure/temporary_resource_guard.py validate path/to/manifest.json
```

For a creator script or command, use `run` so cleanup is executed when the
command exits, including a failed exit:

```powershell
python scripts/azure/temporary_resource_guard.py run path/to/manifest.json `
  --confirm-run-id <manifest-run-id> -- python path/to/creator.py
```

At the end of the task, run a live preflight and cleanup:

```powershell
python scripts/azure/temporary_resource_guard.py preflight path/to/manifest.json
python scripts/azure/temporary_resource_guard.py cleanup path/to/manifest.json `
  --execute --confirm-run-id <manifest-run-id>
```

Cleanup is fail-closed. It only considers exact resources declared as created
by that run, accepts only SQL databases, Web Apps, App Service plans, and
storage accounts, and refuses live beta bindings or resources tagged
`Retention=Permanent` or `Retention=Evidence`. Resource-group deletion is not
supported.

To retain temporary infrastructure, change `completion.mode` to `retain` and
record both `retentionReason` and `productOwnerApproval`. Retention still needs
a real expiration date. The task remains incomplete until either cleanup is
verified or that approval is documented.
