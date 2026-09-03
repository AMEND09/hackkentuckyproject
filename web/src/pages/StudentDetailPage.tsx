import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { api } from "../api/client";
import { RouteMap } from "../components/maps/RouteMap";
import { LoadingBlock } from "../components/ui/LoadingBlock";

export function StudentDetailPage() {
  const { id } = useParams();
  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => (await api.get(`/students/${id}/`)).data,
  });
  if (!student) return <LoadingBlock rows={3} />;
  return (
    <div className="page-shell max-w-3xl">
      <Link to="/students" className="back-link">
        <ArrowLeft size={14} /> Students
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {student.first_name} {student.last_name}
          </h1>
          <p className="page-sub">
            {student.external_id} · grade {student.grade} · {student.school_name} · {student.eligibility}
            {student.requires_wheelchair ? " · wheelchair access" : ""}
          </p>
          <p className="text-sm text-slate mt-2 flex items-center gap-1">
            <MapPin size={14} /> {student.home_address}
          </p>
        </div>
      </div>

      <p className="badge-warn">Fictional roster record · Not a real student</p>

      <div className="card overflow-hidden">
        <RouteMap
          className="h-72 rounded-none border-0"
          points={[
            {
              id: student.id,
              lat: Number(student.latitude),
              lng: Number(student.longitude),
              label: "Home",
              color: "#2563EB",
              kind: "place",
            },
          ]}
        />
      </div>

      <Link className="btn-secondary inline-flex" to={`/schools/${student.school}`}>
        Open school
      </Link>
    </div>
  );
}
