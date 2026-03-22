import * as THREE from "three";
import {
  GraphData,
  SimNode,
  SimLink,
  NodeObj,
  LinkObj,
  Spherical,
} from "../types/graph";

export function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

export function buildLabelSprite(
  label: string,
  icon?: string,
): { sprite: THREE.Sprite; sprMat: THREE.SpriteMaterial } {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;

  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = 28;
  ctx.font = '600 64px "JetBrains Mono", monospace';
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = icon ? `${icon} ${label}` : label;
  ctx.fillText(text, 512, 80);
  ctx.shadowBlur = 14;
  ctx.fillText(text, 512, 80);
  ctx.shadowBlur = 0;
  ctx.fillText(text, 512, 80);

  const tex = new THREE.CanvasTexture(canvas);
  const sprMat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(sprMat);
  sprite.renderOrder = 999;
  return { sprite, sprMat };
}

export function initSimNodes(data: GraphData): SimNode[] {
  const phi = Math.PI * (3 - Math.sqrt(5));
  return data.nodes.map((n, i) => {
    const y = 1 - (i / Math.max(data.nodes.length - 1, 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    const R = 170;
    return {
      ...n,
      color: hexToInt(n.hex),
      x: n.x ?? Math.cos(theta) * r * R + (Math.random() - 0.5) * 50,
      y: n.y ?? y * R + (Math.random() - 0.5) * 50,
      z: n.z ?? Math.sin(theta) * r * R + (Math.random() - 0.5) * 50,
      vx: n.vx ?? 0,
      vy: n.vy ?? 0,
      vz: n.vz ?? 0,
      radius: n.category === "core" ? 10 : n.category === "example" ? 8 : 7,
    };
  });
}

export function buildLinksRaw(data: GraphData): { a: string; b: string }[] {
  const raw: { a: string; b: string }[] = [];
  data.nodes.forEach((n) => {
    (n.connections || []).forEach((cid) => {
      if (
        !raw.find(
          (l) => (l.a === n.id && l.b === cid) || (l.a === cid && l.b === n.id),
        )
      ) {
        raw.push({ a: n.id, b: cid });
      }
    });
  });
  return raw;
}

export function buildSceneObjects(
  scene: THREE.Scene,
  simNodes: SimNode[],
  simLinks: SimLink[],
): { nodeObjs: NodeObj[]; linkObjs: LinkObj[] } {
  // If no true override passed later, just check session storage directly inside graphBuilder
  const showIcons = sessionStorage.getItem("showNodeIcons") !== "false";
  const nodeObjs: NodeObj[] = [];
  const linkObjs: LinkObj[] = [];

  simNodes.forEach((n) => {
    const geo = new THREE.SphereGeometry(n.radius, 32, 32);
    const mat = new THREE.MeshPhongMaterial({
      color: n.color,
      emissive: n.color,
      emissiveIntensity: 0.5,
      shininess: 90,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(n.x, n.y, n.z);
    mesh.userData.nodeId = n.id;
    scene.add(mesh);

    // Inner bright core
    const coreGeo = new THREE.SphereGeometry(n.radius * 0.45, 16, 16);
    mesh.add(
      new THREE.Mesh(
        coreGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      ),
    );

    // Outer glow shell
    const glowGeo = new THREE.SphereGeometry(n.radius * 3, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: n.color,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
    });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));

    // Label sprite (scene-level, not mesh child — so we can scale by distance)
    const { sprite, sprMat } = buildLabelSprite(
      n.label,
      showIcons ? n.icon : undefined,
    );
    scene.add(sprite);
    n._sprite = sprite;
    n._sprMat = sprMat;

    nodeObjs.push({ mesh, mat, glowMat, sprMat, node: n });
  });

  simLinks.forEach((l) => {
    const pts = [
      new THREE.Vector3(l.source.x, l.source.y, l.source.z),
      new THREE.Vector3(l.target.x, l.target.y, l.target.z),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const color = new THREE.Color(l.source.hex).lerp(
      new THREE.Color(l.target.hex),
      0.5,
    );

    // Regular material
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      fog: false,
    });

    // Dashed material for Highlight Mode pathing
    const dashedMat = new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      dashSize: 4,
      gapSize: 4,
      fog: false, // ← add this
    });

    const line = new THREE.Line(geo, mat);
    line.computeLineDistances(); // For dashed lines

    // Path arrow
    const arrowGeo = new THREE.ConeGeometry(5, 12, 12);
    // Rotate geometry once so that it points along the Z axis (Three.js Cone points along +Y initially)
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      visible: false,
    });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    scene.add(arrowMesh);

    scene.add(line);
    linkObjs.push({
      line,
      mat,
      dashedMat,
      source: l.source,
      target: l.target,
      arrowMesh,
    });
  });

  return { nodeObjs, linkObjs };
}

