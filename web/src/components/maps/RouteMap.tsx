import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { interpolateAlong, lerpAngleDegrees, type RouteCoord } from "../../utils/routePath";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  kind?: "stop" | "bus" | "place";
  heading?: number;
  selected?: boolean;
  /** When set, the bus is constrained to this polyline (never leaves the route). */
  path?: RouteCoord[];
  /** 0–1 distance along `path`. Preferred over free lat/lng for buses. */
  progress?: number;
}

export interface MapLine {
  id: string;
  coords: [number, number][];
  color: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}

interface Props {
  points?: MapPoint[];
  lines?: MapLine[];
  className?: string;
  follow?: { lat: number; lng: number; heading?: number } | null;
  fit?: boolean;
  followDuration?: number;
  followSmooth?: boolean;
  smoothMarkers?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Bump to force map.resize() (e.g. after entering fullscreen). */
  resizeKey?: string | number;
}

type MarkerState = {
  lng: number;
  lat: number;
  heading: number;
  targetLng: number;
  targetLat: number;
  targetHeading: number;
  progress: number;
  targetProgress: number;
  path: RouteCoord[] | null;
  color: string;
  label: string;
  kind: MapPoint["kind"];
  selected: boolean;
};

function placeOnPath(path: RouteCoord[], progress: number) {
  return interpolateAlong(path, Math.min(1, Math.max(0, progress)));
}

