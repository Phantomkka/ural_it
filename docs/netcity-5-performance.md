NETCITY 5.0 performance work in progress

Implemented: sustained frame-time adaptation (8 s warmup, 3 s sample, 5 s cooldown, four bounded reductions); shadows follow effective quality; render resolution capped by viewport; high no longer supersamples above native resolution; hidden-tab render work suspended while network remains connected; server-room door cached rather than scanning all meshes per frame.
Manual quality selection resets adaptation. Loading, modal UI and hidden tabs do not contribute samples. Settings explain adaptation. No production changes.

Validation: targeted company/account/stock tests and frame-budget contract pass. FPS improvement on the reporting player's hardware has not been established. Local probe uses CPU throttling and reports the actual renderer; it is not a physical-device certification. Full release/staging work remains ongoing.

Target hardware reported by owner: fourth-generation Core i3, 8 GB RAM, integrated graphics. First-run default selects low on <=4 logical CPUs; explicit saved quality stays honored. Static office furniture/service hardware world matrices are frozen after final placement; hidden remote avatar animation groups pause. CPU-throttled exploratory samples at 1280x720: 9.94 FPS before static transform changes, 14.27 FPS after, both rendered at 640x360/low with four-times CPU slowdown on GTX 1060. These were single runs with other local checks and are NOT a controlled benchmark or an Intel integrated-GPU result. Confirm with repeated isolated samples and real target-device feedback before claiming a percentage gain.

Latest typecheck and targeted 3-test suite pass. Reconnect browser test passed. Enterprise E2E exposed its straight path crossing the existing rack (X17.7/Z0); route corrected to the passage at Z1.8, physical collisions preserved. Office/company browser rerun pending.