export function clearSceneObjects(
  scene: THREE.Scene,
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[],
) {
  nodeObjs.forEach((o) => {
    scene.remove(o.mesh);
    o.mesh.geometry.dispose();
    if (o.node._sprite) {
      scene.remove(o.node._sprite);
      o.node._sprite.material.dispose();
    }
  });
  linkObjs.forEach((o) => {
    scene.remove(o.line);
    o.line.geometry.dispose();
    if (o.arrowMesh) {
      scene.remove(o.arrowMesh);
      o.arrowMesh.geometry.dispose();
      (o.arrowMesh.material as THREE.Material).dispose();
    }
  });
}

export function runPhysics(
  simNodes: SimNode[],
  simLinks: SimLink[],
  tick: number,
  draggedNodeId?: string,
  spreadMult = 1.0, // ← add this
): number {
  const alpha = Math.max(0.012, 0.38 * Math.exp(-tick * 0.08)); // Faster alpha decay: 0.005 -> 0.08

  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i],
        b = simNodes[j];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = ((8000 * spreadMult) / (d * d)) * alpha; // ← multiply repulsion
      a.vx -= (dx / d) * f;
      a.vy -= (dy / d) * f;
      a.vz -= (dz / d) * f;
      b.vx += (dx / d) * f;
      b.vy += (dy / d) * f;
      b.vz += (dz / d) * f;
    }
  }

  simLinks.forEach((l) => {
    const dx = l.target.x - l.source.x,
      dy = l.target.y - l.source.y,
      dz = l.target.z - l.source.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const restLength = 155 * spreadMult; // ← multiply rest length too
    const f = (d - restLength) * 0.032 * alpha;
    l.source.vx += (dx / d) * f;
    l.source.vy += (dy / d) * f;
    l.source.vz += (dz / d) * f;
    l.target.vx -= (dx / d) * f;
    l.target.vy -= (dy / d) * f;
    l.target.vz -= (dz / d) * f;
  });

  // Repulsion
  for (let i = 0; i < simNodes.length; i++) {
    for (let j = i + 1; j < simNodes.length; j++) {
      const a = simNodes[i],
        b = simNodes[j];
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const f = (8000 / (d * d)) * alpha;
      a.vx -= (dx / d) * f;
      a.vy -= (dy / d) * f;
      a.vz -= (dz / d) * f;
      b.vx += (dx / d) * f;
      b.vy += (dy / d) * f;
      b.vz += (dz / d) * f;
    }
  }

  // Link attraction
  simLinks.forEach((l) => {
    const dx = l.target.x - l.source.x,
      dy = l.target.y - l.source.y,
      dz = l.target.z - l.source.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const f = (d - 155) * 0.032 * alpha;
    l.source.vx += (dx / d) * f;
    l.source.vy += (dy / d) * f;
    l.source.vz += (dz / d) * f;
    l.target.vx -= (dx / d) * f;
    l.target.vy -= (dy / d) * f;
    l.target.vz -= (dz / d) * f;
  });

  // Center gravity + integrate
  let maxV2 = 0;
  simNodes.forEach((n) => {
    n.vx -= n.x * 0.006 * alpha;
    n.vy -= n.y * 0.006 * alpha;
    n.vz -= n.z * 0.006 * alpha;
    if (draggedNodeId && n.id === draggedNodeId) return;

    // Velocity decay: 0.82 -> 0.4 (1 - 0.6)
    n.vx *= 0.4;
    n.vy *= 0.4;
    n.vz *= 0.4;

    const v2 = n.vx * n.vx + n.vy * n.vy + n.vz * n.vz;
    if (v2 > maxV2) maxV2 = v2;

    n.x += n.vx;
    n.y += n.vy;
    n.z += n.vz;
  });

  return Math.sqrt(maxV2);
}

