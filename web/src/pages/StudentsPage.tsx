import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api/client";
import { Pager } from "../components/Pager";
import { LoadingBlock } from "../components/ui/LoadingBlock";
import { PageHeader } from "../components/ui/PageHeader";

export function StudentsPage() {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["students", q, grade, page],
    queryFn: async () => (await api.get("/students/", { params: { search: q, grade: grade || undefined, page, page_size: 50 } })).data,
  });
  const rows = data?.results || [];
  return (
    <div className="page-shell">
      <PageHeader
        title="Students"
        subtitle="Fictional roster only. Never real student records. Click a name for the home location."
      />
      <div className="toolbar">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input !pl-10"
            placeholder="Search name or ID"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            aria-label="Search students"
          />
        </div>
        <input
          className="input w-28"
          placeholder="Grade"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setPage(1);
          }}
          aria-label="Filter grade"
        />
      </div>
      {isLoading ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Grade</th>
                <th>School</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s: { id: string; external_id: string; first_name: string; last_name: string; grade: string; school_name: string; requires_wheelchair: boolean }) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-slate">{s.external_id}</td>
                  <td className="font-semibold">
                    <Link className="link" to={`/app/students/${s.id}`}>
                      {s.first_name} {s.last_name}
                    </Link>
                  </td>
                  <td>{s.grade}</td>
                  <td className="text-slate">{s.school_name}</td>
                  <td>
                    {s.requires_wheelchair ? (
                      <span className="badge-neutral">Wheelchair</span>
                    ) : (
                      <span className="text-muted text-xs">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager count={data?.count} page={page} pageSize={50} onPage={setPage} />
    </div>
  );
}
