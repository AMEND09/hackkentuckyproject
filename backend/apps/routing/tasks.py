from celery import shared_task
from django.utils import timezone

from apps.routing.models import BackgroundJob, RoutePlan
from common.exceptions.errors import InfeasibleRouteError


@shared_task
def scan_construction_hazards_task(district_id=None):
    """Re-checks published routes against live ROW construction permits, alerting on new overlaps.

    No celery-beat schedule exists in this project yet, so this runs on
    demand (management command) or from wherever a deployment wires a
    schedule; CELERY_TASK_ALWAYS_EAGER in dev/test means calling it directly
    also works synchronously.
    """
    from apps.districts.models import District
    from apps.routing.services.hazard_watch import scan_published_routes

    district = District.objects.filter(id=district_id).first() if district_id else None
    return scan_published_routes(district=district)


@shared_task
def generate_route_plan_task(plan_id: str, job_id: str, vehicle_ids=None, driver_ids=None):
    job = BackgroundJob.objects.get(id=job_id)
    plan = RoutePlan.objects.get(id=plan_id)
    job.status = BackgroundJob.Status.RUNNING
    job.progress = 10
    job.message = "Building travel matrix"
    job.save()
    try:
        from apps.routing.services.optimizer import generate_plan

        job.progress = 40
        job.message = "Solving vehicle routing problem"
        job.save()
        generate_plan(plan, vehicle_ids=vehicle_ids, driver_ids=driver_ids)
        plan.refresh_from_db()
        job.status = BackgroundJob.Status.SUCCEEDED
        job.progress = 100
        job.message = "Route plan generated"
        job.result = {"plan_id": str(plan.id), "status": plan.status, "metrics": plan.aggregate_metrics}
        job.save()
    except InfeasibleRouteError as exc:
        plan.status = RoutePlan.Status.FAILED
        plan.infeasibility = getattr(exc, "details", {}) or {"reasons": [str(exc.detail)]}
        plan.save()
        job.status = BackgroundJob.Status.FAILED
        job.error = {"code": exc.default_code, "message": str(exc.detail), "details": plan.infeasibility}
        job.message = "Infeasible"
        job.save()
    except Exception as exc:
        plan.status = RoutePlan.Status.FAILED
        plan.save(update_fields=["status"])
        job.status = BackgroundJob.Status.FAILED
        job.error = {"code": "SOLVER_ERROR", "message": str(exc)}
        job.message = str(exc)
        job.save()
        raise
