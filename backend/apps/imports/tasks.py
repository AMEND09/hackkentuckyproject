from celery import shared_task

from apps.imports.models import ImportJob
from apps.imports.services import commit_job, validate_job


@shared_task
def process_import_job(job_id: str, commit: bool = False):
    job = ImportJob.objects.get(id=job_id)
    validate_job(job)
    if commit:
        commit_job(job)