export function RouteMap({
  points = [],
  lines = [],
  className = "h-80",
  follow = null,
  fit = true,
  followDuration = 700,
  followSmooth = false,
  smoothMarkers = true,
  selectedId = null,
  onSelect,
  resizeKey,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const stateRef = useRef<Map<string, MarkerState>>(new Map());
  const fittedRef = useRef(false);
  const targetFollowRef = useRef(follow);
  const cameraLngRef = useRef<number | null>(null);
  const cameraLatRef = useRef<number | null>(null);
  const cameraBearingRef = useRef(0);
  const followAnimRef = useRef<number | null>(null);
  const markerAnimRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          "fleet-routes": {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          },
        },
        layers: [
          { id: "basemap", type: "raster", source: "basemap" },
          {
            id: "fleet-routes-glow",
            type: "line",
            source: "fleet-routes",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": ["+", ["get", "width"], 4],
              "line-opacity": ["*", ["get", "opacity"], 0.28],
            },
          },
          {
            id: "fleet-routes-line",
            type: "line",
            source: "fleet-routes",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": ["get", "width"],
              "line-opacity": ["get", "opacity"],
            },
          },
        ],
      },
      center: [-85.7585, 38.2527],
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("click", () => onSelectRef.current?.(null));
    mapRef.current = map;
    return () => {
      if (markerAnimRef.current != null) cancelAnimationFrame(markerAnimRef.current);
      if (followAnimRef.current != null) cancelAnimationFrame(followAnimRef.current);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      stateRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.resize(), 60);
    return () => window.clearTimeout(id);
  }, [resizeKey, className]);

  // Draw / update route lines as one FeatureCollection (always visible + colored).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource("fleet-routes") as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      const features = lines
        .filter((line) => line.coords.length >= 2)
        .map((line) => ({
          type: "Feature" as const,
          properties: {
            id: line.id,
            color: line.color,
            width: line.width ?? 5.5,
            opacity: line.opacity ?? 0.92,
          },
          geometry: { type: "LineString" as const, coordinates: line.coords },
        }));

      source.setData({ type: "FeatureCollection", features });

      if (fit && !follow && !fittedRef.current && features.length) {
        const b = new maplibregl.LngLatBounds();
        features.forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c as [number, number])));
        if (!b.isEmpty()) {
          map.fitBounds(b, { padding: 64, maxZoom: 12.8, duration: 650 });
          fittedRef.current = true;
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [lines, fit, follow]);

  // Sync marker targets from props
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const keep = new Set(points.map((p) => p.id));

    markersRef.current.forEach((marker, id) => {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        stateRef.current.delete(id);
      }
    });

    points.forEach((p) => {
      const color = p.color || "#2563EB";
      const path = p.path && p.path.length >= 2 ? p.path : null;
      const progress = p.progress ?? 0;
      let lng = p.lng;
      let lat = p.lat;
      let heading = p.heading ?? 0;
      if (path) {
        const placed = placeOnPath(path, progress);
        lng = placed.lng;
        lat = placed.lat;
        heading = placed.heading;
      }

      const existing = stateRef.current.get(p.id);
      if (existing) {
        existing.targetLng = lng;
        existing.targetLat = lat;
        existing.targetHeading = heading;
        existing.targetProgress = progress;
        existing.path = path;
        existing.color = color;
        existing.label = p.label || "";
        existing.kind = p.kind;
        existing.selected = Boolean(p.selected) || p.id === selectedId;
        if (!smoothMarkers || p.kind !== "bus") {
          existing.lng = lng;
          existing.lat = lat;
          existing.heading = heading;
          existing.progress = progress;
        }
      } else {
        stateRef.current.set(p.id, {
          lng,
          lat,
          heading,
          targetLng: lng,
          targetLat: lat,
          targetHeading: heading,
          progress,
          targetProgress: progress,
          path,
          color,
          label: p.label || "",
          kind: p.kind,
          selected: Boolean(p.selected) || p.id === selectedId,
        });
      }

      let marker = markersRef.current.get(p.id);
      if (!marker) {
        const el = document.createElement("div");
        if (p.kind === "bus") {
          el.className = "rw-bus-marker";
          el.innerHTML = `<div class="rw-bus-ring"></div><div class="rw-bus-chevron"></div><span class="rw-bus-label"></span>`;
          el.style.setProperty("--bus-color", color);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            onSelectRef.current?.(p.id === selectedIdRef.current ? null : p.id);
          });
        } else {
          el.style.width = p.kind === "place" ? "14px" : "11px";
          el.style.height = p.kind === "place" ? "14px" : "11px";
          el.style.borderRadius = "999px";
          el.style.background = color;
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 1px 4px rgba(11,31,58,0.35)";
        }
        el.title = p.label || "";
        marker = new maplibregl.Marker({ element: el, rotationAlignment: "map" })
          .setLngLat([lng, lat])
          .addTo(map);
        if (p.kind === "bus") marker.setRotation(heading);
        markersRef.current.set(p.id, marker);
      }
    });

    stateRef.current.forEach((st, id) => {
      const marker = markersRef.current.get(id);
      if (!marker) return;
      marker.setLngLat([st.lng, st.lat]);
      const el = marker.getElement();
      el.title = st.label;
      if (st.kind === "bus") {
        el.style.setProperty("--bus-color", st.color);
        el.classList.toggle("is-selected", st.selected);
        const label = el.querySelector(".rw-bus-label");
        if (label) label.textContent = st.label;
        marker.setRotation(st.heading);
      }
    });
  }, [points, selectedId, smoothMarkers]);

  // Smooth along-path animation (progress lerp → always on polyline)
  useEffect(() => {
    if (!smoothMarkers) return;
    const tick = () => {
      stateRef.current.forEach((st, id) => {
        if (st.kind !== "bus") return;
        if (st.path && st.path.length >= 2) {
          st.progress += (st.targetProgress - st.progress) * 0.14;
          const placed = placeOnPath(st.path, st.progress);
          st.lng = placed.lng;
          st.lat = placed.lat;
          st.heading = lerpAngleDegrees(st.heading, placed.heading, 0.2);
        } else {
          st.lng += (st.targetLng - st.lng) * 0.12;
          st.lat += (st.targetLat - st.lat) * 0.12;
          st.heading = lerpAngleDegrees(st.heading, st.targetHeading, 0.14);
        }
        const marker = markersRef.current.get(id);
        if (!marker) return;
        marker.setLngLat([st.lng, st.lat]);
        marker.setRotation(st.heading);
        const el = marker.getElement();
        el.style.setProperty("--bus-color", st.color);
        el.classList.toggle("is-selected", st.selected || id === selectedIdRef.current);
      });
      markerAnimRef.current = requestAnimationFrame(tick);
    };
    markerAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (markerAnimRef.current != null) cancelAnimationFrame(markerAnimRef.current);
    };
  }, [smoothMarkers]);

  useEffect(() => {
    targetFollowRef.current = follow;
  }, [follow]);

  useEffect(() => {
    if (!followSmooth) return;

    const frame = () => {
      const map = mapRef.current;
      const target = targetFollowRef.current;
      if (!map || !target) {
        followAnimRef.current = requestAnimationFrame(frame);
        return;
      }

      const prevLng = cameraLngRef.current ?? target.lng;
      const prevLat = cameraLatRef.current ?? target.lat;
      cameraLngRef.current = prevLng + (target.lng - prevLng) * 0.14;
      cameraLatRef.current = prevLat + (target.lat - prevLat) * 0.14;
      cameraBearingRef.current = lerpAngleDegrees(
        cameraBearingRef.current,
        target.heading ?? cameraBearingRef.current,
        0.08,
      );

      map.jumpTo({
        center: [cameraLngRef.current, cameraLatRef.current],
        zoom: Math.max(map.getZoom(), 13.6),
        bearing: cameraBearingRef.current,
      });

      followAnimRef.current = requestAnimationFrame(frame);
    };

    followAnimRef.current = requestAnimationFrame(frame);
    return () => {
      if (followAnimRef.current != null) cancelAnimationFrame(followAnimRef.current);
      cameraLngRef.current = null;
      cameraLatRef.current = null;
    };
  }, [followSmooth]);

  useEffect(() => {
    if (followSmooth) return;
    const map = mapRef.current;
    if (!map || !follow) return;
    map.easeTo({
      center: [follow.lng, follow.lat],
      zoom: Math.max(map.getZoom(), 13.6),
      bearing: follow.heading ?? map.getBearing(),
      duration: followDuration,
      essential: true,
    });
  }, [follow, followDuration, followSmooth]);

  useEffect(() => {
    if (!selectedId || followSmooth) return;
    const st = stateRef.current.get(selectedId);
    const map = mapRef.current;
    if (!st || !map) return;
    map.easeTo({
      center: [st.targetLng, st.targetLat],
      zoom: Math.max(map.getZoom(), 13.2),
      duration: 700,
      essential: true,
    });
  }, [selectedId, followSmooth]);

  return (
    <div
      ref={ref}
      className={`w-full overflow-hidden ${className}`}
      role="img"
      aria-label="Map of routes and stops"
    />
  );
}
