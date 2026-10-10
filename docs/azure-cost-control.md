# Reliance Azure cost control

## Baseline and alerts

The intended private-beta baseline is approximately USD 33 per month. The
subscription budget is USD 40 per month, with actual-cost alerts at 80, 100,
125, and 150 percent and a forecast alert at 100 percent. A daily subscription
cost-anomaly rule provides unusual-spend notification. Neither control performs
automatic shutdown or deletion.

## Resource creation contract

No task may create a billable Azure resource until it records:

- why the resource is needed;
- its expected monthly cost;
- whether it is temporary or permanent;
- the cleanup condition or expiration date.

Temporary resources must use the manifest and guard in `scripts/azure`. They
must carry a real `ExpiresOn` date and a unique `RelianceRunId`. A task that
creates temporary Azure resources is not complete until the guard verifies
their deletion or the Product Owner explicitly approves retention with a reason
and approval reference. Creator scripts should run through the guard's `run`
command so cleanup executes when the creator exits, including after failure.

## Required tags

Every Reliance resource must carry:

- `Project=Reliance`
- `Environment=Beta|Production|Test|Rehearsal|Historical`
- `Owner=ProductOwner`
- `Purpose=<plain-language purpose>`
- `Retention=Permanent|Temporary|Evidence`
- `ExpiresOn=<date or NONE>`
- `MonthlyCostClass=Baseline|Temporary|Exceptional`

Temporary resources also require `RelianceRunId=<manifest runId>`.

## Cleanup rule

Rehearsal, recovery, and cutover work must clean up Azure resources, not only
local staging files. The cleanup guard defaults to validation, requires an
explicit execution confirmation, and checks the current beta database and
mounted package storage before deletion. It cannot delete resource groups,
production resources, the authoritative beta database, the mounted package
storage, or anything tagged `Retention=Permanent` or `Retention=Evidence`.

The repository did not contain the ad hoc checkpoint resource-creation commands
that produced the September database accumulation. They are therefore not an
approved future path. New infrastructure work must use the manifest contract or
add an equally strict, reviewed wrapper around it.

## Completion report

Every infrastructure-changing task must report:

- resources created;
- resources removed;
- resources retained and why;
- resulting estimated monthly Azure run rate;
- budget/anomaly status;
- authoritative database and mounted-package verification;
- production status.

Ambiguous historical or forensic resources must be retained for Product Owner
review rather than deleted on naming assumptions.

## Alert maintenance

The Azure anomaly scheduled action has a platform maximum of five years per
schedule. Renew it before its recorded end date. Budget recipients use the
active Azure billing profile contact; secrets and private addresses must not be
committed to this repository.
