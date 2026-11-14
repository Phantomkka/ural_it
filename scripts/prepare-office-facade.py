"""Adapt the downloaded CC0 KayKit facade to the existing office doorway.
Clips triangles against a doorway box, interpolating source UVs/normals. No new art
is passed off as a vendor model. Server geometry and coordinates stay untouched.
"""

import hashlib, json, math, pathlib, struct

root = pathlib.Path("apps/client/public/assets")
source = root / "models/building_A_withoutBase.glb"
data = source.read_bytes()
n = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20 : 20 + n])
binary = data[28 + n :]
p = doc["meshes"][0]["primitives"][0]


def read(index, count, fmt):
    a = doc["accessors"][index]
    v = doc["bufferViews"][a["bufferView"]]
    start = v.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = v.get("byteStride", struct.calcsize(fmt) * count)
    return [
        struct.unpack_from("<" + fmt * count, binary, start + i * stride)
        for i in range(a["count"])
    ]


positions = read(p["attributes"]["POSITION"], 3, "f")
normals = read(p["attributes"]["NORMAL"], 3, "f")
uvs = read(p["attributes"]["TEXCOORD_0"], 2, "f")
a = doc["accessors"][p["indices"]]
indices = [
    v[0] for v in read(p["indices"], 1, "H" if a["componentType"] == 5123 else "I")
]
lo = [min(v[i] for v in positions) for i in range(3)]
hi = [max(v[i] for v in positions) for i in range(3)]
sx = 12 / (hi[0] - lo[0])
sy = 7.4 / (hi[1] - lo[1])
sz = 12 / (hi[2] - lo[2])
cx = (lo[0] + hi[0]) / 2
cz = (lo[2] + hi[2]) / 2
vertices = []
for pos, normal, uv in zip(positions, normals, uvs):
    vertices.append(
        (
            -(pos[2] - cz) * sz,
            (pos[1] - lo[1]) * sy,
            (pos[0] - cx) * sx,
            -normal[2] / sz,
            normal[1] / sy,
            normal[0] / sx,
            *uv,
        )
    )


def clip(poly, axis, bound, sign):
    if not poly:
        return []
    output = []
    previous = poly[-1]
    old = (previous[axis] - bound) * sign >= 0
    for current in poly:
        new = (current[axis] - bound) * sign >= 0
        if new != old:
            t = (bound - previous[axis]) / (current[axis] - previous[axis])
            output.append(tuple(a + (b - a) * t for a, b in zip(previous, current)))
        if new:
            output.append(current)
        previous = current
        old = new
    return output


planes = [
    (0, -7, 1),
    (0, 0, -1),
    (1, -0.1, 1),
    (1, 2.7, -1),
    (2, -1.2, 1),
    (2, 1.2, -1),
]
triangles = []
for i in range(0, len(indices), 3):
    remaining = [vertices[index] for index in indices[i : i + 3]]
    outside = []
    for axis, bound, sign in planes:
        part = clip(remaining, axis, bound, -sign)
        if part:
            outside.append(part)
        remaining = clip(remaining, axis, bound, sign)
        if not remaining:
            break
    for polygon in outside:
        for j in range(1, len(polygon) - 1):
            tri = [polygon[0], polygon[j], polygon[j + 1]]
            e1 = [tri[1][k] - tri[0][k] for k in range(3)]
            e2 = [tri[2][k] - tri[0][k] for k in range(3)]
            cross = [
                e1[1] * e2[2] - e1[2] * e2[1],
                e1[2] * e2[0] - e1[0] * e2[2],
                e1[0] * e2[1] - e1[1] * e2[0],
            ]
            if sum(v * v for v in cross) > 1e-12:
                triangles.extend(tri)
views = []
accessors = []
packed = bytearray()


def add(payload, target=None):
    packed.extend(b"\0" * ((-len(packed)) % 4))
    v = {"buffer": 0, "byteOffset": len(packed), "byteLength": len(payload)}
    if target:
        v["target"] = target
    views.append(v)
    packed.extend(payload)
    return len(views) - 1


for offset, count in [(0, 3), (3, 3), (6, 2)]:
    rows = [v[offset : offset + count] for v in triangles]
    if offset == 3:
        rows = [
            tuple(k / (math.sqrt(sum(x * x for x in v)) or 1) for k in v) for v in rows
        ]
    view = add(
        struct.pack("<" + "f" * (len(rows) * count), *(x for row in rows for x in row)),
        34962,
    )
    accessor = {
        "bufferView": view,
        "componentType": 5126,
        "count": len(rows),
        "type": "VEC3" if count == 3 else "VEC2",
    }
    if offset == 0:
        accessor.update(
            min=[min(row[k] for row in rows) for k in range(3)],
            max=[max(row[k] for row in rows) for k in range(3)],
        )
    accessors.append(accessor)
assert len(triangles) < 65535
view = add(struct.pack("<" + "H" * len(triangles), *range(len(triangles))), 34963)
accessors.append(
    {
        "bufferView": view,
        "componentType": 5123,
        "count": len(triangles),
        "type": "SCALAR",
    }
)
images = []
for image in doc.get("images", []):
    old = doc["bufferViews"][image["bufferView"]]
    start = old.get("byteOffset", 0)
    images.append(
        {
            "mimeType": image["mimeType"],
            "bufferView": add(binary[start : start + old["byteLength"]]),
        }
    )
result = {
    "asset": {
        "version": "2.0",
        "copyright": "Kay Lousberg / KayKit — CC0 1.0; doorway adaptation by NETCITY project",
        "extras": {"doorway": {"min": [-7, -0.1, -1.2], "max": [0, 2.7, 1.2]}},
    },
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [{"mesh": 0, "name": "OfficeFacade"}],
    "meshes": [
        {
            "primitives": [
                {
                    "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                    "indices": 3,
                    "material": p.get("material", 0),
                }
            ]
        }
    ],
    "materials": doc["materials"],
    "textures": doc["textures"],
    "samplers": doc["samplers"],
    "images": images,
    "accessors": accessors,
    "bufferViews": views,
    "buffers": [{"byteLength": len(packed)}],
}
text = json.dumps(result, separators=(",", ":")).encode()
text += b" " * ((-len(text)) % 4)
packed += b"\0" * ((-len(packed)) % 4)
output = (
    struct.pack("<III", 0x46546C67, 2, 28 + len(text) + len(packed))
    + struct.pack("<II", len(text), 0x4E4F534A)
    + text
    + struct.pack("<II", len(packed), 0x004E4942)
    + packed
)
file = root / "models/office_facade.glb"
file.write_bytes(output)
manifest = json.loads((root / "manifest.json").read_text())
manifest = [entry for entry in manifest if entry["file"] != file.name]
manifest.append(
    {
        "file": file.name,
        "author": "Kay Lousberg / KayKit",
        "license": "CC0-1.0",
        "source": next(v["source"] for v in manifest if v["file"] == source.name),
        "sourceSha256": hashlib.sha256(data).hexdigest(),
        "sha256": hashlib.sha256(output).hexdigest(),
        "bytes": len(output),
        "modification": "Baked scale/rotation and clipped a walkable office doorway while preserving source UVs, normals and materials",
    }
)
(root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Office facade:", len(triangles) // 3, "triangles,", len(output), "bytes")
