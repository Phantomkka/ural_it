"""Pack the selected CC0 source glTF files from extracted vendor archives into GLB.
Usage: python scripts/prepare-assets.py /tmp/netcity-sources
Preserves vendor geometry except the explicitly documented office doorway adaptation.
"""

import base64, hashlib, json, pathlib, struct, sys, urllib.request, zipfile, io

root = pathlib.Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
PINNED_PACKS = {
    "city_builder": (
        "KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0",
        "63976910ca04d16f0fc531b9c614244be8128713",
    ),
    "furniture": (
        "KayKit-Game-Assets/KayKit-Furniture-Bits-1.0",
        "96d5930a8dbdb363409bbc2d3341718b00e17c9c",
    ),
    "kenney": (
        "KenneyNL/Starter-Kit-City-Builder",
        "4535092b740b378b700efd9df9e27a631815b84a",
    ),
}
for repo, commit in PINNED_PACKS.values():
    target = root / (repo.split("/")[-1] + "-main")
    if target.exists():
        continue
    archive = urllib.request.urlopen(
        "https://codeload.github.com/" + repo + "/zip/" + commit
    ).read()
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        assert z.comment.decode() == commit, "Unexpected archive revision"
        for name in z.namelist():
            assert (
                not name.startswith("/")
                and ".." not in pathlib.PurePosixPath(name).parts
            )
        z.extractall(root)
    (root / (repo.split("/")[-1] + "-" + commit)).rename(target)
out = pathlib.Path("apps/client/public/assets/models")
manifest = []


def glb(doc, binary):
    data = json.dumps(doc, separators=(",", ":")).encode()
    data += b" " * ((-len(data)) % 4)
    binary += b"\0" * ((-len(binary)) % 4)
    return (
        struct.pack("<III", 0x46546C67, 2, 28 + len(data) + len(binary))
        + struct.pack("<II", len(data), 0x4E4F534A)
        + data
        + struct.pack("<II", len(binary), 0x004E4942)
        + binary
    )


