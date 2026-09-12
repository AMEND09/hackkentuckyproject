from django.core.management.base import BaseCommand

from apps.routing.services.hazard_watch import scan_published_routes


class Command(BaseCommand):
    help = (
        "Re-check published routes against live Louisville ROW construction permits and raise "
        "dispatcher alerts for anything new. Run on a cron/celery-beat schedule in a real deployment; "
        "safe to run repeatedly (idempotent — only new permits trigger an alert)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--district", default=None, help="District slug to scope the scan to.")

    def handle(self, *args, **options):
        district = None
        if options["district"]:
            from apps.districts.models import District

            district = District.objects.get(slug=options["district"])
        created = scan_published_routes(district=district)
        if not created:
            self.stdout.write(self.style.SUCCESS("No new construction hazards on published routes."))
            return
        for c in created:
            self.stdout.write(f"{c['route_code']}: {len(c['new_hits'])} new hazard(s) — alert {c['alert_id']}")
        self.stdout.write(self.style.SUCCESS(f"Raised {len(created)} alert(s)."))