export function syncPositions(
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[],
  spherical: Spherical,
  labelMult = 1,
  highlightPath: string[] = [],
  isPathMode = false,
) {
  const labelScale = spherical.radius * 0.13 * labelMult;

  nodeObjs.forEach((o) => {
    o.mesh.position.set(o.node.x, o.node.y, o.node.z);
    if (o.node._sprite) {
      o.node._sprite.position.set(
        o.node.x,
        o.node.y + o.node.radius + labelScale * 0.22,
        o.node.z,
      );
      o.node._sprite.scale.set(labelScale * 1.4, labelScale * 0.35, 1);
    }
  });

  linkObjs.forEach((lo) => {
    const pos = lo.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, lo.source.x, lo.source.y, lo.source.z);

    // Grow edge from source to target if animating
    if (lo.animProgress !== undefined && lo.animProgress < 1) {
      const p = lo.animProgress;
      const tx = lo.source.x + (lo.target.x - lo.source.x) * p;
      const ty = lo.source.y + (lo.target.y - lo.source.y) * p;
      const tz = lo.source.z + (lo.target.z - lo.source.z) * p;
      pos.setXYZ(1, tx, ty, tz);
      // also lerp opacity
      lo.mat.opacity = 0.75 * p;
    } else {
      pos.setXYZ(1, lo.target.x, lo.target.y, lo.target.z);
    }

    pos.needsUpdate = true;

    // Update arrows
    if (lo.arrowMesh) {
      const isPrimary =
        isPathMode &&
        highlightPath.length > 0 &&
        isPrimaryPathEdge(lo.source.id, lo.target.id, highlightPath);

      if (isPrimary) {
        const dir = getPrimaryPathDirection(lo.source.id, lo.target.id, highlightPath);
        if (dir) {
          const from = dir.fromId === lo.source.id ? lo.source : lo.target;
          const to = dir.toId === lo.source.id ? lo.source : lo.target;

          const toVec = new THREE.Vector3(to.x, to.y, to.z);
          const fromVec = new THREE.Vector3(from.x, from.y, from.z);
          const edgeVec = new THREE.Vector3().subVectors(toVec, fromVec);
          const length = edgeVec.length();
          const unitEdge = edgeVec.clone().normalize();

          // Position arrow slightly offset from the target node surface
          const offset = to.radius + 6;
          const arrowPos = toVec.clone().sub(unitEdge.clone().multiplyScalar(offset));

          lo.arrowMesh.position.copy(arrowPos);
          lo.arrowMesh.lookAt(toVec);
          lo.arrowMesh.visible = true;
          (lo.arrowMesh.material as THREE.MeshBasicMaterial).opacity = 1;
        }
      } else {
        lo.arrowMesh.visible = false;
        (lo.arrowMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });
}

export function setHoveredNode(
  hit: NodeObj | LinkObj | null,
  hovObj: NodeObj | LinkObj | null,
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[],
): NodeObj | LinkObj | null {
  if (hit === hovObj) return hovObj;

  nodeObjs.forEach((o) => {
    const spr = o.node._sprMat;
    if (!hit) {
      o.mat.emissiveIntensity = 0.5;
      o.mat.opacity = 0.95;
      o.glowMat.opacity = 0.055;
      if (spr) spr.opacity = 1;
    } else if ("node" in hit) {
      const isSelf = o.node.id === hit.node.id;
      const isConn =
        hit.node.connections.includes(o.node.id) ||
        o.node.connections.includes(hit.node.id);
      o.mat.emissiveIntensity = isSelf ? 1.4 : isConn ? 0.7 : 0.2;
      o.mat.opacity = isSelf ? 1 : isConn ? 0.95 : 0.18;
      o.glowMat.opacity = isSelf ? 0.25 : isConn ? 0.1 : 0.01;
      if (spr) spr.opacity = isSelf ? 1 : isConn ? 0.9 : 0.2;
    } else {
      // It's a LinkObj
      const isSelf = o.node.id === hit.source.id || o.node.id === hit.target.id;
      o.mat.emissiveIntensity = isSelf ? 1.2 : 0.2;
      o.mat.opacity = isSelf ? 1 : 0.18;
      o.glowMat.opacity = isSelf ? 0.2 : 0.01;
      if (spr) spr.opacity = isSelf ? 1 : 0.2;
    }
  });

  linkObjs.forEach((lo) => {
    if (!hit) {
      lo.mat.opacity = 0.75;
    } else if ("node" in hit) {
      const conn = lo.source.id === hit.node.id || lo.target.id === hit.node.id;
      lo.mat.opacity = conn ? 1 : 0.06;
    } else {
      // It's a LinkObj
      const isSelf = lo === hit;
      lo.mat.opacity = isSelf ? 1 : 0.06;
    }
  });

  return hit;
}

/** Check if edge (source,target) is consecutive in path (primary path) */
function isPrimaryPathEdge(
  sourceId: string,
  targetId: string,
  path: string[],
): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (
      (a === sourceId && b === targetId) ||
      (a === targetId && b === sourceId)
    ) {
      return true;
    }
  }
  return false;
}

