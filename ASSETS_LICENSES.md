# NETCITY ONLINE — asset provenance and licenses

All runtime assets live in `apps/client/public/assets`. The browser fetches only same-origin URLs; no CDN, login or paid service is required. `manifest.json` records each shipped model's filename, author, CC0 identifier, source and SHA-256. This file distinguishes downloaded artwork from project-authored geometry. The game is not endorsed by these authors.

## Downloaded models

| Local files in `assets/models/` | Original author | Original source / distribution mirror | License / changes |
| --- | --- | --- | --- |
| `Worker_Male.glb`, `Worker_Female.glb`, `Casual_Male.glb` | Quaternius | [Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html); [official source page mirror](https://github.com/Quaternius/quaternius.github.io/blob/master/packs/ultimatedanimatedcharacter.html); [GLB conversion mirror](https://github.com/Yametech12/ghostname-3d-assets/tree/main/models) | CC0 1.0, explicitly linked on the original pack page and credited by the conversion mirror. Retain the original meshes, clothing, materials, skeleton and Idle/Walk clips; unused animation data removed. Original/derived SHA-256 in manifest. These are pre-existing CC0 releases, not newly licensed QAL assets. |
| `building_A_withoutBase.glb`, `building_C_withoutBase.glb`, `building_E_withoutBase.glb`, `building_H_withoutBase.glb` | Kay Lousberg (KayKit) | [City Builder Bits 1.0 official repository](https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0/tree/main/addons/kaykit_city_builder_bits/Assets/gltf) | CC0 1.0. Source glTF, binary buffers and palette textures packed into self-contained GLB; scaled/rotated at runtime to the existing building footprints. |
| `bench.glb`, `streetlight.glb`, `trash_B.glb`, `car_sedan.glb`, `car_hatchback.glb`, `trafficlight_A.glb` | Kay Lousberg (KayKit) | Same City Builder Bits repository | CC0 1.0. Converted to embedded GLB without changing authored geometry. |
| `table_medium.glb`, `chair_B.glb`, `cabinet_medium.glb`, `book_set.glb` | Kay Lousberg (KayKit) | [Furniture Bits 1.0 official repository](https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/tree/main/addons/kaykit_furniture_bits/Assets/gltf) | CC0 1.0. Converted to embedded GLB. |
| `grass-trees.glb`, `grass-trees-tall.glb` | Kenney | [Starter Kit City Builder, official repository](https://github.com/KenneyNL/Starter-Kit-City-Builder/tree/main/models) | CC0 1.0 for models, stated explicitly in the repository README (the starter code itself is MIT). Original geometry retained; referenced colormap embedded into GLB. |

The downloaded palette/albedo textures embedded in each GLB inherit the corresponding pack's CC0 license. Their original names include `citybits_texture`, furniture texture atlases and character material colors. There are no untracked external image dependencies.

The office uses `office_facade.glb`, adapted from KayKit `building_A_withoutBase.glb`: scale/rotation are baked and triangles are clipped around the existing entrance, retaining the source UVs/materials. This adapted model is CC0; source and modification hashes are in the model manifest. No server collision data changed.

## Downloaded environment

| Local file | Author/source | License |
| --- | --- | --- |
| `assets/environment/potsdamer_platz_1k.hdr` | HDRI Haven / Poly Haven, [Potsdamer Platz](https://polyhaven.com/a/potsdamer_platz), distributed by the [pmndrs/drei-assets HDRI mirror](https://github.com/pmndrs/drei-assets/blob/master/hdri/potsdamer_platz_1k.hdr). The mirror credits HDRI Haven; the individual photographer could not be independently verified through the blocked API, so no personal author is guessed here. | CC0 1.0, [Poly Haven asset license](https://polyhaven.com/license). Used for PBR environment lighting/reflections. No LUTs or unrelated normal maps from that mirror are included. |

`assets/environment/potsdamer_platz_128.env` is a 128-pixel prefiltered RGBD cubemap derived from the same CC0 HDRI using Babylon's EnvironmentTextureTools. It is the runtime environment; the original HDR is retained only for reproducible offline baking. `prefiltered-metadata.json` records its checksum. This avoids HDR convolution on phones.

## License evidence retained locally

`assets/licenses/CC0-1.0.txt` contains the full CC0 legal text from the SPDX license-list-data repository. `polyhaven-CC0-evidence.txt` quotes the license statement from the official Poly Haven website source. Pack-specific notices are `kaykit-city_builder.txt` and `kaykit-furniture.txt`; `kenney-README.md` distinguishes model CC0 from code MIT. `quaternius-CC0-evidence.txt` and `quaternius-mirror-README.md` preserve the original pack CC0 notice and conversion credits. These text evidence files are not executed by the application. The original website code is not redistributed.

## Project-authored graphics, not downloaded models

The fallback street/humans, modular server rack, switch, patch panel, ports and cables, monitors/computer cases, glass bus shelters, rail fences, storefront glass, signs, brick/concrete/asphalt procedural surface maps and road markings are generated by project code. They are **not** advertised as professional downloaded assets. Hardware hit targets remain the existing game meshes. These components have no third-party asset attribution requirement; see project source for authorship/history.

## Access limitations and visual scope

Direct access to kenney.nl, quaternius.com, api.polyhaven.com, dl.polyhaven.org, Sketchfab and Mixamo returned proxy 403. No restricted asset was obtained by disabling verification or bypassing policy. Existing public GitHub distribution mirrors were used with the source license evidence above. Mixamo standalone assets were not included because redistribution rights would require separate review.

The downloaded city/character packs are detailed **stylized** assets, not photorealistic architectural scans. Photographic asphalt/brick/concrete map downloads and a licensed ready-made server-hardware pack remain unavailable; procedural PBR surfaces and project-authored hardware are used openly instead. Additional network domains have been proposed in the cloud configuration draft for a future asset sourcing pass. Saving that draft does not apply network access.
