# NETCITY 5.0 shared companies (pending release)

The tablet Company app supports up to five members. Open after three completed IT jobs for 200 NET (100 registration, 100 company capital), share the private invite code, assign dispatcher/warehouse/engineer roles and spending limits. Owner withdrawal excludes reserved member shares. Members can collect their own shares exactly once. Offline time incurs no rent or payroll.

Visit the selected leased floor to rent, hire or issue/return stock. Private leases are exclusive; the HQ coworking is shared. Corporate material provenance survives taking, stowing and van transfer. Merchant refunds accept personal stock only; leaving requires returning outstanding material and completing active obligations.

SLA contracts combine actual completed engineering audits, current healthy measurements, NPC preparation and client signoff. Audit receipts are consumed once across all companies/contracts. Wages and preparation are charged once. Half the net SLA profit is reserved equally for members. Corporate deliveries use the physical logistics workflow and credit the company, reserving an executor commission.

Persistence: additive migration 010 creates companies and unique case receipts; prior profile, account and inventory rows are retained. Company operations use locked profile/company transactions and request fingerprints. Public room Schema never contains company invitation codes, balances or profile IDs. Private company updates go only to members. Production is unchanged and release validation is ongoing.

Tests: Memory enterprise contract covers five-member limits, permissions, accounting, leases, stock laundering, exactly-once payouts and guest-to-account preservation; two actual SDK clients cover budget replication and reconnect, with an outsider privacy check. PostgreSQL contract shares the same assertions. Browser test uses an isolated in-process store/server and temporary Vite fixture, with no grant endpoint in production.

Final integration also prevents impossible employee-specialization SLAs before any charge, allows approved material issue to field engineers, normalizes satisfaction to a five-point rating, separates parking bays from traffic, and records actual driven distance on the authoritative server. Field-service clients use local character assets and support E interaction. Release checks and cutover evidence are recorded in the final release PR; data and account preservation take precedence over deployment.
