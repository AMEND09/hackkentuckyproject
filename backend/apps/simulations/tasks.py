from celery import shared_task

from apps.simulations.models import StressTestRun
from apps.simulations.services import run_stress_test


@shared_task
def run_stress_test_task(run_id: str):
    run = StressTestRun.objects.get(id=run_id)
    run.status = StressTestRun.Status.RUNNING
    run.save(update_fields=["status"])
    try:
        results, interpretation = run_stress_test(run)
        run.results = results
        run.interpretation = interpretation
        run.status = StressTestRun.Status.SUCCEEDED
        run.save()
    except Exception as exc:
        run.status = StressTestRun.Status.FAILED
        run.results = {"error": str(exc)}
        run.save()
        raise