selections = {
    "city_builder": [
        "building_A_withoutBase",
        "building_C_withoutBase",
        "building_E_withoutBase",
        "building_H_withoutBase",
        "bench",
        "streetlight",
        "trash_B",
        "car_sedan",
        "car_hatchback",
        "trafficlight_A",
    ],
    "furniture": ["table_medium", "chair_B", "cabinet_medium", "book_set"],
}
for pack, names in selections.items():
    for name in names:
        path = next(p for p in root.rglob(name + ".gltf") if f"kaykit_{pack}" in str(p))
        doc = json.loads(path.read_text())
        binary = bytearray()
        offsets = []
        for buf in doc["buffers"]:
            uri = buf["uri"]
            data = (
                base64.b64decode(uri.split(",")[1])
                if uri.startswith("data:")
                else (path.parent / uri).read_bytes()
            )
            binary += b"\0" * ((-len(binary)) % 4)
            offsets.append(len(binary))
            binary += data
        for view in doc.get("bufferViews", []):
            view["byteOffset"] = view.get("byteOffset", 0) + offsets[view["buffer"]]
            view["buffer"] = 0
        for image in doc.get("images", []):
            uri = image.pop("uri")
            data = (
                base64.b64decode(uri.split(",")[1])
                if uri.startswith("data:")
                else (path.parent / uri).read_bytes()
            )
            binary += b"\0" * ((-len(binary)) % 4)
            image["bufferView"] = len(doc.setdefault("bufferViews", []))
            doc["bufferViews"].append(
                {"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)}
            )
            binary += data
        doc["buffers"] = [{"byteLength": len(binary)}]
        data = glb(doc, bytes(binary))
        target = out / (name + ".glb")
        target.write_bytes(data)
        manifest.append(
            {
                "file": target.name,
                "author": "Kay Lousberg",
                "license": "CC0-1.0",
                "source": "https://github.com/"
                + PINNED_PACKS[pack][0]
                + "/blob/"
                + PINNED_PACKS[pack][1]
                + "/addons/kaykit_"
                + pack
                + "_bits/Assets/gltf/"
                + path.name,
                "sha256": hashlib.sha256(data).hexdigest(),
                "bytes": len(data),
            }
        )
# Retain only Idle/Walk animation accessors and compact the buffer; mesh/skin data is unchanged.
for name in ["Worker_Male", "Worker_Female", "Casual_Male"]:
    path = out / (name + ".glb")
    cache = root / "characters" / path.name
    cache.parent.mkdir(exist_ok=True)
    if not cache.exists():
        cache.write_bytes(
            urllib.request.urlopen(
                "https://raw.githubusercontent.com/Yametech12/ghostname-3d-assets/3ba341c4346e7833da316f4f8b127d349ca89041/models/"
                + path.name
            ).read()
        )
    data = cache.read_bytes()
    assert (
        hashlib.sha256(data).hexdigest()
        == {
            "Worker_Male.glb": "15caab5b6ed3fab8fc3a1277b643765ae8887529a832b071b904d84e67af099a",
            "Worker_Female.glb": "e6a4c66e1174edffa64ba311ab84b2c627f54b30a1cce07b2032a1153f3f54e8",
            "Casual_Male.glb": "c23137c46a8734a8dcd2058acf9acd9796eab0f025c719aaeb82c5e26f0df18c",
        }[path.name]
    ), "Upstream character changed: recheck provenance"
    n = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20 : 20 + n])
    binary = data[28 + n :]
    source_hash = hashlib.sha256(data).hexdigest()
    assert not doc.get("extensionsUsed"), "Review extension indices before pruning"
    doc["animations"] = [a for a in doc["animations"] if a["name"] in ["Idle", "Walk"]]
    refs = []
    for mesh in doc["meshes"]:
        for p in mesh["primitives"]:
            refs.extend((p["attributes"], key) for key in p["attributes"])
            if "indices" in p:
                refs.append((p, "indices"))
            for morph in p.get("targets", []):
                refs.extend((morph, k) for k in morph)
    for skin in doc.get("skins", []):
        if "inverseBindMatrices" in skin:
            refs.append((skin, "inverseBindMatrices"))
    for a in doc["animations"]:
        for s in a["samplers"]:
            refs.extend([(s, "input"), (s, "output")])
    used = sorted({obj[key] for obj, key in refs})
    remap = {old: new for new, old in enumerate(used)}
    for obj, key in refs:
        obj[key] = remap[obj[key]]
    doc["accessors"] = [doc["accessors"][i] for i in used]
    views = []
    for a in doc["accessors"]:
        if "bufferView" in a:
            views.append((a, "bufferView"))
        if "sparse" in a:
            views.extend((a["sparse"][k], "bufferView") for k in ["indices", "values"])
    views.extend(
        (image, "bufferView")
        for image in doc.get("images", [])
        if "bufferView" in image
    )
    used = sorted({obj[key] for obj, key in views})
    remap = {old: new for new, old in enumerate(used)}
    compact = bytearray()
    new_views = []
    for old in used:
        view = doc["bufferViews"][old].copy()
        start = view.get("byteOffset", 0)
        payload = binary[start : start + view["byteLength"]]
        compact += b"\0" * ((-len(compact)) % 4)
        view["byteOffset"] = len(compact)
        view["buffer"] = 0
        new_views.append(view)
        compact += payload
    for obj, key in views:
        obj[key] = remap[obj[key]]
    doc["bufferViews"] = new_views
    doc["buffers"] = [{"byteLength": len(compact)}]
    packed = glb(doc, bytes(compact))
    path.write_bytes(packed)
    manifest.append(
        {
            "file": path.name,
            "author": "Quaternius",
            "license": "CC0-1.0",
            "source": "https://raw.githubusercontent.com/Yametech12/ghostname-3d-assets/3ba341c4346e7833da316f4f8b127d349ca89041/models/"
            + path.name,
            "sourceSha256": source_hash,
            "sha256": hashlib.sha256(packed).hexdigest(),
            "bytes": len(packed),
            "modification": "Pruned unused animation clips; kept Idle and Walk",
        }
    )
# Kenney tree models are already GLB. README explicitly licenses models under CC0.
for name in ["grass-trees", "grass-trees-tall"]:
    path = root / "Starter-Kit-City-Builder-main/models" / (name + ".glb")
    data = path.read_bytes()
    n = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20 : 20 + n])
    binary = bytearray(data[28 + n :])
    for image in doc.get("images", []):
        if "uri" not in image:
            continue
        uri = image.pop("uri")
        payload = (path.parent / uri).read_bytes()
        binary += b"\0" * ((-len(binary)) % 4)
        image["bufferView"] = len(doc["bufferViews"])
        image["mimeType"] = "image/png"
        doc["bufferViews"].append(
            {"buffer": 0, "byteOffset": len(binary), "byteLength": len(payload)}
        )
        binary += payload
    doc["buffers"] = [{"byteLength": len(binary)}]
    data = glb(doc, bytes(binary))
    (out / path.name).write_bytes(data)
    manifest.append(
        {
            "file": path.name,
            "author": "Kenney",
            "license": "CC0-1.0",
            "source": "https://github.com/KenneyNL/Starter-Kit-City-Builder/blob/4535092b740b378b700efd9df9e27a631815b84a/models/"
            + path.name,
            "sha256": hashlib.sha256(data).hexdigest(),
            "bytes": len(data),
        }
    )
(out.parent / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Models:", len(manifest), "total bytes:", sum(item["bytes"] for item in manifest))

import runpy

runpy.run_path("scripts/prepare-office-facade.py", run_name="__main__")
