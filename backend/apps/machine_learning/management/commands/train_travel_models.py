from django.core.management.base import BaseCommand

from apps.machine_learning.services.training import train_models


class Command(BaseCommand):
    help = "Train P50/P90 quantile models and a late-arrival classifier on synthetic data."

    def handle(self, *args, **options):
        result = train_models()
        self.stdout.write(self.style.SUCCESS(str(result["metrics"])))