function getPrimaryPathDirection(
  sourceId: string,
  targetId: string,
  path: string[],
): { fromId: string; toId: string } | null {
  for (let i = 0; i < path.length - 1; i++) {
    const fromId = path[i];
    const toId = path[i + 1];
    if (
      (fromId === sourceId && toId === targetId) ||
      (fromId === targetId && toId === sourceId)
    ) {
      return { fromId, toId };
    }
  }
  return null;
}

export function setHighlighted(
  highlightedIds: Set<string>,
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[],
  highlightPath: string[] = [],
  isPathHideMode: boolean = false
) {
  const isAnyHighlighted = highlightedIds.size > 0;

  nodeObjs.forEach((o) => {
    const spr = o.node._sprMat;
    if (!isAnyHighlighted) {
      o.mat.emissiveIntensity = 0.5;
      o.mat.opacity = 0.95;
      o.glowMat.opacity = 0.055;
      if (spr) spr.opacity = 1;
      return;
    }

    const isHov = highlightedIds.has(o.node.id);
    const isConn = Array.from(highlightedIds).some((hid) =>
      o.node.connections.includes(hid),
    );

    const bgEmissive = isPathHideMode ? 0.0 : 0.15;
    const bgOpacity = isPathHideMode ? 0.0 : 0.12;
    const bgGlowOpacity = isPathHideMode ? 0.0 : 0.005;
    const bgSprOpacity = isPathHideMode ? 0.0 : 0.15;

    o.mat.emissiveIntensity = isHov ? 1.4 : isConn ? 0.8 : bgEmissive;
    o.mat.opacity = isHov ? 1 : isConn ? 0.85 : bgOpacity;
    o.glowMat.opacity = isHov ? 0.28 : isConn ? 0.081 : bgGlowOpacity;
    if (spr) spr.opacity = isHov ? 1 : isConn ? 0.8 : bgSprOpacity;
  });

  linkObjs.forEach((lo) => {
    if (!isAnyHighlighted) {
      lo.line.material = lo.mat;
      lo.mat.opacity = 0.75;
      return;
    }

    const sH = highlightedIds.has(lo.source.id);
    const tH = highlightedIds.has(lo.target.id);

    if (sH && tH) {
      const isPrimary = isPrimaryPathEdge(
        lo.source.id,
        lo.target.id,
        highlightPath,
      );
      if (isPrimary) {
        lo.line.material = lo.mat;
        lo.mat.opacity = 1;
      } else {
        if (lo.dashedMat) {
          lo.line.material = lo.dashedMat;
          lo.dashedMat.opacity = 0.7;
        }
      }
    } else if (sH || tH) {
      // Connection to highlighted node -> dotted
      if (lo.dashedMat) {
        lo.line.material = lo.dashedMat;
        lo.dashedMat.opacity = 0.7;
      }
    } else {
      lo.line.material = lo.mat;
      lo.mat.opacity = isPathHideMode ? 0.0 : 0.04;
    }
  });
}

