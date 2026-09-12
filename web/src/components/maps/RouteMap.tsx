import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { lerpAngleDegrees } from "../../utils/routePath";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  kind?: "stop" | "bus" | "place";
  heading?: number;
}

export interface MapLine {
  id: string;
  coords: [number, number][];
  color: string;
  width?: number;
  dashed?: boolean;
}

interface Props {
  points?: MapPoint[];
  lines?: MapLine[];
  className?: string;
  follow?: { lat: number; lng: number; heading?: number } | null;
  fit?: boolean;
  /** Camera ease duration in ms when not using smooth follow. */
  followDuration?: number;
  /** Lerp camera center + bearing each frame during live sim. */
  followSmooth?: boolean;
}

export function RouteMap({
  points = [],
  lines = [],
  className = "h-80",
  follow = null,
  fit = true,
  followDuration = 700,
  followSmooth = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const loadedRef = useRef(false);
  const busHeadingRef = useRef(0);
  const targetFollowRef = useRef(follow);
  const cameraLngRef = useRef<number | null>(null);
  const cameraLatRef = useRef<number | null>(null);
  const cameraBearingRef = useRef(0);
  const followAnimRef = useRef<number | null>(null);

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
              "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap · © CARTO",
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: [-85.7585, 38.2527],
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.on("load", () => {
      loadedRef.current = true;
    });
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawLines = () => {
      lines.forEach((line) => {
        const src = `line-${line.id}`;
        if (line.coords.length < 2) return;
        const data = {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: line.coords },
        };
        if (map.getSource(src)) {
          (map.getSource(src) as maplibregl.GeoJSONSource).setData(data);
        } else if (map.isStyleLoaded()) {
          map.addSource(src, { type: "geojson", data });
          map.addLayer({
            id: src,
            type: "line",
            source: src,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": line.color,
              "line-width": line.width ?? 5,
              "line-opacity": 0.92,
              ...(line.dashed ? { "line-dasharray": [1.2, 1.6] } : {}),
            },
          });
        }
      });
    };

    if (map.isStyleLoaded()) drawLines();
    else map.once("load", drawLines);
  }, [lines]);

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
      cameraLngRef.current = prevLng + (target.lng - prevLng) * 0.2;
      cameraLatRef.current = prevLat + (target.lat - prevLat) * 0.2;
      cameraBearingRef.current = lerpAngleDegrees(
        cameraBearingRef.current,
        target.heading ?? cameraBearingRef.current,
        0.1,
      );

      map.jumpTo({
        center: [cameraLngRef.current, cameraLatRef.current],
        zoom: Math.max(map.getZoom(), 14),
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
    const map = mapRef.current;
    if (!map) return;
    const keep = new Set(points.map((p) => p.id));
    markersRef.current.forEach((marker, id) => {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
    points.forEach((p) => {
      let marker = markersRef.current.get(p.id);
      if (!marker) {
        const el = document.createElement("div");
        if (p.kind === "bus") {
          el.className = "rw-bus-marker relative";
          el.innerHTML = `<div class="rw-bus-ring"></div><div class="rw-bus-chevron"></div>`;
        } else {
          el.style.width = p.kind === "place" ? "14px" : "12px";
          el.style.height = p.kind === "place" ? "14px" : "12px";
          el.style.borderRadius = "999px";
          el.style.background = p.color || "#1D4E89";
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 1px 4px rgba(11,31,58,0.35)";
        }
        el.title = p.label || "";
        marker = new maplibregl.Marker({ element: el, rotationAlignment: "map" }).setLngLat([p.lng, p.lat]).addTo(map);
        if (p.kind === "bus" && p.heading != null) {
          busHeadingRef.current = p.heading;
          marker.setRotation(p.heading);
        }
        markersRef.current.set(p.id, marker);
      } else {
        marker.setLngLat([p.lng, p.lat]);
        marker.getElement().title = p.label || "";
      }
      if (p.kind === "bus" && p.heading != null) {
        busHeadingRef.current = p.heading;
        marker.setRotation(p.heading);
      }
    });
    if (fit && !follow && points.length) {
      const b = new maplibregl.LngLatBounds();
      points.forEach((p) => b.extend([p.lng, p.lat]));
      if (!b.isEmpty()) map.fitBounds(b, { padding: 48, maxZoom: 13, duration: 400 });
    }
  }, [points, fit, follow, followSmooth]);

  useEffect(() => {
    if (followSmooth) return;
    const map = mapRef.current;
    if (!map || !follow) return;
    map.easeTo({
      center: [follow.lng, follow.lat],
      zoom: Math.max(map.getZoom(), 14),
      bearing: follow.heading ?? map.getBearing(),
      duration: followDuration,
      essential: true,
    });
  }, [follow, followDuration, followSmooth]);

  return <div ref={ref} className={`w-full rounded-2xl overflow-hidden border border-navy/[0.06] ${className}`} role="img" aria-label="Map of routes and stops" />;
}
