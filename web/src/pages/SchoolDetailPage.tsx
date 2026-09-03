import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingBlock } from "../components/ui/LoadingBlock";

export function SchoolDetailPage() {
  const { id } = useParams();
  const { data: school } = useQuery({
    queryKey: ["school", id],
    queryFn: async () => (await api.get(`/schools/${id}/`)).data,
  });
  const { data: students } = useQuery({
    queryKey: ["students", "school", id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get("/students/", { params: { school: id, page_size: 100 } })).data,
  });
  if (!school) return <LoadingBlock rows={3} />;
  const rows = students?.results || [];
  return (
    <div className="page-shell">
      <Link to="/schools" className="back-link">
        <ArrowLeft size={14} /> Schools
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">{school.name}</h1>
          <p className="page-sub capitalize">
            {school.school_type} · bell {school.morning_bell_time} · dismissal {school.dismissal_time}
          </p>
          <p className="text-sm text-slate mt-1">{school.address}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <RouteMap
          className="h-80 rounded-none border-0"
          points={[
            { id: school.id, lat: Number(school.latitude), lng: Number(school.longitude), label: school.name, color: "#059669", kind: "place" },
            ...rows.map((s: { id: string; first_name: string; last_name: string; latitude: string; longitude: string }) => ({
              id: s.id,
              lat: Number(s.latitude),
              lng: Number(s.longitude),
              label: `${s.first_name} ${s.last_name}`,
              color: "#2563EB",
            })),
          ]}
        />
      </div>

      <p className="text-sm text-slate">{students?.count ?? rows.length} fictional students assigned to this school.</p>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Grade</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s: { id: string; first_name: string; last_name: string; grade: string; requires_wheelchair: boolean }) => (
              <tr key={s.id}>
                <td className="font-semibold">
                  <Link className="link" to={`/students/${s.id}`}>
                    {s.first_name} {s.last_name}
                  </Link>
                </td>
                <td>{s.grade}</td>
                <td>{s.requires_wheelchair ? <span className="badge-neutral">Wheelchair</span> : "Standard"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