export function setHighlightedWithHover(
  highlightedIds: Set<string>,
  highlightPath: string[],
  hoverHit: NodeObj | LinkObj | null,
  hovObj: NodeObj | LinkObj | null,
  nodeObjs: NodeObj[],
  linkObjs: LinkObj[],
  isPathHideMode: boolean = false
): NodeObj | LinkObj | null {
  if (highlightedIds.size === 0) {
    return setHoveredNode(hoverHit, hovObj, nodeObjs, linkObjs);
  }

  // Apply path highlight as base, overlay hover emphasis
  nodeObjs.forEach((o) => {
    const spr = o.node._sprMat;
    const isHov = highlightedIds.has(o.node.id);
    const isConn = Array.from(highlightedIds).some((hid) =>
      o.node.connections.includes(hid),
    );

    const bgEmissive = isPathHideMode ? 0.0 : 0.15;
    const bgOpacity = isPathHideMode ? 0.0 : 0.12;
    const bgGlowOpacity = isPathHideMode ? 0.0 : 0.005;
    const bgSprOpacity = isPathHideMode ? 0.0 : 0.15;

    let emissive = isHov ? 1.4 : isConn ? 0.8 : bgEmissive;
    let opacity = isHov ? 1 : isConn ? 0.85 : bgOpacity;
    let glowOpacity = isHov ? 0.28 : isConn ? 0.081 : bgGlowOpacity;
    let sprOpacity = isHov ? 1 : isConn ? 0.8 : bgSprOpacity;

    if (hoverHit && "node" in hoverHit) {
      const isHoverSelf = o.node.id === hoverHit.node.id;
      const isHoverConn =
        hoverHit.node.connections.includes(o.node.id) ||
        o.node.connections.includes(hoverHit.node.id);
      if (isHoverSelf) {
        emissive = 1.4;
        opacity = 1;
        glowOpacity = 0.25;
        if (spr) sprOpacity = 1;
      } else if (isHoverConn) {
        emissive = Math.max(emissive, 0.85);
        opacity = Math.max(opacity, 0.92);
        glowOpacity = Math.max(glowOpacity, 0.1);
        if (spr) sprOpacity = Math.max(sprOpacity, 0.9);
      }
    } else if (hoverHit && "source" in hoverHit) {
      const isHoverEndpoint =
        o.node.id === hoverHit.source.id || o.node.id === hoverHit.target.id;
      if (isHoverEndpoint) {
        emissive = Math.max(emissive, 1.2);
        opacity = Math.max(opacity, 1);
        glowOpacity = Math.max(glowOpacity, 0.2);
        if (spr) sprOpacity = 1;
      }
    }

    o.mat.emissiveIntensity = emissive;
    o.mat.opacity = opacity;
    o.glowMat.opacity = glowOpacity;
    if (spr) spr.opacity = sprOpacity;
  });

  linkObjs.forEach((lo) => {
    const sH = highlightedIds.has(lo.source.id);
    const tH = highlightedIds.has(lo.target.id);
    const isPrimary =
      sH && tH && isPrimaryPathEdge(lo.source.id, lo.target.id, highlightPath);

    if (sH && tH) {
      if (isPrimary) {
        lo.line.material = lo.mat;
        lo.mat.opacity = 1;
      } else if (lo.dashedMat) {
        lo.line.material = lo.dashedMat;
        lo.dashedMat.opacity = 0.7;
      }
    } else if (sH || tH) {
      if (lo.dashedMat) {
        lo.line.material = lo.dashedMat;
        lo.dashedMat.opacity = 0.7;
      }
    } else {
      lo.line.material = lo.mat;
      lo.mat.opacity = isPathHideMode ? 0.0 : 0.04;
    }

    if (hoverHit && "source" in hoverHit) {
      const isHoveredLink = lo === hoverHit;
      if (isHoveredLink) {
        lo.line.material = lo.mat;
        lo.mat.opacity = 1;
      }
    } else if (hoverHit && "node" in hoverHit) {
      const connToHover =
        lo.source.id === hoverHit.node.id || lo.target.id === hoverHit.node.id;
      if (connToHover && lo.dashedMat) {
        lo.line.material = lo.dashedMat;
        lo.dashedMat.opacity = 0.85;
      }
    }
  });

  return hoverHit;
}

export function applyCam(
  camera: THREE.PerspectiveCamera,
  spherical: Spherical,
  panOffset: THREE.Vector3,
) {
  const { theta, phi, radius } = spherical;
  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);
  camera.position.set(x + panOffset.x, y + panOffset.y, z + panOffset.z);
  camera.lookAt(panOffset.x, panOffset.y, panOffset.z);
}
