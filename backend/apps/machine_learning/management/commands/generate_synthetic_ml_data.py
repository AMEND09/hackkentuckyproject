from django.core.management.base import BaseCommand

from apps.machine_learning.services.training import write_synthetic_csv


class Command(BaseCommand):
    help = "Generate >=20k fictional travel-time segments with a fixed seed."

    def handle(self, *args, **options):
        path = write_synthetic_csv()
        self.stdout.write(self.style.SUCCESS(f"Wrote synthetic segments to {path}"))
