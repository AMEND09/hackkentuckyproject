import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { MapLine, MapPoint } from "../components/maps/RouteMap";
import type { ConstructionPermit, HighInjurySegment } from "../types";

/**
 * Vision Zero high-injury corridors + active ROW construction permits, scoped
 * to the bounding box of the given points. Backed by apps.geodata; see
 * backend/apps/geodata. Shared by PlannerPage, DispatchPage, TripDetailPage.
 */
export function useHazardLayers(
  points: { lat: number; lng: number }[],
  opts: { showCorridors: boolean; showConstruction: boolean },
) {
  const bbox = useMemo(() => {
    if (!points.length) return null;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const pad = 0.015;
    return [Math.min(...lats) - pad, Math.min(...lngs) - pad, Math.max(...lats) + pad, Math.max(...lngs) + pad].join(",");
  }, [points]);

  const { data: corridorData } = useQuery({
    queryKey: ["geodata", "high-injury-segments", bbox],
    enabled: Boolean(bbox) && opts.showCorridors,
    queryFn: async () => (await api.get("/geodata/high-injury-segments/", { params: { bbox, page_size: 200 } })).data,
  });

  const { data: constructionData } = useQuery({
    queryKey: ["geodata", "construction-permits"],
    enabled: Boolean(bbox) && opts.showConstruction,
    queryFn: async () => (await api.get("/geodata/construction-permits/", { params: { active: "true", page_size: 200 } })).data,
  });

  const hazardLines: MapLine[] = useMemo(() => {
    if (!opts.showCorridors) return [];
    return (corridorData?.results || []).map((seg: HighInjurySegment) => ({
      id: `hazard-hi-${seg.id}`,
      coords: seg.geometry,
      color: "#DC2626",
      width: 4,
      dashed: true,
    }));
  }, [corridorData, opts.showCorridors]);

  const hazardPoints: MapPoint[] = useMemo(() => {
    if (!opts.showConstruction || !bbox) return [];
    const [minLat, minLng, maxLat, maxLng] = bbox.split(",").map(Number);
    return (constructionData?.results || [])
      .filter(
        (p: ConstructionPermit) =>
          p.latitude >= minLat && p.latitude <= maxLat && p.longitude >= minLng && p.longitude <= maxLng,
      )
      .map((p: ConstructionPermit) => ({
        id: `hazard-con-${p.id}`,
        lat: p.latitude,
        lng: p.longitude,
        color: "#D97706",
        kind: "place" as const,
        label: `${p.work_type || "Construction"} — ${p.street_address}`,
      }));
  }, [constructionData, opts.showConstruction, bbox]);

  return { hazardLines, hazardPoints, bbox };
}
